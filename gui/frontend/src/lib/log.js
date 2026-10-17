// The terminal-style log boxes under each page.

import { $ } from './dom.js';
import { t } from '../core/i18n.js';

const LOG_MAX = 200;

export function log(boxId, msg, type = '') {
  const box = $(boxId);
  const line = document.createElement('div');
  line.className = 'll ' + type;
  line.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  box.appendChild(line);
  // Cap the log so long sessions don't grow the DOM without bound.
  while (box.childElementCount > LOG_MAX) box.removeChild(box.firstElementChild);
  box.scrollTop = box.scrollHeight;
}

// A .catch handler that logs a failed request to the given log box.
export function logConnFail(boxId) {
  return (e) => log(boxId, t('log.conn.fail') + e, 'err');
}
