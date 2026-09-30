import { SharingSession } from '../src/services/owner-sharing';
// Local PostgREST + production sharing handler integration. No hosted Clerk/provider calls.
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { sharingHandler, type SharingDependencies } from '../supabase/functions/_shared/planSharing';
const base = process.env.VISITS_TEST_REST_URL!;
if (!base || !['127.0.0.1','localhost'].includes(new URL(base).hostname)) throw Error('Local fixture required');
const secret=process.env.VISITS_TEST_JWT_SECRET!;
const sign=(role:string,sub?:string)=>{const header=Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url');
 const payload=Buffer.from(JSON.stringify({role,sub,exp:Math.floor(Date.now()/1000)+600})).toString('base64url');
 return header+'.'+payload+'.'+createHmac('sha256',secret).update(header+'.'+payload).digest('base64url');};
const owner='sharing-http-'+randomUUID(), other='sharing-other-'+randomUUID(), plan=randomUUID(), saved=randomUUID();
const ownerToken=sign('authenticated',owner), otherToken=sign('authenticated',other), serviceToken=sign('service_role');
const client=(token:string)=>createClient(base,token,{auth:{persistSession:false,autoRefreshToken:false},
 global:{headers:{Authorization:'Bearer '+token},fetch:(input,init)=>fetch(String(input).replace(base+'/rest/v1',base),init)},db:{schema:'public'}});
// Supabase clients normally add /rest/v1; standalone PostgREST exposes / directly.
const service=client(serviceToken);
const rpc=async(name:string,args:Record<string,unknown>)=>{
 const {data,error}=await service.rpc(name,args);
 if(error)throw Error('fixture RPC failed '+error.code);
 return data;
};
const data=async(token:string,path:string,method='GET',body?:unknown)=>{
 const response=await fetch(base+'/'+path,{method,headers:{Authorization:'Bearer '+token,'content-type':'application/json',Prefer:'return=representation'},body:body===undefined?undefined:JSON.stringify(body)});
 if(!response.ok)throw Error('fixture setup failed '+response.status);
 return response.json();
};
const keys={v1:randomBytes(32).toString('base64url')};
const deps:SharingDependencies={enabled:true,origins:[],keys:()=>keys,activeKey:()=> 'v1',rpc,
 authenticate:async req=>{
  if(req.headers.get('authorization')==='Bearer '+ownerToken)return owner;
  if(req.headers.get('authorization')==='Bearer '+otherToken)return other;
  throw Error('invalid fixture authentication');
 },
 reserve:async(scope,subject)=>await rpc('reserve_sharing',{p_scope:scope,p_subject:subject})===true};
const manager=sharingHandler('owner',deps), publicRead=sharingHandler('public',deps);
const call=(handler:ReturnType<typeof sharingHandler>,body:unknown,token?:string)=>handler(new Request(base+'/function',{method:'POST',
 headers:{'content-type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));
(async()=>{
try{
 await data(ownerToken,'dining_plans','POST',{id:plan,user_id:owner,title:'PRIVATE TITLE'});
 await data(ownerToken,'saved_places','POST',{id:saved,user_id:owner,name:'GOOGLE PRIVATE',address:'PRIVATE ADDRESS',area_or_city:'PRIVATE AREA',category:'cafe',source_url:'https://www.instagram.com/p/httpFixture/',notes:'PRIVATE NOTES'});
 await data(ownerToken,'dining_plan_items','POST',{plan_id:plan,user_id:owner,saved_place_id:saved});
 for(const token of [sign('anon'),ownerToken]){
  for(const name of ['manage_plan_sharing','read_shared_plan','reserve_sharing']){
   const response=await fetch(base+'/rpc/'+name,{method:'POST',headers:{Authorization:'Bearer '+token,'content-type':'application/json'},
    body:JSON.stringify(name==='manage_plan_sharing'?{p_subject:owner,p_plan:plan,p_action:'status'}:name==='read_shared_plan'?{p_verifier:'0'.repeat(64)}:{p_scope:'public'})});
   assert.ok([401,403].includes(response.status),name+' must deny direct client access');
  }
 }
 assert.equal((await call(manager,{planId:plan,action:'status'})).status,401);
 assert.equal((await call(manager,{planId:plan,action:'status'},otherToken)).status,404);
 let revision=0;
 const mutate=async(action:string,payload:Record<string,unknown>={})=>{
  const response=await call(manager,{planId:plan,action,expectedRevision:revision,requestId:randomUUID(),payload},ownerToken);
  assert.equal(response.status,200,await response.clone().text());const value=await response.json();revision=value.revision;return value;
 };
 await mutate('label',{savedPlaceId:saved,name:'Independent name',location:null,provenance:'owner_authored'});
 const enabled=await mutate('enable');assert.ok(enabled.token);
 const first=await call(publicRead,{token:enabled.token});assert.equal(first.status,200);
 assert.deepEqual(await first.json(),{schemaVersion:1,title:'Places to try',places:[{name:'Independent name',location:null,mapUrl:'https://www.google.com/maps/search/?api=1&query=Independent+name'}]});
 const retrieved=await (await call(manager,{planId:plan,action:'retrieve'},ownerToken)).json();assert.equal(retrieved.token,enabled.token);
 await mutate('title',{title:'Independent public title'});
 assert.equal((await (await call(manager,{planId:plan,action:'retrieve'},ownerToken)).json()).token,enabled.token);
 const rotated=await mutate('regenerate');assert.notEqual(rotated.token,enabled.token);
 assert.equal((await call(publicRead,{token:enabled.token})).status,404);
 assert.equal((await call(publicRead,{token:rotated.token})).status,200);
 await mutate('disable');assert.equal((await call(publicRead,{token:rotated.token})).status,404);
 const reenabled=await mutate('enable');assert.notEqual(reenabled.token,rotated.token);
 const ownerClient=client(ownerToken);
 const session=new SharingSession({
  metadata:async(name,args)=>{const result=await ownerClient.rpc(name,args);if(result.error)throw result.error;return result.data;},
  owner:async body=>{const response=await call(manager,body,ownerToken);assert.equal(response.status,200);return response.json();}
 },'https://example.test');
 const metadata=await session.details(plan);assert.equal(metadata.enabled,true);assert.equal(metadata.labels[0].name,'Independent name');
 const preview=await session.preview(plan);assert.equal(preview.content.title,'Independent public title');
 assert.deepEqual(await session.exportAll(),[metadata]);
 assert.ok(!/token|credential|verifier|PRIVATE/.test(JSON.stringify(metadata)));
 let delivered='';await session.deliver(plan,async url=>{delivered=url;});assert.equal(delivered,'https://example.test/s#'+reenabled.token);
 const stranger=await client(otherToken).rpc('get_plan_sharing_details',{p_plan:plan});assert.equal(stranger.error,null);assert.equal(stranger.data,null);
 const anonymous=await client(sign('anon')).rpc('get_plan_sharing_export_page',{});assert.ok(anonymous.error);
 await data(ownerToken,'rpc/delete_current_user_data','POST',{});
 assert.equal((await call(publicRead,{token:reenabled.token})).status,404);
 console.log('PASS: actual PostgREST grants, authenticated owner boundary, encrypted cross-request recovery, strict anonymous response, regeneration and deletion through production handlers');
}finally{await service.auth.signOut({scope:'local'});}


})().catch(error=>{console.error(error);throw error;});
