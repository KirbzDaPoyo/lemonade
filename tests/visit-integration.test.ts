import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultLibraryView, parseLibraryPreferences, selectLibraryPlaces } from '../src/services/library-view';
import { VisitsRepository, type VisitRepository } from '../src/repositories/visits/visits-repository';
import { VisitAccountSession } from '../src/services/visit-journal';
import { createPlaceDataExport } from '../src/services/export/place-data-export';
import { getPlaceDetailHref } from '../src/navigation/route-contract';
import type { PlaceCard } from '../src/types/place';
import type { VisitExport, VisitSummary } from '../src/types/visit';
import { hooks, load, tick, rn } from './helpers/component-harness';

const visit: VisitExport = { id: 'a', savedPlaceId: 'p', visitDate: '2020-02-29', rating: 2, note: '私密 😀', createdAt: '2020-03-01T00:00:00.123456Z', updatedAt: '2020-03-01T00:00:00.123456Z', validationTimezone: 'Asia/Shanghai' };
const place = (id: string): PlaceCard => ({ id, placeName: id, category: 'cafe', address: '', areaCity: '', tags: [], sources: [], sourceInstagramUrl: '', status: 'visited', isFavorite: false, createdAt: '2020-01-01', updatedAt: '2020-01-01' });
const repo = (patch: Partial<VisitRepository>): VisitRepository => ({ history: async () => { throw Error(); }, save: async () => visit, remove: async () => {}, ...patch });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(yes => { resolve = yes; }); return { promise, resolve }; }

test('journal sorts use latest rated value, put absent data last, and break ties stably without altering filters', () => {
  const places = ['e','d','c','b','a'].map(place);
  const summaries: Record<string, VisitSummary> = { a: { count: 2, latestDate: '2020-01-01', latestRating: 5 }, b: { count: 3, latestDate: '2020-02-02', latestRating: null }, c: { count: 2, latestDate: '2020-01-01', latestRating: 2 }, d: { count: 0, latestDate: null, latestRating: null } };
  for (const [sort, ids] of [['recently_visited',['b','a','c','d','e']],['most_visited',['b','a','c','d','e']],['personal_rating',['a','c','b','d','e']]] as const) {
    assert.deepEqual(selectLibraryPlaces(places, { ...defaultLibraryView, sort }, summaries).map(p => p.id), ids);
    assert.deepEqual(selectLibraryPlaces([...places].reverse(), { ...defaultLibraryView, sort }, summaries).map(p => p.id), ids);
    assert.equal(selectLibraryPlaces(places, { ...defaultLibraryView, sort, status: 'want_to_go' }, summaries).length, 0);
    assert.equal(parseLibraryPreferences(JSON.stringify({sort})).sort, sort);
  }
  assert.deepEqual(places.map(p => p.id), ['e','d','c','b','a']);
});

test('summary retrieval batches metadata, rejects missing places and never returns partial data', async () => {
  const batches: string[][] = [];
  const repository = new VisitsRepository({ rpc: async (_: string, args: any) => { batches.push(args.p_place_ids); return { data: args.p_place_ids.map((id: string) => ({ saved_place_id: id, count: 0, latest_date: null, latest_rating: null })) }; } } as any, 'owner');
  const data = await repository.summaries(Array.from({ length: 405 }, (_, i) => String(i)), () => {});
  assert.equal(Object.keys(data).length, 405); assert.deepEqual(batches.map(b => b.length), [200,200,5]);
  const missing = new VisitsRepository({ rpc: async () => ({ data: [] }) } as any, 'owner');
  await assert.rejects(missing.summaries(['deleted'], () => {}), /unavailable/);
});

test('export reads beyond short server pages and fails closed on a later page error', async () => {
  const rows = Array.from({ length: 7 }, (_, i) => ({ id: String(i), saved_place_id: 'p', visit_date: visit.visitDate, rating: null, note: visit.note, created_at: visit.createdAt, updated_at: visit.updatedAt, validation_timezone: 'UTC' }));
  let reads = 0, fail = false;
  const client = { from: () => { let after = ''; const q: any = { select: () => q, eq: (_: string, value: string) => { assert.equal(value, 'owner'); return q; }, order: () => q, limit: () => q, gt: (_: string, value: string) => { after = value; return q; }, then: (resolve: any) => { reads++; resolve(fail && after ? { error: { code: 'offline' } } : { data: rows.filter(r => r.id > after).slice(0, 2) }); } }; return q; } };
  const repository = new VisitsRepository(client as any, 'owner');
  assert.equal((await repository.exportAll(() => {})).length, 7); assert.equal(reads, 5);
  fail = true; await assert.rejects(repository.exportAll(() => {}), /unavailable/);
});

test('account clearing and journal changes invalidate pending export and summary responses', async () => {
  for (const operation of ['export', 'summaries'] as const) {
    for (const invalidate of ['clear','revision'] as const) {
      const pending = deferred<any>();
      const session = new VisitAccountSession(repo({ exportAll: () => pending.promise, summaries: () => pending.promise }));
      const request = operation === 'export' ? session.exportAll() : session.summaries(['p']);
      if (invalidate === 'clear') session.clear(); else session.dataRevision++;
      pending.resolve(operation === 'export' ? [visit] : {});
      await assert.rejects(request, /changed/);
    }
  }
});

test('schema 6 exports every journal field, calendar day and timestamp precision with explicit allowlisting', () => {
  const output = createPlaceDataExport([place('p')], [], 'now', [], [], [{ ...visit, userId: 'secret', raw: 'private-payload' } as any]);
  assert.equal(output.schemaVersion, 6); assert.deepEqual(output.data.visits, [visit]);
  assert.ok(!JSON.stringify(output).includes('secret')); assert.ok(!JSON.stringify(output).includes('private-payload'));
  assert.deepEqual(createPlaceDataExport([], []).data.visits, []);
});

test('sharing rechecks account after async availability and removes its cache file on success or failure', async () => {
  for (const scenario of ['changed', 'success', 'failed'] as const) {
    const ready = deferred<boolean>(); let current = true, exists = false, written = '', shares = 0;
    const { sharePlaceDataExport } = load('src/services/export/share-place-data-export.ts', {
      'expo-file-system': { Paths: { cache: 'cache' }, File: class { uri = 'cache/export'; get exists() { return exists; } create() { exists = true; } write(data: string) { written = data; } delete() { exists = false; } } },
      'expo-sharing': { isAvailableAsync: () => ready.promise, shareAsync: async () => { shares++; if (scenario === 'failed') throw Error('share failed'); } }
    });
    const request = sharePlaceDataExport({ places: [], tags: [] }, [], [], [visit], () => { if (!current) throw Error('changed'); });
    await assert.rejects(sharePlaceDataExport({ places: [], tags: [] }), /already being shared/);
    if (scenario === 'changed') current = false;
    ready.resolve(true);
    if (scenario === 'success') await request; else await assert.rejects(request);
    assert.equal(exists, false); assert.equal(shares, scenario === 'changed' ? 0 : 1);
    if (scenario === 'changed') assert.equal(written, ''); else assert.equal(JSON.parse(written).data.visits[0].note, visit.note);
  }
});

test('library summary hook ignores old-account responses, retries failures and stays idle for ordinary sorts', async () => {
  const h = hooks(), slow = deferred<Record<string, VisitSummary>>(); let calls = 0;
  let session = new VisitAccountSession(repo({ summaries: async () => { calls++; return slow.promise; } }));
  const { useLibraryVisitSummaries } = load('src/services/use-library-visit-summaries.ts', { react: h.react,
    'expo-router': { useFocusEffect: (fn: any) => h.react.useEffect(fn, [fn]) }, '../store/visits-context': { useVisits: () => session }, '../observability/error-monitoring': { errorMonitoring: { captureException() {} } } });
  const render = (enabled: boolean) => h.render(() => useLibraryVisitSummaries(['p'], enabled));
  render(false); assert.equal(calls, 0); render(true); assert.equal(calls, 1);
  session.clear(); session = new VisitAccountSession(repo({ summaries: async () => { throw Error('private'); } }));
  render(true); slow.resolve({ p: { count: 5, latestDate: '2020-01-01', latestRating: 5 } }); await tick();
  const failed = render(true); assert.ok(failed.error); assert.equal(failed.data, undefined);
  session.repository!.summaries = async () => ({}); failed.retry(); render(true); await tick(); assert.deepEqual(Object.keys(render(true).data), []);
  h.unmount();
});

test('plan shortcut route carries only the form intent and preserves ordinary detail routes', () => {
  assert.deepEqual(getPlaceDetailHref('p'), { pathname: '/place/[placeId]', params: { placeId: 'p' } });
  assert.deepEqual(getPlaceDetailHref('p', true), { pathname: '/place/[placeId]', params: { placeId: 'p', logVisit: '1' } });
});

test('sort analytics accepts only bounded sort names and drops arbitrary journal contents', () => {
  const events: any[] = [];
  const { analytics } = load('src/observability/analytics.ts', { 'expo-application': {}, 'expo-constants': {}, 'react-native': rn, 'posthog-react-native': { PostHog: class { capture(...args: any[]) { events.push(args); } } } });
  analytics.librarySortChanged('personal_rating'); analytics.librarySortChanged('private reflection'); analytics.librarySortChanged({ rating: 5 });
  assert.equal(events.length, 1); assert.equal(events[0][1].sort, 'personal_rating');
  assert.ok(!JSON.stringify(events).includes('private reflection'));
});
