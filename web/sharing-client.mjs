import { parseSharedPlanContent } from './sharing-content.mjs';
const TOKEN = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
export function linkToken(location) {
  if (!['/s', '/s.html'].includes(location.pathname) || location.search || !TOKEN.test(location.hash.slice(1))) return null;
  return location.hash.slice(1);
}
export async function readContent(response) {
  if (!response.ok) throw new Error(response.status === 429 ? 'limited' : response.status === 404 ? 'unavailable' : 'connection');
  if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new Error('unavailable');
  const declared = response.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > 65536)) throw new Error('unavailable');
  if (!response.body) throw new Error('unavailable');
  const reader = response.body.getReader(); let size = 0; const chunks = [];
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 65536) { await reader.cancel(); throw new Error('unavailable'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return parseSharedPlanContent(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))); } catch { throw new Error('unavailable'); }
}
// Content is confined to text nodes and allowlisted map destinations. No HTML interpolation.
export function renderPlaces(document, list, content) {
  const rows = content.places.map((place, i) => {
    const row = document.createElement('li');
    const number = document.createElement('span'); number.className = 'number'; number.setAttribute('aria-hidden', 'true'); number.textContent = String(i + 1).padStart(2, '0');
    const details = document.createElement('div'); details.className = 'place-details';
    const heading = document.createElement('h2'); heading.textContent = place.name; details.append(heading);
    if (place.location) { const location = document.createElement('p'); location.textContent = place.location; details.append(location); }
    row.append(number, details);
    if (place.mapUrl) {
      const link = document.createElement('a'); link.className = 'map-link'; link.href = place.mapUrl; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer';
      link.textContent = 'Open Google Maps'; link.setAttribute('aria-label', `Open Google Maps for ${place.name} (new tab)`);
      row.append(link);
    }
    return row;
  });
  list.replaceChildren(...rows);
}
export function startSharingPage({ window, document, fetch, endpoint, nativeScheme = '' }) {
  const title = document.getElementById('plan-title'); const status = document.getElementById('status');
  const list = document.getElementById('places'); const refresh = document.getElementById('refresh');
  const openApp = document.getElementById('open-app');
  let sequence = 0; let controller; let stopped = false;
  function clear(message) {
    if (openApp) openApp.hidden = true;
    title.textContent = 'A place to start.'; list.replaceChildren(); list.hidden = true;
    status.textContent = message; document.getElementById('main').setAttribute('aria-busy', 'false');
  }
  function invalidate() { sequence++; controller?.abort(); controller = undefined; clear('Refresh to check this shortlist.'); refresh.disabled = false; }
  async function load() {
    invalidate(); const attempt = sequence;
    if (stopped || document.visibilityState === 'hidden') return;
    if (window.navigator?.serviceWorker?.controller) { clear('This browser session cannot check the latest shortlist. Try opening the link in a private window.'); refresh.hidden = true; return; }
    const token = linkToken(window.location);
    if (!token) { clear('This link is unavailable. Ask the person who sent it for a current link.'); refresh.hidden = true; return; }
    refresh.hidden = false;
    if (!endpoint) { clear('Sharing is not available here yet. Please try again later.'); return; }
    controller = new AbortController(); const signal = controller.signal;
    refresh.disabled = true; clear('Opening this shortlist…'); document.getElementById('main').setAttribute('aria-busy', 'true');
    const timeout = window.setTimeout(() => controller?.signal === signal && controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({token}),
        credentials:'omit', cache:'no-store', referrerPolicy:'no-referrer', redirect:'error', signal });
      const content = await readContent(response);
      if (stopped || attempt !== sequence || signal.aborted || document.visibilityState === 'hidden') return;
      if (openApp) openApp.hidden = !['project-lemonade','project-lemonade-dev'].includes(nativeScheme);
      title.textContent = content.title; renderPlaces(document, list, content); list.hidden = !content.places.length;
      status.textContent = content.places.length ? `${content.places.length} ${content.places.length === 1 ? 'place' : 'places'} · In the order shared` : 'No places yet. The owner can add some later; refresh to check for updates.';
    } catch (error) {
      if (stopped || attempt !== sequence || document.visibilityState === 'hidden') return;
      clear(error?.message === 'limited' ? 'Sharing is busy. Wait a minute, then refresh.' : error?.message === 'unavailable'
        ? 'This link is unavailable. Ask the person who sent it for a current link.' : 'We could not load this shortlist. Check your connection, then refresh.');
    } finally {
      window.clearTimeout(timeout);
      if (attempt === sequence && !stopped) { refresh.disabled = false; document.getElementById('main').setAttribute('aria-busy','false'); }
    }
  }
  const openNative = () => {
    const token = linkToken(window.location);
    if (!token || !['project-lemonade','project-lemonade-dev'].includes(nativeScheme) || openApp?.hidden) return;
    status.textContent = 'If Lemonade does not open, you can keep using this page. A compatible installed app is required.';
    try { window.location.assign(`${nativeScheme}://shared#${token}`); } catch { /* Browser fallback remains usable. */ }
  };
  openApp?.addEventListener('click',openNative);
  const skip = () => document.getElementById('main').focus();
  document.getElementById('skip').addEventListener('click',skip);
  const workerChanged = () => { invalidate(); void load(); };
  window.navigator?.serviceWorker?.addEventListener('controllerchange',workerChanged);
  const visibility = () => document.visibilityState === 'hidden' ? invalidate() : void load();
  const restored = event => { if (event.persisted) void load(); };
  const hide = () => invalidate();
  refresh.addEventListener('click', load); window.addEventListener('hashchange', load);
  window.addEventListener('pagehide', hide); window.addEventListener('pageshow', restored); document.addEventListener('visibilitychange', visibility);
  void load();
  return () => { openApp?.removeEventListener('click',openNative); window.navigator?.serviceWorker?.removeEventListener('controllerchange',workerChanged); document.getElementById('skip').removeEventListener('click',skip); stopped = true; invalidate(); refresh.removeEventListener('click', load); window.removeEventListener('hashchange',load);
    window.removeEventListener('pagehide',hide); window.removeEventListener('pageshow',restored); document.removeEventListener('visibilitychange',visibility); };
}
