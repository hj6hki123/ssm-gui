// Settings page sliders: humanization (jitter, Great) and the advanced touch
// generation parameters.

import { $, setSliderFill } from '../lib/dom.js';

// ── Humanization ──────────────────────────────────────────────

// Position jitter slider steps → fraction of the lane.
const POSITION_STEPS = [0, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.15, 0.18, 0.22, 0.25];
const JITTER_KEYS = ['timing', 'position', 'tapDur', 'grOffset', 'grCount'];

const sliderValue = (key) => parseInt($('sld-' + key).value) || 0;

function greatCount() {
  const n = parseInt($('inp-grCount').value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function renderJitter(key) {
  const raw = key === 'grCount' ? greatCount() : parseInt($('sld-' + key).value);
  const label = $('val-' + key);
  if (key !== 'grCount') setSliderFill($('sld-' + key));

  const off = key !== 'grOffset' && raw === 0;
  label.classList.toggle('off', off);
  if (off) { label.textContent = 'OFF'; return; }
  switch (key) {
    case 'position': label.textContent = '±' + Math.round((POSITION_STEPS[raw] || 0) * 100) + '%'; break;
    case 'grOffset': label.textContent = raw + ' ms'; break;
    case 'grCount': label.textContent = raw + ' notes'; break;
    default: label.textContent = '±' + raw + ' ms';
  }
}

export function renderAllJitters() {
  JITTER_KEYS.forEach(renderJitter);
}

// Humanization settings for a run request.
export function jitterSettings() {
  return {
    timingJitter: sliderValue('timing'),
    positionJitter: POSITION_STEPS[sliderValue('position')] || 0,
    tapDurJitter: sliderValue('tapDur'),
    greatOffsetMs: sliderValue('grOffset') || 10,
    greatCount: greatCount(),
  };
}

// ── Advanced parameters ───────────────────────────────────────

// Slider values; flickFactor is ×100 and flickPow ×10 of the real value.
const ADVANCED_DEFAULTS = {
  bang: { tapDuration: 10, flickDuration: 60, flickReportInterval: 5, slideReportInterval: 10, flickFactor: 20, flickPow: 10 },
  pjsk: { tapDuration: 10, flickDuration: 20, flickReportInterval: 5, slideReportInterval: 10, flickFactor: 17, flickPow: 10 },
};
let advancedDefaults = ADVANCED_DEFAULTS.bang;

function renderAdvanced(key) {
  const slider = $('sld-' + key);
  const raw = parseInt(slider.value);
  setSliderFill(slider);
  const label = $('val-' + key);
  label.textContent = key === 'flickFactor' ? (raw / 100).toFixed(2)
    : key === 'flickPow' ? (raw / 10).toFixed(1)
      : raw;
}

export function resetAdvanced() {
  for (const [key, value] of Object.entries(advancedDefaults)) {
    $('sld-' + key).value = value;
    renderAdvanced(key);
  }
}

// Switch to the game mode's defaults and reset the sliders to them.
export function useModeDefaults(mode) {
  advancedDefaults = ADVANCED_DEFAULTS[mode] || ADVANCED_DEFAULTS.bang;
  resetAdvanced();
}

// Touch generation parameters for a run request.
export function advancedSettings() {
  const v = (key, fallback) => parseInt($('sld-' + key).value) || fallback;
  return {
    tapDuration: v('tapDuration', 10),
    flickDuration: v('flickDuration', 60),
    flickReportInterval: v('flickReportInterval', 5),
    slideReportInterval: v('slideReportInterval', 10),
    flickFactor: v('flickFactor', 20) / 100,
    flickPow: v('flickPow', 10) / 10,
  };
}

export const tuningActions = {
  onJitter: (key) => renderJitter(key),
  onGreatCountInput: () => renderJitter('grCount'),
  onAdvanced: (key) => renderAdvanced(key),
  resetAdvanced,
};
