// End-to-end test of the GUI frontend in jsdom.
//
// Loads the real index.html markup, stubs fetch and EventSource, imports
// main.js once (which wires every view to the DOM), then drives each feature
// through the same data-action delegation the browser uses and checks the
// resulting DOM. Pure data logic is unit-tested next to its module in data/.

import { describe, it, expect, beforeAll, vi } from 'vitest';
import htmlRaw from '../index.html?raw';
import enLocale from '../public/locales/en.json';
import zhTwLocale from '../public/locales/zh-TW.json';

// ── test doubles ────────────────────────────────────────────
let sse;                 // the EventSource main.js creates
const fetchCalls = [];   // [url, init] for every fetch

class MockEventSource {
  constructor(url) { this.url = url; this.onmessage = null; this.onerror = null; sse = this; }
  close() {}
}

const songDB = {
  songs: {
    325: {
      musicTitle: ['EXIST', 'EXIST'],
      difficulty: { 0: { playLevel: 9 }, 1: { playLevel: 14 }, 2: { playLevel: 20 }, 3: { playLevel: 26 } },
      bandId: 1,
      jacketImage: ['exist'],
    },
  },
  bands: { 1: { bandName: ['バンド', 'Band', '樂團', '乐团', ''] } },
};

const devices = { TESTSERIAL: { width: 1080, height: 2340 } };

function jsonResp(obj) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(obj),
    text: () => Promise.resolve(JSON.stringify(obj)),
  });
}

function mockFetch(url, init) {
  fetchCalls.push([String(url), init]);
  const u = String(url);
  if (u.includes('/locales/zh-TW.json')) return jsonResp(zhTwLocale);
  if (u.includes('/locales/')) return jsonResp(enLocale);
  if (u.includes('/api/device')) return jsonResp(devices);
  if (u.includes('/api/songdb')) return jsonResp(songDB);
  if (u.includes('/api/detect-adb')) return jsonResp({ serial: 'TESTSERIAL' });
  return jsonResp({}); // run / start / stop / offset / extract / kill-adb
}

const flush = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const click = (sel) => document.querySelector(sel).click();
const setInput = (sel, val) => {
  const el = document.querySelector(sel);
  el.value = val;
  el.dispatchEvent(new window.Event('input', { bubbles: true }));
  return el;
};

beforeAll(async () => {
  // Real markup from index.html (scripts in innerHTML stay inert).
  const doc = new DOMParser().parseFromString(htmlRaw, 'text/html');
  document.documentElement.innerHTML = doc.documentElement.innerHTML;

  globalThis.EventSource = MockEventSource;
  globalThis.fetch = vi.fn(mockFetch);

  // Import once; this runs all of main.js's init side effects.
  await import('./main.js');
  await flush();   // let I18n.init() + loadDevices() fetches resolve
  await flush();
});

describe('init', () => {
  it('opens an SSE connection and loads i18n + devices', () => {
    expect(sse).toBeTruthy();
    expect(sse.url).toBe('/api/events');
    expect(fetchCalls.some(([u]) => u.includes('/api/device'))).toBe(true);
    // [data-i18n] nodes were translated from the loaded locale
    expect(document.querySelector('#nav-song [data-i18n]').textContent).toBe(enLocale['nav.song']);
  });

  it('renders the saved device list with a delete control', () => {
    const row = document.querySelector('#dev-list .dev-row');
    expect(row).toBeTruthy();
    expect(row.textContent).toContain('TESTSERIAL');
    expect(document.querySelector('#dev-list [data-action="deleteDevice"]').dataset.serial).toBe('TESTSERIAL');
  });
});

describe('navigation', () => {
  it('switches panes via delegation', () => {
    for (const id of ['play', 'settings', 'extract', 'song']) {
      click(`#nav-${id}`);
      expect(document.getElementById(`pane-${id}`).classList.contains('active')).toBe(true);
    }
  });
});

describe('song setup controls', () => {
  it('toggles game mode and reveals the APPEND difficulty for pjsk', () => {
    click('[data-action="setMode"][data-arg="pjsk"]');
    expect(document.getElementById('mode-pjsk').classList.contains('active')).toBe(true);
    expect(document.querySelectorAll('.db')[5].hidden).toBe(false);
    click('[data-action="setMode"][data-arg="bang"]');
    expect(document.querySelectorAll('.db')[5].hidden).toBe(true);
  });

  it('switches backend and shows the HID warning only for HID', () => {
    click('[data-action="setBackend"][data-arg="hid"]');
    expect(document.getElementById('hid-warn-box').classList.contains('hidden')).toBe(false);
    click('[data-action="setBackend"][data-arg="adb"]');
    expect(document.getElementById('hid-warn-box').classList.contains('hidden')).toBe(true);
  });

  it('selects a difficulty', () => {
    click('.db[data-arg="2"]');
    const active = [...document.querySelectorAll('.db')].findIndex((b) => b.classList.contains('active'));
    expect(active).toBe(2);
  });

  it('sets orientation', () => {
    click('[data-action="setOrient"][data-arg="right"]');
    expect(document.getElementById('or').classList.contains('active')).toBe(true);
  });
});

describe('humanization + advanced sliders', () => {
  it('renders jitter values and OFF state', () => {
    setInput('#sld-timing', '20');
    expect(document.getElementById('val-timing').textContent).toBe('±20 ms');
    setInput('#sld-timing', '0');
    expect(document.getElementById('val-timing').textContent).toBe('OFF');
    setInput('#sld-position', '3');
    expect(document.getElementById('val-position').textContent).toMatch(/±\d+%/);
  });

  it('renders advanced VTE params with their formatting', () => {
    setInput('#sld-flickFactor', '25');
    expect(document.getElementById('val-flickFactor').textContent).toBe('0.25');
    setInput('#sld-flickPow', '15');
    expect(document.getElementById('val-flickPow').textContent).toBe('1.5');
  });
});

describe('search + song selection', () => {
  it('surfaces an error in the dropdown when the song DB fails to load', async () => {
    // Runs before the DB is cached: fail the next songdb fetch once.
    globalThis.fetch.mockImplementationOnce(() =>
      Promise.resolve({ ok: false, status: 500, json: () => Promise.resolve({}), text: () => Promise.resolve('') }));
    setInput('#q', 'exist');
    await flush(260);
    expect(document.getElementById('drop').textContent).toContain(enLocale['drop.error']);
  });

  it('shows matching results in the dropdown', async () => {
    setInput('#q', 'exist');
    await flush(220); // debounce + songdb fetch (now succeeds, caches S.db)
    const items = document.querySelectorAll('#drop .di');
    expect(items.length).toBeGreaterThan(0);
    expect(document.querySelector('#drop .di-title').textContent).toBe('EXIST');
  });

  it('selects a song from the dropdown', () => {
    document.querySelector('#drop .di[data-action="selSong"]').click();
    expect(document.getElementById('sb-id').textContent).toBe('#325');
    expect(document.getElementById('song-id').value).toBe('325');
    expect(document.getElementById('sel-bar').hidden).toBe(false);
  });
});

describe('SSE → now-playing render', () => {
  const np = { songId: 325, title: 'EXIST', artist: 'Band', diff: 'expert', diffLevel: 26, jacketUrl: 'http://x/j.png' };

  it('renders both the sidebar and play-deck cards from one message', () => {
    sse.onmessage({ data: JSON.stringify({ state: 2, offset: 7, nowPlaying: np, greatReq: 0, greatApply: 0 }) });
    expect(document.getElementById('np-card').hidden).toBe(false);
    expect(document.getElementById('np-title').textContent).toBe('EXIST');
    expect(document.getElementById('pn-title-big').textContent).toBe('EXIST');
    expect(document.getElementById('pn-diff-badge').textContent).toBe('EXPERT');
    expect(document.getElementById('ov').textContent).toBe('7');
    expect(document.getElementById('pn-dot').className).toContain('playing');
  });

  it('skips re-painting the jacket when the payload is unchanged', () => {
    const before = document.getElementById('pn-img').getAttribute('src');
    document.getElementById('pn-img').setAttribute('src', 'SENTINEL');
    sse.onmessage({ data: JSON.stringify({ state: 2, offset: 9, nowPlaying: np }) });
    // unchanged nowPlaying → renderNowPlaying is a no-op, src not reset
    expect(document.getElementById('pn-img').getAttribute('src')).toBe('SENTINEL');
    expect(document.getElementById('ov').textContent).toBe('9'); // offset still updates
    document.getElementById('pn-img').setAttribute('src', before || '');
  });

  it('ignores malformed SSE frames without throwing', () => {
    expect(() => sse.onmessage({ data: '{bad json' })).not.toThrow();
  });
});

describe('restart flow (re-arms the same song, no re-load)', () => {
  const np = { songId: 325, title: 'EXIST', artist: 'Band', diff: 'expert', diffLevel: 26, jacketUrl: 'http://x/j.png' };

  it('clicking Restart posts /api/restart', async () => {
    sse.onmessage({ data: JSON.stringify({ state: 2, offset: 0, nowPlaying: np }) }); // playing
    expect(document.getElementById('pn-loaded').hidden).toBe(false);
    fetchCalls.length = 0;
    document.querySelector('[data-action="apiRestart"]').click();
    await flush();
    expect(fetchCalls.some(([u]) => u.includes('/api/restart'))).toBe(true);
  });

  it('keeps the song on the deck through the brief idle while re-arming', () => {
    // Backend echoes the last nowPlaying in the idle frame during re-arm; the
    // deck must stay put (no clear / flicker / re-load).
    sse.onmessage({ data: JSON.stringify({ state: 0, offset: 0, nowPlaying: np }) });
    expect(document.getElementById('pn-loaded').hidden).toBe(false);
    expect(document.getElementById('pn-title-big').textContent).toBe('EXIST');
  });

  it('returns to Ready so Start is enabled again without re-loading', () => {
    sse.onmessage({ data: JSON.stringify({ state: 1, offset: 0, nowPlaying: np }) });
    expect(document.getElementById('btn-start').disabled).toBe(false);
    expect(document.getElementById('pn-loaded').hidden).toBe(false);
  });
});

describe('API actions', () => {
  it('submits a run for the selected, configured device', async () => {
    setInput('#dev-serial', 'TESTSERIAL');
    fetchCalls.length = 0;
    click('[data-action="submitRun"]');
    await flush();
    const run = fetchCalls.find(([u]) => u.includes('/api/run'));
    expect(run).toBeTruthy();
    const body = JSON.parse(run[1].body);
    expect(body.songId).toBe(325);
    expect(body.deviceSerial).toBe('TESTSERIAL');
  });

  it('saves and deletes a device', async () => {
    setInput('#dc-s', 'NEWDEV'); setInput('#dc-w', '1080'); setInput('#dc-h', '2400');
    fetchCalls.length = 0;
    click('[data-action="saveDevice"]');
    await flush();
    const post = fetchCalls.find(([u, i]) => u.includes('/api/device') && i && i.method === 'POST');
    expect(JSON.parse(post[1].body)).toMatchObject({ serial: 'NEWDEV', width: 1080, height: 2400 });

    fetchCalls.length = 0;
    document.querySelector('#dev-list [data-action="deleteDevice"]').click();
    await flush();
    const del = fetchCalls.find(([u, i]) => u.includes('/api/device') && i && i.method === 'DELETE');
    expect(del).toBeTruthy();
  });

  it('sends offset adjustments (debounced)', async () => {
    fetchCalls.length = 0;
    click('[data-action="adj"][data-arg="50"]');
    await flush(80);
    const off = fetchCalls.find(([u]) => u.includes('/api/offset'));
    expect(JSON.parse(off[1].body).delta).toBe(50);
  });

  it('triggers extraction', async () => {
    setInput('#ex-path', './gamedata');
    fetchCalls.length = 0;
    click('[data-action="doExtract"]');
    await flush();
    expect(fetchCalls.some(([u]) => u.includes('/api/extract'))).toBe(true);
  });
});

describe('theme + i18n', () => {
  it('toggles the theme', () => {
    const before = document.documentElement.getAttribute('data-theme');
    click('[data-action="toggleTheme"]');
    expect(document.documentElement.getAttribute('data-theme')).not.toBe(before);
  });

  it('switches language through the menu', async () => {
    click('[data-action="toggleLangMenu"]');
    document.querySelector('.lang-opt[data-arg="zh-TW"]').click();
    await flush(); await flush();
    expect(document.documentElement.lang).toBe('zh-TW');
    expect(document.querySelector('#nav-song [data-i18n]').textContent).toBe(zhTwLocale['nav.song']);
  });
});

describe('log box', () => {
  it('caps entries at 200', () => {
    const box = document.getElementById('play-log');
    for (let i = 0; i < 260; i++) {
      sse.onmessage({ data: JSON.stringify({ state: 1, offset: 0, greatReq: i, greatApply: i }) });
    }
    expect(box.childElementCount).toBeLessThanOrEqual(200);
  });
});

describe('manual song id', () => {
  it('resolves a known id against the loaded DB (title + difficulty availability)', () => {
    // DB is cached from the search tests; id 325 is known with diffs 0-3.
    setInput('#song-id', '325');
    expect(document.getElementById('sel-bar').hidden).toBe(false);
    expect(document.getElementById('sb-id').textContent).toBe('#325');
    expect(document.getElementById('sb-title').textContent).toBe('EXIST'); // real title, not "Manual input"
    expect(document.querySelectorAll('.db')[4].classList.contains('dis')).toBe(true); // SPECIAL unavailable
  });

  it('clears the selection when the id field is emptied', () => {
    setInput('#song-id', '');
    expect(document.getElementById('sel-bar').hidden).toBe(true);
  });
});

describe('regressions', () => {
  // The UI language may have been switched by an earlier test.
  const either = (key) => [enLocale[key], zhTwLocale[key]];

  it('asks for a folder when extracting with an empty path', () => {
    setInput('#ex-path', '');
    click('[data-action="doExtract"]');
    const last = document.getElementById('ex-log').lastElementChild.textContent;
    expect(either('log.extract.no.path').some((m) => last.includes(m))).toBe(true);
  });

  it('keeps a visible difficulty selected when leaving PJSK on APPEND', () => {
    click('[data-action="setMode"][data-arg="pjsk"]');
    click('[data-action="setDiff"][data-arg="5"]');
    click('[data-action="setMode"][data-arg="bang"]');
    expect(document.querySelector('.db.active').dataset.arg).toBe('3');
  });

  it('shows the placeholder when every jacket URL fails', () => {
    const np = { songId: 77, title: 'NO ART', diff: 'easy', jacketUrl: 'http://x/missing.png' };
    sse.onmessage({ data: JSON.stringify({ state: 1, nowPlaying: np }) });
    const img = document.getElementById('pn-img');
    img.onerror(); // the only URL fails
    expect(img.hidden).toBe(true);
    expect(document.getElementById('pn-no').hidden).toBe(false);
  });

  it('reports a device save that never reached the backend', async () => {
    fetch.mockImplementationOnce(() => Promise.reject(new Error('offline')));
    setInput('#dc-s', 'OFFLINE'); setInput('#dc-w', '1'); setInput('#dc-h', '1');
    click('[data-action="saveDevice"]');
    await flush();
    expect(either('dc.hint.fail')).toContain(document.getElementById('dc-hint').textContent);
  });
});
