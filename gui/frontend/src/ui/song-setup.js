// Song page: game mode, backend, orientation, and Load (POST /api/run).

import { $ } from '../lib/dom.js';
import { HTTPError, expectOK, sendJSON } from '../lib/http.js';
import { log, logConnFail } from '../lib/log.js';
import { t } from '../core/i18n.js';
import { showPage } from '../core/nav.js';
import { state } from '../core/state.js';
import { diffName } from '../data/difficulty.js';
import { jacketUrls, loadedSongDB, songArtist, songTitle } from '../data/songdb.js';
import { savedDevices } from './devices.js';
import { renderDiffButtons, selectDiff } from './difficulty-picker.js';
import { clearSong } from './search.js';
import { advancedSettings, jitterSettings, useModeDefaults } from './tuning.js';

function setMode(mode) {
  state.mode = mode;
  if (state.songId) clearSong();
  ['bang', 'pjsk'].forEach((m) => $('mode-' + m).classList.toggle('active', m === mode));
  renderDiffButtons();
  // APPEND only exists in PJSK; fall back to EXPERT so a visible button stays selected.
  if (mode !== 'pjsk' && state.diff === 5) selectDiff(3);
  useModeDefaults(mode);
}

export function setBackend(backend) {
  state.backend = backend;
  ['hid', 'adb'].forEach((b) => $('backend-' + b).classList.toggle('active', b === backend));
  $('hid-warn-box').classList.toggle('hidden', backend !== 'hid');
  // Rotation only matters for HID.
  $('orient-wrap').classList.toggle('muted', backend === 'adb');
}

function setOrient(orient) {
  state.orient = orient;
  $('ol').classList.toggle('active', orient === 'left');
  $('or').classList.toggle('active', orient === 'right');
}

// What the player card shows for the selected song.
function nowPlaying() {
  const np = { songId: state.songId, diff: diffName(state.mode, state.diff), mode: state.mode, title: '', artist: '', diffLevel: 0, jacketUrl: '', jacketUrls: [] };
  const song = state.song;
  if (!song) return np;
  const db = loadedSongDB(state.mode);
  np.title = songTitle(song, state.mode) || '';
  np.diffLevel = song.difficulty?.[state.diff]?.playLevel || 0;
  np.jacketUrls = jacketUrls(state.mode, state.songId, song);
  np.jacketUrl = np.jacketUrls[0] || '';
  np.artist = (db && songArtist(db, song, state.mode)) || song.credits || '';
  return np;
}

// The serial to play on: the one typed in, else the first saved device.
function chooseDevice() {
  const input = $('dev-serial');
  let serial = input.value.trim();
  if (!serial) {
    serial = Object.keys(savedDevices())[0] || '';
    if (serial) {
      input.value = serial;
      log('song-log', t('log.serial.auto') + serial, 'info');
    }
  }
  return serial;
}

// Send the user to the device settings when the device can't be used yet.
function redirectToDeviceSettings(serial) {
  const msg = serial
    ? t('log.serial.unconfigured.pre') + serial + t('log.serial.unconfigured.post')
    : t('log.serial.required');
  log('song-log', msg + t('log.redirecting'), 'err');
  if (serial) $('dc-s').value = serial;
  showPage('settings');

  setTimeout(() => {
    const card = $('dc-s').closest('.card');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    $(serial ? 'dc-w' : 'dc-s').focus({ preventScroll: true });
    card.classList.add('attention');
    setTimeout(() => card.classList.remove('attention'), 2000);
  }, 50);
}

function submitRun() {
  const songId = parseInt($('song-id').value) || state.songId || 0;
  const chartPath = $('chart-path').value.trim();
  if (!songId && !chartPath) { log('song-log', t('log.no.song'), 'err'); return; }

  const serial = chooseDevice();
  if (!serial || !savedDevices()[serial]) { redirectToDeviceSettings(serial); return; }

  const body = {
    mode: state.mode,
    backend: state.backend,
    diff: diffName(state.mode, state.diff),
    orient: state.orient,
    songId,
    chartPath,
    deviceSerial: serial,
    nowPlaying: nowPlaying(),
    ...jitterSettings(),
    ...advancedSettings(),
  };
  log('song-log', t('log.loading'), 'info');
  expectOK(sendJSON('/api/run', body))
    .then(() => {
      log('song-log', t('log.sent'), 'ok');
      showPage('play');
    })
    .catch((e) => (e instanceof HTTPError ? log('song-log', t('log.fail') + e.message, 'err') : logConnFail('song-log')(e)));
}

export const songSetupActions = {
  setMode: (mode) => setMode(mode),
  setBackend: (backend) => setBackend(backend),
  setOrient: (orient) => setOrient(orient),
  setDiff: (i) => selectDiff(parseInt(i)),
  submitRun,
};
