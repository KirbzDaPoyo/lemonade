import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { digest, mintCredential, recoverCredential, tokenKeys, TOKEN, publicProjection, ownerRequest, sharingHandler, type SharingDependencies } from '../supabase/functions/_shared/planSharing';

const plan = randomUUID(), keys = { v1: randomBytes(32).toString('base64url') };
const request = (body: unknown, options: RequestInit = {}) => new Request('https://local.test/shared-plan',
  { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), ...options });
const base: SharingDependencies = {
 enabled: true, origins: ['https://page.test'], authenticate: async () => 'owner',
 reserve: async () => true, rpc: async () => null, keys: () => keys, activeKey: () => 'v1'
};
test('sharing tokens encrypt independently, recover across devices, and bind plan/revision/key/verifier', async () => {
 const a = await mintCredential(keys, 'v1', plan, 1), b = await mintCredential(keys, 'v1', plan, 1);
 assert.ok(TOKEN.test(a.token)); assert.equal(Buffer.from(a.token,'base64url').length,32);
 assert.notEqual(a.token,b.token); assert.notEqual(a.credential.nonce,b.credential.nonce);
 assert.equal(await recoverCredential(keys,a.credential,plan,1,a.verifier),a.token);
 for (const [k,p,r,v] of [[keys,randomUUID(),1,a.verifier],[keys,plan,2,a.verifier],
   [{v1:randomBytes(32).toString('base64url')},plan,1,a.verifier],[{},plan,1,a.verifier],[keys,plan,1,b.verifier]] as const)
   await assert.rejects(recoverCredential(k,a.credential,p,r,v), /Sharing operation failed/);
 const tampered={...a.credential,ciphertext:b.credential.ciphertext};
 await assert.rejects(recoverCredential(keys,tampered,plan,1,a.verifier));
 assert.deepEqual(tokenKeys(JSON.stringify(keys)),keys);
 for(const raw of ['{}','null','{"v1":"short"}','bad']) assert.throws(()=>tokenKeys(raw));
});
test('public projection excludes private fields and reconstructs safe bounded maps', () => {
 const output=publicProjection({schemaVersion:1,title:'<script>alert(1)</script>',user_id:'secret',
  places:[{name:'Owner name',location:'Own area',providerPlaceId:'ChIJ-test',notes:'private',mapUrl:'javascript:alert(1)',rating:5}]});
 assert.deepEqual(Object.keys(output),['schemaVersion','title','places']);
 assert.deepEqual(Object.keys(output.places[0]),['name','location','mapUrl']);
 assert.equal(output.title,'<script>alert(1)</script>'); // Rendering must use text, not HTML, in E.
 assert.equal(output.places[0].mapUrl,'https://www.google.com/maps/search/?api=1&query=Owner+name%2C+Own+area&query_place_id=ChIJ-test');
 assert.ok(!JSON.stringify(output).includes('private'));
 assert.equal(publicProjection({schemaVersion:1,title:'Hi',places:[]}).places.length,0);
 for(const value of [null,{schemaVersion:2,title:'Hi',places:[]},{schemaVersion:1,title:'Hi',places:Array(21).fill({name:'A',location:null})},
  {schemaVersion:1,title:'Hi',places:[{name:'',location:null}]}, {schemaVersion:1,title:'Hi',places:[{name:'A\nB',location:null}]}])
  assert.throws(()=>publicProjection(value));
 const bounded=publicProjection({schemaVersion:1,title:'😀'.repeat(80),places:Array(20).fill({name:'😀'.repeat(200),location:'😀'.repeat(300)})});
 assert.ok(Buffer.byteLength(JSON.stringify(bounded))<65536); assert.equal(bounded.places[0].mapUrl,null);
});
test('owner requests reject forged ownership, unknown fields, invalid revisions and unapproved provenance', () => {
 const valid={planId:plan,action:'label',expectedRevision:0,requestId:randomUUID(),
  payload:{savedPlaceId:'saved',name:' Name ',location:null,provenance:'owner_authored'}};
 assert.equal(ownerRequest(valid).payload.name,'Name');
 for(const body of [{...valid,userId:'victim'},{...valid,expectedRevision:-1},{...valid,expectedRevision:2147483647},
  {...valid,payload:{...valid.payload,provenance:'google'}},{...valid,payload:{...valid.payload,mapUrl:'https://evil.test'}},
  {planId:plan,action:'status',requestId:randomUUID()}])assert.throws(()=>ownerRequest(body));
});
test('public disabled, malformed, missing and revoked links expose no distinguishing data', async () => {
 const token=randomBytes(32).toString('base64url');
 for(const [deps,body] of [[{...base,enabled:false},{token}],[base,{token:'bad'}],[base,{token}],[base,{token,planId:plan}]] as const){
  const response=await sharingHandler('public',deps)(request(body));
  assert.equal(response.status,404);assert.deepEqual(await response.json(),{error:'unavailable'});assert.equal(response.headers.get('cache-control'),'no-store');
 }
 let active=true;
 const handler=sharingHandler('public',{...base,rpc:async(_n,args)=>{
  assert.equal(args.p_verifier,await digest(token));return active?{schemaVersion:1,title:'Public',places:[]}:null;
 }});
 assert.equal((await handler(request({token}))).status,200);active=false;assert.equal((await handler(request({token}))).status,404);
});
test('limits run before parsing/lookup; untrusted origins, oversized streams and errors fail safely', async () => {
 let reads=0;const deps={...base,rpc:async()=>{reads++;throw new Error('SECRET TOKEN URL CONTENT');}};
 const limited=await sharingHandler('public',{...deps,reserve:async()=>false})(request({token:'bad'}));
 assert.equal(limited.status,429);assert.equal(reads,0);assert.equal(limited.headers.get('retry-after'),'60');
 const handler=sharingHandler('public',deps);
 const denied=await handler(request({}, {headers:{origin:'https://evil.test','content-type':'application/json'}}));
 assert.equal(denied.status,403);assert.equal(reads,0);
 assert.equal((await handler(request({token:'x'.repeat(3000)}))).status,413);assert.equal(reads,0);
 const response=await handler(request({token:randomBytes(32).toString('base64url')}));
 assert.equal(response.status,503);assert.ok(!(await response.text()).includes('SECRET'));
 const preflight=await handler(new Request('https://local.test/shared-plan',{method:'OPTIONS',headers:{origin:'https://page.test'}}));
 assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),'https://page.test');
});
test('owner responses strip encrypted credentials; disable works with sharing off and missing keys', async () => {
 const minted=await mintCredential(keys,'v1',plan,1);
 let calls=0;
 const handler=sharingHandler('owner',{...base,rpc:async(_name,args)=>{calls++;assert.equal(args.p_subject,'owner');
  return {enabled:true,revision:1,title:'Public',createdAt:null,updatedAt:null,
   credential:minted.credential,credentialRevision:1,verifier:minted.verifier,unexpected:'private'};}});
 const status=await (await handler(request({planId:plan,action:'status'}))).json();
 assert.deepEqual(Object.keys(status),['enabled','revision','title','createdAt','updatedAt']);
 const retrieved=await (await handler(request({planId:plan,action:'retrieve'}))).json();
 assert.equal(retrieved.token,minted.token);assert.ok(!('credential' in retrieved));
 const bad=await sharingHandler('owner',{...base,authenticate:async()=>{throw Error('Clerk secret');}})(request({}));
 assert.equal(bad.status,401);
 const off=sharingHandler('owner',{...base,enabled:false,keys:()=>{throw Error('missing');},rpc:async()=>({enabled:false,revision:2,title:'Public',createdAt:null,updatedAt:null})});
 assert.equal((await off(request({planId:plan,action:'disable',expectedRevision:1,requestId:randomUUID()}))).status,200);
 assert.equal((await off(request({planId:plan,action:'enable',expectedRevision:2,requestId:randomUUID()}))).status,503);
 assert.equal(calls,2);
});
