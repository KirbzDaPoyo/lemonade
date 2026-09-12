// Optional Windows-only disposable verification runner. Install pinned PostgreSQL/pg
// dependencies in TEMP/lemonade-inbox-validation and PostgREST there as documented.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync, spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
(async () => {
  const deps = path.join(os.tmpdir(), 'lemonade-inbox-validation/node_modules');
  const bin = path.join(deps, '@embedded-postgres/windows-x64/native/bin');
  process.env.PATH = bin + path.delimiter + process.env.PATH;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lemonade-pg-'));
  const data = path.join(root, 'data');
  const run = (name, args) => execFileSync(path.join(bin, name + '.exe'), args, { windowsHide: true, encoding: 'utf8', stdio: 'ignore', timeout: 60000 });
  let started = false; let rest;
  try {
    run('initdb', ['-D', data, '-U', 'postgres', '-A', 'trust', '--encoding=UTF8', '--locale=C']);
    run('pg_ctl', ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', '-h 127.0.0.1 -p 55432', '-w', 'start']);
    started = true;
    const address = 'postgresql://postgres@127.0.0.1:55432/postgres';
    const { Client } = require(path.join(deps, 'pg'));
    const db = new Client({ connectionString: address });
    await db.connect();
    try {
      await db.query(`create role anon; create role authenticated; create role service_role; create schema auth;
        create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
        grant usage on schema auth, public to anon, authenticated, service_role;
        grant execute on function auth.jwt() to anon, authenticated, service_role;`);
      const files = fs.readdirSync('supabase/migrations').filter(f => f.endsWith('.sql')).sort();
      for (const file of files) await db.query(fs.readFileSync('supabase/migrations/' + file, 'utf8'));
      await db.query('create role api_authenticator login noinherit; grant authenticated, anon to api_authenticator');
      console.log(`PASS: ${files.length} migrations on native PostgreSQL 17`);
      await db.query(fs.readFileSync('supabase/tests/import-inbox.test.sql', 'utf8').replace(/-- PGTAP_BEGIN[\s\S]*?-- PGTAP_END/g, ''));
      console.log('PASS: complete inbox SQL assertion fixture');
    } finally { await db.end(); }
    console.log(execFileSync(process.execPath, ['script/verify-inbox-concurrency.cjs'], { windowsHide: true, encoding: 'utf8', timeout: 60000, env: { ...process.env, INBOX_TEST_DATABASE_URL: address } }));
    const secret = randomBytes(48).toString('hex');
    rest = spawn(path.join(os.tmpdir(), 'lemonade-inbox-validation/postgrest/postgrest.exe'), [], {
      windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'],
      env: { ...process.env, PGRST_DB_URI: 'postgresql://api_authenticator@127.0.0.1:55432/postgres', PGRST_DB_SCHEMAS: 'public', PGRST_DB_ANON_ROLE: 'anon', PGRST_JWT_SECRET: secret, PGRST_SERVER_HOST: '127.0.0.1', PGRST_SERVER_PORT: '55433', PGRST_DB_POOL: '2' }
    });
    let logs = ''; rest.stderr.on('data', bytes => { logs += bytes.toString(); });
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { await fetch('http://127.0.0.1:55433/'); ready = true; break; } catch {}
      if (rest.exitCode !== null) throw Error('PostgREST exit ' + rest.exitCode + ': ' + logs);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    if (!ready) throw Error('PostgREST failed to start: ' + logs);
    console.log(execFileSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', 'script/verify-inbox-api.ts'], { windowsHide: true, encoding: 'utf8', timeout: 60000, env: { ...process.env, INBOX_TEST_REST_URL: 'http://127.0.0.1:55433', INBOX_TEST_JWT_SECRET: secret } }));
  } finally {
    if (rest && rest.exitCode === null) { rest.kill(); await new Promise(resolve => rest.once('exit', resolve)); }
    if (started) run('pg_ctl', ['-D', data, '-m', 'fast', '-w', 'stop']);
    console.log('Disposable database directory: ' + root);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
