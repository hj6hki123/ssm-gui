// Extract page: unpack game assets from a folder pulled off the device.

import { $ } from '../lib/dom.js';
import { HTTPError, expectOK, sendJSON } from '../lib/http.js';
import { log, logConnFail } from '../lib/log.js';
import { t } from '../core/i18n.js';

function doExtract() {
  const path = $('ex-path').value.trim();
  if (!path) { log('ex-log', t('log.extract.no.path'), 'err'); return; }
  log('ex-log', t('log.extract.start') + path, 'info');
  expectOK(sendJSON('/api/extract', { path }))
    .then(() => log('ex-log', t('log.extract.done'), 'ok'))
    .catch((e) => (e instanceof HTTPError ? log('ex-log', t('log.extract.fail') + e.message, 'err') : logConnFail('ex-log')(e)));
}

export const extractActions = { doExtract };
