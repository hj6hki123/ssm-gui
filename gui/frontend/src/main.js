// Entry point: initializes every view and wires the data-action handlers.
//
// Layout:
//   lib/   DOM, HTTP and log helpers
//   core/  app-wide pieces: shared state, i18n, theme, page switching, actions
//   data/  pure data: difficulties, the song database and search
//   ui/    one module per part of the page

import './style.css';
import { listenForActions, registerActions } from './core/actions.js';
import { initI18n, onLanguageChange, selectLanguage, toggleLangMenu } from './core/i18n.js';
import { showPage } from './core/nav.js';
import { state } from './core/state.js';
import { initTheme, toggleTheme } from './core/theme.js';
import { diffName } from './data/difficulty.js';
import { setAccent } from './ui/accent.js';
import { deviceActions, initDevices, loadDevices } from './ui/devices.js';
import { renderDiffButtons } from './ui/difficulty-picker.js';
import { extractActions } from './ui/extract.js';
import { initPlayer, playerActions } from './ui/player.js';
import { initSearch, searchActions } from './ui/search.js';
import { setBackend, songSetupActions } from './ui/song-setup.js';
import { renderAllJitters, resetAdvanced, tuningActions } from './ui/tuning.js';

// Click-outside handlers must be registered before the action listeners.
const i18nReady = initI18n();
initDevices();
initSearch();
initPlayer();

initTheme();
setAccent(diffName(state.mode, state.diff));
setBackend(state.backend);
renderDiffButtons();
resetAdvanced();
onLanguageChange(renderAllJitters);

registerActions({
  nav: (page) => showPage(page),
  toggleTheme,
  toggleLangMenu,
  selectLanguage: (id) => selectLanguage(id),
  ...songSetupActions,
  ...searchActions,
  ...deviceActions,
  ...tuningActions,
  ...playerActions,
  ...extractActions,
});
listenForActions();

// Rendered once translations are in, so dynamic labels are never shown untranslated.
i18nReady.then(loadDevices);

if (import.meta.env.DEV) import('./dev-mock.js');
