import type { SupabaseClient } from '@supabase/supabase-js';
import type { AnalyticsFailureCategory } from '../../observability/analytics-contract';
import { sortInbox, type InboxItem, type InboxOrigin, type EnqueueResult } from '../../types/inbox';

type InboxRow = {
  id: string; source_url: string; origin: InboxOrigin; status: InboxItem['status'];
  place_name_hint: string | null; failure_category: AnalyticsFailureCategory | null;
  attempt_count: number; last_attempt_at: string | null; created_at: string; updated_at: string;
};
export const mapInboxRow = (row: InboxRow): InboxItem => ({
  id: row.id, sourceUrl: row.source_url, origin: row.origin, status: row.status,
  placeNameHint: row.place_name_hint, failureCategory: row.failure_category,
  attemptCount: row.attempt_count, lastAttemptAt: row.last_attempt_at,
  createdAt: row.created_at, updatedAt: row.updated_at
});
const fields = 'id,source_url,origin,status,place_name_hint,failure_category,attempt_count,last_attempt_at,created_at,updated_at';
const check = (error: unknown) => { if (error) throw new Error('Inbox storage unavailable. Retry when connected.'); };
export class InboxRepository {
  constructor(private client: SupabaseClient, private userId: string) {}
  async list(): Promise<InboxItem[]> {
    const { data, error } = await this.client.from('import_inbox_items').select(fields).eq('user_id', this.userId).order('created_at', { ascending: false }).order('id', { ascending: false }).limit(100);
    check(error);
    return sortInbox((data ?? []).map(row => mapInboxRow(row as InboxRow)));
  }
  async enqueue(urls: string[], origin: InboxOrigin): Promise<EnqueueResult[]> {
    if (urls.length > 20) throw new Error('Capture up to 20 links at a time.');
    if (!urls.length) return [];
    const { data, error } = await this.client.rpc('enqueue_import_inbox', { urls, capture_origin: origin });
    check(error);
    if (!Array.isArray(data) || data.length !== urls.length) throw new Error('Inbox capture confirmation unavailable. Retry.');
    return data.map(row => ({ sourceUrl: row.source_url, outcome: row.outcome, placeId: row.saved_place_id }));
  }
  async findSaved(sourceUrl: string): Promise<string | null> {
    const { data, error } = await this.client.from('saved_place_sources').select('saved_place_id').eq('user_id', this.userId).eq('source_url', sourceUrl).maybeSingle();
    check(error);
    return data?.saved_place_id ?? null;
  }
  async beginAttempt(id: string, hint: string) {
    const { error } = await this.client.rpc('begin_inbox_attempt', { item_id: id, hint: Array.from(hint.trim()).slice(0, 200).join('') });
    check(error);
  }
  async updateHint(id: string, hint: string) {
    await this.update(id, { place_name_hint: Array.from(hint.trim()).slice(0, 200).join('') || null });
  }
  async markAttention(id: string, category: AnalyticsFailureCategory) {
    await this.update(id, { status: 'needs_attention', failure_category: category });
  }
  private async update(id: string, patch: object) {
    const { data, error } = await this.client.from('import_inbox_items').update(patch).eq('user_id', this.userId).eq('id', id).select('id');
    check(error);
    if (!data?.length) throw new Error('Inbox item unavailable. Refresh the inbox.');
  }
  async remove(id: string) {
    const { error } = await this.client.from('import_inbox_items').delete().eq('user_id', this.userId).eq('id', id);
    check(error);
  }
  async clear() {
    const { error } = await this.client.from('import_inbox_items').delete().eq('user_id', this.userId);
    check(error);
  }
}
