// Copyright (C) 2026 hj6hki123
// SPDX-License-Identifier: GPL-3.0-or-later

package gui

import (
	"context"
	"net/http"
	"time"

	"github.com/kvarenzn/ssm/common"
	"github.com/kvarenzn/ssm/controllers"
)

// Playback flow: POST /api/run → Backend.Run prepares the song and calls
// SetReady → POST /api/start → the backend's WaitForStart returns and it calls
// Autoplay. A song that plays to the end is re-armed so Start replays it.

// preparedSong is the song armed for playback and the channels controlling it.
type preparedSong struct {
	controller controllers.Controller
	events     []common.ViscousEventItem
	start      chan struct{} // receives when Start is pressed
	stop       chan struct{} // closed to interrupt the song
	offset     chan int      // live offset changes, ms
}

func newPreparedSong(ctrl controllers.Controller, events []common.ViscousEventItem) *preparedSong {
	return &preparedSong{
		controller: ctrl,
		events:     events,
		start:      make(chan struct{}, 1),
		stop:       make(chan struct{}),
		offset:     make(chan int, 32),
	}
}

func (p *preparedSong) interrupt() {
	select {
	case <-p.stop:
	default:
		close(p.stop)
	}
}

// touchResetter is implemented by backends that can lift every pointer (the
// adb backend), so a stopped song never leaves a finger held down.
type touchResetter interface {
	ResetTouch()
}

func resetTouch(ctrl controllers.Controller) {
	if r, ok := ctrl.(touchResetter); ok {
		r.ResetTouch()
	}
}

// ─── Reported by the backend ─────────────────────────────────

// SetReady arms a prepared song, replacing (and interrupting) the previous one.
func (s *Server) SetReady(ctrl controllers.Controller, events []common.ViscousEventItem, np NowPlaying) {
	s.mu.Lock()
	s.song.interrupt()
	s.song = newPreparedSong(ctrl, events)
	s.mu.Unlock()

	resetTouch(ctrl)

	s.updateStatus(func(st *Status) {
		st.State = StateReady
		st.Offset = 0
		st.Error = ""
		st.NowPlaying = np
	})
}

func (s *Server) SetError(msg string) {
	s.updateStatus(func(st *Status) {
		st.State = StateError
		st.Error = msg
	})
}

// SetGreatStats reports how many Great taps were requested and applied.
func (s *Server) SetGreatStats(requested, applied int64) {
	s.updateStatus(func(st *Status) {
		st.GreatReq = max(requested, 0)
		st.GreatApply = max(applied, 0)
	})
}

// WaitForStart blocks until Start is pressed and reports whether playback
// should begin (false if the song was replaced or ctx was cancelled).
func (s *Server) WaitForStart(ctx context.Context) bool {
	s.mu.Lock()
	song := s.song
	s.mu.Unlock()

	select {
	case <-song.start:
		if ctx.Err() != nil {
			return false
		}
		s.updateStatus(func(st *Status) { st.State = StatePlaying })
		return true
	case <-ctx.Done():
		return false
	case <-song.stop:
		return false
	}
}

// Autoplay plays the armed song. The first event is due at start; offset
// changes shift the rest of the song.
func (s *Server) Autoplay(ctx context.Context, start time.Time) {
	s.mu.Lock()
	song := s.song
	s.mu.Unlock()

	playEvents(ctx, song, start)
	resetTouch(song.controller)
	s.finish()
}

func playEvents(ctx context.Context, song *preparedSong, start time.Time) {
	for i := 0; i < len(song.events); {
		select {
		case <-song.stop:
			return
		case <-ctx.Done():
			return
		default:
		}
		select {
		case delta := <-song.offset:
			start = start.Add(time.Duration(-delta) * time.Millisecond)
		default:
		}

		event := song.events[i]
		remaining := event.Timestamp - time.Since(start).Milliseconds()
		switch {
		case remaining <= 0:
			song.controller.Send(event.Data)
			i++
		case remaining > 10:
			// Sleep until shortly before the event, staying interruptible.
			select {
			case <-song.stop:
				return
			case <-ctx.Done():
				return
			case <-time.After(time.Duration(remaining-5) * time.Millisecond):
			}
		case remaining > 4:
			time.Sleep(time.Millisecond)
		}
	}
}

// finish marks a song that was playing as Done and, after a moment, re-arms
// it so Start replays it without re-loading (like the Restart button).
func (s *Server) finish() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.status.State != StatePlaying {
		return
	}
	s.status.State = StateDone
	s.publishLocked()

	req, seq := s.lastRun, s.runSeq
	go func() {
		time.Sleep(time.Second)
		s.mu.Lock()
		if s.status.State != StateDone || s.runSeq != seq {
			s.mu.Unlock()
			return // replaced or restarted meanwhile
		}
		s.status.State = StateIdle
		s.publishLocked()
		s.mu.Unlock()
		s.backend.Run(req)
	}()
}

// ─── Requested by the page ───────────────────────────────────

func (s *Server) handleRun(w http.ResponseWriter, r *http.Request) {
	var req RunRequest
	if err := decodeJSON(r, &req); err != nil {
		http.Error(w, "bad request: "+err.Error(), http.StatusBadRequest)
		return
	}
	s.mu.Lock()
	s.lastRun = req
	s.runSeq++
	s.status.GreatReq = req.GreatCount
	s.status.GreatApply = 0
	s.mu.Unlock()

	s.backend.Run(req)
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleStart(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	state, song := s.status.State, s.song
	s.mu.Unlock()

	if state != StateReady {
		http.Error(w, "not ready", http.StatusConflict)
		return
	}
	select {
	case song.start <- struct{}{}:
	default: // already pressed
	}
	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleOffset(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Delta int `json:"delta"`
	}
	if err := decodeJSON(r, &body); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	song := s.song
	s.mu.Unlock()
	select {
	case song.offset <- body.Delta:
	default:
	}

	s.updateStatus(func(st *Status) { st.Offset += body.Delta })
	w.WriteHeader(http.StatusOK)
}

// handleRestart interrupts the song and re-arms it, so the player can re-sync
// and press Start again without re-loading.
func (s *Server) handleRestart(w http.ResponseWriter, r *http.Request) {
	s.mu.Lock()
	restart := s.status.State == StatePlaying || s.status.State == StateDone
	if restart {
		s.song.interrupt()
		s.status.State = StateIdle
		s.publishLocked()
	}
	req := s.lastRun
	s.mu.Unlock()

	if restart {
		go s.backend.Run(req)
	}
	w.WriteHeader(http.StatusOK)
}
