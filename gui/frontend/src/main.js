import './style.css'
// ══ i18n engine ════════════════════════════════════════════
const I18n = (function () {
  const langs = {};
  const langMeta = [
    { id: 'en', shortName: 'EN', nativeName: 'English' },
    { id: 'zh-TW', shortName: '繁中', nativeName: '繁體中文' },
    { id: 'zh-CN', shortName: '简中', nativeName: '简体中文' },
    { id: 'ja', shortName: 'JP', nativeName: '日本語' },
  ];
  let current = 'en';

  function loadLang(id, cb) {
    if (langs[id]) { cb(); return; }
    fetch('/locales/' + id + '.json')
      .then(function (r) { return r.json(); })
      .then(function (d) { langs[id] = d; cb(); })
      .catch(function () { langs[id] = {}; cb(); });
  }

  function detectLang() {
    const nav = (navigator.language || 'en').toLowerCase();
    if (nav.startsWith('zh-tw') || nav.startsWith('zh-hant')) return 'zh-TW';
    if (nav.startsWith('zh')) return 'zh-CN';
    if (nav.startsWith('ja')) return 'ja';
    return 'en';
  }

  function t(key) {
    const d = langs[current] || {};
    return d[key] !== undefined ? d[key] : ((langs['en'] || {})[key] || key);
  }

  function apply(id, save) {
    current = id;
    if (save) { try { localStorage.setItem('ssm-lang', id); } catch (e) { } }
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.innerHTML = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });
    const meta = langMeta.filter(function (m) { return m.id === id; })[0] || langMeta[0];
    document.getElementById('lb-name').textContent = meta.shortName;
    document.querySelectorAll('.lang-opt').forEach(function (opt) {
      opt.classList.toggle('active', opt.getAttribute('data-lang') === id);
    });
    document.documentElement.lang = id;
  }

  function buildMenu() {
    const menu = document.getElementById('lang-menu');
    if (!menu) return;
    menu.innerHTML = langMeta.map(function (m) {
      return '<div class="lang-opt" data-lang="' + m.id + '" data-action="langSelect" data-arg="' + m.id + '">'
        + '<div class="lo-info"><span class="lo-name">' + m.shortName + '</span>'
        + '<span class="lo-native">' + m.nativeName + '</span></div></div>';
    }).join('');
  }

  function init() {
    buildMenu();
    let saved; try { saved = localStorage.getItem('ssm-lang'); } catch (e) { }
    const target = saved || detectLang();
    loadLang(target, function () {
      apply(target, false);
    });
  }

  return {
    t: t, apply: apply,
    select: function (id) {
      loadLang(id, function () {
        apply(id, true); closeLangMenu();
        updateDynamicTexts(); renderAllJitters();
      });
    },
    init: init,
    loadLang: loadLang,
  };
})();

function t(key) { return I18n.t(key); }

function toggleLangMenu() {
  const menu = document.getElementById('lang-menu');
  const btn = document.getElementById('lang-btn');
  const open = menu.classList.toggle('open');
  btn.classList.toggle('open', open);
}
function closeLangMenu() {
  document.getElementById('lang-menu').classList.remove('open');
  document.getElementById('lang-btn').classList.remove('open');
}
document.addEventListener('click', function (e) { if (!e.target.closest('#lang-picker')) closeLangMenu(); });

const THEME_KEY = 'ssm-theme';

function applyTheme(theme, save) {
  const t = theme === 'light' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  document.documentElement.classList.toggle('dark', t === 'dark');
  const ico = document.getElementById('theme-ico');
  if (ico) ico.textContent = t === 'dark' ? '☾' : '☀';
  if (save) {
    try { localStorage.setItem(THEME_KEY, t); } catch (e) { }
  }
}

function initTheme() {
  let saved;
  try { saved = localStorage.getItem(THEME_KEY); } catch (e) { }
  if (saved === 'light' || saved === 'dark') {
    applyTheme(saved, false);
    return;
  }
  applyTheme('dark', false);
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(cur === 'dark' ? 'light' : 'dark', true);
}

function toggleDevDrop(e) {
  e.stopPropagation();
  const drop = document.getElementById('dev-drop');
  if (drop.classList.contains('open')) {
    drop.classList.remove('open');
  } else {
    loadDevOptions();
  }
}


function loadDevOptions() {
  fetch('/api/device')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (d) {
      const drop = document.getElementById('dev-drop');
      drop.classList.add('dev-drop-style');
      const keys = Object.keys(d);

      if (!keys.length) {
        drop.innerHTML = '<div class="drop-hint">' + t('device.none') + '</div>';
      } else {
        drop.innerHTML = keys.map(function (s) {
          return '<div class="di" data-action="selectDevSerial" data-serial="' + escAttr(s) + '">'
            + '<span class="di-id">' + esc(s) + '</span>'
            + '<div class="di-info"><div class="di-title">' + d[s].width + ' × ' + d[s].height + '</div></div>'
            + '</div>';
        }).join('');
      }
      drop.classList.add('open');
    })
    .catch(logConnFail('song-log'));
}


function selectDevSerial(s) {
  document.getElementById('dev-serial').value = s;
  document.getElementById('dev-drop').classList.remove('open');
}

document.addEventListener('click', function (e) {
  if (!e.target.closest('#dev-drop') && e.target.id !== 'btn-dev-drop') {
    document.getElementById('dev-drop').classList.remove('open');
  }
});
// ══ jitter ═════════════════════════════════════════════════
const JITTER_POS_MAP = [0, 0.02, 0.04, 0.06, 0.08, 0.10, 0.12, 0.15, 0.18, 0.22, 0.25];

function jitterRealValue(key, raw) {
  raw = parseInt(raw);
  return key === 'position' ? (JITTER_POS_MAP[raw] || 0) : raw;
}

function getGreatCountRaw() {
  const inp = document.getElementById('inp-grCount');
  let raw = parseInt(inp ? inp.value : 0);
  if (!isFinite(raw) || raw < 0) raw = 0;
  return raw;
}

// Set the slider's --val fill percentage (used by the track gradient).
function setSliderFill(sld) {
  const min = +sld.min || 0, max = +sld.max || 100;
  sld.style.setProperty('--val', ((+sld.value - min) / (max - min)) * 100 + '%');
}

function renderJitter(key) {
  const raw = key === 'grCount' ? getGreatCountRaw() : parseInt(document.getElementById('sld-' + key).value);
  const el = document.getElementById('val-' + key);

  if (key !== 'grCount') setSliderFill(document.getElementById('sld-' + key));

  if (key !== 'grOffset' && raw === 0) { el.textContent = 'OFF'; el.style.color = 'var(--hint)'; return; }
  el.style.color = 'var(--blue)';
  if (key === 'position') {
    el.textContent = '±' + Math.round((JITTER_POS_MAP[raw] || 0) * 100) + '%';
  } else if (key === 'grOffset') {
    el.textContent = raw + ' ms';
  } else if (key === 'grCount') {
    el.textContent = raw + ' notes';
  } else {
    el.textContent = '±' + raw + ' ms';
  }
}

function renderAllJitters() { ['timing', 'position', 'tapDur', 'grOffset', 'grCount'].forEach(renderJitter); }
function onJitter(key) { renderJitter(key); }
function onGreatCountInput() { renderJitter('grCount'); }

// ══ state ══════════════════════════════════════════════════
const S = { backend: 'adb', diff: 3, orient: 'left', mode: 'bang', state: 0, offset: 0, songId: 0, songData: null, db: null, dropIdx: -1, _lastLogState: -1, _lastGreatSig: '' };
const DN_BANG = ['easy', 'normal', 'hard', 'expert', 'special'];
const DN_PJSK = ['easy', 'normal', 'hard', 'expert', 'master', 'append'];
const DL_BANG = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'SPECIAL'];
const DL_PJSK = ['EASY', 'NORMAL', 'HARD', 'EXPERT', 'MASTER', 'APPEND'];
const DOT_CLS = { 1: 'ready', 2: 'playing', 3: 'done', 4: 'error' };
const STATE_MAP = { 0: 'state.idle', 1: 'state.ready.full', 2: 'state.playing.full', 3: 'state.done.full', 4: 'state.error.full' };
const DIFF_COLORS = { easy: '#5ba3e0', normal: '#7ab84a', hard: '#d4921e', expert: '#e06060', special: '#9b95e0', append: '#4f8ff7' };

function diffName(i) {
  const dn = S.mode === 'pjsk' ? DN_PJSK : DN_BANG;
  return dn[i] || dn[3];
}

function diffLabel(i) {
  const dl = S.mode === 'pjsk' ? DL_PJSK : DL_BANG;
  return dl[i] || dl[3];
}

function updateDiffLabels() {
  const btns = document.querySelectorAll('.db');
  if (!btns || !btns.length) return;
  if (btns[4]) btns[4].textContent = diffLabel(4);
  if (btns[5]) {
    btns[5].textContent = diffLabel(5);
    btns[5].style.display = S.mode === 'pjsk' ? '' : 'none';
  }
}

function updateDynamicTexts() {
  const txt = t(STATE_MAP[S.state] || 'state.idle');
  const e1 = document.getElementById('np-state-txt'), e2 = document.getElementById('pn-state-label');
  if (e1) e1.textContent = txt; if (e2) e2.textContent = txt;
  const btn = document.getElementById('btn-start');
  if (btn) btn.innerHTML = t('play.start.btn');
  if (document.getElementById('pane-settings').classList.contains('active')) loadDevices();
}

function nav(id) {
  document.querySelectorAll('.nav-btn').forEach(function (e) { e.classList.remove('active'); });
  document.querySelectorAll('.pane').forEach(function (e) { e.classList.remove('active'); });
  document.getElementById('nav-' + id).classList.add('active');
  document.getElementById('pane-' + id).classList.add('active');
  if (id === 'settings') loadDevices();
}
function navToSearch() {
  nav('song');

  setTimeout(function () {
    const searchInput = document.getElementById('q');
    if (searchInput) {
      searchInput.focus({ preventScroll: true });

      const searchCard = searchInput.closest('.card');
      if (searchCard) {
        searchCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, 50);
}
function setMode(m) {
  S.mode = m; S.db = null; if (S.songId) clearSong();

  // Update active state on the mode buttons.
  ['bang', 'pjsk'].forEach(function (x) {
    document.getElementById('mode-' + x).classList.toggle('active', x === m);
  });

  if (m === 'pjsk') {
    ADV_DEFAULTS.flickDuration = 20; ADV_DEFAULTS.flickFactor = 17;
  } else {
    ADV_DEFAULTS.flickDuration = 60; ADV_DEFAULTS.flickFactor = 20;
  }
  updateDiffLabels();
  // APPEND only exists in PJSK; fall back to EXPERT so a visible button stays selected.
  if (m !== 'pjsk' && S.diff === 5) setDiff(3);
  resetAdvanced();
}
function setBackend(b) {
  S.backend = b;
  ['hid', 'adb'].forEach(function (x) { document.getElementById('backend-' + x).classList.toggle('active', x === b); });
  const warnBox = document.getElementById('hid-warn-box');
    if (warnBox) {
      if (b === 'hid') {
        warnBox.classList.remove('hidden');
      } else {
        warnBox.classList.add('hidden');
      }
    }

  document.getElementById('orient-wrap').style.opacity = b === 'adb' ? '0.4' : '1';
}
function setOrient(o) {
  S.orient = o;
  document.getElementById('ol').classList.toggle('active', o === 'left');
  document.getElementById('or').classList.toggle('active', o === 'right');
}
function setDiff(i) {
  const btns = document.querySelectorAll('.db');

  // Guard: if this difficulty is disabled, ignore the click.
  if (btns[i] && btns[i].classList.contains('dis')) {
    return;
  }

  S.diff = i;
  btns.forEach(function (b, j) {
    b.classList.toggle('active', j === i);
  });

  // Keep play-panel glow synced with current difficulty even before playback starts.
  applyJacketColor(getDiffThemeColor(diffName(i)));
}
function setDiffAvail(avail) {
  document.querySelectorAll('.db').forEach(function (b, i) {
    const ok = !avail || avail.indexOf(i) >= 0;
    b.classList.toggle('dis', !ok);
    if (!ok && S.diff === i) setDiff(avail ? avail[avail.length - 1] : 3);
  });
}

// ══ search ═════════════════════════════════════════════════
let qTimer = null;
function onQInput() {
  const v = document.getElementById('q').value;
  document.getElementById('sc').style.display = v ? 'block' : 'none';
  clearTimeout(qTimer); if (!v.trim()) { closeDrop(); return; }
  qTimer = setTimeout(function () { doSearch(v.trim()); }, 160);
}
function onQFocus() { const v = document.getElementById('q').value.trim(); if (v) doSearch(v); }
function clearQ() { document.getElementById('q').value = ''; document.getElementById('sc').style.display = 'none'; closeDrop(); }

function loadDB(cb, onErr) {
  if (S.db) { cb(S.db); return; }
  fetch('/api/songdb?mode=' + S.mode)
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
    .then(function (d) {
      S.db = normalizeSongDB(d);
      cb(S.db);
    })
    .catch(function (e) {
      logConnFail('song-log')(e);
      if (onErr) onErr(e);
    });
}

// Show a single-line hint inside the search dropdown (loading / error / etc.).
function showDropHint(text) {
  const drop = document.getElementById('drop');
  drop.innerHTML = '<div class="drop-hint">' + esc(text) + '</div>';
  drop.classList.add('open');
}

function normalizeSong(rawSong) {
  if (!rawSong) return null;

  // Bestdori payload is already close to the UI schema.
  if (rawSong.musicTitle) {
    return rawSong;
  }

  const id = rawSong.id || rawSong.ID;
  if (!id) return null;

  const title = rawSong.title || rawSong.Title || '';
  const pronunciation = rawSong.pronunciation || rawSong.Pronunciation || '';
  const lyricist = rawSong.lyricist || rawSong.Lyricist || '';
  const composer = rawSong.composer || rawSong.Composer || '';
  const arranger = rawSong.arranger || rawSong.Arranger || '';

  return {
    id: id,
    musicTitle: [title, pronunciation],
    difficulty: rawSong.difficulty || {},
    jacketImage: rawSong.jacketImage || null,
    creatorArtistId: rawSong.creatorArtistId || rawSong.CreatorArtistID || 0,
    __artist: [lyricist, composer, arranger].filter(Boolean).join(' / '),
    __searchNames: [title, pronunciation].filter(Boolean),
    __raw: rawSong,
  };
}

function normalizeSongDB(payload) {
  if (!payload || !payload.songs) {
    return { songs: {}, bands: {}, artists: {} };
  }

  function addSearchName(song, name) {
    if (!song || !name) return;
    if (!song.__searchNames) song.__searchNames = [];
    if (song.__searchNames.indexOf(name) < 0) song.__searchNames.push(name);
    const compact = normalizeForSearch(name);
    if (compact && song.__searchNames.indexOf(compact) < 0) song.__searchNames.push(compact);
  }

  const songs = {};
  if (Array.isArray(payload.songs)) {
    payload.songs.forEach(function (s) {
      const n = normalizeSong(s);
      if (n && n.id) songs[n.id] = n;
    });
  } else {
    Object.keys(payload.songs).forEach(function (sid) {
      const n = normalizeSong(payload.songs[sid]);
      if (n) songs[parseInt(sid)] = n;
    });
  }

  // Handle songsJp for adding Japanese search names
  if (payload.songsJp) {
    const jpArray = Array.isArray(payload.songsJp) ? payload.songsJp : [];
    const jpObject = (typeof payload.songsJp === 'object' && !Array.isArray(payload.songsJp)) ? payload.songsJp : {};

    // Process array format
    jpArray.forEach(function (jp) {
      if (!jp || !jp.id) return;
      const songId = parseInt(jp.id);
      const song = songs[songId];
      if (!song) return;
      const jpTitle = jp.title || jp.musicTitle || '';
      const jpPronunciation = jp.pronunciation || '';
      if (jpTitle) addSearchName(song, jpTitle);
      if (jpPronunciation) addSearchName(song, jpPronunciation);
    });

    // Process object format (key = id)
    Object.keys(jpObject).forEach(function (id) {
      const jp = jpObject[id];
      if (!jp) return;
      const songId = parseInt(id);
      const song = songs[songId];
      if (!song) return;
      const jpTitle = jp.title || jp.musicTitle || '';
      const jpPronunciation = jp.pronunciation || '';
      if (jpTitle) addSearchName(song, jpTitle);
      if (jpPronunciation) addSearchName(song, jpPronunciation);
    });
  }

  function diffIndexByName(name) {
    switch (String(name || '').toLowerCase()) {
      case 'easy': return 0;
      case 'normal': return 1;
      case 'hard': return 2;
      case 'expert': return 3;
      case 'special': return 4;
      case 'master': return 4;
      case 'append': return 5;
      default: return -1;
    }
  }

  if (Array.isArray(payload.musicDifficulties)) {
    payload.musicDifficulties.forEach(function (md) {
      if (!md) return;
      const songId = md.musicId || md.musicID || md.songId || 0;
      const song = songs[songId];
      if (!song) return;
      const idx = diffIndexByName(md.musicDifficulty);
      if (idx < 0) return;
      if (!song.difficulty) song.difficulty = {};
      song.difficulty[idx] = {
        playLevel: md.playLevel || 0,
        totalNoteCount: md.totalNoteCount || 0,
      };
    });
  }

  const artists = {};
  if (Array.isArray(payload.artists)) {
    payload.artists.forEach(function (a) {
      if (!a || !a.id) return;
      artists[a.id] = a.name || a.pronunciation || '';
    });
  } else if (payload.artists) {
    Object.keys(payload.artists).forEach(function (aid) {
      const a = payload.artists[aid];
      if (!a) return;
      artists[parseInt(aid)] = a.name || a.pronunciation || '';
    });
  }

  return {
    songs: songs,
    bands: payload.bands || {},
    artists: artists,
  };
}

function pickName(arr, preferFirst) {
  if (!arr) return '';
  if (preferFirst) return arr[0] || arr[2] || arr[1] || arr[3] || arr[4] || '';
  return arr[2] || arr[1] || arr[0] || arr[3] || arr[4] || '';
}
function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function escAttr(s) { return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;'); }

function normalizeForSearch(s) {
  // Remove spaces and common punctuation (including full-width and half-width)
  return String(s || '')
    .toLowerCase()
    .replace(/[\s\-_.,:;!?[\]{}'"""~`・，。；！？「」『』（）]/g, '');
}

function doSearch(q) {
  // First search has to fetch the (large) song DB; show feedback instead of a
  // dead-looking empty box, and surface failures in the dropdown itself.
  if (!S.db) showDropHint(t('drop.loading'));
  loadDB(function (db) {
    const ql = q.toLowerCase(), qc = normalizeForSearch(q), res = [];
    Object.keys(db.songs).forEach(function (sid) {
      const id = parseInt(sid), song = db.songs[sid];
      if (!song || !song.musicTitle) return;
      // Cache the lowercased / normalized search keys per song so they are
      // computed once instead of on every keystroke across the whole library.
      let si = song.__si;
      if (!si) {
        const names = (song.__searchNames && song.__searchNames.length) ? song.__searchNames : song.musicTitle;
        si = song.__si = (names || []).reduce(function (acc, n) {
          if (n) acc.push([String(n).toLowerCase(), normalizeForSearch(n)]);
          return acc;
        }, []);
      }
      const hit = si.some(function (e) {
        return e[0].indexOf(ql) >= 0 || (qc && e[1].indexOf(qc) >= 0);
      });
      if (!hit) return;
      const band = db.bands[song.bandId];
      let artist = '';
      if (S.mode === 'pjsk' && db.artists && song.creatorArtistId) {
        artist = db.artists[song.creatorArtistId] || '';
      }
      if (!artist && band && band.bandName) {
        artist = pickName(band.bandName);
      }
      res.push({ id: id, song: song, band: artist });
    });
    res.sort(function (a, b) {
      const at = pickName(a.song.musicTitle, S.mode === 'pjsk').toLowerCase(), bt = pickName(b.song.musicTitle, S.mode === 'pjsk').toLowerCase();
      const ae = at === ql, be = bt === ql; if (ae && !be) return -1; if (!ae && be) return 1;
      const as = at.startsWith(ql), bs = bt.startsWith(ql); if (as && !bs) return -1; if (!as && bs) return 1;
      return a.id - b.id;
    });
    renderDrop(res.slice(0, 40));
  }, function () {
    showDropHint(t('drop.error'));
  });
}

function renderDrop(res) {
  const drop = document.getElementById('drop');
  if (!res.length) { drop.innerHTML = '<div class="drop-hint">' + t('drop.none') + '</div>'; drop.classList.add('open'); return; }
  drop.innerHTML = res.map(function (r) {
    const title = pickName(r.song.musicTitle, S.mode === 'pjsk');
    const dh = Object.keys(r.song.difficulty || {}).map(Number).sort().map(function (d) { return '<span class="di-d d-' + diffName(d) + '">' + diffLabel(d) + '</span>'; }).join('');
    return '<div class="di" data-action="selSong" data-arg="' + r.id + '">'
      + '<span class="di-id">#' + r.id + '</span>'
      + '<div class="di-info"><div class="di-title">' + esc(title) + '</div>'
      + (r.band ? '<div class="di-band">' + esc(r.band) + '</div>' : '')
      + '</div><div class="di-diffs">' + dh + '</div></div>';
  }).join('');
  drop.classList.add('open'); S.dropIdx = -1;
}

function closeDrop() { document.getElementById('drop').classList.remove('open'); S.dropIdx = -1; }
function onQKey(e) {
  const items = document.getElementById('drop').querySelectorAll('.di');
  if (e.key === 'ArrowDown') { e.preventDefault(); S.dropIdx = Math.min(S.dropIdx + 1, items.length - 1); hiDrop(items); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); S.dropIdx = Math.max(S.dropIdx - 1, -1); hiDrop(items); }
  else if (e.key === 'Enter' && S.dropIdx >= 0 && items[S.dropIdx]) items[S.dropIdx].click();
  else if (e.key === 'Escape') closeDrop();
}
function hiDrop(items) { items.forEach(function (el, i) { el.classList.toggle('hi', i === S.dropIdx); if (i === S.dropIdx) el.scrollIntoView({ block: 'nearest' }); }); }
document.addEventListener('click', function (e) { if (!e.target.closest('.sw')) closeDrop(); });

function selSong(id) {
  loadDB(function (db) {
    const song = db.songs[id]; if (!song) return;
    S.songId = id; S.songData = song;
    const title = pickName(song.musicTitle, S.mode === 'pjsk');
    document.getElementById('sb-id').textContent = '#' + id;
    document.getElementById('sb-title').textContent = title;
    document.getElementById('sel-bar').classList.add('show');
    document.getElementById('q').value = ''; document.getElementById('sc').style.display = 'none';
    document.getElementById('song-id').value = id; closeDrop();
    const avail = Object.keys(song.difficulty || {}).map(Number).sort();
    setDiffAvail(avail.length ? avail : null);
    log('song-log', '#' + id + ' ' + title, 'ok');
  });
}
function clearSong() {
  S.songId = 0; S.songData = null;
  document.getElementById('sel-bar').classList.remove('show');
  document.getElementById('song-id').value = '';
  document.getElementById('q').value = ''; document.getElementById('sc').style.display = 'none';
  setDiffAvail(null); closeDrop();
}
function onManualId() {
  const v = parseInt(document.getElementById('song-id').value) || 0;
  if (v > 0) {
    // If the song DB is already loaded and knows this id, surface its real
    // title and available difficulties right away instead of waiting for the
    // backend to reject an unavailable difficulty after Load.
    const song = (S.db && S.db.songs) ? S.db.songs[v] : null;
    S.songId = v; S.songData = song || null;
    document.getElementById('sb-id').textContent = '#' + v;
    document.getElementById('sb-title').textContent = song ? pickName(song.musicTitle, S.mode === 'pjsk') : t('manual.title');
    document.getElementById('sel-bar').classList.add('show');
    if (song) {
      const avail = Object.keys(song.difficulty || {}).map(Number).sort();
      setDiffAvail(avail.length ? avail : null);
    } else {
      setDiffAvail(null);
    }
  } else {
    // Field was cleared — drop the selection so a stale id isn't submitted.
    S.songId = 0; S.songData = null;
    document.getElementById('sel-bar').classList.remove('show');
    setDiffAvail(null);
  }
}

// ══ log ════════════════════════════════════════════════════
const LOG_MAX = 200;
function log(boxId, msg, type) {
  const box = document.getElementById(boxId);
  const l = document.createElement('div'); l.className = 'll ' + (type || '');
  l.textContent = '[' + new Date().toLocaleTimeString() + '] ' + msg;
  box.appendChild(l);
  // Cap the log so long sessions don't grow the DOM without bound.
  while (box.childElementCount > LOG_MAX) box.removeChild(box.firstElementChild);
  box.scrollTop = box.scrollHeight;
}

// ══ SSE ════════════════════════════════════════════════════
let _sseDown = false;
const es = new EventSource('/api/events');
es.onmessage = function (e) {
  let d;
  try { d = JSON.parse(e.data); } catch (err) { return; }  // ignore malformed frames
  if (_sseDown) { _sseDown = false; log('play-log', t('log.sse.reconnect'), 'ok'); }
  S.state = d.state; S.offset = d.offset || 0; updateUI(d);
};
es.onerror = function () {
  // EventSource auto-reconnects; surface the dropped connection once so the
  // UI doesn't look frozen when the backend restarts.
  if (!_sseDown) { _sseDown = true; log('play-log', t('log.sse.lost'), 'err'); }
};

function updateUI(d) {
  const st = d.state, dotCls = DOT_CLS[st] || '';
  const npDot = document.getElementById('np-dot');
  if (npDot) npDot.className = 'dot ' + dotCls;
  document.getElementById('pn-dot').className = 'dot ' + dotCls;

  const npCard = document.getElementById('np-card');
  if (npCard) {
    npCard.classList.remove('np-state-idle', 'np-state-ready', 'np-state-playing', 'np-state-done', 'np-state-error');
    if (st === 1) npCard.classList.add('np-state-ready');
    else if (st === 2) npCard.classList.add('np-state-playing');
    else if (st === 3) npCard.classList.add('np-state-done');
    else if (st === 4) npCard.classList.add('np-state-error');
    else npCard.classList.add('np-state-idle');
  }

  // Sync jacket-wrap playing class
  const jw = document.getElementById('pn-jacket-wrap');
  if (jw) {
    jw.classList.toggle('playing', st === 2);  // 2 = StatePlaying
  }

  // Add playing-glow class to player-deck when playing
  const deck = document.querySelector('.player-deck');
  if (deck) {
    deck.classList.toggle('playing-glow', st === 2);
  }

  const txt = t(STATE_MAP[st] || 'state.idle');
  document.getElementById('np-state-txt').textContent = txt;
  document.getElementById('pn-state-label').textContent = txt;
  document.getElementById('ov').textContent = d.offset || 0;
  const btn = document.getElementById('btn-start');
  // Label is set via data-i18n (and updateDynamicTexts on language change), so
  // updateUI only flips the ready/disabled state per SSE frame.
  btn.disabled = st !== 1;
  btn.classList.toggle('rdy', st === 1);
  if (d.nowPlaying && (d.nowPlaying.songId > 0 || d.nowPlaying.title)) renderNowPlaying(d.nowPlaying);
  if (st !== S._lastLogState) {
    S._lastLogState = st;
    if (st === 1) log('play-log', t('log.ready'), 'info');
    if (st === 2) log('play-log', t('log.playing'), 'info');
    if (st === 3) log('play-log', t('log.done'), 'ok');
    if (st === 4 && d.error) log('play-log', t('log.fail') + d.error, 'err');
  }

  if (st === 1 && typeof d.greatReq === 'number' && typeof d.greatApply === 'number') {
    const greatSig = String(d.greatReq) + '/' + String(d.greatApply);
    if (greatSig !== S._lastGreatSig) {
      S._lastGreatSig = greatSig;
      log('play-log', t('log.great.pre') + d.greatApply + t('log.great.mid') + d.greatReq, d.greatApply > 0 ? 'ok' : 'info');
    }
  }
}

// Paint a jacket <img> with multi-URL fallback, toggling its "no artwork"
// placeholder sibling.
function paintJacket(imgId, noId, np) {
  const img = document.getElementById(imgId);
  const placeholder = document.getElementById(noId);
  function showPlaceholder() {
    img.onerror = null;
    img.removeAttribute('src');
    img.style.display = 'none';
    placeholder.style.display = 'flex';
  }
  if (!np.jacketUrl) { showPlaceholder(); return; }
  img.style.display = 'block';
  placeholder.style.display = 'none';
  setImageWithFallback(img, np.jacketUrls && np.jacketUrls.length ? np.jacketUrls : [np.jacketUrl], showPlaceholder);
}

function setDiffBadge(id, rawDiff) {
  const el = document.getElementById(id);
  el.className = 'np-diff d-' + normalizeDiffKey(rawDiff || 'expert');
  el.textContent = String(rawDiff || '').toUpperCase();
}

// Render both the sidebar mini-card and the play-deck card from one NowPlaying
// payload. Guarded by a signature so the per-message SSE stream doesn't re-set
// the jacket src (which caused reload flicker) or redo DOM work every tick.
let _npSig = '';
function renderNowPlaying(np) {
  const sig = [np.songId, np.title, np.artist, np.diff, np.diffLevel, np.jacketUrl].join('');
  if (sig === _npSig) return;
  _npSig = sig;

  // sidebar mini-card
  document.getElementById('np-card').style.display = 'block';
  paintJacket('np-img', 'np-no', np);
  document.getElementById('np-title').textContent = np.title || '—';
  document.getElementById('np-artist').textContent = np.artist || '';
  setDiffBadge('np-diff', np.diff);
  document.getElementById('np-lv').textContent = np.diffLevel ? 'Lv.' + np.diffLevel : '';

  // play-deck card
  document.getElementById('pn-none').style.display = 'none';
  document.getElementById('pn-loaded').style.display = 'block';
  paintJacket('pn-img', 'pn-no', np);
  document.getElementById('pn-title-big').textContent = np.title || '—';
  document.getElementById('pn-artist-big').textContent = np.artist || '';
  setDiffBadge('pn-diff-badge', np.diff);
  document.getElementById('pn-lv-big').textContent = np.diffLevel ? 'Lv.' + np.diffLevel : '';
  applyJacketColor(getDiffThemeColor(normalizeDiffKey(np.diff || 'expert')));
}

function normalizeDiffKey(diff) {
  const key = String(diff || '').toLowerCase();
  if (key === 'master') return 'special';
  if (key === 'append') return 'append';
  return key;
}

function getDiffThemeColor(diff) {
  const key = normalizeDiffKey(diff);
  return DIFF_COLORS[key] || '#3b82f6';
}

function applyJacketColor(themeColor) {
  const wrap = document.getElementById('pn-jacket-wrap');
  if (wrap) {
    wrap.style.setProperty('--jacket-color', themeColor);
    wrap.classList.toggle('is-append', themeColor === '#4f8ff7' || themeColor === '#f26ec9');
  }

  const deck = document.querySelector('.player-deck');
  if (deck) {
    deck.style.setProperty('--jacket-color', themeColor);
    deck.classList.toggle('is-append', themeColor === '#4f8ff7' || themeColor === '#f26ec9');
  }

  // Mirror to root so all descendants and pseudo-elements resolve the same value.
  document.documentElement.style.setProperty('--jacket-color', themeColor);
  document.documentElement.classList.toggle('is-append-diff', themeColor === '#4f8ff7' || themeColor === '#f26ec9');
}

// Try each URL in turn; call onAllFailed when none of them loads.
function setImageWithFallback(imgEl, urls, onAllFailed) {
  let i = 0;
  function tryNext() {
    if (i >= urls.length) {
      imgEl.onerror = null;
      onAllFailed();
      return;
    }
    const u = urls[i++];
    imgEl.onerror = tryNext;
    imgEl.src = u;
  }
  tryNext();
}

// ══ keyboard ═══════════════════════════════════════════════
document.addEventListener('keydown', function (e) {
  if (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA') return;
  if (!document.getElementById('pane-play').classList.contains('active')) return;
  switch (e.key) {
    case 'Enter': case ' ': e.preventDefault(); apiStart(); break;
    case 'ArrowLeft': e.preventDefault(); adj(e.ctrlKey || e.metaKey ? -100 : e.shiftKey ? -50 : -10); break;
    case 'ArrowRight': e.preventDefault(); adj(e.ctrlKey || e.metaKey ? 100 : e.shiftKey ? 50 : 10); break;
  }
});

// ══ API ════════════════════════════════════════════════════
function sendJSON(url, body, method) {
  return fetch(url, { method: method || 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}

// Returns a .catch handler that logs a network failure to the given log box.
function logConnFail(boxId) {
  return function (e) { log(boxId, t('log.conn.fail') + e, 'err'); };
}

function buildNowPlaying() {
  const np = { songId: S.songId, diff: diffName(S.diff), mode: S.mode, title: '', artist: '', diffLevel: 0, jacketUrl: '', jacketUrls: [] };
  if (S.songData) {
    np.title = pickName(S.songData.musicTitle, S.mode === 'pjsk') || '';
    const di = S.songData.difficulty; if (di && di[S.diff]) np.diffLevel = di[S.diff].playLevel || 0;
    const ji = S.songData.jacketImage;
    if (S.mode === 'pjsk') {
      const raw = S.songData.__raw || {};
      const bundle = raw.assetbundleName || ('jacket_s_' + String(S.songId || 0).padStart(3, '0'));
      np.jacketUrls = [
        'https://storage.sekai.best/sekai-jp-assets/music/jacket/' + bundle + '/' + bundle + '.png',
        'https://assets.pjsek.ai/file/pjsekai-assets/startapp/music/jacket/' + bundle + '/' + bundle + '.png'
      ];
      np.jacketUrl = np.jacketUrls[0];
    } else if (ji && ji[0]) {
      const n = Math.ceil(S.songId / 10) * 10 || 10;
      np.jacketUrl = 'https://bestdori.com/assets/jp/musicjacket/musicjacket' + n + '_rip/assets-star-forassetbundle-startapp-musicjacket-musicjacket' + n + '-' + ji[0] + '-jacket.png';
      np.jacketUrls = [np.jacketUrl];
    }
    if (S.mode === 'pjsk' && S.db && S.db.artists && S.songData.creatorArtistId) {
      np.artist = S.db.artists[S.songData.creatorArtistId] || '';
    }
    if (S.db && S.db.bands && S.songData.bandId) { const band = S.db.bands[S.songData.bandId]; if (band && band.bandName) np.artist = pickName(band.bandName); }
    if (!np.artist && S.songData.__artist) np.artist = S.songData.__artist;
  }
  return np;
}

function submitRun() {
  const sid = parseInt(document.getElementById('song-id').value) || S.songId || 0;
  const cp = document.getElementById('chart-path').value.trim();
  let ds = document.getElementById('dev-serial').value.trim();
  if (!sid && !cp) { log('song-log', t('log.no.song'), 'err'); return; }

  const dsInput = document.getElementById('dev-serial');

  if (!ds) {
      const savedSerials = Object.keys(S.devices || {});
      if (savedSerials.length > 0) {
        ds = savedSerials[0];
        dsInput.value = ds;
        log('song-log', t('log.serial.auto') + ds, 'info');
      }
    }

  const isConfigured = S.devices && S.devices[ds];

  if (!ds || !isConfigured) {
    const errorMsg = !ds
      ? t('log.serial.required')
      : t('log.serial.unconfigured.pre') + ds + t('log.serial.unconfigured.post');

    log('song-log', errorMsg + t('log.redirecting'), 'err');

    if (ds) document.getElementById('dc-s').value = ds;

    nav('settings');

    setTimeout(function () {
      const devCard = document.getElementById('dc-s').closest('.card');
      if (devCard) {
        devCard.scrollIntoView({ behavior: 'smooth', block: 'center' });

        const focusTarget = !ds ? 'dc-s' : 'dc-w';
        document.getElementById(focusTarget).focus({ preventScroll: true });

        devCard.style.transition = 'box-shadow 0.3s ease, border-color 0.3s ease';
        devCard.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.4)';
        devCard.style.borderColor = '#ef4444';

        setTimeout(function () {
          devCard.style.boxShadow = '';
          devCard.style.borderColor = '';
        }, 2000);
      }
    }, 50);
    return;
  }

  const tRaw = parseInt(document.getElementById('sld-timing').value) || 0;
  const pRaw = parseInt(document.getElementById('sld-position').value) || 0;
  const dRaw = parseInt(document.getElementById('sld-tapDur').value) || 0;
  const grOffsetRaw = parseInt(document.getElementById('sld-grOffset').value) || 10;
  const grCountRaw = getGreatCountRaw();
  const adv = getAdvancedValues();
  const body = { mode: S.mode, backend: S.backend, diff: diffName(S.diff), orient: S.orient, songId: sid, chartPath: cp, deviceSerial: ds, nowPlaying: buildNowPlaying(), timingJitter: tRaw, positionJitter: jitterRealValue('position', pRaw), tapDurJitter: dRaw, greatOffsetMs: grOffsetRaw, greatCount: grCountRaw, tapDuration: adv.tapDuration, flickDuration: adv.flickDuration, flickReportInterval: adv.flickReportInterval, slideReportInterval: adv.slideReportInterval, flickFactor: adv.flickFactor, flickPow: adv.flickPow };
  log('song-log', t('log.loading'), 'info');
  sendJSON('/api/run', body)
    .then(function (r) { if (r.ok) { log('song-log', t('log.sent'), 'ok'); nav('play'); } else r.text().then(function (tx) { log('song-log', t('log.fail') + tx, 'err'); }); })
    .catch(logConnFail('song-log'));
}

function apiStart() { if (S.state !== 1) return; fetch('/api/start', { method: 'POST' }).catch(logConnFail('play-log')); }
function apiRestart() { fetch('/api/restart', { method: 'POST' }).catch(logConnFail('play-log')); }

// Offset nudges are batched for 50 ms so holding an arrow key sends one request.
let _adjTimer = null, _adjPending = 0;
function sendOffset(delta) { sendJSON('/api/offset', { delta: delta }).catch(logConnFail('play-log')); }
function adj(d) {
  _adjPending += d;
  clearTimeout(_adjTimer);
  _adjTimer = setTimeout(function () {
    if (_adjPending === 0) return;
    const delta = _adjPending;
    _adjPending = 0;
    sendOffset(delta);
  }, 50);
}
function resetOff() {
  _adjPending = 0;
  clearTimeout(_adjTimer);
  if (S.offset !== 0) sendOffset(-S.offset);
}

// ══ devices ════════════════════════════════════════════════
function loadDevices() {
  fetch('/api/device').then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).then(function (d) {
    S.devices = d || {};
    const list = document.getElementById('dev-list');
    if (!d || !Object.keys(d).length) { list.innerHTML = '<div style="font-size:12px;color:var(--hint)">' + t('device.none') + '</div>'; return; }
    list.innerHTML = Object.entries(d).map(function (e) { return '<div class="dev-row"><span class="dev-s">' + esc(e[0]) + '</span><span>' + e[1].width + ' × ' + e[1].height + '</span><button class="btn-del" data-action="deleteDevice" data-serial="' + escAttr(e[0]) + '">' + t('settings.device.delete') + '</button></div>'; }).join('');
  }).catch(logConnFail('song-log'));
}
function saveDevice() {
  const s = document.getElementById('dc-s').value.trim(), w = parseInt(document.getElementById('dc-w').value) || 0, h = parseInt(document.getElementById('dc-h').value) || 0;
  if (!s || !w || !h) { document.getElementById('dc-hint').textContent = t('dc.hint.missing'); return; }
  const hint = document.getElementById('dc-hint');
  sendJSON('/api/device', { serial: s, width: w, height: h })
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      hint.textContent = t('dc.hint.saved');
      loadDevices();
    })
    .catch(function () { hint.textContent = t('dc.hint.fail'); });
}
function deleteDevice(serial) {
  sendJSON('/api/device', { serial: serial }, 'DELETE')
    .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); loadDevices(); })
    .catch(function () { document.getElementById('dc-hint').textContent = t('dc.hint.fail'); });
}

// ══ ADB & Device Utilities ════════════════════════════════
function killAdbServer() {
  log('song-log', t('log.adb.killing'), 'info');
  fetch('/api/kill-adb', { method: 'POST' })
    .then(function (r) {
      if (r.ok) log('song-log', t('log.adb.killed'), 'ok');
      else log('song-log', t('log.adb.kill.fail'), 'err');
    })
    .catch(logConnFail('song-log'));
}

function autoDetectDevice() {
  const dsInput = document.getElementById('dev-serial');
  dsInput.placeholder = t('log.detect.detecting');

  fetch('/api/detect-adb')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.serial) {
        dsInput.value = d.serial;
        log('song-log', t('log.detect.found') + d.serial, 'ok');
      } else {
        log('song-log', t('log.detect.none'), 'err');
        dsInput.placeholder = "";
      }
    })
    .catch(function (e) {
      log('song-log', t('log.detect.fail'), 'err');
      dsInput.placeholder = "";
    });
}


// ══ advanced VTE params ════════════════════════════════════
const ADV_DEFAULTS = { tapDuration: 10, flickDuration: 60, flickReportInterval: 5, slideReportInterval: 10, flickFactor: 20, flickPow: 10 };
function onAdvanced(key) {
  const raw = parseInt(document.getElementById('sld-' + key).value);
  const el = document.getElementById('val-' + key);

  setSliderFill(document.getElementById('sld-' + key));

  if (key === 'flickFactor') {
    el.textContent = (raw / 100).toFixed(2);
  } else if (key === 'flickPow') {
    el.textContent = (raw / 10).toFixed(1);
  } else {
    el.textContent = raw;
  }
  el.style.color = 'var(--blue)';
}
function resetAdvanced() {
  Object.keys(ADV_DEFAULTS).forEach(function (key) {
    document.getElementById('sld-' + key).value = ADV_DEFAULTS[key];
    onAdvanced(key);
  });
}
function getAdvancedValues() {
  return {
    tapDuration: parseInt(document.getElementById('sld-tapDuration').value) || 10,
    flickDuration: parseInt(document.getElementById('sld-flickDuration').value) || 60,
    flickReportInterval: parseInt(document.getElementById('sld-flickReportInterval').value) || 5,
    slideReportInterval: parseInt(document.getElementById('sld-slideReportInterval').value) || 10,
    flickFactor: (parseInt(document.getElementById('sld-flickFactor').value) || 20) / 100,
    flickPow: (parseInt(document.getElementById('sld-flickPow').value) || 10) / 10,
  };
}
// ══ extraction ═════════════════════════════════════════════
function doExtract() {
  const p = document.getElementById('ex-path').value.trim();
  if (!p) { log('ex-log', t('log.extract.no.path'), 'err'); return; }
  log('ex-log', t('log.extract.start') + p, 'info');
  sendJSON('/api/extract', { path: p })
    .then(function (r) { if (r.ok) log('ex-log', t('log.extract.done'), 'ok'); else r.text().then(function (tx) { log('ex-log', t('log.extract.fail') + tx, 'err'); }); })
    .catch(logConnFail('ex-log'));
}
// ══ initialization ═════════════════════════════════════════
I18n.init();
initTheme();
applyJacketColor(getDiffThemeColor(diffName(S.diff)));
setBackend(S.backend);
updateDiffLabels();
resetAdvanced();
loadDevices();

// ══ event delegation ═══════════════════════════════════════
// One set of delegated listeners replaces the old inline on* attributes and
// the window-global exposure. Markup opts in via data-action / data-oninput /
// data-onkeydown / data-onfocus, with an optional data-arg payload. Handlers
// receive (arg, element, event).
const ACTIONS = {
  toggleLangMenu, toggleTheme, navToSearch, killAdbServer, autoDetectDevice,
  clearSong, clearQ, submitRun, apiStart, apiRestart, resetOff, resetAdvanced,
  doExtract, saveDevice, onQInput, onQFocus, onManualId, onGreatCountInput,
  nav: function (arg) { nav(arg); },
  setMode: function (arg) { setMode(arg); },
  setBackend: function (arg) { setBackend(arg); },
  setOrient: function (arg) { setOrient(arg); },
  setDiff: function (arg) { setDiff(parseInt(arg)); },
  adj: function (arg) { adj(parseInt(arg)); },
  onJitter: function (arg) { onJitter(arg); },
  onAdvanced: function (arg) { onAdvanced(arg); },
  langSelect: function (arg) { I18n.select(arg); },
  selSong: function (arg) { selSong(parseInt(arg)); },
  selectDevSerial: function (arg, el) { selectDevSerial(el.dataset.serial); },
  deleteDevice: function (arg, el) { deleteDevice(el.dataset.serial); },
  toggleDevDrop: function (arg, el, e) { toggleDevDrop(e); },
  onQKey: function (arg, el, e) { onQKey(e); },
};

function dispatch(attr, e) {
  const el = e.target.closest('[' + attr + ']');
  if (!el) return;
  const fn = ACTIONS[el.getAttribute(attr)];
  if (fn) fn(el.dataset.arg, el, e);
}
document.addEventListener('click', function (e) { dispatch('data-action', e); });
document.addEventListener('input', function (e) { dispatch('data-oninput', e); });
document.addEventListener('keydown', function (e) { dispatch('data-onkeydown', e); });
document.addEventListener('focusin', function (e) { dispatch('data-onfocus', e); });


// ══ Development mode ════════════════════════════════
if (import.meta.env.DEV) {
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd') {
      e.preventDefault();

      const mockNp = {
        songId: 999,
        title: 'DEBUG MOCK SONG ~Test Track~',
        artist: 'System Tester',
        diff: 'expert',
        diffLevel: 28,
        jacketUrl: 'https://bestdori.com/assets/jp/musicjacket/musicjacket10_rip/assets-star-forassetbundle-startapp-musicjacket-musicjacket10-10-jacket.png'
      };

      S.songId = 999;
      S.diff = 3;
      S.state = 1;


      renderNowPlaying(mockNp);

      updateUI({
        state: 1,
        offset: 0,
        nowPlaying: mockNp
      });

      nav('play');
      log('play-log', 'Debug test song loaded.', 'info');
    }
  });
}
