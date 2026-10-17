// Copyright (C) 2026 hj6hki123
// SPDX-License-Identifier: GPL-3.0-or-later

package main

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/kvarenzn/ssm/common"
	"github.com/kvarenzn/ssm/config"
	"github.com/kvarenzn/ssm/gui"
	"github.com/kvarenzn/ssm/log"
	"github.com/kvarenzn/ssm/scores"
)

// player is the GUI's gui.Backend: it loads the requested song, opens the
// device and plays the song when the page presses Start. One song at a time.
type player struct {
	conf *config.Config
	srv  *gui.Server

	mu      sync.Mutex
	current *playRun
}

// playRun is one song being loaded or played.
type playRun struct {
	cancel context.CancelFunc
	done   chan struct{}
}

// Run stops the song in progress, waits until it has released the device and
// starts loading req.
func (p *player) Run(req gui.RunRequest) {
	p.mu.Lock()
	// Requests can arrive concurrently (Load, Restart and the automatic
	// re-arm), so re-check after waiting: if another request started a song
	// meanwhile, stop that one too. The last request wins and songs never
	// overlap.
	for p.current != nil {
		prev := p.current
		prev.cancel()
		p.mu.Unlock()
		<-prev.done
		p.mu.Lock()
		if p.current == prev {
			p.current = nil
		}
	}
	ctx, cancel := context.WithCancel(context.Background())
	run := &playRun{cancel: cancel, done: make(chan struct{})}
	p.current = run
	p.mu.Unlock()

	go func() {
		defer close(run.done)
		defer cancel()
		p.play(ctx, req)
	}()
}

func (p *player) Extract(path string) error {
	_, err := Extract(path, extractAssetFilter)
	return err
}

// play loads req, arms it and plays it once Start is pressed. Failures are
// shown in the page.
func (p *player) play(ctx context.Context, req gui.RunRequest) {
	// log.Fatal/Die panic with log.FatalErr; show it instead of exiting.
	defer func() {
		if r := recover(); r != nil {
			if _, ok := r.(log.FatalErr); !ok {
				panic(r)
			}
			p.srv.SetError("Playback aborted by a fatal error. See the console log for details.")
		}
	}()

	ctrl, events, err := p.prepare(req)
	if err != nil {
		p.srv.SetError(err.Error())
		return
	}
	defer ctrl.Close()

	p.srv.SetReady(ctrl, events, nowPlaying(req))
	if !p.srv.WaitForStart(ctx) {
		return
	}
	start := time.Now().Add(-time.Duration(events[0].Timestamp) * time.Millisecond)
	p.srv.Autoplay(ctx, start)
	time.Sleep(300 * time.Millisecond) // let the last touches reach the device
}

// prepare turns req into touch events and opens the device to play them on.
func (p *player) prepare(req gui.RunRequest) (playController, []common.ViscousEventItem, error) {
	pjsk := req.Mode == "pjsk"
	chart, err := loadChart(req, pjsk)
	if err != nil {
		return nil, nil, err
	}

	genConfig, humanize := touchConfig(req, pjsk)
	raw, greatApplied := scores.GenerateHumanizedTouchEvent(genConfig, humanize, chart)
	p.srv.SetGreatStats(req.GreatCount, int64(greatApplied))

	ctrl, events, err := openController(p.conf, req, pjsk, raw)
	if err != nil {
		return nil, nil, err
	}
	if len(events) == 0 {
		ctrl.Close()
		return nil, nil, errors.New("no playable events were generated for this chart")
	}
	return ctrl, events, nil
}

// loadChart reads and parses the chart for req: the custom chart file if one
// is given, otherwise the extracted chart of the song and difficulty.
func loadChart(req gui.RunRequest, pjsk bool) (scores.Chart, error) {
	path := req.ChartPath
	if path == "" {
		var err error
		if path, err = findChart(assetsRoot, pjsk, req.SongID, req.AltSongIDs, req.Diff); err != nil {
			return nil, err
		}
	}

	text, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read musicscore: %w", err)
	}
	if !pjsk {
		return scores.ParseBMS(string(text)), nil
	}
	chart, err := scores.ParseSUS(string(text))
	if err != nil {
		return nil, fmt.Errorf("failed to parse SUS: %w", err)
	}
	return chart, nil
}

// assetsRoot is where Extract writes the asset bundles' contents.
const assetsRoot = "./assets"

// findChart returns the extracted chart of a song and difficulty. Some songs
// are listed twice with the same chart (e.g. #786 and #790), and the game may
// only have downloaded one of them, so altIDs are tried after songID.
func findChart(root string, pjsk bool, songID int, altIDs []int, difficulty string) (string, error) {
	for _, id := range append([]int{songID}, altIDs...) {
		matches, _ := filepath.Glob(chartPattern(root, pjsk, id, difficulty))
		if len(matches) > 0 {
			if id != songID {
				log.Infof("Chart of song #%d not found, using the same chart of song #%d", songID, id)
			}
			return matches[0], nil
		}
	}
	return "", chartNotFound(root, pjsk, songID, difficulty)
}

// chartPattern is the glob matching a song's chart under the assets root.
func chartPattern(root string, pjsk bool, songID int, difficulty string) string {
	if pjsk {
		return filepath.Join(root, "sekai/assetbundle/resources/startapp/music/music_score",
			fmt.Sprintf("%04d_01", songID), difficulty+".txt")
	}
	return filepath.Join(root, "star/forassetbundle/startapp/musicscore",
		"musicscore*", fmt.Sprintf("%03d", songID), "*_"+difficulty+".txt")
}

// chartNotFound explains why a chart is missing: the song was never extracted
// (the game has not downloaded it), or it lacks this difficulty.
func chartNotFound(root string, pjsk bool, songID int, difficulty string) error {
	others, _ := filepath.Glob(chartPattern(root, pjsk, songID, "*"))
	if len(others) == 0 {
		return fmt.Errorf("the chart of song #%d is not in the extracted assets (%s). "+
			"Download the song in the game (play or preview it once), extract the assets again, "+
			"or use a custom chart path", songID, root)
	}
	found := make([]string, 0, len(others))
	for _, p := range others {
		name := strings.TrimSuffix(filepath.Base(p), ".txt")
		found = append(found, name[strings.LastIndex(name, "_")+1:])
	}
	return fmt.Errorf("song #%d has no %s chart in the extracted assets (found: %s)",
		songID, strings.ToUpper(difficulty), strings.Join(found, ", "))
}

// touchConfig returns the touch generation and humanization settings for req.
// Generation parameters left at 0 keep the game mode's default.
func touchConfig(req gui.RunRequest, pjsk bool) (*scores.VTEGenerateConfig, scores.HumanizeConfig) {
	c := &scores.VTEGenerateConfig{
		TapDuration:         10,
		FlickDuration:       60,
		FlickReportInterval: 5,
		FlickFactor:         1.0 / 5,
		FlickPow:            1,
		SlideReportInterval: 10,
	}
	if pjsk {
		c.FlickFactor = 1.0 / 6
		c.FlickDuration = 20
	}
	setIfPositive(&c.TapDuration, req.TapDuration)
	setIfPositive(&c.FlickDuration, req.FlickDuration)
	setIfPositive(&c.FlickReportInterval, req.FlickReportInterval)
	setIfPositive(&c.SlideReportInterval, req.SlideReportInterval)
	setIfPositive(&c.FlickFactor, req.FlickFactor)
	setIfPositive(&c.FlickPow, req.FlickPow)

	greatOffset := req.GreatOffsetMs
	if greatOffset < 0 {
		greatOffset = -greatOffset
	}
	if greatOffset == 0 {
		greatOffset = 10
	}
	return c, scores.HumanizeConfig{
		TimingJitter:     req.TimingJitter,
		PositionJitter:   req.PositionJitter,
		TapDurJitter:     req.TapDurJitter,
		GreatOffsetMs:    greatOffset,
		GreatTargetCount: max(req.GreatCount, 0),
	}
}

func setIfPositive[T int64 | float64](dst *T, v T) {
	if v > 0 {
		*dst = v
	}
}

// nowPlaying describes the loaded song for the player card.
func nowPlaying(req gui.RunRequest) gui.NowPlaying {
	np := req.NowPlaying
	np.SongID = req.SongID
	np.Diff = req.Diff
	np.Mode = req.Mode
	return np
}

// extractAssetFilter selects which asset-bundle paths Extract unpacks: chart,
// jacket and in-game skin assets under startapp (audio .acb excluded).
func extractAssetFilter(p string) bool {
	if strings.HasSuffix(p, ".acb.bytes") || !strings.Contains(p, "startapp") {
		return false
	}
	return strings.Contains(p, "musicscore/") || strings.Contains(p, "music_score/") ||
		strings.Contains(p, "musicjacket/") || strings.Contains(p, "jacket/") ||
		strings.Contains(p, "ingameskin")
}
