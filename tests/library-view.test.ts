import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import { clearLibraryFilters, defaultLibraryView as base, libraryOptions, normalizeLibraryText, parseLibraryPreferences, selectLibraryPlaces } from '../src/services/library-view';
import type { PlaceCard } from '../src/types/place';

const place = (overrides: Partial<PlaceCard> = {}): PlaceCard => ({ id: 'a', placeName: 'Café 香港', areaCity: 'Hong Kong', address: '12 Queen Road', category: 'cafe', cuisineOrSpecialty: 'Pastries', tags: ['Weekend'], notes: 'Try the soufflé', status: 'want_to_go', isFavorite: true, createdAt: '2026-01-01', updatedAt: '2026-01-03', sourceInstagramUrl: 'https://www.instagram.com/p/privateurl/', sources: [{ id: 'source', savedPlaceId: 'a', platform: 'instagram', sourceUrl: 'https://www.instagram.com/p/privateurl/', mediaType: 'post', creatorUsername: 'foodlover', captionExcerpt: 'Sunny terrace', recommendedItems: ['Pistachio tart'], vibeTags: ['Quiet'], createdAt: '2026-01-01' }], ...overrides });
const ids = (places: PlaceCard[]) => places.map(p => p.id);

test('local token search normalizes case, whitespace, Unicode and diacritics across persisted fields', () => {
  assert.equal(normalizeLibraryText('  CAFÉ\t香港  '), 'cafe 香港');
  for (const query of ['CAFE', 'cafe\u0301', '香港', 'Ｈｏｎｇ', '  cafe   weekend  ', 'souffle', 'foodlover', 'terrace', 'pistachio quiet', 'queen pastries']) {
    assert.deepEqual(ids(selectLibraryPlaces([place()], { ...base, query })), ['a'], query);
  }
  for (const query of ['cafe missing', 'privateurl']) assert.equal(selectLibraryPlaces([place()], { ...base, query }).length, 0);
});
test('source caption search is bounded by Unicode code points', () => {
  const p = place(); p.sources[0].captionExcerpt = '😀'.repeat(280) + 'hidden';
  assert.equal(selectLibraryPlaces([p], { ...base, query: 'hidden' }).length, 0);
});
test('every filter group combines with search using AND and normalized tag identity', () => {
  const p = place();
  const view = { ...base, query: 'cafe', status: 'want_to_go' as const, favoritesOnly: true, tag: ' weekend ', category: 'cafe', area: 'hong kong' };
  assert.equal(selectLibraryPlaces([p], view).length, 1);
  for (const change of [{ status: 'visited' as const }, { tag: 'other' }, { category: 'restaurant' }, { area: 'taipei' }, { query: 'other' }]) assert.equal(selectLibraryPlaces([p], { ...view, ...change }).length, 0);
  assert.equal(selectLibraryPlaces([place({ isFavorite: false })], view).length, 0);
});
test('options derive stable normalized values and labels without a catalog', () => {
  assert.deepEqual(libraryOptions([place(), place({ areaCity: '  hong   kong ' }), place({ areaCity: '' })], 'areaCity'), [{ value: 'hong kong', label: 'Hong Kong' }]);
});
test('clearing filters preserves query and durable choices; clearing query preserves filters', () => {
  const view = { ...base, query: 'x', tag: 'Weekend', area: 'hong kong', category: 'cafe', favoritesOnly: true, status: 'visited' as const, sort: 'name' as const, density: 'compact' as const };
  assert.deepEqual(clearLibraryFilters(view), { ...base, query: 'x', sort: 'name', density: 'compact' });
  assert.equal(selectLibraryPlaces([place()], { ...view, query: '' }).length, 0);
});
test('four sorts are deterministic, safe for invalid values and do not mutate input', () => {
  const records = [place({ id: 'b', placeName: 'Zulu', createdAt: '2026-01-02', updatedAt: '2026-01-02' }), place({ id: 'a', placeName: 'Alpha', createdAt: '2026-01-01', updatedAt: '2026-01-03' }), place({ id: 'c', placeName: 'Alpha', createdAt: '2026-01-01', updatedAt: '2026-01-03' })];
  const original = JSON.stringify(records);
  for (const [sort, expected] of [['newest', ['b','a','c']], ['oldest', ['a','c','b']], ['updated', ['a','c','b']], ['name', ['a','c','b']]] as const) {
    assert.deepEqual(ids(selectLibraryPlaces(records, { ...base, sort })), expected);
    assert.deepEqual(ids(selectLibraryPlaces([...records].reverse(), { ...base, sort })), expected);
  }
  assert.equal(JSON.stringify(records), original);
  assert.deepEqual(ids(selectLibraryPlaces([place({ id: 'z', createdAt: 'bad' }), place({ id: 'a', createdAt: '' })], base)), ['a','z']);
});
test('large synthetic library search and sort preserves the complete source collection', () => {
  const records = Array.from({ length: 5000 }, (_, i) => place({ id: String(i).padStart(5,'0'), notes: i % 2 ? 'target' : 'other' }));
  Object.freeze(records);
  const results = selectLibraryPlaces(records, { ...base, query: 'target cafe', sort: 'name' });
  assert.equal(results.length, 2500); assert.equal(records.length, 5000); assert.equal(results[0].id, '00001');
});
test('preference parsing validates each durable field and excludes transient state', () => {
  assert.deepEqual(parseLibraryPreferences('{"sort":"name","density":"compact","query":"secret"}'), { sort: 'name', density: 'compact' });
  for (const raw of [null, '', '{', 'null', '[]', '{"sort":["name"]}', '{"sort":"toString","density":"tiny"}']) assert.deepEqual(parseLibraryPreferences(raw), { sort: 'newest', density: 'comfortable' });
});

// Execute TSX with lightweight host stubs to check component output and callbacks.
// These are component contracts, not native layout or device acceptance tests.
const load = (path: string, stubs: Record<string, unknown>) => {
  const filename = resolve(path); const localRequire = createRequire(filename);
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(filename,'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText, { exports, __DEV__: true, process: { env: { EXPO_PUBLIC_POSTHOG_API_KEY: 'test', EXPO_PUBLIC_POSTHOG_HOST: 'https://example.test' } }, require: (name: string) => name in stubs ? stubs[name] : localRequire(name) });
  return exports as any;
};
const theme = { colors: {}, typography: { body: {} }, spacing: {}, radii: {} };
const rn = { Pressable: 'Pressable', Text: 'Text', View: 'View', StyleSheet: { create: (s: unknown) => s } };
const flatten = (node: any): any[] => node == null || typeof node === 'boolean' ? [] : Array.isArray(node) ? node.flatMap(flatten) : [node, ...flatten(node.props?.children)];
test('comfortable and compact row component output preserves identity, lifecycle and favorite', () => {
  const { V2PlaceRow } = load('src/components/v2-place-row.tsx', { react: { useMemo: (fn: () => unknown) => fn() }, 'react-native': rn, '../design-system/theme': { useAppTheme: () => ({ theme }) }, './v2-marks': { FavoriteMark: 'FavoriteMark', PlaceGlyph: 'PlaceGlyph' } });
  for (const density of ['comfortable', 'compact']) {
    let opened = false;
    const tree = V2PlaceRow({ place: place(), index: 1, density, onPress: () => { opened = true; } });
    const nodes = flatten(tree);
    assert.match(tree.props.accessibilityLabel, /Café 香港.*Hong Kong.*favorite/);
    assert.ok(nodes.some(n => n.type === 'FavoriteMark' && n.props.active));
    assert.equal(nodes.some(n => n.type === 'PlaceGlyph'), density === 'comfortable');
    tree.props.onPress(); assert.ok(opened);
  }
});
test('active route and V2 screen integrate local selector, distinct empty states and independent clear', () => {
  const route = readFileSync('app/(app)/index.tsx','utf8');
  const screen = readFileSync('src/screens/v2-home-screen.tsx','utf8');
  assert.match(route, /V2HomeScreen/); assert.match(screen, /selectLibraryPlaces\(places, view\)/);
  assert.match(screen, /Your library is empty/); assert.match(screen, /No matching places/);
  assert.match(screen, /changeQuery\(''\)/); assert.match(screen, /setSessionView\(clearLibraryFilters\)/);
  assert.match(screen, /density=\{view.density\}/);
  assert.doesNotMatch(readFileSync('src/services/library-view.ts','utf8'), /fetch\(|supabase|apify|analytics/);
});
test('library analytics adapter sends only empty or bounded enum payloads', () => {
  const captured: any[] = [];
  const { analytics } = load('src/observability/analytics.ts', { 'expo-application': {}, 'expo-constants': {}, 'react-native': { Platform: { OS: 'android' } }, 'posthog-react-native': { PostHog: class { capture(...args: any[]) { captured.push(args); } } } });
  analytics.librarySearchStarted(); analytics.libraryFilterChanged('area'); analytics.librarySortChanged('name'); analytics.libraryDensityChanged('compact'); analytics.libraryFiltersCleared();
  assert.deepEqual(captured.map(event => event[0]), ['library_search_started','library_filter_changed','library_sort_changed','library_density_changed','library_filters_cleared']);
  assert.equal(captured[1][1].filter_type, 'area');
  assert.equal(captured[2][1].sort, 'name');
  assert.equal(captured[3][1].density, 'compact');
  for (const [,properties] of captured) assert.ok(Object.keys(properties).every(key => ['environment','platform','app_version','app_build','filter_type','sort','density'].includes(key)));
  const adapter = readFileSync('src/observability/analytics.ts','utf8');
  assert.match(adapter, /librarySearchStarted\(\) \{ capture\('library_search_started', \{\}\)/);
  const screen = readFileSync('src/screens/v2-home-screen.tsx','utf8');
  assert.match(screen, /!searchStarted.current/);
  assert.doesNotMatch(screen, /analytics\.\w+\([^)]*(?:query|tag\.name|areaCity|notes)/);
  const hook = readFileSync('src/services/use-library-preferences.ts','utf8');
  assert.doesNotMatch(hook, /captureException\(error|storageError/);
  assert.match(hook, /new Error\('Local preference write failed'\)/);
});

test('preference hook restores per account, preserves session choices on failure and ignores late reads', async () => {
  let states: any[] = [], cursor = 0;
  let effects: Array<() => void | (() => void)> = [];
  let deps: any[][] = [], cleanups: Array<void | (() => void)> = [];
  const react = {
    useState(initial: any) { const i = cursor++; if (!(i in states)) states[i] = initial; return [states[i], (next: any) => { states[i] = typeof next === 'function' ? next(states[i]) : next; }]; },
    useRef(initial: any) { const i = cursor++; if (!(i in states)) states[i] = { current: initial }; return states[i]; },
    useEffect(fn: any, next: any[]) { const i = cursor++; if (!deps[i] || next.some((x,j) => x !== deps[i][j])) { effects.push(() => { cleanups[i]?.(); cleanups[i] = fn(); }); deps[i] = next; } }
  };
  const data = new Map<string,string>(); const failures: any[] = []; let failWrite = false, failRead = false;
  let pending: ((value: string | null) => void) | null = null;
  let deferRead = false;
  const storage = {
    async getItemAsync(key: string) { if (failRead) throw new Error('private'); if (deferRead) return new Promise<string | null>(resolve => { pending = resolve; }); return data.get(key) ?? '{"sort":"oldest","density":"compact"}'; },
    async setItemAsync(key: string, value: string) { if (failWrite) throw new Error('private'); data.set(key, value); }
  };
  const { useLibraryPreferences } = load('src/services/use-library-preferences.ts', { react, 'react-native': { Platform: { OS: 'android' } }, 'expo-secure-store': storage, '../observability/error-monitoring': { errorMonitoring: { captureException: (...args: any[]) => failures.push(args) } } });
  const render = (id = 'account-a') => { cursor = 0; const value = useLibraryPreferences(id); const tasks = effects; effects = []; tasks.forEach(fn => fn()); return value; };
  const tick = async () => { await new Promise(resolve => setImmediate(resolve)); };
  render(); await tick();
  assert.equal(render()[0].sort, 'oldest'); assert.equal(render()[0].density, 'compact');
  render()[1]({ sort: 'name', density: 'comfortable' }); await tick();
  assert.equal(data.size, 1); assert.deepEqual(JSON.parse([...data.values()][0]), { sort: 'name', density: 'comfortable' });
  failWrite = true; render()[1]({ sort: 'updated', density: 'compact' }); await tick();
  assert.equal(render()[0].sort, 'updated'); assert.equal(failures[0][1].operation, 'preference_write');
  assert.equal(failures[0][0].message, 'Local preference write failed');
  failRead = true; render('account-b'); await tick(); assert.equal(render('account-b')[0].sort, 'newest');
  assert.equal(failures[1][1].operation, 'preference_read');
  failRead = false; deferRead = true;
  render('account-c'); render('account-c')[1]({ sort: 'name', density: 'compact' });
  pending!('{"sort":"oldest","density":"comfortable"}'); await tick();
  assert.equal(render('account-c')[0].sort, 'name');
});

test('V2 home callbacks combine filters, clear search independently, and recompute changed records', () => {
  let session = { ...base }; let preferences = { sort: 'newest', density: 'comfortable' }; let records = [place()];
  const events: any[] = [];
  const { V2HomeScreen } = load('src/screens/v2-home-screen.tsx', {
    '@clerk/expo': { useAuth: () => ({ userId: 'test' }) },
    react: { useMemo: (fn: any) => fn(), useState: () => [session, (value: any) => { session = typeof value === 'function' ? value(session) : value; }], useRef: () => ({ current: false }), useEffect: () => {} },
    'react-native': { ...rn, FlatList: 'FlatList', TextInput: 'TextInput', Keyboard: { dismiss() {} } },
    '../design-system/theme': { useAppTheme: () => ({ theme }) },
    '../store/PlacesContext': { usePlaces: () => ({ availableTags: [{ id:'t', name:'Weekend' }], isLoading:false, isStorageAvailable:true, places:records }) },
    '../services/use-library-preferences': { useLibraryPreferences: () => [preferences, (next: any) => { preferences = next; }] },
    '../observability/analytics': { analytics: new Proxy({}, { get: (_, key) => (...args: any[]) => events.push([key,...args]) }) },
    '../components/state-panel': { StatePanel: 'StatePanel' }, '../components/storage-error-banner': { StorageErrorBanner: 'StorageErrorBanner' },
    '../components/v2-filter-rack': { V2FilterRack: 'V2FilterRack' }, '../components/v2-marks': { EnergySlash:'EnergySlash' }, '../components/v2-place-row': { V2PlaceRow:'V2PlaceRow' }
  });
  const render = () => {
    const tree = V2HomeScreen({ navigation: { navigate() {} } });
    const list = flatten(tree).find(n => n.type === 'FlatList');
    const header = flatten(list.props.ListHeaderComponent);
    return { list, search: header.find(n => n.type === 'TextInput'), rack: header.find(n => n.type === 'V2FilterRack') };
  };
  render().rack.props.onFilterChange({ favoritesOnly:true },'favorite');
  render().search.props.onChangeText('missing');
  assert.equal(render().list.props.data.length,0);
  assert.equal(flatten(render().list.props.ListEmptyComponent).find(n => n.type === 'StatePanel').props.title,'No matching places');
  render().search.props.onChangeText(''); assert.equal(session.favoritesOnly,true); assert.equal(render().list.props.data.length,1);
  render().rack.props.onSortChange('name'); render().rack.props.onDensityChange('compact');
  render().rack.props.onClearFilters(); assert.equal(preferences.sort,'name'); assert.equal(preferences.density,'compact');
  assert.equal(render().list.props.renderItem({ item:records[0],index:0 }).props.density,'compact');
  render().search.props.onChangeText('newrecommendation'); assert.equal(render().list.props.data.length,0);
  records = [place({ sources: [{ ...place().sources[0], recommendedItems:['newrecommendation'] }] })]; assert.equal(render().list.props.data.length,1);
  records = []; assert.equal(render().list.props.ListEmptyComponent.props.title,'Your library is empty');
  assert.ok(events.every(event => !JSON.stringify(event).includes('missing')));
});
