const fs = require('node:fs');
const path = require('node:path');
function associationConfiguration(env = process.env) {
  if (env.SHARING_APP_LINKS_ENABLED !== 'true') return null;
  const url = new URL(env.EXPO_PUBLIC_SHARING_ORIGIN || '');
  if (url.protocol !== 'https:' || url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) throw Error('Approved sharing HTTPS origin required');
  const fingerprints = (env.SHARING_ANDROID_SHA256 || '').split(',').map(x => x.trim());
  if (!fingerprints.length || fingerprints.some(x => !/^(?:[A-Fa-f0-9]{2}:){31}[A-Fa-f0-9]{2}$/.test(x))) throw Error('Verified Android signing SHA-256 fingerprint required');
  const packageName = env.EXPO_PUBLIC_APP_ENV === 'development' ? 'com.projectlemonade.mvp.dev' : 'com.projectlemonade.mvp';
  const iosId = env.SHARING_IOS_APP_ID || '';
  if (iosId && (!/^[A-Z0-9]{10}\./.test(iosId) || iosId.slice(11) !== packageName)) throw Error('Verified Apple team ID and matching bundle ID required');
  return { hostname:url.hostname, packageName, fingerprints: fingerprints.map(x=>x.toUpperCase()), iosId };
}
function documents(config) {
  if (!config) throw Error('Association generation is not enabled');
  return { android: [{relation:['delegate_permission/common.handle_all_urls'],target:{namespace:'android_app',package_name:config.packageName,sha256_cert_fingerprints:config.fingerprints}}],
    ios: config.iosId ? {applinks:{apps:[],details:[{appID:config.iosId,paths:['/s']}]}} : null };
}
module.exports = { associationConfiguration, documents };
if (require.main === module) {
  const config = associationConfiguration(); const output = documents(config);
  const directory=path.resolve('web/.well-known');fs.mkdirSync(directory,{recursive:true});
  fs.writeFileSync(path.join(directory,'assetlinks.json'),JSON.stringify(output.android,null,2)+'\n');
  if(output.ios)fs.writeFileSync(path.join(directory,'apple-app-site-association'),JSON.stringify(output.ios,null,2)+'\n');
  console.log('Association files generated for the explicitly configured signing identities. Domain verification still required.');
}
