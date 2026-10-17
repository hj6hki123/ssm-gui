// Copyright (C) 2026 hj6hki123
// SPDX-License-Identifier: GPL-3.0-or-later

// Package gui serves the browser GUI: the embedded frontend and the JSON/SSE
// API it talks to. Loading songs and driving devices is left to a Backend.
package gui

import (
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/kvarenzn/ssm/config"
)

// Backend performs the work behind the API.
type Backend interface {
	// Run loads req and arms it for playback, replacing any song in
	// progress. It reports back through the Server (SetReady, SetError,
	// ...) and must not block until playback ends.
	Run(req RunRequest)
	// Extract unpacks game assets from the directory at path.
	Extract(path string) error
}

type Server struct {
	port    int
	conf    *config.Config
	backend Backend
	clients hub

	mu      sync.Mutex // guards the fields below
	status  Status
	lastRun RunRequest    // most recent run request, replayed by Restart
	runSeq  int           // bumped on every run request
	song    *preparedSong // song armed for playback
}

func NewServer(port int, conf *config.Config, backend Backend) *Server {
	return &Server{
		port:    port,
		conf:    conf,
		backend: backend,
		clients: hub{clients: map[chan string]struct{}{}},
		status:  Status{State: StateIdle},
		song:    newPreparedSong(nil, nil),
	}
}

// Start listens on the loopback interface and serves in the background. It
// returns the URL to open in the browser.
func (s *Server) Start() (string, error) {
	ln, err := net.Listen("tcp", fmt.Sprintf("127.0.0.1:%d", s.port))
	if err != nil {
		return "", err
	}
	port := ln.Addr().(*net.TCPAddr).Port

	handler, err := s.handler(port)
	if err != nil {
		ln.Close()
		return "", err
	}
	srv := &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}
	go srv.Serve(ln)
	return fmt.Sprintf("http://127.0.0.1:%d", port), nil
}

func (s *Server) handler(port int) (http.Handler, error) {
	static, err := staticHandler()
	if err != nil {
		return nil, err
	}

	mux := http.NewServeMux()
	mux.Handle("GET /", static)

	mux.HandleFunc("GET /api/events", s.handleEvents)
	mux.HandleFunc("GET /api/status", s.handleStatus)
	mux.HandleFunc("POST /api/run", s.handleRun)
	mux.HandleFunc("POST /api/start", s.handleStart)
	mux.HandleFunc("POST /api/offset", s.handleOffset)
	mux.HandleFunc("POST /api/restart", s.handleRestart)

	mux.HandleFunc("GET /api/device", s.handleListDevices)
	mux.HandleFunc("POST /api/device", s.handleSaveDevice)
	mux.HandleFunc("DELETE /api/device", s.handleDeleteDevice)
	mux.HandleFunc("GET /api/detect-adb", s.handleDetectADB)
	mux.HandleFunc("POST /api/kill-adb", s.handleKillADB)

	mux.HandleFunc("GET /api/songdb", s.handleSongDB)
	mux.HandleFunc("POST /api/extract", s.handleExtract)

	return loopbackOnly(port, mux), nil
}

// loopbackOnly rejects requests whose Host header is not our loopback
// address. This blocks DNS-rebinding attacks, where a remote page resolves a
// hostname to 127.0.0.1 and drives these side-effecting endpoints.
func loopbackOnly(port int, next http.Handler) http.Handler {
	allowed := map[string]bool{
		fmt.Sprintf("127.0.0.1:%d", port): true,
		fmt.Sprintf("localhost:%d", port): true,
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !allowed[r.Host] {
			http.Error(w, "forbidden host", http.StatusForbidden)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func decodeJSON(r *http.Request, v any) error {
	return json.NewDecoder(r.Body).Decode(v)
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	data, err := json.Marshal(v)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	w.Write(data)
}
