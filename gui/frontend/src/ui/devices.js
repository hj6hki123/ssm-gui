// Devices: the saved list on the settings page, the serial picker on the song
// page, and adb helpers.

import { $, esc, escAttr, onClickOutside } from '../lib/dom.js';
import { getJSON, post, sendJSON } from '../lib/http.js';
import { log, logConnFail } from '../lib/log.js';
import { t } from '../core/i18n.js';
import { onPageShown } from '../core/nav.js';

let devices = {}; // serial → {width, height}

// Devices saved with a resolution, as last loaded.
export function savedDevices() {
  return devices;
}

export function initDevices() {
  onPageShown('settings', loadDevices);
  onClickOutside('#dev-drop, #btn-dev-drop', closeSerialPicker);
}

export function loadDevices() {
  return getJSON('/api/device').then((list) => {
    devices = list || {};
    renderDeviceList();
  }).catch(logConnFail('song-log'));
}

// Entries carry data-i18n so they are re-translated on a language switch.
function renderDeviceList() {
  const entries = Object.entries(devices);
  $('dev-list').innerHTML = entries.length
    ? entries.map(([serial, d]) => '<div class="dev-row">'
      + `<span class="dev-s">${esc(serial)}</span><span>${d.width} × ${d.height}</span>`
      + `<button class="btn-del" data-action="deleteDevice" data-serial="${escAttr(serial)}" data-i18n="settings.device.delete">${t('settings.device.delete')}</button>`
      + '</div>').join('')
    : `<div class="dev-empty" data-i18n="device.none">${t('device.none')}</div>`;
}

function setHint(key) {
  $('dc-hint').textContent = t(key);
}

function saveDevice() {
  const serial = $('dc-s').value.trim();
  const width = parseInt($('dc-w').value) || 0;
  const height = parseInt($('dc-h').value) || 0;
  if (!serial || !width || !height) { setHint('dc.hint.missing'); return; }
  sendJSON('/api/device', { serial, width, height })
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      setHint('dc.hint.saved');
      loadDevices();
    })
    .catch(() => setHint('dc.hint.fail'));
}

function deleteDevice(serial) {
  sendJSON('/api/device', { serial }, 'DELETE')
    .then((r) => {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      loadDevices();
    })
    .catch(() => setHint('dc.hint.fail'));
}

// ── Serial picker on the song page ────────────────────────────

function openSerialPicker() {
  getJSON('/api/device').then((list) => {
    const drop = $('dev-drop');
    drop.classList.add('dev-drop-style');
    const serials = Object.keys(list);
    drop.innerHTML = serials.length
      ? serials.map((s) => `<div class="di" data-action="selectDevSerial" data-serial="${escAttr(s)}">`
        + `<span class="di-id">${esc(s)}</span>`
        + `<div class="di-info"><div class="di-title">${list[s].width} × ${list[s].height}</div></div>`
        + '</div>').join('')
      : `<div class="drop-hint">${t('device.none')}</div>`;
    drop.classList.add('open');
  }).catch(logConnFail('song-log'));
}

function closeSerialPicker() {
  $('dev-drop').classList.remove('open');
}

// ── adb helpers ───────────────────────────────────────────────

function killAdbServer() {
  log('song-log', t('log.adb.killing'), 'info');
  post('/api/kill-adb')
    .then((r) => {
      if (r.ok) log('song-log', t('log.adb.killed'), 'ok');
      else log('song-log', t('log.adb.kill.fail'), 'err');
    })
    .catch(logConnFail('song-log'));
}

function autoDetectDevice() {
  const input = $('dev-serial');
  input.placeholder = t('log.detect.detecting');
  getJSON('/api/detect-adb')
    .then(({ serial }) => {
      if (serial) {
        input.value = serial;
        log('song-log', t('log.detect.found') + serial, 'ok');
      } else {
        log('song-log', t('log.detect.none'), 'err');
        input.placeholder = '';
      }
    })
    .catch(() => {
      log('song-log', t('log.detect.fail'), 'err');
      input.placeholder = '';
    });
}

export const deviceActions = {
  saveDevice,
  deleteDevice: (arg, el) => deleteDevice(el.dataset.serial),
  toggleDevDrop() {
    if ($('dev-drop').classList.contains('open')) closeSerialPicker();
    else openSerialPicker();
  },
  selectDevSerial(arg, el) {
    $('dev-serial').value = el.dataset.serial;
    closeSerialPicker();
  },
  killAdbServer,
  autoDetectDevice,
};
