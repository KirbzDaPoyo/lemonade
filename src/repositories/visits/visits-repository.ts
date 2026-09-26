import type { SupabaseClient } from '@supabase/supabase-js';
import { isCalendarDate, validateVisitDraft, type Visit, type VisitCursor, type VisitDraft, type VisitPage, type VisitSummary, type VisitExport } from '../../types/visit';

export class VisitStorageError extends Error {}
const unavailable = () => new VisitStorageError('Visit storage is unavailable. Check your connection and retry.');
function check(error: unknown) {
  if (!error) return;
  const code = (error as { code?: string }).code;
  throw new VisitStorageError(code === '23503' ? 'This place is no longer available. Refresh your library.'
    : code === '42501' || code === 'PGRST301' ? 'Your private journal could not be accessed. Check your sign-in and retry.'
    : code === '22023' || code === '23514' || code === '23502' || code === '22008' ? 'Check the visit date, rating, reflection length, and device time zone.'
    : 'Visit storage is unavailable. Check your connection and retry.');
}
const fields = 'id,saved_place_id,visit_date,rating,note,created_at,updated_at';
function mapVisit(row: any): Visit {
  if (!row || typeof row.id !== 'string' || typeof row.saved_place_id !== 'string' || !isCalendarDate(row.visit_date ?? '')
    || (row.rating !== null && (!Number.isInteger(row.rating) || row.rating < 1 || row.rating > 5))
    || (row.note !== null && (typeof row.note !== 'string' || Array.from(row.note).length > 2000))
    || !Number.isFinite(Date.parse(row.created_at)) || !Number.isFinite(Date.parse(row.updated_at))) throw unavailable();
  return { id: row.id, savedPlaceId: row.saved_place_id, visitDate: row.visit_date, rating: row.rating,
    note: row.note, createdAt: row.created_at, updatedAt: row.updated_at };
}
export interface VisitRepository {
  summaries?(placeIds: readonly string[], assertCurrent: () => void): Promise<Record<string, VisitSummary>>;
  exportAll?(assertCurrent: () => void): Promise<VisitExport[]>;
  history(placeId: string, cursor?: VisitCursor): Promise<VisitPage>;
  save(placeId: string, draft: VisitDraft, timeZone: string, original?: Visit): Promise<Visit>;
  remove(placeId: string, id: string): Promise<void>;
}
export class VisitsRepository implements VisitRepository {
  constructor(private client: SupabaseClient, private userId: string) {}
  async summaries(placeIds: readonly string[], assertCurrent: () => void): Promise<Record<string, VisitSummary>> {
    const result: Record<string, VisitSummary> = Object.create(null);
    const ids = [...new Set(placeIds)];
    for (let offset = 0; offset < ids.length; offset += 200) {
      assertCurrent();
      const batch = ids.slice(offset, offset + 200);
      const { data, error } = await this.client.rpc('get_library_visit_summaries', { p_place_ids: batch });
      assertCurrent(); check(error);
      if (!Array.isArray(data) || data.length !== batch.length) throw unavailable();
      for (const row of data) {
        if (!batch.includes(row.saved_place_id) || Object.hasOwn(result, row.saved_place_id)
          || !Number.isSafeInteger(row.count) || row.count < 0
          || (row.latest_date !== null && !isCalendarDate(row.latest_date))
          || (row.latest_rating !== null && (!Number.isInteger(row.latest_rating) || row.latest_rating < 1 || row.latest_rating > 5))
          || (row.count === 0) !== (row.latest_date === null) || (row.count === 0 && row.latest_rating !== null)) throw unavailable();
        result[row.saved_place_id] = { count: row.count, latestDate: row.latest_date, latestRating: row.latest_rating };
      }
    }
    assertCurrent();
    return result;
  }
  async exportAll(assertCurrent: () => void): Promise<VisitExport[]> {
    const entries: VisitExport[] = [];
    let after: string | undefined;
    for (;;) {
      assertCurrent();
      let query = this.client.from('place_visits').select('id,saved_place_id,visit_date,rating,note,created_at,updated_at,validation_timezone').eq('user_id', this.userId).order('id', { ascending: true }).limit(200);
      if (after) query = query.gt('id', after);
      const { data, error } = await query;
      assertCurrent(); check(error);
      if (!Array.isArray(data)) throw unavailable();
      if (!data.length) return entries;
      for (const row of data) {
        const visit = mapVisit(row);
        if ((after && visit.id <= after) || typeof row.validation_timezone !== 'string' || !row.validation_timezone) throw unavailable();
        entries.push({ ...visit, validationTimezone: row.validation_timezone });
        after = visit.id;
      }
      // Continue until an empty page, even if the server caps responses below 200.
    }
  }
  async history(placeId: string, cursor?: VisitCursor): Promise<VisitPage> {
    const { data, error } = await this.client.rpc('get_place_visit_history', {
      p_saved_place_id: placeId, p_before_date: cursor?.visitDate ?? null,
      p_before_created_at: cursor?.createdAt ?? null, p_before_id: cursor?.id ?? null
    });
    check(error);
    if (!data || !Array.isArray(data.entries) || data.entries.length > 20 || typeof data.has_more !== 'boolean'
      || !Number.isSafeInteger(data.summary?.count) || data.summary.count < 0
      || (data.summary.latest_date !== null && !isCalendarDate(data.summary.latest_date))
      || !['want_to_go', 'visited', 'skipped'].includes(data.place_status) || !Number.isFinite(Date.parse(data.place_updated_at))) throw unavailable();
    const entries = data.entries.map(mapVisit);
    if (entries.some((entry: Visit) => entry.savedPlaceId !== placeId)) throw unavailable();
    const rated = data.latest_rated;
    if (rated !== null && (!Number.isInteger(rated?.rating) || rated.rating < 1 || rated.rating > 5 || !isCalendarDate(rated.visit_date ?? ''))) throw unavailable();
    return { entries, hasMore: data.has_more, summary: { count: data.summary.count,
      latestDate: data.summary.latest_date, latestRated: rated ? { rating: rated.rating, visitDate: rated.visit_date } : null },
      placeStatus: data.place_status, placeUpdatedAt: data.place_updated_at };
  }
  async save(placeId: string, draft: VisitDraft, timeZone: string, original?: Visit): Promise<Visit> {
    const validation = validateVisitDraft(draft, '9999-12-31', original?.visitDate);
    if (validation) throw new VisitStorageError(validation);
    if (!timeZone || (original && (original.id !== draft.id || original.savedPlaceId !== placeId))) throw unavailable();
    const note = draft.note.trim() ? draft.note : null;
    const response = original
      ? await this.client.from('place_visits').update({ visit_date: draft.visitDate, rating: draft.rating, note, validation_timezone: timeZone })
        .eq('user_id', this.userId).eq('saved_place_id', placeId).eq('id', draft.id).select(fields).maybeSingle()
      : await this.client.rpc('create_place_visit', { p_id: draft.id, p_saved_place_id: placeId,
        p_visit_date: draft.visitDate, p_validation_timezone: timeZone, p_rating: draft.rating, p_note: note });
    check(response.error);
    if (!response.data) throw new VisitStorageError('This visit is no longer available. Close the form and refresh history.');
    const visit = mapVisit(response.data);
    if (visit.id !== draft.id || visit.savedPlaceId !== placeId) throw unavailable();
    return visit;
  }
  async remove(placeId: string, id: string): Promise<void> {
    const { error } = await this.client.from('place_visits').delete().eq('user_id', this.userId).eq('saved_place_id', placeId).eq('id', id);
    check(error);
  }
}
