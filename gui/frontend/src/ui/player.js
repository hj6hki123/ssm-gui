// Play page: playback status pushed by the backend over SSE, the now-playing
// cards, Start / Restart, offset adjustment and keyboard shortcuts.

import { $ } from '../lib/dom.js';
import { post, sendJSON } from '../lib/http.js';
import { log, logConnFail } from '../lib/log.js';
import { onLanguageChange, t } from '../core/i18n.js';
import { isPageShown } from '../core/nav.js';
import { state } from '../core/state.js';
import { diffStyleKey } from '../data/difficulty.js';
import { setAccent } from './accent.js';

// Mirrors gui.PlayState in the backend.
const PlayState = { IDLE: 0, READY: 1, PLAYING: 2, DONE: 3, ERROR: 4 };

const STATE_CLASS = { 1: 'ready', 2: 'playing', 3: 'done', 4: 'error' };
const STATE_TEXT = { 0: 'state.idle', 1: 'state.ready.full', 2: 'state.playing.full', 3: 'state.done.full', 4: 'state.error.full' };
const STATE_LOG = {
  1: ['log.ready', 'info'],
  2: ['log.playing', 'info'],
  3: ['log.done', 'ok'],
};

let lastLoggedState = -1;
let lastGreatStats = '';
let shownSong = ''; // signature of the song on the cards
let connectionLost = false;

export function initPlayer() {
  const events = new EventSource('/api/events');
  events.onmessage = (e) => {
    let status;
    try { status = JSON.parse(e.data); } catch { return; } // ignore malformed frames
    if (connectionLost) {
      connectionLost = false;
      log('play-log', t('log.sse.reconnect'), 'ok');
    }
    renderStatus(status);
  };
  // EventSource reconnects by itself; say so once, so the page doesn't look
  // frozen while the backend restarts.
  events.onerror = () => {
    if (!connectionLost) {
      connectionLost = true;
      log('play-log', t('log.sse.lost'), 'err');
    }
  };

  document.addEventListener('keydown', onShortcut);
  onLanguageChange(renderStateText);
}

export function renderStatus(status) {
  const st = status.state;
  state.playState = st;
  state.offset = status.offset || 0;

  $('pn-dot').className = 'dot ' + (STATE_CLASS[st] || '');
  const card = $('np-card');
  card.classList.remove('np-state-idle', 'np-state-ready', 'np-state-playing', 'np-state-done', 'np-state-error');
  card.classList.add('np-state-' + (STATE_CLASS[st] || 'idle'));
  $('pn-jacket-wrap').classList.toggle('playing', st === PlayState.PLAYING);
  document.querySelector('.player-deck').classList.toggle('playing-glow', st === PlayState.PLAYING);

  renderStateText();
  $('ov').textContent = state.offset;
  const start = $('btn-start');
  start.disabled = st !== PlayState.READY;
  start.classList.toggle('rdy', st === PlayState.READY);

  const np = status.nowPlaying;
  if (np && (np.songId > 0 || np.title)) renderNowPlaying(np);
  logStateChange(status);
}

function renderStateText() {
  const text = t(STATE_TEXT[state.playState] || 'state.idle');
  $('np-state-txt').textContent = text;
  $('pn-state-label').textContent = text;
}

function logStateChange(status) {
  const st = status.state;
  if (st !== lastLoggedState) {
    lastLoggedState = st;
    if (STATE_LOG[st]) log('play-log', t(STATE_LOG[st][0]), STATE_LOG[st][1]);
    if (st === PlayState.ERROR && status.error) log('play-log', t('log.fail') + status.error, 'err');
  }
  if (st === PlayState.READY && typeof status.greatReq === 'number' && typeof status.greatApply === 'number') {
    const stats = status.greatReq + '/' + status.greatApply;
    if (stats !== lastGreatStats) {
      lastGreatStats = stats;
      log('play-log', t('log.great.pre') + status.greatApply + t('log.great.mid') + status.greatReq,
        status.greatApply > 0 ? 'ok' : 'info');
    }
  }
}

// Fill the sidebar mini-card and the play deck. Skipped when the song is
// unchanged, so the per-message SSE stream doesn't reload the jacket.
export function renderNowPlaying(np) {
  const signature = [np.songId, np.title, np.artist, np.diff, np.diffLevel, np.jacketUrl].join('');
  if (signature === shownSong) return;
  shownSong = signature;

  const level = np.diffLevel ? 'Lv.' + np.diffLevel : '';
  $('np-card').hidden = false;
  paintJacket($('np-img'), $('np-no'), np);
  $('np-title').textContent = np.title || '—';
  $('np-artist').textContent = np.artist || '';
  paintDiffBadge($('np-diff'), np.diff);
  $('np-lv').textContent = level;

  $('pn-none').hidden = true;
  $('pn-loaded').hidden = false;
  paintJacket($('pn-img'), $('pn-no'), np);
  $('pn-title-big').textContent = np.title || '—';
  $('pn-artist-big').textContent = np.artist || '';
  paintDiffBadge($('pn-diff-badge'), np.diff);
  $('pn-lv-big').textContent = level;
  setAccent(np.diff || 'expert');
}

function paintDiffBadge(el, diff) {
  el.className = 'np-diff d-' + diffStyleKey(diff || 'expert');
  el.textContent = String(diff || '').toUpperCase();
}

// Show the jacket, trying each URL in turn; fall back to the placeholder.
function paintJacket(img, placeholder, np) {
  const urls = np.jacketUrls && np.jacketUrls.length ? np.jacketUrls : [np.jacketUrl];
  const showPlaceholder = () => {
    img.onerror = null;
    img.removeAttribute('src');
    img.hidden = true;
    placeholder.hidden = false;
  };
  if (!np.jacketUrl) { showPlaceholder(); return; }

  img.hidden = false;
  placeholder.hidden = true;
  let next = 0;
  const tryNext = () => {
    if (next >= urls.length) { showPlaceholder(); return; }
    img.onerror = tryNext;
    img.src = urls[next++];
  };
  tryNext();
}

// ── Controls ──────────────────────────────────────────────────

function start() {
  if (state.playState !== PlayState.READY) return;
  post('/api/start').catch(logConnFail('play-log'));
}

function restart() {
  post('/api/restart').catch(logConnFail('play-log'));
}

// Offset nudges are batched for 50 ms so holding an arrow key sends one request.
const OFFSET_BATCH_MS = 50;
let offsetTimer = null;
let pendingOffset = 0;

function sendOffset(delta) {
  sendJSON('/api/offset', { delta }).catch(logConnFail('play-log'));
}

function nudgeOffset(delta) {
  pendingOffset += delta;
  clearTimeout(offsetTimer);
  offsetTimer = setTimeout(() => {
    if (pendingOffset === 0) return;
    const d = pendingOffset;
    pendingOffset = 0;
    sendOffset(d);
  }, OFFSET_BATCH_MS);
}

function resetOffset() {
  pendingOffset = 0;
  clearTimeout(offsetTimer);
  if (state.offset !== 0) sendOffset(-state.offset);
}

// Enter/Space start; ←/→ nudge the offset by 10 ms (Shift 50, Ctrl/⌘ 100).
function onShortcut(e) {
  const tag = document.activeElement.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || !isPageShown('play')) return;
  const step = e.ctrlKey || e.metaKey ? 100 : e.shiftKey ? 50 : 10;
  switch (e.key) {
    case 'Enter': case ' ': e.preventDefault(); start(); break;
    case 'ArrowLeft': e.preventDefault(); nudgeOffset(-step); break;
    case 'ArrowRight': e.preventDefault(); nudgeOffset(step); break;
  }
}

export const playerActions = {
  apiStart: start,
  apiRestart: restart,
  adj: (delta) => nudgeOffset(parseInt(delta)),
  resetOff: resetOffset,
};
