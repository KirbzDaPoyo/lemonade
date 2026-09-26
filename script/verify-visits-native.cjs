// Optional Windows runner: same pinned local-only tools as the earlier DB suites.
// npm install --prefix "$env:TEMP/lemonade-inbox-validation" --ignore-scripts --save-exact pg@8.16.3 @embedded-postgres/windows-x64@17.10.0-beta.17
// Base checks need no hosted credentials or application dependencies.
// --api also runs real HTTP tests/advisors with the pinned PostgREST 16.3 binary
// at TEMP/lemonade-inbox-validation/postgrest/postgrest.exe.
// --api-only reapplies the migration chain and runs HTTP checks/advisors without
// repeating the separate database mutation suite.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const { randomBytes } = require('node:crypto');
const { execFileSync, spawn } = require('node:child_process');

(async () => {
  const deps = path.join(os.tmpdir(), 'lemonade-inbox-validation/node_modules');
  const bin = path.join(deps, '@embedded-postgres/windows-x64/native/bin');
  if (!fs.existsSync(path.join(bin, 'initdb.exe'))) throw Error('Install the pinned local test tools listed at the top of this file.');
  process.env.PATH = bin + path.delimiter + process.env.PATH;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lemonade-visits-pg-'));
  const data = path.join(root, 'data');
  const port = await new Promise((resolve, reject) => {
    const server = net.createServer(); server.on('error', reject);
    server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
  });
  const run = (name, args) => execFileSync(path.join(bin, name + '.exe'), args,
    { windowsHide: true, encoding: 'utf8', stdio: 'ignore', timeout: 60000 });
  let started = false; let rest;
  try {
    run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C']);
    run('pg_ctl', ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
    started = true;
    const address = `postgresql://postgres@127.0.0.1:${port}/postgres`;
    const { Client } = require(path.join(deps, 'pg'));
    const db = new Client({ connectionString: address });
    await db.connect();
    try {
      await db.query(`create role anon; create role authenticated; create role service_role; create schema auth;
        create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
        grant usage on schema auth, public to anon, authenticated, service_role;
        grant execute on function auth.jwt() to anon, authenticated, service_role;`);
      await db.query('create role api_authenticator login noinherit; grant authenticated, anon to api_authenticator');
      const files = fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
      for (const file of files) {
        // Prove that an existing visited place acquires no fabricated history.
        if (file.endsWith('_add_place_visits.sql')) {
          await db.query(`insert into saved_places(id,user_id,name,address,area_or_city,category,source_url,status)
            values('visits-legacy','visits-legacy','Legacy','Test','Test','cafe','https://www.instagram.com/p/visitsLegacy/','visited')`);
        }
        await db.query(fs.readFileSync(path.join('supabase/migrations', file), 'utf8'));
      }
      const { rows } = await db.query("select (select count(*) from place_visits) as visits, status from saved_places where id='visits-legacy'");
      require('node:assert/strict').deepEqual(rows, [{ visits: '0', status: 'visited' }]);
      console.log(`PASS: complete ${files.length}-migration chain; existing visited place preserved without invented history`);
    } finally { await db.end(); }
    if (!process.argv.includes('--api-only')) execFileSync(process.execPath, ['script/verify-visits-database.cjs'], {
      windowsHide: true, stdio: 'inherit', timeout: 60000,
      env: { ...process.env, VISITS_TEST_DATABASE_URL: address }
    });
    if (process.argv.includes('--api') || process.argv.includes('--api-only')) {
      const apiPort = await new Promise((resolve, reject) => {
        const server = net.createServer(); server.on('error', reject);
        server.listen(0, '127.0.0.1', () => { const port = server.address().port; server.close(() => resolve(port)); });
      });
      const secret = randomBytes(48).toString('hex');
      rest = spawn(path.join(os.tmpdir(), 'lemonade-inbox-validation/postgrest/postgrest.exe'), [], {
        windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
        env: { ...process.env, PGRST_DB_URI: address.replace('postgres@', 'api_authenticator@'), PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: secret, PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: String(apiPort), PGRST_DB_POOL: '2' }
      });
      let logs = ''; let startError; rest.on('error', error => { startError = error; });
      rest.stderr.on('data', bytes => { logs += bytes.toString(); });
      const base = 'http://127.0.0.1:' + apiPort;
      let ready = false;
      for (let i = 0; i < 100; i++) {
        if (startError) throw startError;
        try { await fetch(base); ready = true; break; } catch {}
        if (rest.exitCode !== null) throw Error('PostgREST stopped (' + rest.exitCode + '): ' + logs);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (!ready) throw Error('PostgREST did not start');
      execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'script/verify-visits-api.ts'], {
        windowsHide: true, stdio: 'inherit', timeout: 180000,
        env: { ...process.env, VISITS_TEST_DATABASE_URL: address, VISITS_TEST_REST_URL: base, VISITS_TEST_JWT_SECRET: secret }
      });
      execFileSync('powershell.exe', ['-NoProfile', '-Command', 'npm exec --no -- supabase@2.117.0 db advisors --db-url ' + address + '?sslmode=disable --type all'], { windowsHide: true, stdio: 'inherit', timeout: 60000 });
    }
  } finally {
    if (rest?.pid && rest.exitCode === null) { rest.kill(); await new Promise(resolve => rest.once('exit', resolve)); }
    if (started) run('pg_ctl', ['-D', data, '-m', 'immediate', '-w', 'stop']);
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
