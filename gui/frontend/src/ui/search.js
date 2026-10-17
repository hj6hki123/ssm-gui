// Song search box, result dropdown and the selected-song bar.

import { $, esc, onClickOutside } from '../lib/dom.js';
import { log, logConnFail } from '../lib/log.js';
import { t } from '../core/i18n.js';
import { showPage } from '../core/nav.js';
import { state } from '../core/state.js';
import { diffLabel, diffName, diffStyleKey } from '../data/difficulty.js';
import { availableDiffs, loadSongDB, loadedSongDB, searchSongs, songTitle } from '../data/songdb.js';
import { limitDiffs } from './difficulty-picker.js';

const SEARCH_DELAY_MS = 160;
let searchTimer = null;
let highlighted = -1; // keyboard-highlighted result

export function initSearch() {
  onClickOutside('.sw', closeDrop);
}

export const searchActions = {
  onQInput() {
    const q = $('q').value;
    $('sc').hidden = !q;
    clearTimeout(searchTimer);
    if (!q.trim()) { closeDrop(); return; }
    searchTimer = setTimeout(() => search(q.trim()), SEARCH_DELAY_MS);
  },
  onQFocus() {
    const q = $('q').value.trim();
    if (q) search(q);
  },
  onQKey(arg, el, e) {
    const items = $('drop').querySelectorAll('.di');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      highlight(items, Math.min(highlighted + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      highlight(items, Math.max(highlighted - 1, -1));
    } else if (e.key === 'Enter' && items[highlighted]) {
      items[highlighted].click();
    } else if (e.key === 'Escape') {
      closeDrop();
    }
  },
  clearQ() {
    clearQuery();
    closeDrop();
  },
  selSong: (arg) => selectSong(parseInt(arg)),
  clearSong,
  // Typing a song id selects it directly; the title and difficulties are
  // shown right away when the song database is already loaded.
  onManualId() {
    const id = parseInt($('song-id').value) || 0;
    if (id <= 0) {
      state.songId = 0;
      state.song = null;
      $('sel-bar').hidden = true;
      limitDiffs(null);
      return;
    }
    const db = loadedSongDB(state.mode);
    const song = db ? db.songs[id] || null : null;
    state.songId = id;
    state.song = song;
    showSelection(id, song ? songTitle(song, state.mode) : t('manual.title'));
    limitDiffs(song && availableDiffs(song).length ? availableDiffs(song) : null);
  },
  // Jump to the search box (from the play page's "Change song").
  navToSearch() {
    showPage('song');
    setTimeout(() => {
      const input = $('q');
      input.focus({ preventScroll: true });
      input.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 50);
  },
};

export function clearSong() {
  state.songId = 0;
  state.song = null;
  $('sel-bar').hidden = true;
  $('song-id').value = '';
  clearQuery();
  limitDiffs(null);
  closeDrop();
}

// The song database for the current mode, logging failures.
function songDB() {
  const db = loadSongDB(state.mode);
  db.catch(logConnFail('song-log'));
  return db;
}

async function search(query) {
  // The first search has to fetch the (large) song database.
  if (!loadedSongDB(state.mode)) showHint(t('drop.loading'));
  let db;
  try {
    db = await songDB();
  } catch {
    showHint(t('drop.error'));
    return;
  }
  renderResults(searchSongs(db, query, state.mode));
}

function renderResults(results) {
  if (!results.length) { showHint(t('drop.none')); return; }
  const drop = $('drop');
  drop.innerHTML = results.map(({ id, song, artist }) => {
    const tags = Object.keys(song.difficulty || {}).map(Number).sort()
      .map((d) => `<span class="di-d d-${diffStyleKey(diffName(state.mode, d))}">${diffLabel(state.mode, d)}</span>`)
      .join('');
    return `<div class="di" data-action="selSong" data-arg="${id}">`
      + `<span class="di-id">#${id}</span>`
      + `<div class="di-info"><div class="di-title">${esc(songTitle(song, state.mode))}</div>`
      + (artist ? `<div class="di-band">${esc(artist)}</div>` : '')
      + `</div><div class="di-diffs">${tags}</div></div>`;
  }).join('');
  drop.classList.add('open');
  highlighted = -1;
}

function showHint(text) {
  const drop = $('drop');
  drop.innerHTML = `<div class="drop-hint">${esc(text)}</div>`;
  drop.classList.add('open');
}

function closeDrop() {
  $('drop').classList.remove('open');
  highlighted = -1;
}

function highlight(items, index) {
  highlighted = index;
  items.forEach((el, i) => {
    el.classList.toggle('hi', i === index);
    if (i === index) el.scrollIntoView({ block: 'nearest' });
  });
}

function clearQuery() {
  $('q').value = '';
  $('sc').hidden = true;
}

function showSelection(id, title) {
  $('sb-id').textContent = '#' + id;
  $('sb-title').textContent = title;
  $('sel-bar').hidden = false;
}

function selectSong(id) {
  // Normally the database is already loaded from the search that listed the song.
  const db = loadedSongDB(state.mode);
  if (db) showSong(db, id);
  else songDB().then((loaded) => showSong(loaded, id), () => { /* already logged */ });
}

function showSong(db, id) {
  const song = db.songs[id];
  if (!song) return;
  state.songId = id;
  state.song = song;
  const title = songTitle(song, state.mode);
  showSelection(id, title);
  clearQuery();
  $('song-id').value = id;
  closeDrop();
  const available = availableDiffs(song);
  limitDiffs(available.length ? available : null);
  log('song-log', '#' + id + ' ' + title, 'ok');
}
