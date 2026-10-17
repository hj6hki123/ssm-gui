// The play deck's glow follows the color of the selected difficulty.

import { $ } from '../lib/dom.js';
import { diffColor, isAppendColor } from '../data/difficulty.js';

export function setAccent(difficulty) {
  const color = diffColor(difficulty);
  const append = isAppendColor(color);
  for (const el of [$('pn-jacket-wrap'), document.querySelector('.player-deck')]) {
    el.style.setProperty('--jacket-color', color);
    el.classList.toggle('is-append', append);
  }
  // Mirrored on the root so every descendant and pseudo-element sees it.
  document.documentElement.style.setProperty('--jacket-color', color);
  document.documentElement.classList.toggle('is-append-diff', append);
}
