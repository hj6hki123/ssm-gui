// Event delegation. Markup opts in with data-action (click), data-oninput,
// data-onkeydown or data-onfocus naming a registered handler, plus an optional
// data-arg. Handlers are called as handler(arg, element, event).

const handlers = {};

export function registerActions(map) {
  Object.assign(handlers, map);
}

export function listenForActions() {
  const bind = (type, attr) => document.addEventListener(type, (e) => {
    const el = e.target.closest(`[${attr}]`);
    const handler = el && handlers[el.getAttribute(attr)];
    if (handler) handler(el.dataset.arg, el, e);
  });
  bind('click', 'data-action');
  bind('input', 'data-oninput');
  bind('keydown', 'data-onkeydown');
  bind('focusin', 'data-onfocus');
}
