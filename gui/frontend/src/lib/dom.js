// Small DOM helpers shared by every view.

export const $ = (id) => document.getElementById(id);

export function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function escAttr(s) {
  return esc(s).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Set the range input's --val fill percentage (drawn by the track gradient).
export function setSliderFill(slider) {
  const min = +slider.min || 0;
  const max = +slider.max || 100;
  slider.style.setProperty('--val', ((+slider.value - min) / (max - min)) * 100 + '%');
}

// Call fn for clicks outside every element matched by selector.
export function onClickOutside(selector, fn) {
  document.addEventListener('click', (e) => {
    if (!e.target.closest(selector)) fn(e);
  });
}
