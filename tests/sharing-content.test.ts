import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { parseSharedPlanContent, createSharingReview, sharingDisclosure } from '../src/services/sharing-content';
import { publicProjection, sharingHandler, type SharingDependencies } from '../supabase/functions/_shared/planSharing';
import { load, rn } from './helpers/component-harness';

const raw={schemaVersion:1,title:'My public list',places:[{name:'My cafe',location:'My area',providerPlaceId:'ChIJ-fixture'}]};
test('public preview and recipient responses have identical reviewed content',async()=>{
 const deps:SharingDependencies={enabled:true,origins:[],authenticate:async()=> 'owner',reserve:async()=>true,
  keys:()=>({}),activeKey:()=>'',rpc:async(name)=>name==='read_shared_plan'?raw:{
   enabled:false,revision:1,title:raw.title,createdAt:null,updatedAt:null,preview:raw}};
 const call=(mode:'owner'|'public',body:unknown)=>sharingHandler(mode,deps)(new Request('https://test.invalid/shared-plan',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)}));
 const preview=await (await call('owner',{planId:randomUUID(),action:'preview'})).json();
 const recipient=await (await call('public',{token:randomBytes(32).toString('base64url')})).json();
 assert.deepEqual(createSharingReview(preview.preview).content,parseSharedPlanContent(recipient));
 assert.equal(createSharingReview(preview.preview).disclosure,sharingDisclosure);
 assert.throws(()=>createSharingReview(null),/unavailable/);
});
test('recipient boundary rejects private fields instead of rendering a private-row fallback',()=>{
 const clean=publicProjection(raw);
 for(const field of ['id','planId','userId','email','notes','journal','rating','visitedAt','tags','isFavorite','status','sources','sourceUrl','latitude','distance','token','credential','verifier']){
  assert.throws(()=>parseSharedPlanContent({...clean,[field]:'PRIVATE'}),/unavailable/);
  assert.throws(()=>parseSharedPlanContent({...clean,places:[{...clean.places[0],[field]:'PRIVATE'}]}),/unavailable/);
 }
 assert.throws(()=>parseSharedPlanContent({...clean,places:[{placeName:'private row',address:'private address'}]}));
 assert.throws(()=>parseSharedPlanContent({...clean,places:[{name:'Missing required fields'}]}));
});
test('consumer destination checks reject redirects, altered destinations and hidden parameters',()=>{
 const clean=publicProjection(raw), url=clean.places[0].mapUrl!;
 for(const unsafe of ['javascript:alert(1)','data:text/html,hello','https://evil.test/maps',
  url.replace('www.google.com','www.google.com.evil.test'),url.replace('https:','http:'),
  url.replace('www.google.com','secret@www.google.com'),url+'&origin=HOME',url+'&api=1',
  url+'#SECRET',url.replace('My+cafe','Another+cafe'),'https://maps.app.goo.gl/unknown',
  url.replace('query_place_id=ChIJ-fixture','query_place_id=bad%2Fid')]){
  assert.throws(()=>parseSharedPlanContent({...clean,places:[{...clean.places[0],mapUrl:unsafe}]}),/unavailable/);
 }
 assert.deepEqual(parseSharedPlanContent(clean),clean);
 assert.equal(parseSharedPlanContent({...clean,places:[{...clean.places[0],mapUrl:null}]}).places[0].mapUrl,null);
});
test('content boundary preserves inert text and bounds Unicode, empty lists and malformed bodies',()=>{
 const special=publicProjection({schemaVersion:1,title:'<img src=x onerror=alert(1)>',
  places:[{name:'<script>alert(1)</script>',location:null}]});
 assert.equal(parseSharedPlanContent(special).title,special.title); // Must render as Text/textContent in D/E.
 assert.equal(parseSharedPlanContent({schemaVersion:1,title:'Empty',places:[]}).places.length,0);
 const maximum=publicProjection({schemaVersion:1,title:'😀'.repeat(80),places:Array(20).fill({name:'😀'.repeat(200),location:'😀'.repeat(300)})});
 assert.deepEqual(parseSharedPlanContent(maximum),maximum);
 for(const bad of [null,[],{...maximum,schemaVersion:2},{...maximum,title:'😀'.repeat(81)},
  {...maximum,title:' hidden '},{...maximum,places:Array(21).fill(maximum.places[0])},
  {...maximum,places:[{...maximum.places[0],name:'bad\ntext'}]}])assert.throws(()=>parseSharedPlanContent(bad));
});
test('Sentry removes raw tokens, verifiers, ciphertext, app links and sharing content from nested contexts',()=>{
 const {scrubSentryEvent}=load('src/observability/error-monitoring.ts',{
  'expo-application':{},'expo-constants':{},'react-native':rn,'@sentry/react-native':{}});
 const token=randomBytes(32).toString('base64url'), verifier=randomBytes(32).toString('hex'), ciphertext=randomBytes(59).toString('base64url');
 const output=scrubSentryEvent({contexts:{debug:{detail:'Credential '+token+'; '+token,
  values:[verifier,ciphertext,'project-lemonade://shared#'+token,'project-lemonade-dev://shared#'+token,
   'https://example.test/s#'+token],sharedContent:{name:'PRIVATE PUBLIC TEXT'},publicName:'PRIVATE PUBLIC NAME',publicLabel:'PRIVATE PUBLIC LABEL',credential:{nonce:'PRIVATE NONCE'}}},
  exception:{values:[{value:token,stacktrace:{frames:[{function:'read '+token}]}}]}});
 const serialized=JSON.stringify(output);
 for(const value of [token,verifier,ciphertext,'PRIVATE PUBLIC TEXT','PRIVATE PUBLIC NAME','PRIVATE PUBLIC LABEL','PRIVATE NONCE','project-lemonade://','project-lemonade-dev://'])assert.ok(!serialized.includes(value));
 const stable=scrubSentryEvent({contexts:{technical:{operation:'app_frame',platform:'android'}}});
 assert.equal(stable.contexts.technical.operation,'app_frame');
});
