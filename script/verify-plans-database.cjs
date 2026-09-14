const assert = require('node:assert/strict');
const path = require('node:path');
const {randomUUID}=require('node:crypto');
(async()=>{
 const address=process.env.INBOX_TEST_DATABASE_URL;
 if(!address || !['127.0.0.1','localhost'].includes(new URL(address).hostname))throw Error('Disposable localhost database required');
 const {Client}=require(path.join(process.env.TEMP,'lemonade-inbox-validation/node_modules/pg'));
 const admin=new Client({connectionString:address});const a=new Client({connectionString:address});const b=new Client({connectionString:address});const other=new Client({connectionString:address});
 const owner='plans-a-'+randomUUID(), stranger='plans-b-'+randomUUID(), plan=randomUUID(), foreignPlan=randomUUID();
 const query=(client,sql,params=[])=>client.query(sql,params);
 const add=(client,id)=>query(client,'insert into public.dining_plan_items(user_id,plan_id,saved_place_id) values($1,$2,$3)',[owner,plan,id]);
 const denied=async(p,code='42501')=>assert.rejects(p,e=>e.code===code);
 try {
  await Promise.all([admin,a,b,other].map(c=>c.connect()));
  for(const [client,sub] of [[a,owner],[b,owner],[other,stranger]]){await query(client,'set role authenticated');await query(client,"select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub})]);await query(client,"set statement_timeout='5s'");}
  await query(a,'insert into dining_plans(id,user_id,title) values($1,$2,$3)',[plan,owner,'  Dinner  ']);
  await query(other,'insert into dining_plans(id,user_id,title) values($1,$2,$3)',[foreignPlan,stranger,'Private']);
  assert.equal((await query(a,'select title from dining_plans')).rows[0].title,'Dinner');
  for(let i=0;i<22;i++)await query(a,"insert into saved_places(id,user_id,name,address,area_or_city,category,source_url) values($1,$2,'Fixture','Test','Test','cafe',$3)",[owner+i,owner,'https://www.instagram.com/p/plan'+i+'/']);
  await query(other,"insert into saved_places(id,user_id,name,address,area_or_city,category,source_url) values($1,$2,'Fixture','Test','Test','cafe','https://www.instagram.com/p/foreign/')",[stranger,stranger]);
  await denied(query(a,'insert into dining_plans(user_id,title) values($1,$2)',[stranger,'Forge']));
  for(const sql of ["update dining_plans set user_id='forged'",'update dining_plans set completed_at=now()',"insert into dining_plans(user_id,title,status) values('x','x','completed')",'update dining_plan_items set plan_id=plan_id'])await denied(query(a,sql));
  assert.equal((await query(other,'select * from dining_plans where id=$1',[plan])).rowCount,0);
  for(const sql of ["update dining_plans set title='Changed' where id=$1","update dining_plans set status='completed' where id=$1","update dining_plans set status='active' where id=$1",'delete from dining_plans where id=$1'])assert.equal((await query(other,sql,[plan])).rowCount,0);
  await denied(query(other,'insert into dining_plan_items(user_id,plan_id,saved_place_id) values($1,$2,$3)',[stranger,plan,stranger]),'23503');
  await denied(add(a,stranger),'23503');
  await denied(query(a,"update dining_plans set title=''"),'23514');
  await denied(query(a,'update dining_plans set title=$1',['😀'.repeat(81)]),'23514');
  await query(a,'update dining_plans set title=$1',['😀'.repeat(80)]);
  await query(a,"update dining_plans set status='completed'");assert.ok((await query(a,'select completed_at from dining_plans')).rows[0].completed_at);
  await query(a,"update dining_plans set status='active'");assert.equal((await query(a,'select completed_at from dining_plans')).rows[0].completed_at,null);
  await denied(query(a,"update dining_plans set status='wrong'"),'23514');
  // Hold a transaction until pg_blocking_pids proves the second insert overlaps.
  async function race(idA,idB,code,isolation='read committed'){
   await query(a,'begin isolation level '+isolation);await add(a,idA);
   await query(b,'begin isolation level '+isolation);
   let settled=false;const pending=add(b,idB).then(()=>null,e=>e).finally(()=>{settled=true;});
   let blocked=false;for(let i=0;i<100&&!settled;i++){if((await query(admin,'select cardinality(pg_blocking_pids($1))>0 as blocked',[b.processID])).rows[0].blocked){blocked=true;break;}await new Promise(r=>setTimeout(r,10));}
   await query(a,'commit');const error=await pending;await query(b,'rollback');assert.ok(blocked,'overlapping insert must block');assert.equal(error?.code,code);
  }
  await race(owner+'0',owner+'0','23505');
  for(let i=1;i<19;i++)await add(a,owner+i);
  await race(owner+'19',owner+'20','P0020');
  assert.equal(Number((await query(a,'select count(*) from dining_plan_items')).rows[0].count),20);
  await query(a,'delete from dining_plan_items where saved_place_id=$1',[owner+'19']);
  await race(owner+'19',owner+'20','40001','repeatable read');
  assert.equal((await query(other,'select * from dining_plan_items')).rowCount,0);
  assert.equal((await query(other,'delete from dining_plan_items where plan_id=$1',[plan])).rowCount,0);
  await query(a,'delete from saved_places where id=$1',[owner+'0']);assert.equal(Number((await query(a,'select count(*) from dining_plan_items')).rows[0].count),19);
  await query(a,'delete from dining_plans where id=$1',[plan]);assert.equal((await query(a,'select * from dining_plan_items')).rowCount,0);assert.equal((await query(a,'select * from saved_places')).rowCount,21);
  await query(a,'insert into dining_plans(id,user_id,title) values($1,$2,$3)',[plan,owner,'Again']);await add(a,owner+'1');
  await query(a,'select * from delete_current_user_data()');assert.equal((await query(a,'select * from dining_plans')).rowCount,0);assert.equal((await query(a,'select * from dining_plan_items')).rowCount,0);assert.equal((await query(other,'select * from dining_plans')).rowCount,1);
  await query(admin,'set role anon');for(const table of ['dining_plans','dining_plan_items'])for(const sql of [`select * from ${table}`,`delete from ${table}`,`insert into ${table} default values`])await denied(query(admin,sql));await denied(query(admin,'select * from delete_current_user_data()'));await query(admin,'reset role');
  const checks=await query(admin,"select relname,relrowsecurity from pg_class where oid in ('public.dining_plans'::regclass,'public.dining_plan_items'::regclass)");assert.ok(checks.rows.every(r=>r.relrowsecurity));
  for(const name of ['guard_dining_plan','guard_dining_plan_item']){const row=(await query(admin,'select prosecdef,proconfig from pg_proc where proname=$1',[name])).rows[0];assert.equal(row.prosecdef,false);assert.ok(row.proconfig.includes('search_path=""'));}
  console.log('PASS: plan grants/RLS, anonymous/cross-account denial, immutable owners, title/status constraints, proven overlapping duplicate/capacity and repeatable-read races, deletion cascades and account isolation');
 }finally{await Promise.all([admin,a,b,other].map(c=>c.end()));}
})().catch(e=>{console.error(e);process.exitCode=1;});
