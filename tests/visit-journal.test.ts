import assert from 'node:assert/strict';
import test from 'node:test';
import { VisitAccountSession, VisitJournal } from '../src/services/visit-journal';
import { VisitsRepository, type VisitRepository } from '../src/repositories/visits/visits-repository';
import { isCalendarDate, localVisitDate, validateVisitDraft, type Visit, type VisitDraft, type VisitPage } from '../src/types/visit';
import { flatten, hooks, load, rn, theme, tick } from './helpers/component-harness';

const visit: Visit = { id: '00000000-0000-4000-8000-000000000001', savedPlaceId: 'place', visitDate: '2020-02-29', rating: 4, note: 'Private memory', createdAt: '2020-03-01T12:00:00.123456+00:00', updatedAt: '2020-03-01T12:00:00.123456+00:00' };
const draft: VisitDraft = { id: visit.id, visitDate: visit.visitDate, rating: visit.rating, note: visit.note! };
const page = (entries: Visit[] = [visit], count = entries.length, hasMore = false): VisitPage => ({ entries, hasMore,
  summary: { count, latestDate: count ? visit.visitDate : null, latestRated: count ? { rating: 4, visitDate: visit.visitDate } : null },
  placeStatus: 'visited', placeUpdatedAt: visit.updatedAt });
const repository = (patch: Partial<VisitRepository> = {}): VisitRepository => ({ history: async () => page(), save: async () => visit, remove: async () => {}, ...patch });
function deferred<T>() { let resolve!: (value: T) => void; let reject!: (reason?: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }

test('calendar date validation handles leap years, local today and Unicode note limits', () => {
  for (const value of ['2000-02-29', '2024-02-29', '0001-01-01']) assert.ok(isCalendarDate(value));
  for (const value of ['1900-02-29', '2023-02-29', '2024-04-31', '0000-01-01', '2024-1-01', '2024-01-01T00:00:00Z']) assert.ok(!isCalendarDate(value));
  assert.equal(localVisitDate(new Date(2024, 0, 2, 0, 5)), '2024-01-02');
  assert.match(validateVisitDraft({ ...draft, visitDate: '2024-01-03' }, '2024-01-02')!, /earlier/);
  assert.equal(validateVisitDraft({ ...draft, visitDate: '2024-01-03' }, '2024-01-02', '2024-01-03'), null);
  assert.equal(validateVisitDraft({ ...draft, note: '😀'.repeat(2000) }), null);
  assert.match(validateVisitDraft({ ...draft, note: '😀'.repeat(2001) })!, /2,000/);
  for (const rating of [0, 6, 1.5, NaN]) assert.match(validateVisitDraft({ ...draft, rating })!, /rating/);
  assert.equal(validateVisitDraft({ ...draft, rating: null, note: '' }), null);
});

test('journal replaces bounded history pages, keeps precise cursor and retries the failed page', async () => {
  let fail = false; const cursors: unknown[] = [];
  const journal = new VisitJournal(new VisitAccountSession(repository({ history: async (_, cursor) => {
    cursors.push(cursor); if (fail) throw Error('offline'); return cursor ? page([{ ...visit, id: 'older' }], 21) : page([visit], 21, true);
  } })), 'place');
  await journal.refresh(); fail = true; assert.equal(await journal.older(), false); assert.equal(journal.state.pageNumber, 1);
  fail = false; await journal.retryPage(); assert.equal(journal.state.pageNumber, 2); assert.equal(journal.state.page?.entries.length, 1);
  assert.equal(journal.state.page?.entries[0].id, 'older'); assert.deepEqual(cursors[1], cursors[2]);
  assert.equal((cursors[2] as any).createdAt, visit.createdAt);
  await journal.newer(); assert.equal(journal.state.pageNumber, 1); assert.equal(journal.state.page?.summary.count, 21);
});

test('a late read cannot overwrite a newer refresh or confirmed write', async () => {
  const slow = deferred<VisitPage>(); let calls = 0;
  const journal = new VisitJournal(new VisitAccountSession(repository({ history: async () => ++calls === 1 ? slow.promise : page([], 0) })), 'place');
  const pending = journal.refresh(); await journal.refresh(); slow.resolve(page()); await pending;
  assert.equal(journal.state.page?.summary.count, 0);
  const stale = deferred<VisitPage>(); const repo = repository({ history: () => stale.promise });
  const second = new VisitJournal(new VisitAccountSession(repo), 'place'); const read = second.refresh();
  repo.history = async () => page([], 0); await second.remove(visit.id); stale.resolve(page()); await read;
  assert.equal(second.state.page?.summary.count, 0);
});

test('repeated save taps are locked and confirmed writes refresh once', async () => {
  const writing = deferred<Visit>(); let writes = 0, reads = 0, libraryRefreshes = 0;
  const journal = new VisitJournal(new VisitAccountSession(repository({ save: async () => { writes++; return writing.promise; }, history: async () => { reads++; return page(); } })), 'place', () => {}, () => libraryRefreshes++);
  const first = journal.save(draft, 'UTC'); assert.equal(await journal.save(draft, 'UTC'), false); assert.equal(await journal.refresh(), false);
  writing.resolve(visit); assert.equal(await first, true); assert.equal(writes, 1); assert.equal(reads, 1); assert.equal(libraryRefreshes, 0); assert.equal(journal.state.busy, false);
});

test('failed writes hide stale summaries and permit retry without changing the draft identity', async () => {
  let fail = true; const ids: string[] = [];
  const journal = new VisitJournal(new VisitAccountSession(repository({ save: async (_, input) => { ids.push(input.id); if (fail) throw Error('PRIVATE_CONTENT'); return visit; } })), 'place');
  await journal.refresh(); assert.equal(await journal.save(draft, 'UTC'), false);
  assert.equal(journal.state.page, null); assert.ok(journal.state.mutationError); assert.ok(!journal.state.mutationError.includes('PRIVATE_CONTENT'));
  fail = false; assert.equal(await journal.save(draft, 'UTC'), true); assert.deepEqual(ids, [draft.id, draft.id]); assert.equal(journal.state.mutationError, null);
});

test('a committed save with failed refresh is reported as saved, not retried as a write', async () => {
  let writes = 0, fallback = 0;
  const repo = repository({ save: async () => { writes++; return visit; }, history: async () => { throw Error(); } });
  const journal = new VisitJournal(new VisitAccountSession(repo), 'place', () => {}, () => fallback++);
  assert.equal(await journal.save(draft, 'UTC'), true); assert.equal(journal.state.page, null); assert.match(journal.state.notice!, /was saved/); assert.equal(fallback, 1);
  repo.history = async () => page(); await journal.retryPage(); assert.equal(writes, 1); assert.equal(journal.state.notice, null);
});

test('account clearing and screen disposal ignore late reads, writes and lifecycle updates', async () => {
  for (const operation of ['read', 'write'] as const) {
    const pending = deferred<any>(); let callbacks = 0;
    const session = new VisitAccountSession(repository(operation === 'read' ? { history: () => pending.promise } : { save: () => pending.promise }));
    const journal = new VisitJournal(session, 'place', () => callbacks++, () => callbacks++);
    const result = operation === 'read' ? journal.refresh() : journal.save(draft, 'UTC');
    session.clear(); pending.resolve(operation === 'read' ? page() : visit); assert.equal(await result, false);
    assert.equal(callbacks, 0); assert.equal(journal.state.page, null); assert.equal(await journal.save(draft, 'UTC'), false);
  }
  const pending = deferred<VisitPage>(); const journal = new VisitJournal(new VisitAccountSession(repository({ history: () => pending.promise })), 'place');
  const result = journal.refresh(); journal.dispose(); pending.resolve(page()); assert.equal(await result, false);
});

test('deletion failure preserves retry action and deleting the last entry returns an empty journal', async () => {
  let fail = true;
  const journal = new VisitJournal(new VisitAccountSession(repository({ remove: async () => { if (fail) throw Error(); }, history: async () => page([], 0) })), 'place');
  assert.equal(await journal.remove(visit.id), false); assert.ok(journal.state.mutationError);
  fail = false; assert.equal(await journal.remove(visit.id), true); assert.equal(journal.state.page?.summary.count, 0); assert.equal(journal.state.page?.placeStatus, 'visited');
});

const row = { id: visit.id, saved_place_id: visit.savedPlaceId, visit_date: visit.visitDate, rating: visit.rating, note: visit.note, created_at: visit.createdAt, updated_at: visit.updatedAt };
const rawPage = { entries: [row], has_more: false, summary: { count: 1, latest_date: visit.visitDate }, latest_rated: { rating: 4, visit_date: visit.visitDate }, place_status: 'visited', place_updated_at: visit.updatedAt };
function clientFixture() {
  const calls: Array<[string, ...any[]]> = []; let result: any = { data: rawPage, error: null };
  const builder: any = { then: (yes: any, no: any) => Promise.resolve(result).then(yes, no) };
  for (const method of ['update', 'delete', 'eq', 'select', 'maybeSingle', 'single']) builder[method] = (...args: any[]) => { calls.push([method, ...args]); return builder; };
  const client = { rpc: (...args: any[]) => { calls.push(['rpc', ...args]); return builder; }, from: (...args: any[]) => { calls.push(['from', ...args]); return builder; } };
  return { calls, client, result: (next: any) => { result = next; } };
}

test('repository maps one coherent history response and transmits the full keyset cursor', async () => {
  const f = clientFixture(); const repo = new VisitsRepository(f.client as any, 'owner');
  assert.deepEqual(await repo.history('place', visit), page());
  assert.equal(f.calls[0][2].p_before_created_at, visit.createdAt);
  f.result({ data: { ...rawPage, entries: [{ ...row, saved_place_id: 'other' }] }, error: null });
  await assert.rejects(repo.history('place'), /unavailable/);
  f.result({ data: { ...rawPage, latest_rated: { rating: 6, visit_date: visit.visitDate } }, error: null });
  await assert.rejects(repo.history('place'), /unavailable/);
});

test('repository create, edit, and delete scope identifiers and sanitize backend errors', async () => {
  const f = clientFixture(); const repo = new VisitsRepository(f.client as any, 'owner'); f.result({ data: row, error: null });
  assert.deepEqual(await repo.save('place', draft, 'UTC'), visit);
  assert.equal(f.calls[0][1], 'create_place_visit'); assert.equal(f.calls[0][2].p_id, draft.id);
  f.calls.length = 0; await repo.save('place', { ...draft, note: '' }, 'UTC', visit);
  assert.deepEqual(f.calls.filter(c => c[0] === 'eq'), [['eq', 'user_id', 'owner'], ['eq', 'saved_place_id', 'place'], ['eq', 'id', visit.id]]);
  assert.equal(f.calls.find(c => c[0] === 'update')![1].note, null);
  f.calls.length = 0; await repo.remove('place', visit.id);
  assert.equal(f.calls.filter(c => c[0] === 'eq').length, 3);
  f.result({ data: null, error: { code: '23514', message: 'Private reflection', details: 'private notes and rating' } });
  await assert.rejects(repo.save('place', draft, 'UTC'), e => e instanceof Error && !/Private reflection|private notes/.test(e.message));
});

function formFixture(original?: Visit) {
  const h = hooks(); const alerts: any[] = [], submissions: VisitDraft[] = [], closes: unknown[] = [];
  let keyboard = false, saveResult: Promise<boolean> | boolean = true;
  const { VisitForm } = load('src/components/visit-form.tsx', { react: h.react,
    'react-native': { ...rn, Modal: 'Modal', Keyboard: { isVisible: () => keyboard, dismiss: () => { keyboard = false; } }, Alert: { alert: (...args: any[]) => alerts.push(args) } },
    'react-native-safe-area-context': { SafeAreaView: 'SafeArea' }, '../design-system/theme': { useAppTheme: () => ({ theme }) },
    '../design-system/use-reduced-motion': { useReducedMotion: () => true }, './v2-controls': { V2Button: 'Button', V2TextField: 'Field' }, './v2-layout': { V2SectionLabel: 'Label' } });
  const render = () => h.render(() => VisitForm({ original, error: null, onClose: (saved: boolean) => closes.push(saved), onSave: (d: VisitDraft) => { submissions.push(d); return Promise.resolve(saveResult); } }));
  const button = (label: string) => flatten(render()).find(n => n.type === 'Button' && n.props.label === label);
  const field = (label: string) => flatten(render()).find(n => n.type === 'Field' && n.props.label === label);
  return { render, button, field, alerts, submissions, closes, keyboard: () => { keyboard = true; }, result: (value: Promise<boolean> | boolean) => { saveResult = value; } };
}

test('form defaults to today and exposes optional accessible rating and reflection controls', () => {
  const f = formFixture(); assert.equal(f.field('Visit date').props.value, localVisitDate());
  assert.equal(f.field('Reflection · optional').props.value, ''); assert.ok(f.button('No rating').props.selected);
  assert.equal(f.button('3').props.accessibilityLabel, 'Your rating: 3 out of 5'); f.button('3').props.onPress(); assert.ok(f.button('3').props.selected);
  f.button('No rating').props.onPress(); assert.ok(f.button('No rating').props.selected);
  assert.equal(flatten(f.render()).find(n => n.type === 'Modal').props.animationType, 'none');
});

test('form rejects invalid input without writing and keeps drafts on failed saves with a stable ID', async () => {
  const f = formFixture(); f.field('Visit date').props.onChangeText('2023-02-29'); f.button('Save visit').props.onPress(); await tick(); assert.equal(f.submissions.length, 0);
  f.field('Visit date').props.onChangeText('2020-01-01'); f.field('Reflection · optional').props.onChangeText('Remember this'); f.result(false);
  f.button('Save visit').props.onPress(); await tick(); assert.equal(f.field('Reflection · optional').props.value, 'Remember this'); assert.equal(f.closes.length, 0);
  f.result(true); f.button('Retry save').props.onPress(); await tick(); assert.equal(f.submissions[0].id, f.submissions[1].id); assert.deepEqual(f.closes, [true]);
});

test('form locks duplicate taps and dismisses keyboard before confirming discard', async () => {
  const f = formFixture(); f.field('Reflection · optional').props.onChangeText('Draft'); f.keyboard();
  f.button('Cancel').props.onPress(); assert.equal(f.alerts.length, 0); f.button('Cancel').props.onPress(); assert.equal(f.alerts[0][0], 'Discard visit changes?');
  const pending = deferred<boolean>(); f.result(pending.promise); const button = f.button('Save visit'); button.props.onPress(); button.props.onPress(); assert.equal(f.submissions.length, 1);
  assert.ok(f.button('Saving visit…').props.disabled); pending.resolve(true); await tick();
});

test('edit form retains the existing date, note and rating, including clearing optional values', async () => {
  const f = formFixture(visit); assert.equal(f.field('Visit date').props.value, visit.visitDate); assert.ok(f.button('4').props.selected);
  f.button('No rating').props.onPress(); f.field('Reflection · optional').props.onChangeText(''); f.button('Save visit').props.onPress(); await tick();
  assert.equal(f.submissions[0].rating, null); assert.equal(f.submissions[0].note, ''); assert.equal(f.submissions[0].id, visit.id);
});

test('provider rejects switched subjects and invalidates a token request pending during sign-out', async () => {
  const h = hooks(); let options: any; const pending = deferred<string | null>();
  const { VisitsProvider } = load('src/store/visits-context.tsx', { react: h.react,
    '@supabase/supabase-js': { createClient: (_url: string, _key: string, o: any) => { options = o; return {}; } },
    '../config/backend': { backendConfig: { supabaseUrl: 'https://test.invalid', supabasePublishableKey: 'test' } },
    '../lib/supabaseClient': { createSupabaseFetchWithJwtClockSkewRetry: (f: unknown) => f },
    '../repositories/visits/visits-repository': { VisitsRepository: class {} } });
  const token = (sub: string) => 'x.' + Buffer.from(JSON.stringify({ sub })).toString('base64url') + '.x';
  let provider: () => Promise<string | null> = async () => token('other');
  const render = () => h.render(() => VisitsProvider({ userId: 'owner', accessTokenProvider: provider, children: null }));
  render(); await assert.rejects(options.accessToken(), /Account changed/);
  provider = () => pending.promise; render(); const inFlight = options.accessToken(); h.unmount(); pending.resolve(token('owner'));
  await assert.rejects(inFlight, /Account changed/);
});

test('Sentry scrubs journal values from nested contexts', () => {
  const { scrubSentryEvent } = load('src/observability/error-monitoring.ts', { 'expo-application': {}, 'expo-constants': {}, 'react-native': rn, '@sentry/react-native': {} });
  const result = scrubSentryEvent({ contexts: { visitDate: '2020-02-29', rating: 5, reflection: 'PRIVATE', validation_timezone: 'Asia/Shanghai' } });
  for (const value of ['2020-02-29', 'PRIVATE', 'Asia/Shanghai']) assert.ok(!JSON.stringify(result).includes(value));
  assert.equal(result.contexts.rating, '[Filtered]');
});

function panelFixture(initial = page(), logVisit = false) {
  const h = hooks(); let result = initial, failLoad = false, failDelete = false; let deletes = 0;
  const alerts: any[] = [], reported: any[] = [], applied: any[] = [];
  const repo = repository({ history: async () => { if (failLoad) throw Error('PRIVATE FAILURE'); return result; },
    remove: async () => { deletes++; if (failDelete) throw Error('PRIVATE FAILURE'); result = page([], 0); } });
  const session = new VisitAccountSession(repo);
  const onBusyChange = () => {};
  const { PlaceVisitJournal } = load('src/components/place-visit-journal.tsx', { react: h.react,
    'react-native': { ...rn, Alert: { alert: (...args: any[]) => alerts.push(args) } },
    'expo-localization': { getCalendars: () => [{ timeZone: 'Asia/Shanghai' }] },
    'expo-router': { useFocusEffect: (fn: any) => h.react.useEffect(fn, [fn]) },
    '../design-system/theme': { useAppTheme: () => ({ theme }) }, '../store/visits-context': { useVisits: () => session },
    '../store/PlacesContext': { usePlaces: () => ({ applyVisitPlaceStatus: (...args: any[]) => applied.push(args), retryStorage() {} }) },
    '../observability/error-monitoring': { errorMonitoring: { captureException: (...args: any[]) => reported.push(args) } },
    './v2-controls': { V2Button: 'Button' }, './v2-layout': { V2SectionLabel: 'Label' }, './visit-form': { VisitForm: 'Form' } });
  const render = () => h.render(() => PlaceVisitJournal({ logVisit, placeId: 'place', disabled: false, onBusyChange }));
  const button = (label: string) => flatten(render()).find(n => n.type === 'Button' && n.props.label === label);
  const text = () => flatten(render()).filter(n => n.type === 'Text').map(n => Array.isArray(n.props.children) ? n.props.children.join('') : n.props.children).join('\n');
  return { render, button, text, session, alerts, reported, applied, deletes: () => deletes,
    failLoad: (value: boolean) => { failLoad = value; }, failDelete: (value: boolean) => { failDelete = value; } };
}

test('history UI shows private summaries, opens the form, and confirms deletion before mutating', async () => {
  const f = panelFixture(); f.render(); f.render(); await tick();
  assert.match(f.text(), /1 recorded visit/); assert.match(f.text(), /Your most recent rated visit: 4\/5/);
  f.button('Log a visit').props.onPress(); assert.ok(flatten(f.render()).some(n => n.type === 'Form'));
  flatten(f.render()).find(n => n.type === 'Form').props.onClose(false); await tick();
  f.button('Delete visit').props.onPress(); assert.equal(f.deletes(), 0); assert.equal(f.alerts[0][0], 'Delete this visit?');
  f.failDelete(true); f.alerts[0][2][1].onPress(); await tick(); assert.ok(f.button('Retry deletion')); assert.ok(!f.text().includes('1 recorded visit'));
  f.failDelete(false); f.button('Retry deletion').props.onPress(); await tick();
  assert.match(f.text(), /0 recorded visits/); assert.match(f.text(), /marked Visited can still have no recorded visits/);
  assert.equal(f.applied.at(-1)[1], 'visited');
  assert.ok(!JSON.stringify(f.reported).includes('PRIVATE FAILURE'));
});

test('history UI recovers a failed load and account clearing hides all journal content', async () => {
  const f = panelFixture(); f.failLoad(true); f.render(); f.render(); await tick(); assert.ok(f.button('Retry history'));
  f.failLoad(false); f.button('Retry history').props.onPress(); await tick(); assert.match(f.text(), /Private memory/);
  f.session.clear(); assert.equal(f.render(), null);
});

test('a stale library hydration or journal status cannot overwrite a newer confirmed status', async () => {
  const h = hooks(); const base = { id: 'place', status: 'want_to_go', updatedAt: '2026-01-01T00:00:00.123100Z' };
  const slow = deferred<any[]>(); let calls = 0;
  const repo = { listPlaces: async () => ++calls === 1 ? [base] : slow.promise, listTags: async () => [],
    updatePlace: async () => ({ ...base, status: 'skipped', updatedAt: '2026-01-01T00:00:00.123900Z' }) };
  const { PlacesProvider } = load('src/store/PlacesContext.tsx', { react: h.react,
    '../repositories/savedPlaces': { createSavedPlacesRepository: () => ({ repository: repo }) },
    '../observability/error-monitoring': { errorMonitoring: { captureException() {} } } });
  const render = () => h.render(() => PlacesProvider({ userId: 'owner', accessTokenProvider: async () => 'token', children: null })).props.value;
  render(); await tick(); render().retryStorage(); render();
  render().applyVisitPlaceStatus('place', 'visited', '2026-01-01T00:00:00.123500Z');
  slow.resolve([base]); await tick(); assert.equal(render().places[0].status, 'visited');
  await render().updatePlace('place', { status: 'skipped' });
  render().applyVisitPlaceStatus('place', 'visited', '2026-01-01T00:00:00.123500Z');
  assert.equal(render().places[0].status, 'skipped');
});

test('plan shortcut opens the visit form once and cancellation never creates a visit', async () => {
  const f = panelFixture(page(), true); f.render(); f.render(); await tick();
  const form = flatten(f.render()).find(n => n.type === 'Form'); assert.ok(form);
  assert.equal(form.props.original, undefined);
  form.props.onClose(false); await tick();
  assert.ok(!flatten(f.render()).some(n => n.type === 'Form'));
  assert.match(f.text(), /1 recorded visit/); assert.equal(f.deletes(), 0);
});
