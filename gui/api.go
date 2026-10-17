// Copyright (C) 2026 hj6hki123
// SPDX-License-Identifier: GPL-3.0-or-later

package gui

// Types exchanged with the frontend as JSON.

// PlayState is the playback state shown by the frontend.
type PlayState int

const (
	StateIdle    PlayState = iota // nothing loaded
	StateReady                    // song loaded, waiting for Start
	StatePlaying                  // playing
	StateDone                     // played to the end
	StateError                    // loading or playback failed
)

// NowPlaying describes the loaded song for the player card.
type NowPlaying struct {
	SongID    int    `json:"songId"`
	Title     string `json:"title"`
	Artist    string `json:"artist"`
	Diff      string `json:"diff"`
	DiffLevel int    `json:"diffLevel"`
	JacketURL string `json:"jacketUrl"`
	Mode      string `json:"mode"`
}

// RunRequest asks to load a song and arm it for playback (POST /api/run).
type RunRequest struct {
	Mode         string     `json:"mode"`    // "bang" or "pjsk"
	Backend      string     `json:"backend"` // "adb" or "hid"
	Diff         string     `json:"diff"`
	Orient       string     `json:"orient"` // "left" or "right"
	SongID       int        `json:"songId"`
	AltSongIDs   []int      `json:"altSongIds"` // songs with the same chart, tried if SongID's is missing
	ChartPath    string     `json:"chartPath"`  // custom chart; overrides SongID/Diff
	DeviceSerial string     `json:"deviceSerial"`
	NowPlaying   NowPlaying `json:"nowPlaying"`

	// Humanization; 0 disables each one.
	TimingJitter   int64   `json:"timingJitter"`   // ± ms
	PositionJitter float64 `json:"positionJitter"` // ± track units
	TapDurJitter   int64   `json:"tapDurJitter"`   // ± ms
	GreatOffsetMs  int64   `json:"greatOffsetMs"`  // how early a Great tap is hit
	GreatCount     int64   `json:"greatCount"`     // number of taps to hit as Great

	// Touch generation parameters; 0 keeps the game mode's default.
	TapDuration         int64   `json:"tapDuration"`
	FlickDuration       int64   `json:"flickDuration"`
	FlickReportInterval int64   `json:"flickReportInterval"`
	SlideReportInterval int64   `json:"slideReportInterval"`
	FlickFactor         float64 `json:"flickFactor"`
	FlickPow            float64 `json:"flickPow"`
}

// Status is pushed to the frontend on every change (GET /api/events) and
// served on demand (GET /api/status).
type Status struct {
	State      PlayState  `json:"state"`
	Offset     int        `json:"offset"` // ms
	Error      string     `json:"error"`
	NowPlaying NowPlaying `json:"nowPlaying"`
	GreatReq   int64      `json:"greatReq"`   // Great taps requested
	GreatApply int64      `json:"greatApply"` // Great taps actually applied
}
