// UI translations. Static text is marked in the markup with data-i18n (and
// data-i18n-placeholder); dynamic text calls t().

import { $, onClickOutside } from '../lib/dom.js';

export const LANGUAGES = [
  { id: 'en', shortName: 'EN', nativeName: 'English' },
  { id: 'zh-TW', shortName: '繁中', nativeName: '繁體中文' },
  { id: 'zh-CN', shortName: '简中', nativeName: '简体中文' },
  { id: 'ja', shortName: 'JP', nativeName: '日本語' },
];
const STORAGE_KEY = 'ssm-lang';

const loaded = {}; // language id → messages
const listeners = [];
let current = 'en';

export function t(key) {
  const msg = (loaded[current] || {})[key];
  return msg !== undefined ? msg : ((loaded.en || {})[key] || key);
}

// fn runs after the user switches language.
export function onLanguageChange(fn) {
  listeners.push(fn);
}

export async function initI18n() {
  renderMenu();
  onClickOutside('#lang-picker', closeLangMenu);
  let saved;
  try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* storage unavailable */ }
  const id = saved || detectLanguage();
  await load(id);
  apply(id);
}

export async function selectLanguage(id) {
  await load(id);
  apply(id);
  try { localStorage.setItem(STORAGE_KEY, id); } catch { /* storage unavailable */ }
  closeLangMenu();
  listeners.forEach((fn) => fn());
}

export function toggleLangMenu() {
  const open = $('lang-menu').classList.toggle('open');
  $('lang-btn').classList.toggle('open', open);
}

function closeLangMenu() {
  $('lang-menu').classList.remove('open');
  $('lang-btn').classList.remove('open');
}

async function load(id) {
  if (loaded[id]) return;
  try {
    const r = await fetch('/locales/' + id + '.json');
    loaded[id] = await r.json();
  } catch {
    loaded[id] = {};
  }
}

function detectLanguage() {
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('zh-tw') || nav.startsWith('zh-hant')) return 'zh-TW';
  if (nav.startsWith('zh')) return 'zh-CN';
  if (nav.startsWith('ja')) return 'ja';
  return 'en';
}

// Translate every marked element into language id.
function apply(id) {
  current = id;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    el.innerHTML = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  const lang = LANGUAGES.find((l) => l.id === id) || LANGUAGES[0];
  $('lb-name').textContent = lang.shortName;
  document.querySelectorAll('.lang-opt').forEach((opt) => {
    opt.classList.toggle('active', opt.dataset.lang === id);
  });
  document.documentElement.lang = id;
}

function renderMenu() {
  $('lang-menu').innerHTML = LANGUAGES.map((l) =>
    `<div class="lang-opt" data-lang="${l.id}" data-action="selectLanguage" data-arg="${l.id}">`
    + `<div class="lo-info"><span class="lo-name">${l.shortName}</span><span class="lo-native">${l.nativeName}</span></div>`
    + '</div>').join('');
}
