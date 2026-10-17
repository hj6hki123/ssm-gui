// The difficulty buttons on the song page.

import { state } from '../core/state.js';
import { DEFAULT_DIFF, diffLabel, diffName } from '../data/difficulty.js';
import { setAccent } from './accent.js';

const buttons = () => document.querySelectorAll('.db');

// Label the mode-specific buttons: SPECIAL/MASTER, and APPEND (PJSK only).
export function renderDiffButtons() {
  const b = buttons();
  b[4].textContent = diffLabel(state.mode, 4);
  b[5].hidden = state.mode !== 'pjsk';
}

export function selectDiff(i) {
  const b = buttons();
  if (b[i] && b[i].classList.contains('dis')) return;
  state.diff = i;
  b.forEach((btn, j) => btn.classList.toggle('active', j === i));
  setAccent(diffName(state.mode, i));
}

// Disable the difficulties a song lacks (null = all available) and move the
// selection to the hardest available one if the current one is gone.
export function limitDiffs(available) {
  const ok = (i) => !available || available.includes(i);
  buttons().forEach((btn, i) => btn.classList.toggle('dis', !ok(i)));
  if (!ok(state.diff)) selectDiff(available ? available[available.length - 1] : DEFAULT_DIFF);
}
