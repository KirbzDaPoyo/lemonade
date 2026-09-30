// Shared, dependency-free boundary: imported by the Edge runtime and local tests.
export type Credential = { keyId: string; nonce: string; ciphertext: string };
export type PublicPlan = { schemaVersion: 1; title: string; places: { name: string; location: string | null; mapUrl: string | null }[] };
type RecordValue = Record<string, unknown>;
const encoder = new TextEncoder();
export const TOKEN = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export class SharingError extends Error {
  constructor(public code: string, public status = 400) { super('Sharing operation failed'); }
}
function object(value: unknown): RecordValue {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SharingError('invalid');
  return value as RecordValue;
}
function exact(value: RecordValue, keys: string[]) {
  if (Object.keys(value).some(key => !keys.includes(key))) throw new SharingError('invalid');
}
function boundedText(value: unknown, max: number): string {
  if (typeof value !== 'string' || !value.trim() || [...value.trim()].length > max || /[\u0000-\u001f\u007f]/u.test(value))
    throw new SharingError('invalid');
  return value.trim();
}
function encode(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new SharingError('configuration', 503);
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)), c => c.charCodeAt(0));
}
export async function digest(value: string): Promise<string> {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)))].map(b => b.toString(16).padStart(2, '0')).join('');
}
export function tokenKeys(raw: string | undefined): Record<string, string> {
  try {
    const keys = object(JSON.parse(raw ?? '{}'));
    if (!Object.keys(keys).length || Object.keys(keys).length > 4) throw Error();
    for (const [id, key] of Object.entries(keys)) {
      if (!/^[A-Za-z0-9_-]{1,32}$/.test(id) || typeof key !== 'string' || !TOKEN.test(key) || decode(key).length !== 32) throw Error();
    }
    return keys as Record<string, string>;
  } catch { throw new SharingError('configuration', 503); }
}
async function keyFor(keys: Record<string, string>, id: string) {
  if (!Object.hasOwn(keys, id)) throw new SharingError('configuration', 503);
  return crypto.subtle.importKey('raw', decode(keys[id]), 'AES-GCM', false, ['encrypt', 'decrypt']);
}
export async function mintCredential(keys: Record<string, string>, id: string, plan: string, revision: number) {
  const token = encode(crypto.getRandomValues(new Uint8Array(32)));
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce,
    additionalData: encoder.encode(plan + ':' + revision) }, await keyFor(keys, id), encoder.encode(token));
  return { token, verifier: await digest(token), credential: { keyId: id, nonce: encode(nonce), ciphertext: encode(new Uint8Array(ciphertext)) } };
}
export async function recoverCredential(keys: Record<string, string>, value: unknown, plan: string, revision: number, verifier: string) {
  try {
    const c = object(value);
    const token = new TextDecoder('utf-8', { fatal: true }).decode(await crypto.subtle.decrypt({
      name: 'AES-GCM', iv: decode(String(c.nonce)), additionalData: encoder.encode(plan + ':' + revision)
    }, await keyFor(keys, String(c.keyId)), decode(String(c.ciphertext))));
    if (!TOKEN.test(token) || await digest(token) !== verifier) throw Error();
    return token;
  } catch { throw new SharingError('configuration', 503); }
}
export function publicProjection(value: unknown): PublicPlan {
  const raw = object(value);
  if (raw.schemaVersion !== 1 || !Array.isArray(raw.places) || raw.places.length > 20) throw new SharingError('unavailable', 404);
  const title = boundedText(raw.title, 80);
  const places = raw.places.map(value => {
    const row = object(value);
    const name = boundedText(row.name, 200);
    const location = row.location === null ? null : boundedText(row.location, 300);
    const params = new URLSearchParams({ api: '1', query: [name, location].filter(Boolean).join(', ') });
    if (typeof row.providerPlaceId === 'string' && /^[A-Za-z0-9_-]{1,255}$/.test(row.providerPlaceId)) params.set('query_place_id', row.providerPlaceId);
    const url = 'https://www.google.com/maps/search/?' + params;
    // Bound optional destinations more tightly than the contract ceiling to keep
    // the worst-case 20-place UTF-8 envelope below 64 KiB.
    return { name, location, mapUrl: encoder.encode(url).length <= 1024 ? url : null };
  });
  const result: PublicPlan = { schemaVersion: 1, title, places };
  if (encoder.encode(JSON.stringify(result)).length > 65536) throw new SharingError('unavailable', 404);
  return result;
}
export type OwnerRequest = {
  planId: string; action: string; expectedRevision?: number; requestId?: string;
  payload: RecordValue;
};
export function ownerRequest(value: unknown): OwnerRequest {
  const raw = object(value);
  exact(raw, ['planId', 'action', 'expectedRevision', 'requestId', 'payload']);
  if (typeof raw.planId !== 'string' || !UUID.test(raw.planId) ||
      typeof raw.action !== 'string' || !['status','preview','retrieve','enable','disable','regenerate','title','label'].includes(raw.action))
    throw new SharingError('invalid');
  const payload = raw.payload === undefined ? {} : object(raw.payload);
  let clean: RecordValue = {};
  if (raw.action === 'title') {
    exact(payload, ['title']); clean = { title: boundedText(payload.title, 80) };
  } else if (raw.action === 'label') {
    exact(payload, ['savedPlaceId', 'name', 'location', 'provenance']);
    if (payload.provenance !== 'owner_authored') throw new SharingError('invalid');
    clean = { savedPlaceId: boundedText(payload.savedPlaceId, 500), name: boundedText(payload.name, 200),
      location: payload.location == null ? null : boundedText(payload.location, 300), provenance: 'owner_authored' };
  } else exact(payload, []);
  const read = ['status','preview','retrieve'].includes(raw.action);
  if (!read && (!Number.isSafeInteger(raw.expectedRevision) || Number(raw.expectedRevision) < 0 || Number(raw.expectedRevision) >= 2147483647 ||
    typeof raw.requestId !== 'string' || !UUID.test(raw.requestId))) throw new SharingError('invalid');
  if (read && (raw.expectedRevision !== undefined || raw.requestId !== undefined)) throw new SharingError('invalid');
  return { planId: raw.planId.toLowerCase(), action: raw.action, ...(read ? {} : {
    expectedRevision: Number(raw.expectedRevision), requestId: String(raw.requestId).toLowerCase() }), payload: clean };
}
export async function readJson(request: Request, limit: number): Promise<unknown> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json')
    throw new SharingError('invalid', 415);
  const declared = request.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > limit)) throw new SharingError('invalid', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new SharingError('invalid');
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new SharingError('invalid', 413); }
      chunks.push(value);
    }
    const bytes = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch (error) {
    if (error instanceof SharingError) throw error;
    throw new SharingError('invalid');
  } finally { reader.releaseLock(); }
}
export type SharingDependencies = {
  enabled: boolean; origins: string[];
  authenticate(request: Request): Promise<string>;
  reserve(scope: 'public' | 'owner', subject: string): Promise<boolean>;
  rpc(name: string, args: RecordValue): Promise<unknown>;
  keys(): Record<string, string>; activeKey(): string;
};
export function sharingHandler(mode: 'public' | 'owner', deps: SharingDependencies) {
  return async (request: Request): Promise<Response> => {
    const origin = request.headers.get('origin');
    const headers: Record<string, string> = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      'CDN-Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive', Vary: 'Origin' };
    if (origin && deps.origins.includes(origin)) headers['Access-Control-Allow-Origin'] = origin;
    const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
    try {
      if (origin && !deps.origins.includes(origin)) throw new SharingError('unavailable', 403);
      if (new URL(request.url).search) throw new SharingError('invalid');
      if (request.method === 'OPTIONS') {
        headers['Access-Control-Allow-Methods'] = 'POST, OPTIONS';
        headers['Access-Control-Allow-Headers'] = 'authorization, apikey, content-type, x-client-info';
        return new Response(null, { status: 204, headers });
      }
      if (request.method !== 'POST') throw new SharingError('invalid', 405);
      if (mode === 'public') {
        if (!deps.enabled) throw new SharingError('unavailable', 404);
        if (!await deps.reserve('public', '')) throw new SharingError('limited', 429);
        let raw: RecordValue;
        try { raw = object(await readJson(request, 2048)); exact(raw, ['token']); }
        catch (error) {
          if (error instanceof SharingError && [413,415].includes(error.status)) throw error;
          throw new SharingError('unavailable', 404);
        }
        if (typeof raw.token !== 'string' || !TOKEN.test(raw.token)) throw new SharingError('unavailable', 404);
        const data = await deps.rpc('read_shared_plan', { p_verifier: await digest(raw.token) });
        if (!data) throw new SharingError('unavailable', 404);
        try { return respond(publicProjection(data)); } catch { throw new SharingError('unavailable', 404); }
      }
      let subject: string;
      try { subject = await deps.authenticate(request); } catch { throw new SharingError('authentication', 401); }
      if (!subject || subject.length > 200) throw new SharingError('authentication', 401);
      if (!await deps.reserve('owner', subject)) throw new SharingError('limited', 429);
      const input = ownerRequest(await readJson(request, 16384));
      if (!deps.enabled && ['enable','regenerate','retrieve'].includes(input.action)) throw new SharingError('unavailable', 503);
      const args: RecordValue = { p_subject: subject, p_plan: input.planId, p_action: input.action,
        p_expected: input.expectedRevision ?? null, p_request: input.requestId ?? null,
        p_digest: input.requestId ? await digest(JSON.stringify(input)) : null, p_payload: input.payload };
      if (['enable','regenerate'].includes(input.action)) {
        const minted = await mintCredential(deps.keys(), deps.activeKey(), input.planId, input.expectedRevision! + 1);
        args.p_verifier = minted.verifier; args.p_credential = minted.credential;
      }
      const data = object(await deps.rpc('manage_plan_sharing', args));
      if (data.error) {
        const code = ['conflict','ineligible','invalid','unavailable'].includes(String(data.error)) ? String(data.error) : 'unavailable';
        throw new SharingError(code, code === 'conflict' ? 409 : code === 'ineligible' ? 422 : code === 'invalid' ? 400 : 404);
      }
      const result: RecordValue = { enabled: data.enabled === true, revision: data.revision,
        title: data.title, createdAt: data.createdAt, updatedAt: data.updatedAt };
      if (input.action === 'preview') result.preview = data.preview === null ? null : publicProjection(data.preview);
      if (['enable','regenerate','retrieve'].includes(input.action) && data.enabled === true) {
        result.token = await recoverCredential(deps.keys(), data.credential, input.planId, Number(data.credentialRevision), String(data.verifier));
      }
      return respond(result);
    } catch (error) {
      const known = error instanceof SharingError;
      const status = known ? error.status : 503;
      if (status === 429) headers['Retry-After'] = '60';
      // Never serialize/log raw exceptions, request objects, URLs or credential data.
      return respond({ error: known ? error.code : 'unavailable' }, status);
    }
  };
}
