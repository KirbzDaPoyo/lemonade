const fs = require('fs');
const path = require('path');
// Optional validation dependency, installed outside the app:
// npm install --prefix <temporary-directory> --ignore-scripts @electric-sql/pglite@0.3.14
// PGLITE_MODULE can point to that package; no app dependency is added.
(async () => {
  const modulePath = process.env.PGLITE_MODULE || path.join(process.env.TEMP || '/tmp', 'lemonade-inbox-validation/node_modules/@electric-sql/pglite');
  const { PGlite } = require(modulePath);
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role; create schema auth;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      grant usage on schema auth, public to anon, authenticated, service_role;
      grant execute on function auth.jwt() to anon, authenticated, service_role;`);
    const files = fs.readdirSync('supabase/migrations').filter(file => file.endsWith('.sql')).sort();
    for (const file of files) await db.exec(fs.readFileSync('supabase/migrations/' + file, 'utf8'));
    console.log(`PASS: ${files.length} migrations applied to isolated PostgreSQL`);
    const sql = fs.readFileSync('supabase/tests/import-inbox.test.sql', 'utf8').replace(/-- PGTAP_BEGIN[\s\S]*?-- PGTAP_END/g, '');
    await db.exec(sql);
    console.log('PASS: all inbox SQL behavioral assertions (same assertions as pgTAP fixture)');
    console.log('LIMIT: single connection; concurrent PostgreSQL transactions and PostgREST require local Supabase.');
  } finally { await db.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
