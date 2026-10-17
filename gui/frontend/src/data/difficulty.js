// Difficulty names and colors. Difficulties are indexed 0 (easy) … 5 (append);
// index 4 is "special" in BanG Dream and "master" in Project Sekai.

const NAMES = {
  bang: ['easy', 'normal', 'hard', 'expert', 'special'],
  pjsk: ['easy', 'normal', 'hard', 'expert', 'master', 'append'],
};

export const DEFAULT_DIFF = 3; // expert

const COLORS = {
  easy: '#5ba3e0',
  normal: '#7ab84a',
  hard: '#d4921e',
  expert: '#e06060',
  special: '#9b95e0',
  append: '#4f8ff7',
};
const FALLBACK_COLOR = '#3b82f6';

// Name of difficulty i in a game mode, e.g. diffName('pjsk', 4) === 'master'.
// Unknown indices fall back to expert.
export function diffName(mode, i) {
  const names = NAMES[mode] || NAMES.bang;
  return names[i] || names[DEFAULT_DIFF];
}

export function diffLabel(mode, i) {
  return diffName(mode, i).toUpperCase();
}

const INDEX = { easy: 0, normal: 1, hard: 2, expert: 3, special: 4, master: 4, append: 5 };

// Index of a difficulty name from either game, or -1.
export function diffIndex(name) {
  return INDEX[String(name || '').toLowerCase()] ?? -1;
}

// Styling key of a difficulty: master shares special's look.
export function diffStyleKey(name) {
  const key = String(name || '').toLowerCase();
  return key === 'master' ? 'special' : key;
}

export function diffColor(name) {
  return COLORS[diffStyleKey(name)] || FALLBACK_COLOR;
}

export function isAppendColor(color) {
  return color === COLORS.append;
}
