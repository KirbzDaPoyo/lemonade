const assert = require('node:assert/strict');
const path = require('node:path');
const { randomUUID, createHash } = require('node:crypto');
(async () => {
 const address=process.env.VISITS_TEST_DATABASE_URL;
 if(!address || !['localhost','127.0.0.1'].includes(new URL(address).hostname)) throw Error('Disposable localhost database required');
 const {Client}=require(path.join(process.env.TEMP,'lemonade-inbox-validation/node_modules/pg'));
 const clients=Array.from({length:5},()=>new Client({connectionString:address}));
 const [admin,owner,other,server,second]=clients;
 const sub='sharing-'+randomUUID(), stranger='other-'+randomUUID(), plan=randomUUID(), foreign=randomUUID();
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const credential={keyId:'fixture',nonce:'A'.repeat(16),ciphertext:'B'.repeat(79)};
 const manage=async(client,subject,action,revision=null,id=null,payload={},verifier=null)=>
  (await client.query('select public.manage_plan_sharing($1,$2,$3,$4,$5,$6,$7,$8,$9) as value',
   [subject,plan,action,revision,id,id?hash(JSON.stringify({action,revision,id,payload})):null,payload,verifier,verifier?credential:null])).rows[0].value;
 const read=async(verifier)=>(await server.query('select public.read_shared_plan($1) as value',[verifier])).rows[0].value;
 const denied=p=>assert.rejects(p,e=>e.code==='42501');
 try {
  await Promise.all(clients.map(c=>c.connect()));
  for(const c of clients)await c.query("set statement_timeout='10s'");
  for(const [c,s] of [[owner,sub],[other,stranger]]){await c.query('set role authenticated');await c.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:s})]);}
  for(const c of [server,second])await c.query('set role service_role');
  await owner.query('insert into dining_plans(id,user_id,title) values($1,$2,$3)',[plan,sub,'SECRET PRIVATE TITLE']);
  await other.query('insert into dining_plans(id,user_id,title) values($1,$2,$3)',[foreign,stranger,'OTHER PRIVATE']);
  for(let i=0;i<2;i++)await owner.query("insert into saved_places(id,user_id,name,address,area_or_city,category,source_url,notes,place_id) values($1,$2,'GOOGLE NAME','GOOGLE ADDRESS','AREA','cafe',$3,'SECRET NOTES',$4)",[sub+i,sub,'https://www.instagram.com/p/share'+i+'/',i===0?'ChIJ-test':null]);
  await owner.query('insert into dining_plan_items(plan_id,user_id,saved_place_id) values($1,$2,$3)',[plan,sub,sub+'0']);
  assert.deepEqual(await manage(server,stranger,'status'),{error:'unavailable'});
  for(const action of ['preview','retrieve','enable','disable','regenerate','title','label'])
   assert.deepEqual(await manage(server,stranger,action,0,randomUUID()),{error:'unavailable'});
  for(const role of ['anon','authenticated']){
   await admin.query('set role '+role);
   for(const table of ['private.plan_shares','private.plan_share_labels','private.sharing_usage','public.dining_plans','public.saved_places','public.saved_place_sources','public.place_visits']){
    if(role==='anon'||table.startsWith('private.'))await denied(admin.query('select * from '+table));
   }
   await denied(manage(admin,sub,'status'));
   await denied(admin.query("select public.read_shared_plan('x')"));
   await denied(admin.query("select private.sharing_projection($1,'x')",[plan]));
   await denied(admin.query("select public.reserve_sharing('public')"));
   await admin.query('reset role');
  }
  await denied(server.query('select * from private.plan_shares'));
  const state=await manage(server,sub,'status');assert.equal(state.revision,0);assert.equal(state.enabled,false);assert.equal(state.title,'Places to try');
  assert.equal((await manage(server,sub,'preview')).preview,null);
  assert.deepEqual(await manage(server,sub,'enable',0,randomUUID(),{},hash('first')),{error:'ineligible'});
  let revision=0;
  const mutate=async(action,payload={},verifier=null)=>{const result=await manage(server,sub,action,revision,randomUUID(),payload,verifier);assert.ok(!result.error,JSON.stringify(result));revision=result.revision;return result;};
  await mutate('label',{savedPlaceId:sub+'0',name:'Owner cafe',location:'Own location',provenance:'owner_authored'});
  await mutate('title',{title:'Public <title>'});
  const operation=randomUUID(), before=revision;
  const enabled=await manage(server,sub,'enable',before,operation,{},hash('first'));revision=enabled.revision;
  assert.equal(enabled.enabled,true);
  assert.deepEqual(await manage(server,sub,'enable',before,operation,{},hash('different candidate')),enabled);
  assert.deepEqual(await manage(server,sub,'disable',before,operation),{error:'conflict'});
  const projected=await read(hash('first'));assert.equal(projected.title,'Public <title>');
  assert.deepEqual(projected.places,[{name:'Owner cafe',location:'Own location',providerPlaceId:'ChIJ-test'}]);
  assert.ok(!/SECRET|GOOGLE|instagram|user_id|plan_id/.test(JSON.stringify(projected)));
  await mutate('title',{title:'Updated'});
  assert.equal((await read(hash('first'))).title,'Updated');
  assert.deepEqual(await manage(server,sub,'enable',before,operation,{},hash('first')),{error:'conflict'});
  // Enable while active preserves the old verifier.
  await mutate('enable',{},hash('ignored'));assert.equal(await read(hash('ignored')),null);
  assert.ok(await read(hash('first')));
  const metadata=(await owner.query('select get_plan_sharing_details($1) as value',[plan])).rows[0].value;
  assert.equal(metadata.planId,plan);assert.equal(metadata.labels[0].name,'Owner cafe');
  assert.ok(!/credential|verifier|token|SECRET|GOOGLE/.test(JSON.stringify(metadata)));
  assert.equal((await other.query('select get_plan_sharing_details($1) as value',[plan])).rows[0].value,null);
  assert.deepEqual((await other.query('select get_plan_sharing_export_page() as value')).rows[0].value,[]);
  assert.deepEqual((await owner.query('select get_plan_sharing_export_page() as value')).rows[0].value,[metadata]);
  assert.deepEqual((await owner.query('select get_plan_sharing_export_page($1) as value',[plan])).rows[0].value,[]);
  await admin.query('set role anon');
  await denied(admin.query('select get_plan_sharing_details($1)',[plan]));
  await denied(admin.query('select get_plan_sharing_export_page()'));
  await admin.query('reset role');
  // Prove overlap using PostgreSQL blockers, not sleeps.
  await server.query('begin');
  const raceRevision=revision;
  const winner=await manage(server,sub,'regenerate',raceRevision,randomUUID(),{},hash('winner'));
  let settled=false;
  const pending=manage(second,sub,'regenerate',raceRevision,randomUUID(),{},hash('loser')).finally(()=>{settled=true;});
  let blocked=false;
  for(let i=0;i<100&&!settled;i++){
   if((await admin.query('select cardinality(pg_blocking_pids($1))>0 as blocked',[second.processID])).rows[0].blocked){blocked=true;break;}
   await new Promise(r=>setTimeout(r,10));
  }
  await server.query('commit');assert.ok(blocked);assert.deepEqual(await pending,{error:'conflict'});revision=winner.revision;
  assert.equal(await read(hash('first')),null);assert.equal(await read(hash('loser')),null);assert.ok(await read(hash('winner')));
  // Existing clients can add members; missing public labels fail the whole page closed.
  await owner.query('insert into dining_plan_items(plan_id,user_id,saved_place_id) values($1,$2,$3)',[plan,sub,sub+'1']);
  assert.equal(await read(hash('winner')),null);
  const changed=(await manage(server,sub,'status')).revision;assert.ok(changed>revision);
  assert.deepEqual(await manage(server,sub,'enable',revision,randomUUID(),{},hash('stale')),{error:'conflict'});revision=changed;
  await mutate('label',{savedPlaceId:sub+'1',name:'Second public name',location:null,provenance:'owner_authored'});
  assert.deepEqual((await read(hash('winner'))).places.map(p=>p.name),['Owner cafe','Second public name']);
  // No reorder API: verify projection follows the repository's timestamp/ID order.
  await admin.query("update dining_plan_items set created_at=created_at-interval '1 day' where saved_place_id=$1",[sub+'1']);
  assert.deepEqual((await read(hash('winner'))).places.map(p=>p.name),['Second public name','Owner cafe']);
  await owner.query('delete from saved_places where id=$1',[sub+'0']);
  assert.equal((await read(hash('winner'))).places.length,1);
  revision=(await manage(server,sub,'status')).revision;
  await mutate('disable');assert.equal(await read(hash('winner')),null);
  const cleared=(await admin.query('select verifier,credential,credential_revision from private.plan_shares where plan_id=$1',[plan])).rows[0];
  assert.deepEqual(cleared,{verifier:null,credential:null,credential_revision:null});
  await mutate('disable');await mutate('enable',{},hash('new'));assert.ok(await read(hash('new')));
  await admin.query('truncate private.sharing_usage');
  const reserve=async(c,scope,subject='',minute=120,day=5000)=>(await c.query('select public.reserve_sharing($1,$2,$3,$4) as ok',[scope,subject,minute,day])).rows[0].ok;
  for(let i=0;i<30;i++)assert.equal(await reserve(server,'owner',sub),true);
  assert.equal(await reserve(server,'owner',sub),false);
  assert.equal(await reserve(server,'public','',0),false);
  await admin.query('truncate private.sharing_usage');
  await server.query('begin');assert.equal(await reserve(server,'public','',1),true);
  const quotaPending=reserve(second,'public','',1);await server.query('commit');assert.equal(await quotaPending,false);
  await admin.query('truncate private.sharing_usage');assert.equal(await reserve(server,'owner',sub),true);
  await owner.query('select * from delete_current_user_data()');
  assert.equal(await read(hash('new')),null);
  assert.equal((await admin.query('select count(*) from private.plan_shares where user_id=$1',[sub])).rows[0].count,'0');
  assert.equal((await admin.query('select count(*) from private.plan_share_labels')).rows[0].count,'0');
  assert.equal((await admin.query("select count(*) from private.sharing_usage where bucket=$1",['owner:'+sub])).rows[0].count,'0');
  assert.equal((await other.query('select count(*) from dining_plans')).rows[0].count,'1');
  // Plan deletion alone also revokes, including empty plans.
  await owner.query('insert into dining_plans(id,user_id,title) values($1,$2,$3)',[plan,sub,'New private']);
  revision=0;await mutate('enable',{},hash('empty'));
  assert.deepEqual((await read(hash('empty'))).places,[]);
  await owner.query('delete from dining_plans where id=$1',[plan]);assert.equal(await read(hash('empty')),null);
  const funcs=(await admin.query("select n.nspname,p.proname,p.prosecdef,p.proconfig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where p.proname in ('manage_plan_sharing','read_shared_plan','reserve_sharing')")).rows;
  for(const f of funcs){assert.equal(f.prosecdef,f.nspname==='private');assert.ok(f.proconfig.includes('search_path=""'));}
  console.log('PASS: sharing ownership/grants, private data denial, explicit projection, live ordering, idempotency, overlapping regeneration, quotas, revocation, deletion and account isolation');
 }finally{await Promise.all(clients.map(c=>c.end()));}
})().catch(error=>{console.error(error);process.exitCode=1;});
