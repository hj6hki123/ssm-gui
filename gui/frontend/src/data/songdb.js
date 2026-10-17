// The song database behind search: fetched from the backend once per game
// mode and normalized to one shape for both games.
//
// A song has musicTitle ([jp, en, tw, cn, kr] for BanG Dream, [title,
// pronunciation] for Project Sekai), difficulty ({index: {playLevel}}) and
// optionally bandId, creatorArtistId, jacketImage, credits and searchNames.

import { getJSON } from '../lib/http.js';
import { diffIndex } from './difficulty.js';

let pending = { mode: null, db: null }; // load in flight or done, as a promise
let loaded = { mode: null, db: null };  // finished load

// Fetches the song database for mode once; concurrent callers share the
// request, and a failed request is retried on the next call.
export function loadSongDB(mode) {
  if (pending.mode !== mode) {
    const db = getJSON('/api/songdb?mode=' + mode).then(normalizeSongDB);
    pending = { mode, db };
    db.then(
      (result) => { loaded = { mode, db: result }; },
      () => { if (pending.db === db) pending = { mode: null, db: null }; },
    );
  }
  return pending.db;
}

// The database for mode if it has already been loaded, else null.
export function loadedSongDB(mode) {
  return loaded.mode === mode ? loaded.db : null;
}

export function normalizeSongDB(payload) {
  if (!payload || !payload.songs) return { songs: {}, bands: {}, artists: {} };

  const songs = {};
  for (const [key, raw] of entries(payload.songs)) {
    const song = normalizeSong(raw);
    if (!song) continue;
    const id = Array.isArray(payload.songs) ? song.id : parseInt(key);
    if (id) songs[id] = song;
  }

  // Japanese titles become extra search names.
  for (const [key, jp] of entries(payload.songsJp)) {
    const id = Array.isArray(payload.songsJp) ? jp?.id : key;
    const song = jp && id ? songs[parseInt(id)] : null;
    if (!song) continue;
    addSearchName(song, jp.title || jp.musicTitle || '');
    addSearchName(song, jp.pronunciation || '');
  }

  for (const md of payload.musicDifficulties || []) {
    const song = md && songs[md.musicId || md.musicID || md.songId || 0];
    const idx = song ? diffIndex(md.musicDifficulty) : -1;
    if (idx < 0) continue;
    song.difficulty ||= {};
    song.difficulty[idx] = { playLevel: md.playLevel || 0, totalNoteCount: md.totalNoteCount || 0 };
  }

  const artists = {};
  for (const [key, a] of entries(payload.artists)) {
    const id = Array.isArray(payload.artists) ? a?.id : parseInt(key);
    if (a && id) artists[id] = a.name || a.pronunciation || '';
  }

  return { songs, bands: payload.bands || {}, artists };
}

// Bestdori entries already have the UI shape; Sekai entries are converted.
function normalizeSong(raw) {
  if (!raw) return null;
  if (raw.musicTitle) return raw;

  const id = raw.id || raw.ID;
  if (!id) return null;
  const title = raw.title || raw.Title || '';
  const pronunciation = raw.pronunciation || raw.Pronunciation || '';
  const credits = [raw.lyricist || raw.Lyricist, raw.composer || raw.Composer, raw.arranger || raw.Arranger];
  return {
    id,
    musicTitle: [title, pronunciation],
    difficulty: raw.difficulty || {},
    jacketImage: raw.jacketImage || null,
    creatorArtistId: raw.creatorArtistId || raw.CreatorArtistID || 0,
    assetbundleName: raw.assetbundleName,
    credits: credits.filter(Boolean).join(' / '),
    searchNames: [title, pronunciation].filter(Boolean),
  };
}

function addSearchName(song, name) {
  if (!name) return;
  song.searchNames ||= [];
  for (const n of [name, normalizeForSearch(name)]) {
    if (n && !song.searchNames.includes(n)) song.searchNames.push(n);
  }
}

function entries(collection) {
  if (Array.isArray(collection)) return collection.map((v, i) => [i, v]);
  return collection && typeof collection === 'object' ? Object.entries(collection) : [];
}

// Lowercase and drop spaces and punctuation (half- and full-width), so
// "Tell Your World" matches "tellyourworld".
export function normalizeForSearch(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[\s\-_.,:;!?[\]{}'"""~`・，。；！？「」『』（）]/g, '');
}

// Pick a display name from a localized name array: BanG Dream prefers the
// Taiwanese/English names, Project Sekai the original title.
export function pickName(names, preferFirst) {
  if (!names) return '';
  if (preferFirst) return names[0] || names[2] || names[1] || names[3] || names[4] || '';
  return names[2] || names[1] || names[0] || names[3] || names[4] || '';
}

export function songTitle(song, mode) {
  return pickName(song.musicTitle, mode === 'pjsk');
}

// The artist credited for a song: its Sekai artist or its BanG Dream band.
export function songArtist(db, song, mode) {
  if (mode === 'pjsk' && song.creatorArtistId) {
    const artist = db.artists[song.creatorArtistId];
    if (artist) return artist;
  }
  const band = db.bands[song.bandId];
  return band && band.bandName ? pickName(band.bandName) : '';
}

// Difficulty indices the song has, ascending.
export function availableDiffs(song) {
  return Object.keys(song.difficulty || {}).map(Number).sort();
}

const searchKeys = new WeakMap(); // song → [[lowercase, normalized], …]

// Songs whose names contain query, best matches first: exact title, then
// title prefix, then by id.
export function searchSongs(db, query, mode, limit = 40) {
  const lower = query.toLowerCase();
  const compact = normalizeForSearch(query);
  const results = [];
  for (const [key, song] of Object.entries(db.songs)) {
    if (!song || !song.musicTitle) continue;
    let keys = searchKeys.get(song);
    if (!keys) {
      const names = song.searchNames && song.searchNames.length ? song.searchNames : song.musicTitle;
      keys = names.filter(Boolean).map((n) => [String(n).toLowerCase(), normalizeForSearch(n)]);
      searchKeys.set(song, keys);
    }
    if (!keys.some(([l, c]) => l.includes(lower) || (compact && c.includes(compact)))) continue;
    results.push({ id: parseInt(key), song, artist: songArtist(db, song, mode) });
  }

  const rank = (r) => {
    const title = songTitle(r.song, mode).toLowerCase();
    return title === lower ? 0 : title.startsWith(lower) ? 1 : 2;
  };
  results.sort((a, b) => rank(a) - rank(b) || a.id - b.id);
  return results.slice(0, limit);
}

// Jacket image URLs for a song, most reliable first.
export function jacketUrls(mode, songId, song) {
  if (mode === 'pjsk') {
    const bundle = song.assetbundleName || 'jacket_s_' + String(songId || 0).padStart(3, '0');
    return [
      `https://storage.sekai.best/sekai-jp-assets/music/jacket/${bundle}/${bundle}.png`,
      `https://assets.pjsek.ai/file/pjsekai-assets/startapp/music/jacket/${bundle}/${bundle}.png`,
    ];
  }
  const image = song.jacketImage && song.jacketImage[0];
  if (!image) return [];
  const group = Math.ceil(songId / 10) * 10 || 10;
  return [`https://bestdori.com/assets/jp/musicjacket/musicjacket${group}_rip/assets-star-forassetbundle-startapp-musicjacket-musicjacket${group}-${image}-jacket.png`];
}
