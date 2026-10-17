// Dark / light theme, remembered across visits.

import { $ } from '../lib/dom.js';

const STORAGE_KEY = 'ssm-theme';

export function initTheme() {
  let saved;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

export function toggleTheme() {
  const next = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
  applyTheme(next);
  try { localStorage.setItem(STORAGE_KEY, next); } catch { /* storage unavailable */ }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.classList.toggle('dark', theme === 'dark');
  $('theme-ico').textContent = theme === 'dark' ? '☾' : '☀';
}
