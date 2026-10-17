// Copyright (C) 2026 hj6hki123
// SPDX-License-Identifier: GPL-3.0-or-later

package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeChart(t *testing.T, root, rel string) string {
	t.Helper()
	p := filepath.Join(root, rel)
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(p, nil, 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestFindChart(t *testing.T) {
	root := t.TempDir()
	const bang = "star/forassetbundle/startapp/musicscore/musicscore790/"
	expert790 := writeChart(t, root, bang+"790/790_expert.txt")
	writeChart(t, root, bang+"786/786_hard.txt")
	writeChart(t, root, bang+"786/786_special.txt")
	pjskMaster := writeChart(t, root, "sekai/assetbundle/resources/startapp/music/music_score/0011_01/master.txt")

	if p, err := findChart(root, false, 790, nil, "expert"); err != nil || p != expert790 {
		t.Errorf("own chart: got %q, %v", p, err)
	}
	if p, err := findChart(root, false, 786, []int{790}, "expert"); err != nil || p != expert790 {
		t.Errorf("same chart under another id: got %q, %v", p, err)
	}
	if p, err := findChart(root, true, 11, nil, "master"); err != nil || p != pjskMaster {
		t.Errorf("pjsk: got %q, %v", p, err)
	}

	_, err := findChart(root, false, 786, nil, "expert")
	if err == nil || !strings.Contains(err.Error(), "no EXPERT chart") || !strings.Contains(err.Error(), "hard, special") {
		t.Errorf("missing difficulty: %v", err)
	}
	_, err = findChart(root, false, 792, nil, "expert")
	if err == nil || !strings.Contains(err.Error(), "#792 is not in the extracted assets") {
		t.Errorf("missing song: %v", err)
	}
}
