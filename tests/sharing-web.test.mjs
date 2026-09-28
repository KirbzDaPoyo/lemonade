import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { linkToken, readContent, startSharingPage } from '../web/sharing-client.mjs';
import { buildSharingWeb, webConfiguration } from '../script/build-sharing-web.mjs';
const token='A'.repeat(43);
const content={schemaVersion:1,title:'<img src=x onerror=alert(1)>',places:[{name:'A <script> & cafe',location:'Somewhere',mapUrl:'https://www.google.com/maps/search/?api=1&query=A+%3Cscript%3E+%26+cafe%2C+Somewhere'}]};
const response=(body=content,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const tick=()=>new Promise(r=>setImmediate(r));
class Element extends EventTarget {
 constructor(){super();this.children=[];this.hidden=false;this.disabled=false;this.attributes={};this.text='';}
 set textContent(value){this.text=value;this.children=[];} get textContent(){return this.text;}
 append(...values){this.children.push(...values);} replaceChildren(...values){this.children=values;this.text='';}
 setAttribute(key,value){this.attributes[key]=value;} focus(){this.focused=true;}
}
function environment(fetch, navigator, nativeScheme = '') {
 const nodes=Object.fromEntries(['plan-title','places','status','refresh','main','skip','open-app'].map(id=>[id,new Element()]));
 const document=Object.assign(new EventTarget(),{visibilityState:'visible',getElementById:id=>nodes[id],createElement:tag=>Object.assign(new Element(),{tag})});
 const window=Object.assign(new EventTarget(),{navigator,location:{pathname:'/s',search:'',hash:'#'+token},setTimeout,clearTimeout});
 window.location.assign = (value) => { window.destination = value; };
 const stop=startSharingPage({window,document,fetch,endpoint:'https://fixture.supabase.co/functions/v1/shared-plan',nativeScheme});
 return {nodes,document,window,stop};
}
test('fragment grammar rejects query credentials, extra routes, encoded and malformed links',()=>{
 assert.equal(linkToken({pathname:'/s',search:'',hash:'#'+token}),token);
 for(const input of [{pathname:'/private/plan',search:'',hash:'#'+token},{pathname:'/s',search:'?token=x',hash:'#'+token},{pathname:'/s',search:'',hash:'#'+token+'='},{pathname:'/s',search:'',hash:'#%41'+token.slice(1)},{pathname:'/s',search:'',hash:'#'+'B'.repeat(43)}])assert.equal(linkToken(input),null);
});
test('public reader enforces size, MIME, strict fields and destinations before rendering',async()=>{
 assert.deepEqual(await readContent(response()),content);
 for(const value of [{...content,ownerId:'private'},{...content,places:[{...content.places[0],mapUrl:'javascript:alert(1)'}]},{...content,places:[{...content.places[0],mapUrl:'https://www.google.com/maps/search/?api=1&query=wrong'}]}])await assert.rejects(readContent(response(value)));
 await assert.rejects(readContent(new Response('x'.repeat(65537),{headers:{'Content-Type':'application/json'}})));
 await assert.rejects(readContent(new Response('{}',{headers:{'Content-Type':'text/html'}})));
 await assert.rejects(readContent(response({},429)),/limited/);
 await assert.rejects(readContent(response({},404)),/unavailable/);
});
test('page renders text nodes and safe maps; refresh after success cannot reuse revoked content',async()=>{
 let calls=0;const requests=[];
 const page=environment(async(url,options)=>{requests.push({url,options});return calls++===0?response():response({},404);});
 await tick();assert.equal(page.nodes['plan-title'].textContent,content.title);
 const row=page.nodes.places.children[0];assert.equal(row.children[1].children[0].textContent,content.places[0].name);
 const link=row.children[2];assert.equal(link.href,content.places[0].mapUrl);assert.equal(link.rel,'noopener noreferrer');
 assert.equal(requests[0].options.cache,'no-store');assert.equal(requests[0].options.credentials,'omit');assert.equal(requests[0].options.redirect,'error');
 assert.equal(requests[0].options.referrerPolicy,'no-referrer');assert.equal(requests[0].options.body,JSON.stringify({token}));assert.ok(!requests[0].url.includes(token));
 page.nodes.refresh.dispatchEvent(new Event('click'));assert.equal(page.nodes.places.children.length,0);await tick();
 assert.match(page.nodes.status.textContent,/unavailable/);assert.equal(page.nodes.places.children.length,0);assert.equal(calls,2);page.stop();
});
test('hiding and restoring clears content and refetches, with no background polling',async()=>{
 let calls=0;const page=environment(async()=>{calls++;return response();});await tick();
 page.document.visibilityState='hidden';page.document.dispatchEvent(new Event('visibilitychange'));
 assert.equal(page.nodes.places.children.length,0);assert.equal(calls,1);
 page.document.visibilityState='visible';page.document.dispatchEvent(new Event('visibilitychange'));await tick();assert.equal(calls,2);
 page.window.dispatchEvent(new Event('pagehide'));assert.equal(page.nodes.places.children.length,0);
 const restored=new Event('pageshow');Object.defineProperty(restored,'persisted',{value:true});page.window.dispatchEvent(restored);await tick();assert.equal(calls,3);page.stop();
});
test('changed hash and navigation invalidate late responses, including empty and error states',async()=>{
 let resolve;const pending=new Promise(r=>{resolve=r;});const page=environment(()=>pending);
 page.window.location.hash='#bad';page.window.dispatchEvent(new Event('hashchange'));resolve(response());await tick();
 assert.equal(page.nodes.places.children.length,0);assert.match(page.nodes.status.textContent,/unavailable/);page.stop();
 const empty=environment(async()=>response({...content,places:[]}));await tick();assert.match(empty.nodes.status.textContent,/No places yet/);empty.stop();
 const offline=environment(async()=>{throw Error('PRIVATE NETWORK DETAILS');});await tick();assert.match(offline.nodes.status.textContent,/Check your connection/);assert.ok(!offline.nodes.status.textContent.includes('PRIVATE'));offline.stop();
});
test('keyboard skip action preserves the bearer fragment',async()=>{
 const page=environment(async()=>response());await tick();page.nodes.skip.dispatchEvent(new Event('click'));
 assert.equal(page.nodes.main.focused,true);assert.equal(page.window.location.hash,'#'+token);page.stop();
});
test('generated browser parser matches mobile source and configuration locks outbound connections',()=>{
 const directory=mkdtempSync(join(tmpdir(),'lemonade-web-test-'));
 try{buildSharingWeb(directory);assert.equal(readFileSync(join(directory,'sharing-content.mjs'),'utf8'),readFileSync('web/sharing-content.mjs','utf8'));}finally{rmSync(directory,{recursive:true});}
 for(const url of ['http://fixture.supabase.co/functions/v1/shared-plan','https://evil.test/functions/v1/shared-plan','https://user@fixture.supabase.co/functions/v1/shared-plan','https://fixture.supabase.co/functions/v1/shared-plan?token=x'])assert.throws(()=>webConfiguration(url));
 const {config}=webConfiguration('https://fixture.supabase.co/functions/v1/shared-plan');const headers=Object.fromEntries(config.headers[0].headers.map(h=>[h.key,h.value]));
 assert.match(headers['Content-Security-Policy'],/connect-src https:\/\/fixture.supabase.co;/);
 for(const key of ['Cache-Control','CDN-Cache-Control','Vercel-CDN-Cache-Control'])assert.match(headers[key],/no-store/);
 assert.equal(headers['Referrer-Policy'],'no-referrer');assert.match(headers['X-Robots-Tag'],/noindex/);
 const shell=readFileSync('web/s.html','utf8');assert.match(shell,/noindex, nofollow, noarchive/);assert.doesNotMatch(shell,/(?:src|href)="https?:/);assert.doesNotMatch(shell,/canonical|og:url|project-lemonade:\/\//);
 const client=readFileSync('web/sharing-client.mjs','utf8');assert.doesNotMatch(client,/innerHTML|localStorage|sessionStorage|indexedDB|console\.|setInterval|sendBeacon/);
 assert.match(readFileSync('web/robots.txt','utf8'),/Disallow: \/s/);
});

test('an existing service worker prevents retrieval, and pending results are cleared on takeover',async()=>{
 let calls=0;const worker=new EventTarget();const page=environment(async()=>{calls++;return response();},{serviceWorker:worker});await tick();
 worker.controller={};worker.dispatchEvent(new Event('controllerchange'));await tick();
 assert.equal(calls,1);assert.equal(page.nodes.places.children.length,0);assert.match(page.nodes.status.textContent,/private window/);page.stop();
});


test('native open is opt-in, explicit, canonical and retains the usable browser page',async()=>{
 const disabled=environment(async()=>response());await tick();assert.equal(disabled.nodes['open-app'].hidden,true);disabled.stop();
 const page=environment(async()=>response(),undefined,'project-lemonade');await tick();
 assert.equal(page.nodes['open-app'].hidden,false);assert.equal(page.window.destination,undefined);
 page.nodes['open-app'].dispatchEvent(new Event('click'));assert.equal(page.window.destination,`project-lemonade://shared#${token}`);
 assert.equal(page.nodes.places.children.length,1);assert.match(page.nodes.status.textContent,/keep using this page/);page.stop();
 assert.throws(()=>webConfiguration('', 'project-lemonade'));assert.throws(()=>webConfiguration('https://fixture.supabase.co/functions/v1/shared-plan','javascript'));
});
