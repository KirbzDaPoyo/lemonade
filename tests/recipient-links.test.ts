import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { parseRecipientLink, approvedSharingOrigin, RecipientLinkSession, recipientLinks, routeRecipientLink } from '../src/navigation/recipient-links';
import { hooks, load, flatten, tick, rn, theme } from './helpers/component-harness';
const token='A'.repeat(43), second='C'.repeat(42)+'A';
const origin='https://sharing.example.test';
const publicContent={schemaVersion:1,title:'Shared title',places:[{name:'Own cafe',location:null,mapUrl:null}]};
test('recipient parser permits exact production/development links and rejects hostile or ambiguous forms',()=>{
 for(const link of [`project-lemonade://shared#${token}`,`${origin}/s#${token}`,`/shared#${token}`,`/s#${token}`])assert.deepEqual(parseRecipientLink(link,origin),{handled:true,token});
 assert.equal(parseRecipientLink(`project-lemonade-dev://shared#${token}`,origin,true).token,token);
 for(const link of [`project-lemonade-dev://shared#${token}`,`${origin}/s?ownerId=x#${token}`,`https://evil.test/s#${token}`,`https://sharing.example.test.evil.test/s#${token}`,`project-lemonade://user@shared#${token}`,`project-lemonade://shared/#${token}`,`project-lemonade://shared#%41${token.slice(1)}`,`/shared?planId=private#${token}`,`/shared#${token}=`,`/%73hared#${token}`])assert.deepEqual(parseRecipientLink(link,origin),{handled:true,token:null});
 assert.equal(parseRecipientLink('https://www.instagram.com/p/abc/',origin).handled,false);
 assert.equal(parseRecipientLink('/place/private-owner-id',origin).handled,false);
 assert.equal(approvedSharingOrigin('http://sharing.example.test'),undefined);
 assert.equal(approvedSharingOrigin(origin),origin);
});
test('cold and warm routing removes credentials from navigation and invalid links clear previous memory',()=>{
 recipientLinks.clear();assert.equal(routeRecipientLink(`project-lemonade://shared#${token}`),'/shared');assert.equal(recipientLinks.getToken(),token);
 assert.equal(routeRecipientLink(`project-lemonade://shared#${second}`),'/shared');assert.equal(recipientLinks.getToken(),second);
 assert.equal(routeRecipientLink('/shared#bad'),'/shared');assert.equal(recipientLinks.getToken(),null);
 assert.equal(routeRecipientLink('/plans'),'/plans');
 const session=new RecipientLinkSession();let signals=0;const unsub=session.subscribe(()=>signals++);session.accept(token);session.clear();unsub();assert.equal(signals,2);assert.equal(session.getToken(),null);
 const {redirectSystemPath}=load('app/+native-intent.tsx',{});
 for(const initial of [true,false])assert.equal(redirectSystemPath({path:`project-lemonade://shared#${token}`,initial}),'/shared');recipientLinks.clear();
});
test('anonymous native retrieval strips identity and fails closed for revoked, oversized or private output',async()=>{
 const {retrieveSharedPlan}=load('src/services/recipient-sharing.ts',{'expo/fetch':{fetch},'../config/backend':{backendConfig:{supabaseUrl:'https://fixture.supabase.co'}}});
 let request:any;
 const read=(body:unknown,status=200)=>retrieveSharedPlan(token,new AbortController().signal,async(url:string,init:any)=>{request={url,init};return new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json'}});});
 assert.equal(JSON.stringify(await read(publicContent)),JSON.stringify(publicContent));
 assert.equal(request.url,'https://fixture.supabase.co/functions/v1/shared-plan');assert.equal(request.init.credentials,'omit');assert.equal(request.init.cache,'no-store');assert.equal(request.init.redirect,'error');assert.equal(request.init.headers['Cache-Control'],'no-store');assert.equal(request.init.headers.Authorization,undefined);assert.equal(request.init.headers.apikey,undefined);
 await assert.rejects(read({},404));await assert.rejects(read({},429));await assert.rejects(read({...publicContent,ownerId:'PRIVATE'}));await assert.rejects(read({...publicContent,title:'x'.repeat(70000)}));
});
test('recipient screen refreshes after backgrounding, discards revoked data and never exposes owner actions',async()=>{
 const h=hooks(),session=new RecipientLinkSession();session.accept(token);let lifecycle:(state:string)=>void=()=>{};let revoked=false;const actions:string[]=[];
 const {SharedPlanScreen}=load('src/screens/shared-plan-screen.tsx',{
  react:h.react,'react-native':{...rn,AppState:{currentState:'active',addEventListener:(_name:string,fn:any)=>{lifecycle=fn;return{remove(){}};}},Linking:{openURL:async()=>{}}},
  'expo-router':{useRouter:()=>({canGoBack:()=>false,replace:(path:string)=>actions.push(path)}),useFocusEffect:(fn:any)=>h.react.useEffect(fn,[fn])},
  '../components/v2-controls':{V2Button:'Button'},'../design-system/theme':{useAppTheme:()=>({theme})},'../navigation/recipient-links':{recipientLinks:session},
  '../services/recipient-sharing':{retrieveSharedPlan:async()=>{if(revoked)throw Error('secret');return publicContent;},RecipientFailure:class extends Error{}}
 });
 const render=()=>flatten(h.render(()=>SharedPlanScreen()));render();await tick();assert.ok(render().includes('Shared title'));
 assert.ok(!render().some(n=>n?.props?.label==='Enable read-only link'));
 lifecycle('background');assert.ok(!render().includes('Shared title'));revoked=true;lifecycle('active');await tick();assert.ok(!render().includes('Shared title'));
 render().find(n=>n?.props?.label==='Close shortlist').props.onPress();assert.equal(session.getToken(),null);assert.deepEqual(actions,['/']);h.unmount();
});
test('native associations remain off by default and require real-format signing identities',()=>{
 const {associationConfiguration,documents}=createRequire(import.meta.url)('../script/sharing-associations.cjs');
 assert.equal(associationConfiguration({}),null);assert.throws(()=>associationConfiguration({SHARING_APP_LINKS_ENABLED:'true'}));
 const env={SHARING_APP_LINKS_ENABLED:'true',EXPO_PUBLIC_SHARING_ORIGIN:origin,SHARING_ANDROID_SHA256:Array(32).fill('AB').join(':')};
 const result=associationConfiguration(env);assert.equal(result.packageName,'com.projectlemonade.mvp');assert.equal(documents(result).ios,null);
 assert.throws(()=>associationConfiguration({...env,SHARING_IOS_APP_ID:'GUESS.com.some.other.app'}));
 const apple=documents(associationConfiguration({...env,SHARING_IOS_APP_ID:'ABCDEFGHIJ.com.projectlemonade.mvp'}));assert.deepEqual(apple.ios.applinks.details[0].paths,['/s']);
});
test('public route renders while Clerk is loading, signed out or signed in, outside private providers',()=>{
 const h=hooks();let auth:any={isLoaded:false,isSignedIn:undefined};const Stack=Object.assign('Stack',{Protected:'Protected',Screen:'Screen'});
 const {RootNavigator}=load('app/_layout.tsx',{
  'react-native-url-polyfill/auto':{},'@expo-google-fonts/barlow-condensed/700Bold':{},'@clerk/expo':{useAuth:()=>auth},'@clerk/expo/token-cache':{},
  'expo-constants':{default:{},ExecutionEnvironment:{StoreClient:'store'}},'expo-font':{},'expo-router':{Stack,usePathname:()=>'/shared'},'expo-share-intent':{},'expo-status-bar':{},react:h.react,'react-native':rn,'react-native-safe-area-context':{},
  '../src/components/app-recovery-boundary':{},'../src/observability/analytics-identity':{},'../src/observability/error-monitoring-identity':{},'../src/observability/error-monitoring':{wrapWithErrorMonitoring:(value:unknown)=>value},'../src/design-system/theme':{useAppTheme:()=>({theme})}
 });
 for(const state of [{isLoaded:false,isSignedIn:undefined},{isLoaded:true,isSignedIn:false},{isLoaded:true,isSignedIn:true}]){
  auth=state;const tree=h.render(()=>RootNavigator());const children=tree.props.children;
  assert.ok(children.some((node:any)=>node.type==='Screen'&&node.props.name==='shared'));
  assert.equal(children[0].props.guard,Boolean(state.isLoaded&&state.isSignedIn));
 }
 const route=readFileSync('app/shared.tsx','utf8');assert.doesNotMatch(route,/\(app\)|useAuth|Provider/);
});
