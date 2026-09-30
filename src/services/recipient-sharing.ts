import { fetch as expoFetch } from 'expo/fetch';
import { backendConfig } from '../config/backend';
import { parseSharedPlanContent } from './sharing-content';
export class RecipientFailure extends Error {
  constructor(public code: 'unavailable' | 'limited' | 'connection' = 'connection') { super('Shared shortlist unavailable'); }
}
export async function retrieveSharedPlan(token: string, signal: AbortSignal, request: typeof fetch = expoFetch as typeof fetch) {
  if (!/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(token)) throw new RecipientFailure('unavailable');
  if (!backendConfig.supabaseUrl) throw new RecipientFailure();
  // SDK 54 expo/fetch does not forward the RequestInit cache option; enforce it in HTTP too.
  const response = await request(`${backendConfig.supabaseUrl}/functions/v1/shared-plan`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify({ token }),
    signal, credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer'
  });
  if (!response.ok) throw new RecipientFailure(response.status === 404 ? 'unavailable' : response.status === 429 ? 'limited' : 'connection');
  if (response.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') throw new RecipientFailure('unavailable');
  const length = response.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > 65536)) throw new RecipientFailure('unavailable');
  if (!response.body) throw new RecipientFailure('unavailable');
  const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.length;
      if (size > 65536) { await reader.cancel(); throw new RecipientFailure('unavailable'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return parseSharedPlanContent(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))); }
  catch { throw new RecipientFailure('unavailable'); }
}
