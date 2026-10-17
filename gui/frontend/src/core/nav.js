// Switching between the sidebar pages.

import { $ } from '../lib/dom.js';

const onShow = {};

// fn runs every time the page is opened.
export function onPageShown(id, fn) {
  onShow[id] = fn;
}

export function showPage(id) {
  document.querySelectorAll('.nav-btn').forEach((b) => b.classList.remove('active'));
  document.querySelectorAll('.pane').forEach((p) => p.classList.remove('active'));
  $('nav-' + id).classList.add('active');
  $('pane-' + id).classList.add('active');
  onShow[id]?.();
}

export function isPageShown(id) {
  return $('pane-' + id).classList.contains('active');
}
