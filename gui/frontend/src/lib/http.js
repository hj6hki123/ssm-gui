// Requests to the local backend.

export async function getJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

export function sendJSON(url, body, method = 'POST') {
  return fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export function post(url) {
  return fetch(url, { method: 'POST' });
}

// Rejects with the response text when the request failed, so callers can
// show the backend's error message.
export async function expectOK(response) {
  const r = await response;
  if (!r.ok) throw new HTTPError(await r.text());
  return r;
}

export class HTTPError extends Error {}
