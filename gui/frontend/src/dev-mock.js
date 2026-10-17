// Development only (npm run dev): Ctrl+Shift+D loads a fake song on the play
// page so the player can be styled without a device.

import { showPage } from './core/nav.js';
import { log } from './lib/log.js';
import { renderStatus } from './ui/player.js';

document.addEventListener('keydown', (e) => {
  if (!(e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'd')) return;
  e.preventDefault();
  renderStatus({
    state: 1,
    offset: 0,
    nowPlaying: {
      songId: 999,
      title: 'DEBUG MOCK SONG ~Test Track~',
      artist: 'System Tester',
      diff: 'expert',
      diffLevel: 28,
      jacketUrl: 'https://bestdori.com/assets/jp/musicjacket/musicjacket10_rip/assets-star-forassetbundle-startapp-musicjacket-musicjacket10-10-jacket.png',
    },
  });
  showPage('play');
  log('play-log', 'Debug test song loaded.', 'info');
});
