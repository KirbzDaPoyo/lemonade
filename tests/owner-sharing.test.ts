import assert from 'node:assert/strict';
import test from 'node:test';
import { SharingSession, SharingFailure, parseSharingDetails, sharingOrigin, type SharingDetails, type SharingTransport } from '../src/services/owner-sharing';
import { createPlaceDataExport } from '../src/services/export/place-data-export';
import { hooks, load, flatten, tick, rn, theme } from './helpers/component-harness';
const planId = '00000000-0000-4000-8000-000000000001';
const details: SharingDetails = { planId, enabled: false, revision: 0, title: 'Places to try', createdAt: null, updatedAt: null,
  labels: [{ savedPlaceId: 'place-1', name: null, location: null, updatedAt: null }] };
const deferred = <T,>() => { let resolve!: (v:T) => void; const promise = new Promise<T>(r => { resolve=r; }); return { promise, resolve }; };
const transport = (extra: Partial<SharingTransport> = {}): SharingTransport => ({ metadata: async () => details, owner: async () => details, ...extra });
test('owner metadata and schema 6 export explicitly exclude credentials and unknown fields', () => {
  const hostile = { ...details, token: 'secret', credential: 'secret', verifier: 'secret', url: 'secret', labels: [{ ...details.labels[0], notes: 'secret' }] };
  const clean = parseSharingDetails(hostile);
  assert.deepEqual(clean, details);
  const data = createPlaceDataExport([], [], 'now', [], [], [], [hostile]);
  assert.equal(data.schemaVersion, 6); assert.deepEqual(data.data.planSharing, [details]);
  assert.ok(!JSON.stringify(data).includes('secret'));
  assert.equal(sharingOrigin('https://example.test/'), 'https://example.test');
  for (const value of ['http://example.test', 'https://user:pass@example.test', 'https://example.test/s', 'https://example.test/?a=1']) assert.equal(sharingOrigin(value), undefined);
});
test('sharing pagination exhausts pages, rejects repeats/failures and invalidates on account change', async () => {
  const values = Array.from({length:53}, (_,i) => ({ ...details, planId: String(i).padStart(36,'0') }));
  const cursors: unknown[] = [];
  const session = new SharingSession(transport({ metadata: async (_, args) => {
    cursors.push(args.p_after); const index = args.p_after === null ? 0 : values.findIndex(v=>v.planId === args.p_after) + 1;
    return values.slice(index,index+25);
  }}));
  assert.deepEqual(await session.exportAll(), values); assert.equal(cursors.length,4);
  await assert.rejects(new SharingSession(transport({metadata:async()=>[details]})).exportAll());
  let calls=0;
  await assert.rejects(new SharingSession(transport({metadata:async()=> {if(calls++) throw Error('offline');return [details];}})).exportAll());
  const pending=deferred<unknown>();const old = new SharingSession(transport({metadata:()=>pending.promise}));
  const output=old.exportAll();old.clear();pending.resolve([details]);await assert.rejects(output);
});
test('duplicate mutation, uncertain writes, stale account delivery and revoked links fail safely', async () => {
  const pending=deferred<unknown>();let calls=0;
  const session=new SharingSession(transport({owner:async()=>{calls++;return pending.promise;}}),'https://example.test');
  const write=session.mutate(planId,'enable',0);await assert.rejects(session.mutate(planId,'enable',0));
  pending.resolve({...details,enabled:true,token:'secret'});assert.ok(!('token' in await write));assert.equal(calls,1);
  const fail=new SharingSession(transport({owner:async()=>{throw new SharingFailure('conflict');}}),'https://example.test');
  await assert.rejects(fail.mutate(planId,'disable',0),e=>e instanceof SharingFailure&&e.code==='conflict');
  const retrieval=deferred<unknown>();let deliveries=0;
  const old=new SharingSession(transport({owner:()=>retrieval.promise}),'https://example.test');
  const send=old.deliver(planId,async()=>{deliveries++;});old.clear();retrieval.resolve({...details,enabled:true,token:'A'.repeat(43)});
  await assert.rejects(send);assert.equal(deliveries,0);
  const revoked=new SharingSession(transport(),'https://example.test');await assert.rejects(revoked.deliver(planId,async()=>{deliveries++;}));
  assert.equal(deliveries,0);
  const ready=new SharingSession(transport({owner:async()=>({...details,enabled:true,token:'A'.repeat(43)})}),'https://example.test');
  let url='';await ready.deliver(planId,async value=>{url=value;});assert.equal(url,`https://example.test/s#${'A'.repeat(43)}`);
  await assert.rejects(ready.deliver(planId,async()=>{deliveries++;},()=>{throw Error('Closed');}));assert.equal(deliveries,0);
});
function editorFixture(initial=details) {
  const h=hooks(); let stored=structuredClone(initial); const actions:string[]=[]; let failed=false; let closed=false;
  const session=new SharingSession(transport({metadata:async()=>stored,owner:async input=>{
    actions.push(String(input.action));if(failed)throw new SharingFailure();
    if(input.action==='preview')return {...stored,preview:{schemaVersion:1,title:stored.title,places:stored.labels.map(l=>({name:l.name,location:l.location,mapUrl:null}))}};
    const payload=input.payload as Record<string,unknown>;
    stored={...stored,revision:stored.revision+1};
    if(input.action==='title')stored.title=String(payload.title);
    if(input.action==='label')stored.labels=stored.labels.map(l=>l.savedPlaceId===payload.savedPlaceId?{...l,name:String(payload.name),location:payload.location as string|null}:l);
    if(input.action==='enable')stored.enabled=true;
    return stored;
  }}),'https://example.test');
  const alerts:any[]=[];
  const {SharingEditor}=load('src/components/plan-sharing-panel.tsx',{
    react:h.react,'react-native':{...rn,Modal:'Modal',Keyboard:{isVisible:()=>false},Alert:{alert:(...args:any[])=>alerts.push(args)},Share:{share:async()=>{}},Linking:{openURL:async()=>{}}},
    'react-native-safe-area-context':{SafeAreaView:'SafeAreaView'},'expo-clipboard':{setStringAsync:async()=>true},
    './v2-controls':{V2Button:'Button',V2TextField:'Field'},'./v2-layout':{V2SectionLabel:'Section',V2TopBar:'Top'},
    '../design-system/use-reduced-motion':{useReducedMotion:()=>true}, '../design-system/theme':{useAppTheme:()=>({theme})},'../store/sharing-context':{useSharing:()=>session}
  });
  const render=()=>flatten(h.render(()=>SharingEditor({planId,onClose:()=>{closed=true;}})));
  const button=(label:string)=>render().find(n=>n.type==='Button'&&n.props.label===label);
  const field=(label:string)=>render().find(n=>n.type==='Field'&&n.props.label===label);
  return {render,button,field,actions,alerts,fail:()=>{failed=true;},isClosed:()=>closed,unmount:h.unmount};
}
test('owner editor never prefills private names, preserves drafts, gates enable on review and confirms discard',async()=>{
  const ui=editorFixture();ui.render();await tick();
  assert.equal(ui.field('Public name for place 1').props.value,'');
  assert.equal(ui.button('Review public preview').props.disabled,true);
  ui.field('Public title').props.onChangeText('Our weekend');ui.field('Public name for place 1').props.onChangeText('My own cafe');
  ui.button('Save public title').props.onPress();await tick();
  assert.equal(ui.field('Public name for place 1').props.value,'My own cafe');
  ui.button('Done').props.onPress();assert.equal(ui.alerts[0][0],'Discard public edits?');assert.equal(ui.isClosed(),false);
  ui.button('Save public details for place 1').props.onPress();await tick();
  assert.equal(ui.button('Enable read-only link'),undefined);
  ui.button('Review public preview').props.onPress();await tick();
  assert.equal(ui.button('Enable read-only link').props.disabled,false);
  ui.button('Enable read-only link').props.onPress();await tick();
  assert.ok(ui.render().includes('Link enabled'));assert.ok(ui.button('Copy link'));assert.ok(ui.button('View public page'));
  assert.deepEqual(ui.actions,['title','label','preview','enable']);ui.unmount();
});
test('failed enable leaves status uncertain and prevents copy until refresh',async()=>{
  const ui=editorFixture({...details,labels:[]});ui.render();await tick();ui.button('Review public preview').props.onPress();await tick();
  ui.fail();ui.button('Enable read-only link').props.onPress();await tick();
  assert.ok(ui.render().includes('Current sharing status needs confirmation.'));assert.equal(ui.button('Copy link'),undefined);
  assert.ok(ui.button('Refresh sharing status'));ui.unmount();
});

test('sharing provider rejects a changed Clerk subject and late tokens after sign-out',async()=>{
  const h=hooks();let options:any;const pending=deferred<string|null>();
  const {SharingProvider}=load('src/store/sharing-context.tsx',{
    react:h.react,'@supabase/supabase-js':{createClient:(_url:string,_key:string,o:any)=>{options=o;return {}; }},
    '../config/backend':{backendConfig:{supabaseUrl:'https://example.test',supabasePublishableKey:'test'}},
    '../lib/supabaseClient':{createSupabaseFetchWithJwtClockSkewRetry:(f:unknown)=>f}
  });
  const token=(sub:string)=>'x.'+Buffer.from(JSON.stringify({sub})).toString('base64url')+'.x';
  let provider:()=>Promise<string|null>=async()=>token('other');
  const render=()=>h.render(()=>SharingProvider({userId:'owner',accessTokenProvider:provider,children:null}));
  render();await assert.rejects(options.accessToken());
  provider=()=>pending.promise;render();const inFlight=options.accessToken();h.unmount();pending.resolve(token('owner'));
  await assert.rejects(inFlight);
});
test('a local sharing mutation invalidates an in-progress export guard',async()=>{
  const session=new SharingSession(transport());const guard=session.guard();
  await session.mutate(planId,'title',0,{title:'new title'});assert.throws(guard);
});
