// Local synthetic fixture server only. Never serves account data or calls hosted APIs.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname } from 'node:path';
import { webConfiguration } from './build-sharing-web.mjs';
const root=resolve('web'); const port=4179;
const nativeScheme=process.env.LEMONADE_FIXTURE_NATIVE_OPEN === 'true' ? 'project-lemonade' : '';
const fixture={schemaVersion:1,title:'An afternoon, well spent.',places:[
 {name:'The Corner Table',location:'Old town · near the market',mapUrl:'https://www.google.com/maps/search/?api=1&query=The+Corner+Table%2C+Old+town+%C2%B7+near+the+market'},
 {name:'Little Garden Café',location:'A quiet spot for coffee',mapUrl:null},
 {name:'Noodle House',location:null,mapUrl:'https://www.google.com/maps/search/?api=1&query=Noodle+House'}]};
const headers=Object.fromEntries(webConfiguration().config.headers[0].headers.map(h=>[h.key,h.value]));
headers['Content-Security-Policy']=headers['Content-Security-Policy'].replace("connect-src 'none'","connect-src 'self'");
let mode='ready';
const server=createServer(async(req,res)=>{
 try {
  const url=new URL(req.url,'http://127.0.0.1');
  if(url.pathname==='/fixture-mode'&&req.method==='POST'){
   let body='';for await(const chunk of req){body+=chunk;if(body.length>100)throw Error();}
   if(!['ready','empty','revoked','limited','error','long','unsafe'].includes(body)){res.writeHead(400,headers);res.end();return;}mode=body;res.writeHead(204,headers);res.end();return;
  }
  if(url.pathname==='/fixture-api'&&req.method==='POST'){
   for await(const chunk of req){if(chunk.length>2048)throw Error();}
   const status=mode==='revoked'?404:mode==='limited'?429:mode==='error'?503:200;
   res.writeHead(status,{...headers,'Content-Type':'application/json'});
   const content=mode==='empty'?{...fixture,places:[]}:mode==='long'?{schemaVersion:1,title:'A'.repeat(80),places:Array.from({length:20},()=>({name:'W'.repeat(200),location:'L'.repeat(300),mapUrl:null}))}:mode==='unsafe'?{...fixture,title:'<img src=x onerror=alert(1)>',places:[{name:'<script>alert(1)</script>',location:'<&>',mapUrl:null}]}:fixture;
   res.end(JSON.stringify(status===200?content:{error:'unavailable'}));return;
  }
  if(url.pathname==='/sharing-config.mjs'){
   res.writeHead(200,{...headers,'Content-Type':'text/javascript'});res.end('export const endpoint="http://127.0.0.1:'+port+'/fixture-api"; export const nativeScheme='+JSON.stringify(nativeScheme)+';');return;
  }
  const name=url.pathname==='/'?'index.html':url.pathname==='/s'?'s.html':url.pathname.slice(1);
  const path=resolve(root,name);if(!path.startsWith(root+ '/')&&!path.startsWith(root+'\\'))throw Error();
  const mime={'.html':'text/html; charset=utf-8','.css':'text/css','.mjs':'text/javascript','.ttf':'font/ttf','.txt':'text/plain'}[extname(path)];
  if(!mime)throw Error();const body=await readFile(path);res.writeHead(200,{...headers,'Content-Type':mime});res.end(body);
 }catch{res.writeHead(404,headers);res.end('Unavailable');}
});
server.listen(port,'127.0.0.1',()=>console.log('Synthetic sharing fixture on http://127.0.0.1:'+port));
