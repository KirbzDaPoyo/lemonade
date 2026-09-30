import { parseSharedPlanContent, type SharedPlanContent } from './sharing-content';
export type SharingDetails = {
  planId: string; enabled: boolean; revision: number; title: string;
  createdAt: string | null; updatedAt: string | null;
  labels: { savedPlaceId: string; name: string | null; location: string | null; updatedAt: string | null }[];
};
export type SharingAction = 'title' | 'label' | 'enable' | 'disable' | 'regenerate';
export type SharingTransport = {
  metadata(name: string, args: Record<string, unknown>): Promise<unknown>;
  owner(body: Record<string, unknown>): Promise<unknown>;
};
export class SharingFailure extends Error {
  constructor(public code = 'unavailable') { super('Sharing request failed'); }
}
export function sharingMessage(error: unknown) {
  const code = error instanceof SharingFailure ? error.code : 'unavailable';
  return code === 'conflict' ? 'This plan changed. Refresh and review its latest details before trying again.'
    : code === 'limited' ? 'Too many sharing requests. Wait a minute, then try again.'
    : code === 'ineligible' ? 'Add a public name for every place, then review again.'
    : code === 'authentication' ? 'Your session expired. Sign in again to manage sharing.'
    : code === 'invalid' ? 'Check the length of your public fields and remove line breaks or control characters.'
    : 'Sharing could not be confirmed. Check your connection and refresh before trying again.';
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new SharingFailure();
  return value as Record<string, unknown>;
}
function string(value: unknown, max: number, nullable = false): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || !value || [...value].length > max) throw new SharingFailure();
  return value;
}
function state(value: unknown) {
  const raw = record(value);
  if (typeof raw.enabled !== 'boolean' || !Number.isSafeInteger(raw.revision) || Number(raw.revision) < 0) throw new SharingFailure();
  return { enabled: raw.enabled, revision: Number(raw.revision), title: string(raw.title, 80)!,
    createdAt: string(raw.createdAt, 100, true), updatedAt: string(raw.updatedAt, 100, true) };
}
export function parseSharingDetails(value: unknown): SharingDetails {
  const raw = record(value);
  if (!Array.isArray(raw.labels) || raw.labels.length > 20) throw new SharingFailure();
  return { ...state(raw), planId: string(raw.planId, 36)!, labels: raw.labels.map(value => {
    const label = record(value);
    return { savedPlaceId: string(label.savedPlaceId, 500)!, name: string(label.name, 200, true),
      location: string(label.location, 300, true), updatedAt: string(label.updatedAt, 100, true) };
  }) };
}
export function sharingOrigin(value: string | undefined): string | undefined {
  try {
    const url = new URL(value ?? '');
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.pathname !== '/') return;
    return url.origin;
  } catch { return; }
}
// UUID is an idempotency identifier, never the bearer credential.
const requestId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16);
});
export class SharingSession {
  active = true;
  generation = 0;
  private locked = false;
  constructor(private transport?: SharingTransport, readonly origin?: string) {}
  clear() { this.active = false; this.generation++; }
  guard() {
    const generation = this.generation;
    return () => { if (!this.active || this.generation !== generation) throw new SharingFailure('account'); };
  }
  private async call(kind: 'metadata' | 'owner', name: string, args: Record<string, unknown>) {
    const current = this.guard(); current();
    if (!this.transport) throw new SharingFailure();
    const result = kind === 'metadata' ? await this.transport.metadata(name, args) : await this.transport.owner(args);
    current(); return result;
  }
  async details(planId: string) {
    const result = parseSharingDetails(await this.call('metadata', 'get_plan_sharing_details', { p_plan: planId }));
    if (result.planId !== planId) throw new SharingFailure();
    return result;
  }
  async preview(planId: string): Promise<{ revision: number; content: SharedPlanContent }> {
    const raw = record(await this.call('owner', '', { planId, action: 'preview' }));
    return { revision: state(raw).revision, content: parseSharedPlanContent(raw.preview) };
  }
  async mutate(planId: string, action: SharingAction, revision: number, payload: Record<string, unknown> = {}) {
    if (this.locked) throw new SharingFailure('busy');
    if (['enable', 'regenerate'].includes(action) && !this.origin) throw new SharingFailure();
    this.generation++; this.locked = true;
    try {
      // No automatic write retries. An uncertain response must be reconciled by reading status.
      const raw = await this.call('owner', '', { planId, action, expectedRevision: revision, requestId: requestId(), payload });
      return state(raw); // Intentionally discard any returned bearer; retrieve only on copy/share.
    } finally { this.locked = false; }
  }
  async deliver(planId: string, send: (url: string) => Promise<unknown>, assertVisible: () => void = () => {}) {
    if (this.locked || !this.origin) throw new SharingFailure();
    const current = this.guard(); this.locked = true;
    try {
      const raw = record(await this.call('owner', '', { planId, action: 'retrieve' }));
      if (!state(raw).enabled || typeof raw.token !== 'string' || !/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/.test(raw.token)) throw new SharingFailure();
      current(); assertVisible();
      await send(`${this.origin}/s#${raw.token}`);
      current(); assertVisible();
    } finally { this.locked = false; }
  }
  async exportAll(): Promise<SharingDetails[]> {
    if (this.locked) throw new SharingFailure('busy');
    const current = this.guard(); let after: string | null = null;
    const rows: SharingDetails[] = [];
    for (;;) {
      const raw = await this.call('metadata', 'get_plan_sharing_export_page', { p_after: after });
      current();
      if (!Array.isArray(raw) || raw.length > 25) throw new SharingFailure();
      if (!raw.length) return rows;
      for (const value of raw) {
        const row = parseSharingDetails(value);
        if (after !== null && row.planId <= after) throw new SharingFailure();
        rows.push(row); after = row.planId;
      }
    }
  }
}
