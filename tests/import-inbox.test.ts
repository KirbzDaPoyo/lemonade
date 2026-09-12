import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { extractInboxLinks } from '../src/services/incomingShare/inbox-links';
import { InboxRepository, mapInboxRow } from '../src/repositories/inbox/inbox-repository';
import { sortInbox, type InboxItem } from '../src/types/inbox';
import { createPlaceDataExport } from '../src/services/export/place-data-export';
import { reduceImportFlow, initialImportFlowState } from '../src/navigation/import-flow-context';
import { load, hooks, flatten, tick, theme, rn } from './helpers/component-harness';
const url = (id = 'one') => `https://www.instagram.com/reel/${id}/`;
const item: InboxItem = { id: 'one', sourceUrl: url(), origin: 'share', status: 'pending', placeNameHint: null, failureCategory: null, attemptCount: 0, lastAttemptAt: null, createdAt: '2026-01-01', updatedAt: '2026-01-01' };
const noopAnalytics = new Proxy({}, { get: () => () => {} });

test('batch extraction canonicalizes, deduplicates, reports invalid and limits to twenty', () => {
  const batch = extractInboxLinks(`Look (${url()}?igsh=x), https://instagram.com/reels/one/#x https://wrong.test/p/x/ ${Array.from({length:22}, (_,i) => url('n'+i)).join(' ')}`);
  assert.equal(batch.urls.length, 20); assert.equal(batch.duplicate, 1); assert.equal(batch.invalid, 1); assert.equal(batch.omitted, 3);
  assert.equal(batch.urls[0], url());
  assert.equal(extractInboxLinks('no links here').invalid, 1);
  assert.equal(extractInboxLinks('').urls.length, 0);
  assert.equal(extractInboxLinks(url('x'.repeat(2048))).invalid, 1);
});
test('repository sends one bounded database operation and maps every capture outcome', async () => {
  const calls: any[] = [];
  const repo = new InboxRepository({ rpc: async (...args: any[]) => { calls.push(args); return { data: ['queued','already_queued','already_saved','invalid','capacity_reached'].map((outcome,i) => ({ source_url:url(String(i)), outcome, saved_place_id: outcome === 'already_saved' ? 'place' : null })) }; } } as any, 'owner');
  const results = await repo.enqueue(Array.from({length:5}, (_,i) => url(String(i))), 'manual');
  assert.equal(calls.length, 1); assert.equal(calls[0][0], 'enqueue_import_inbox'); assert.equal(calls[0][1].urls.length, 5);
  assert.equal(results[2].placeId, 'place'); assert.equal(results[4].outcome, 'capacity_reached');
  await assert.rejects(repo.enqueue(Array(21).fill(url()), 'manual')); assert.equal(calls.length, 1);
  assert.deepEqual(await repo.enqueue([], 'manual'), []);
});
test('hydration mapping excludes raw ownership and deterministic newest ordering', () => {
  const mapped = mapInboxRow({ id:'one',source_url:url(),origin:'share',status:'pending',place_name_hint:null,failure_category:null,attempt_count:0,last_attempt_at:null,created_at:'2026-01-01',updated_at:'2026-01-01',user_id:'private' } as any);
  assert.deepEqual(mapped,item);
  assert.deepEqual(sortInbox([item,{...item,id:'two'},{...item,id:'old',createdAt:'2025'}]).map(i=>i.id), ['two','one','old']);
});
test('export schema 3 contains only explicit stored inbox fields and retains places/sources', () => {
  const exported = createPlaceDataExport([], [], 'now', [{...item, raw:'secret'} as any]);
  assert.equal(exported.schemaVersion,3); assert.deepEqual(exported.data.importInboxItems,[item]);
  assert.deepEqual(exported.data.savedPlaces,[]); assert.ok(!JSON.stringify(exported).includes('secret'));
});
test('inbox identity survives candidates and resets for direct manual entry', () => {
  const state = reduceImportFlow(initialImportFlowState, { type:'begin-inbox', item });
  const next = reduceImportFlow(state, {type:'show-candidates',draft:{sourceInstagramUrl:url(),inboxItemId:item.id},candidates:[]});
  assert.equal(next.inboxItem?.id,item.id); assert.equal(next.draft?.inboxItemId,item.id);
  assert.equal(reduceImportFlow(next,{type:'begin-manual'}).inboxItem,undefined);
});
test('state hydrates, preserves capture success after refresh failure, clears and ignores late unmounted reads', async () => {
  const h = hooks(); let fail = false; let deferred: ((value: any) => void) | null = null;
  const repo = { list: async () => { if (fail) throw Error('secret'); return [item]; }, enqueue: async () => [{sourceUrl:url(),outcome:'queued',placeId:null}], remove:async()=>{}, clear:async()=>{} };
  const { useInboxState } = load('src/store/inbox-context.tsx', { react:h.react, '../config/backend':{backendConfig:{}}, '../observability/analytics':{analytics:noopAnalytics}, '../observability/error-monitoring':{errorMonitoring:{captureException(){}}} });
  const render = () => h.render(() => useInboxState(repo));
  render(); await tick(); assert.equal(render().items.length,1);
  fail = true; const captured = await render().enqueue(url(),'share'); assert.equal(captured.summary.queued,1); assert.ok(render().error);
  fail = false; assert.equal(await render().remove(item.id,true),true); assert.equal(render().items.length,0);
  repo.list = () => new Promise(resolve => { deferred = resolve; });
  const pending = render().refresh(); h.unmount(); deferred!([item]); await pending; assert.equal(render().items.length,0);
});
test('share capture resets once after retaining URL and preserves active import navigation on failure and retry', async () => {
  const h = hooks(); let fail = true; const calls:any[]=[]; let reset=0;
  const share = { hasShareIntent:true, shareIntent:{webUrl:url(),text:null}, resetShareIntent:()=>{reset++;}, error:null };
  const enqueue = async () => { calls.push('enqueue'); if(fail) throw Error('private'); return {results:[{sourceUrl:url(),outcome:'queued',placeId:null}]}; };
  const { AuthenticatedShareCoordinator } = load('src/navigation/share-coordinator.tsx', {react:h.react, 'expo-router':{useRouter:()=>({push:()=>calls.push('navigate')}),usePathname:()=>'/add-place'}, 'expo-share-intent':{useShareIntentContext:()=>share},'react-native':rn,'../components/v2-controls':{V2Button:'Button'},'../design-system/theme':{useAppTheme:()=>({theme})},'../store/inbox-context':{useInbox:()=>({enqueue})}});
  const render=()=>h.render(AuthenticatedShareCoordinator);
  render(); await tick(); render(); assert.equal(reset,1); assert.equal(calls.length,1);
  let buttons=flatten(render()).filter(n=>n.type==='Button'); assert.ok(buttons.some(n=>n.props?.label==='RETRY SHARE (1)'));
  fail=false; buttons.find(n=>n.props?.label==='RETRY SHARE (1)').props.onPress(); await tick();
  assert.equal(reset,1); assert.deepEqual(calls,['enqueue','enqueue']); assert.ok(!flatten(render()).some(n=>n.props?.label==='RETRY SHARE (1)'));
});
test('save resolution separates all successful place outcomes from cleanup failures', async () => {
  for(const outcome of ['created_place','attached_source','existing_source']) for(const cleaned of [true,false,'throws']) {
    const alerts:any[]=[]; const routes:any[]=[];
    const { useInboxCompletion }=load('src/navigation/inbox-completion.ts',{react:{useRef:(value:any)=>({current:value})},'../store/PlacesContext':{usePlaces:()=>({retryStorage(){}})},'expo-router':{useRouter:()=>({dismissTo:(p:string)=>routes.push(p),push(){}})},'react-native':{Alert:{alert:(...args:any[])=>alerts.push(args)}},'../store/inbox-context':{useInbox:()=>({items:[item],remove:async()=>{if(cleaned==='throws') throw Error('storage unavailable'); return cleaned;}})}});
    await useInboxCompletion()(item.id,'place',outcome);
    assert.deepEqual(routes,['/inbox']); assert.ok(!alerts[0][0].includes('failed'));
    assert.equal(alerts[0][1].includes('cleanup failed'),cleaned!==true); assert.equal(alerts[0][2][1].text,'Open place');
  }
});
test('inbox analytics sends bounded aggregate counts and no submitted content', () => {
  const events:any[]=[];
  const {analytics}=load('src/observability/analytics.ts',{'expo-application':{},'expo-constants':{},'react-native':rn,'posthog-react-native':{PostHog:class{capture(...args:any[]){events.push(args);}}}});
  analytics.inboxEnqueued('manual',{submitted:999,queued:21,already_queued:0,already_saved:0,invalid:999,capacity_reached:0,sourceUrl:url(),placeNameHint:'secret'});
  assert.equal(events.length,1); assert.equal(events[0][1].submitted,20); assert.equal(events[0][1].queued,20);
  assert.ok(!JSON.stringify(events).includes('secret')); assert.ok(!JSON.stringify(events).includes(url()));
});
test('active inbox route, clear confirmation, account deletion and native-independent dependencies are wired', () => {
  assert.match(readFileSync('app/(app)/inbox.tsx','utf8'),/V2InboxScreen/);
  assert.match(readFileSync('app/(app)/_layout.tsx','utf8'),/InboxProvider key=\{userId\}/);
  const screen=readFileSync('src/screens/v2-inbox-screen.tsx','utf8');
  assert.match(screen,/Alert.alert\('Clear inbox\?'/); assert.match(screen,/disabled=\{busy \|\| active\}/);
  const sql=readFileSync('supabase/migrations/20260910162113_add_import_inbox.sql','utf8');
  for(const fragment of ['enable row level security','for select to authenticated','for insert to authenticated','for update to authenticated','for delete to authenticated','with check','pg_advisory_xact_lock','>= 100','cardinality(urls) > 20','delete from public.import_inbox_items where user_id = current_user_id']) assert.ok(sql.includes(fragment),fragment);
  assert.ok(!sql.toLowerCase().includes('security definer'));
});

test('explicit Find Place persists one attempt and checks saved source before any provider call', async () => {
  for (const alreadySaved of [false,true]) {
    const h=hooks(); const calls:string[]=[];
    const inbox={beginAttempt:async()=>{calls.push('attempt');return true;},findSaved:async()=>{calls.push('lookup');return alreadySaved?'place':null;},markAttention:async()=>true,updateHint:async()=>true};
    const {V2AddPlaceScreen}=load('src/screens/v2-add-place-screen.tsx',{
      react:h.react,'react-native':{...rn,Alert:{alert(){}}},'../design-system/theme':{useAppTheme:()=>({theme})},
      '../store/inbox-context':{useInbox:()=>inbox},'../navigation/inbox-completion':{useInboxCompletion:()=>async()=>{calls.push('cleanup');}},
      '../components/v2-controls':{V2Button:'Button',V2TextField:'Field'},'../components/v2-layout':{V2Console:'Console',V2TitleBlock:'Title',V2TopBar:'Top'},'../components/v2-marks':{HazardStrip:'Strip'},
      '../observability/analytics':{analytics:noopAnalytics},'../observability/error-monitoring':{errorMonitoring:{captureException(){}}},
      '../services/instagramImport':{instagramImportProvider:{importUrl:async()=>{calls.push('provider');throw Error('private post');}}},
      '../services/placeExtraction':{placeExtractionService:{}},'../services/placeSearch':{placeSearchService:{}},
      '../config/geoContext':{getDefaultGeoContext:()=>({})}
    });
    const render=()=>h.render(()=>V2AddPlaceScreen({navigation:{},initialInstagramUrl:url(),inboxItem:item}));
    const tree=render(); assert.deepEqual(calls,[]);
    const find=flatten(tree).find(n=>n.props?.label==='FIND PLACE'); find.props.onPress(); find.props.onPress(); await tick();
    assert.deepEqual(calls,alreadySaved?['attempt','lookup','cleanup']:['attempt','lookup','provider']);
  }
});
test('provider failures persist a bounded needs-attention category and hint save is explicit', async () => {
  const h=hooks(); const categories:string[]=[]; const hints:string[]=[];
  const inbox={beginAttempt:async()=>true,findSaved:async()=>null,markAttention:async(_id:string,category:string)=>{categories.push(category);return true;},updateHint:async(_id:string,hint:string)=>{hints.push(hint);return true;}};
  const {V2AddPlaceScreen}=load('src/screens/v2-add-place-screen.tsx',{
    react:h.react,'react-native':{...rn,Alert:{alert(){}}},'../design-system/theme':{useAppTheme:()=>({theme})},
    '../store/inbox-context':{useInbox:()=>inbox},'../navigation/inbox-completion':{useInboxCompletion:()=>async()=>{}},
    '../components/v2-controls':{V2Button:'Button',V2TextField:'Field'},'../components/v2-layout':{V2Console:'Console',V2TitleBlock:'Title',V2TopBar:'Top'},'../components/v2-marks':{HazardStrip:'Strip'},
    '../observability/analytics':{analytics:noopAnalytics},'../observability/error-monitoring':{errorMonitoring:{captureException(){}}},
    '../services/instagramImport':{instagramImportProvider:{importUrl:async()=>{throw Error('private post secret caption');}}},'../services/placeExtraction':{placeExtractionService:{}},'../services/placeSearch':{placeSearchService:{}},'../config/geoContext':{getDefaultGeoContext:()=>({})}
  });
  const render=()=>h.render(()=>V2AddPlaceScreen({navigation:{},initialInstagramUrl:url(),inboxItem:item}));
  flatten(render()).find(n=>n.props?.label==='FIND PLACE').props.onPress();await tick();
  assert.deepEqual(categories,['private_post']);
  flatten(render()).find(n=>n.props?.label==='Place name — required').props.onChangeText('My hint');
  flatten(render()).find(n=>n.props?.label==='SAVE HINT').props.onPress();await tick();assert.deepEqual(hints,['My hint']);
});
test('inbox delete and clear actions execute only from their respective user controls', async () => {
  const h=hooks();const calls:string[]=[];const alerts:any[]=[];
  const {V2InboxScreen}=load('src/screens/v2-inbox-screen.tsx',{
    react:h.react,'expo-router':{useFocusEffect(){},useRouter:()=>({})},'react-native':{...rn,Alert:{alert:(...args:any[])=>alerts.push(args)}},
    '../design-system/theme':{useAppTheme:()=>({theme})},'../navigation/import-flow-context':{useImportFlow:()=>({active:false})},
    '../components/v2-controls':{V2Button:'Button',V2TextField:'Field'},'../components/v2-layout':{V2TitleBlock:'Title',V2TopBar:'Top'},'../components/state-panel':{StatePanel:'Panel'},
    '../observability/analytics':{analytics:noopAnalytics},'../store/inbox-context':{useInbox:()=>({items:[item],remove:async()=>calls.push('delete'),clear:async()=>{calls.push('clear');return true;}})}
  });
  const render=()=>h.render(()=>V2InboxScreen({navigation:{}}));
  let list=flatten(render()).find(n=>n.type==='FlatList');
  flatten(list.props.ListHeaderComponent).find(n=>n.props?.label==='CLEAR INBOX').props.onPress();
  assert.deepEqual(calls,[]);assert.equal(alerts[0][2][0].style,'cancel');
  alerts[0][2][1].onPress();await tick();assert.deepEqual(calls,['clear']);
  list=flatten(render()).find(n=>n.type==='FlatList');flatten(list.props.renderItem({item})).find(n=>n.props?.label==='DELETE').props.onPress();await tick();assert.deepEqual(calls,['clear','delete']);
});
test('dedicated inbox client rejects tokens for a different Clerk account', async () => {
  const h=hooks();let options:any;
  const {InboxProvider}=load('src/store/inbox-context.tsx',{react:h.react,'@supabase/supabase-js':{createClient:(_url:any,_key:any,opts:any)=>{options=opts;return{};}},'../config/backend':{backendConfig:{supabaseUrl:'https://example.test',supabasePublishableKey:'test'}},'../observability/analytics':{analytics:noopAnalytics},'../observability/error-monitoring':{errorMonitoring:{captureException(){}}}});
  h.render(()=>InboxProvider({userId:'a',accessTokenProvider:async()=>`x.${Buffer.from(JSON.stringify({sub:'b'})).toString('base64url')}.x`,children:null}));
  await assert.rejects(options.accessToken(),/Account changed/);
});

test('auth token callback changes do not rebuild the repository or refresh the inbox', async () => {
  const h = hooks(); let clients = 0; let reads = 0; let tokenOptions: any;
  const { InboxProvider } = load('src/store/inbox-context.tsx', {
    react: h.react,
    '@supabase/supabase-js': { createClient: (_url: any, _key: any, options: any) => { clients++; tokenOptions = options; return {}; } },
    '../repositories/inbox/inbox-repository': { InboxRepository: class { async list() { reads++; return []; } } },
    '../config/backend': { backendConfig: { supabaseUrl: 'https://example.test', supabasePublishableKey: 'test' } },
    '../observability/analytics': { analytics: noopAnalytics },
    '../observability/error-monitoring': { errorMonitoring: { captureException() {} } }
  });
  const token = (marker: string) => `x.${Buffer.from(JSON.stringify({ sub: 'a', marker })).toString('base64url')}.x`;
  const render = (marker: string) => h.render(() => InboxProvider({ userId: 'a', accessTokenProvider: async () => token(marker), children: null }));
  const first = render('first'); await tick();
  const next = render('next'); await tick(); render('latest'); await tick();
  assert.equal(clients, 1); assert.equal(reads, 1);
  assert.equal(first.props.value.refresh, next.props.value.refresh);
  assert.equal(await tokenOptions.accessToken(), token('latest'));
});
