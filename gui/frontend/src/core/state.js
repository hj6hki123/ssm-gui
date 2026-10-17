// State shared between views. Anything only one view needs lives in that view.

export const state = {
  mode: 'bang',      // 'bang' | 'pjsk'
  backend: 'adb',    // 'adb' | 'hid'
  orient: 'left',    // 'left' | 'right'
  diff: 3,           // difficulty index (0 = easy … 5 = append)
  songId: 0,         // selected song, 0 = none
  song: null,        // selected song's entry in the song database, if known
  playState: 0,      // PlayState pushed by the backend (see player.js)
  offset: 0,         // current offset, ms
};
