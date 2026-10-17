import { describe, expect, it } from 'vitest';
import { availableDiffs, jacketUrls, sameChartIds, normalizeForSearch, normalizeSongDB, pickName, searchSongs, songArtist } from './songdb.js';

// Bestdori (BanG Dream) payload: songs keyed by id, already in UI shape.
const bang = normalizeSongDB({
  songs: {
    1: { musicTitle: ['ティアドロップス', 'Teardrops', '淚滴', null, null], difficulty: { 3: { playLevel: 25 }, 0: { playLevel: 8 } }, bandId: 1, jacketImage: ['t1'] },
    2: { musicTitle: ['EXIST', 'EXIST', null, null, null], difficulty: {}, bandId: 2 },
    786: { musicTitle: ['ときめき (まりなver.)', 'Tokimeki'], difficulty: { 3: { playLevel: 25 }, 4: { playLevel: 26 } } },
    790: { musicTitle: ['ときめき (まりなver.)', 'Tokimeki'], difficulty: { 3: { playLevel: 25 }, 4: { playLevel: 27 } } },
    13: { musicTitle: ['Existence', 'Existence', null, null, null], difficulty: {}, bandId: 2 },
  },
  bands: { 1: { bandName: ['Poppin\'Party', null, null, null, null] }, 2: { bandName: ['Roselia', null, null, null, null] } },
});

// Sekai payload: arrays, difficulties and artists listed separately.
const sekai = normalizeSongDB({
  songs: [{ id: 11, title: 'Tell Your World', pronunciation: 'てるゆあわーるど', creatorArtistId: 1, lyricist: 'kz', composer: 'kz' }],
  songsJp: [{ id: 11, title: 'テルユアワールド' }],
  artists: [{ id: 1, name: 'livetune' }],
  musicDifficulties: [
    { musicId: 11, musicDifficulty: 'append', playLevel: 30 },
    { musicId: 11, musicDifficulty: 'master', playLevel: 29 },
    { musicId: 99, musicDifficulty: 'easy', playLevel: 5 },
  ],
});

describe('normalizeSongDB', () => {
  it('keeps Bestdori entries as they are', () => {
    expect(bang.songs[1].musicTitle[1]).toBe('Teardrops');
    expect(bang.bands[2].bandName[0]).toBe('Roselia');
  });

  it('converts Sekai entries and attaches difficulties, artists and credits', () => {
    const song = sekai.songs[11];
    expect(song.musicTitle).toEqual(['Tell Your World', 'てるゆあわーるど']);
    expect(song.difficulty).toEqual({ 4: { playLevel: 29, totalNoteCount: 0 }, 5: { playLevel: 30, totalNoteCount: 0 } });
    expect(song.credits).toBe('kz / kz');
    expect(sekai.artists[1]).toBe('livetune');
  });

  it('adds Japanese titles as search names', () => {
    expect(sekai.songs[11].searchNames).toContain('テルユアワールド');
  });

  it('tolerates an empty payload', () => {
    expect(normalizeSongDB(null)).toEqual({ songs: {}, bands: {}, artists: {} });
  });
});

describe('search', () => {
  it('ignores case, spaces and punctuation', () => {
    expect(normalizeForSearch('Tell Your World!')).toBe('tellyourworld');
    expect(searchSongs(sekai, 'tellyour', 'pjsk').map((r) => r.id)).toEqual([11]);
  });

  it('ranks exact titles, then prefixes, then by id', () => {
    expect(searchSongs(bang, 'exist', 'bang').map((r) => r.id)).toEqual([2, 13]);
    expect(searchSongs(bang, 'existence', 'bang').map((r) => r.id)).toEqual([13]);
  });

  it('matches any localized name', () => {
    expect(searchSongs(bang, '淚', 'bang').map((r) => r.id)).toEqual([1]);
  });

  it('credits the band, or the Sekai artist', () => {
    expect(searchSongs(bang, 'teardrops', 'bang')[0].artist).toBe('Poppin\'Party');
    expect(songArtist(sekai, sekai.songs[11], 'pjsk')).toBe('livetune');
  });
});

describe('sameChartIds', () => {
  it('finds the same title at the same level under another id', () => {
    expect(sameChartIds(bang, 786, 3)).toEqual([790]);
    expect(sameChartIds(bang, 790, 3)).toEqual([786]);
  });

  it('skips a different chart or a missing song', () => {
    expect(sameChartIds(bang, 786, 4)).toEqual([]);
    expect(sameChartIds(bang, 1, 3)).toEqual([]);
    expect(sameChartIds(bang, 999, 3)).toEqual([]);
  });
});

describe('song details', () => {
  it('lists available difficulties in order', () => {
    expect(availableDiffs(bang.songs[1])).toEqual([0, 3]);
  });

  it('prefers the Taiwanese/English name for BanG Dream and the original for Sekai', () => {
    expect(pickName(bang.songs[1].musicTitle)).toBe('淚滴');
    expect(pickName(sekai.songs[11].musicTitle, true)).toBe('Tell Your World');
  });

  it('builds jacket URLs for each game', () => {
    expect(jacketUrls('bang', 1, bang.songs[1])[0]).toContain('musicjacket10_rip/assets-star-forassetbundle-startapp-musicjacket-musicjacket10-t1-jacket.png');
    expect(jacketUrls('bang', 2, bang.songs[2])).toEqual([]);
    expect(jacketUrls('pjsk', 11, sekai.songs[11])[0]).toContain('/jacket_s_011/jacket_s_011.png');
  });
});
