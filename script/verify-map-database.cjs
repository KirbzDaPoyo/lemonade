const assert = require("node:assert/strict");
const path = require("node:path");
(async () => {
  const address = process.env.INBOX_TEST_DATABASE_URL;
  if (
    !address ||
    !["127.0.0.1", "localhost"].includes(new URL(address).hostname)
  )
    throw Error("Disposable localhost database required");
  const { Client } = require(
    path.join(process.env.TEMP, "lemonade-inbox-validation/node_modules/pg"),
  );
  const clients = Array.from(
    { length: 4 },
    () => new Client({ connectionString: address }),
  );
  const [admin, a, b, other] = clients;
  const reserve = (client, subject, count, user = 60, global = 250) =>
    client
      .query("select public.reserve_map_positions($1,$2,$3,$4) as result", [
        subject,
        count,
        user,
        global,
      ])
      .then((r) => r.rows[0].result);
  try {
    await Promise.all(clients.map((c) => c.connect()));
    await admin.query(
      "truncate private.map_position_usage, private.map_position_quota_exemptions",
    );
    for (const c of [a, b, other]) await c.query("set role service_role");
    assert.equal(await reserve(a, "a", 20), "ok");
    assert.equal(await reserve(a, "a", 20), "ok");
    assert.equal(await reserve(a, "a", 20), "ok");
    assert.equal(await reserve(a, "a", 1), "user_quota");
    assert.equal(
      Number(
        (
          await admin.query(
            "select attempts from private.map_position_usage where scope='project'",
          )
        ).rows[0].attempts,
      ),
      60,
    );
    await admin.query("truncate private.map_position_usage");
    for (let i = 0; i < 12; i++)
      assert.equal(await reserve(a, "user-" + i, 20), "ok");
    assert.equal(await reserve(a, "boundary", 10), "ok");
    assert.equal(await reserve(other, "another", 1), "project_quota");
    await admin.query("truncate private.map_position_usage");
    await reserve(a, "race", 20);
    await reserve(a, "race", 20);
    await a.query("begin");
    assert.equal(await reserve(a, "race", 20), "ok");
    let settled = false;
    const pending = reserve(b, "race", 1).finally(() => (settled = true));
    let blocked = false;
    for (let i = 0; i < 100 && !settled; i++) {
      if (
        (
          await admin.query(
            "select cardinality(pg_blocking_pids($1))>0 as blocked",
            [b.processID],
          )
        ).rows[0].blocked
      ) {
        blocked = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 10));
    }
    await a.query("commit");
    assert.equal(await pending, "user_quota");
    assert.ok(blocked, "race must actually overlap");
    await admin.query("truncate private.map_position_usage");
    await a.query("begin");
    assert.equal(await reserve(a, "a", 20, 60, 20), "ok");
    const globalRace = reserve(other, "b", 1, 60, 20);
    await a.query("commit");
    assert.equal(await globalRace, "project_quota");
    await admin.query(
      "insert into private.map_position_usage values(current_date-3,'user','old',1,now())",
    );
    await reserve(a, "c", 1);
    assert.equal(
      (
        await admin.query(
          "select * from private.map_position_usage where subject='old'",
        )
      ).rowCount,
      0,
    );
    const beforeExemption = Number(
      (
        await admin.query(
          "select attempts from private.map_position_usage where scope='project'",
        )
      ).rows[0].attempts,
    );
    await admin.query(
      "insert into private.map_position_quota_exemptions(subject,note) values('developer','test fixture')",
    );
    assert.equal(await reserve(a, "developer", 20, 0, 0), "ok");
    assert.equal(
      (
        await admin.query(
          "select * from private.map_position_usage where scope='user' and subject='developer'",
        )
      ).rowCount,
      0,
    );
    assert.equal(
      Number(
        (
          await admin.query(
            "select attempts from private.map_position_usage where scope='project'",
          )
        ).rows[0].attempts,
      ),
      beforeExemption,
    );
    for (const role of ["anon", "authenticated"]) {
      await admin.query("set role " + role);
      await assert.rejects(
        reserve(admin, "forge", 1),
        (e) => e.code === "42501",
      );
      await assert.rejects(
        admin.query("select * from private.map_position_usage"),
        (e) => e.code === "42501",
      );
      await assert.rejects(
        admin.query("select * from private.map_position_quota_exemptions"),
        (e) => e.code === "42501",
      );
      await admin.query("reset role");
    }
    await assert.rejects(reserve(a, "a", 21));
    await assert.rejects(reserve(a, "a", 1, 61));
    await assert.rejects(reserve(a, "a", 1, 60, 251));
    const before = Number(
      (
        await admin.query(
          "select attempts from private.map_position_usage where scope='project'",
        )
      ).rows[0].attempts,
    );
    await admin.query(
      "insert into private.map_position_quota_exemptions(subject,note) values('a','deletion fixture')",
    );
    await admin.query("set role authenticated");
    await admin.query("select set_config('request.jwt.claims',$1,false)", [
      JSON.stringify({ sub: "a", role: "authenticated" }),
    ]);
    await admin.query("select * from public.delete_current_user_data()");
    await admin.query("reset role");
    assert.equal(
      (
        await admin.query(
          "select * from private.map_position_usage where scope='user' and subject='a'",
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await admin.query(
          "select * from private.map_position_quota_exemptions where subject='a'",
        )
      ).rowCount,
      0,
    );
    assert.equal(
      (
        await admin.query(
          "select * from private.map_position_usage where scope='user' and subject='c'",
        )
      ).rowCount,
      1,
    );
    assert.equal(
      Number(
        (
          await admin.query(
            "select attempts from private.map_position_usage where scope='project'",
          )
        ).rows[0].attempts,
      ),
      before,
    );
    const fn = (
      await admin.query(
        "select proconfig,prosecdef from pg_proc where proname='reserve_map_positions'",
      )
    ).rows[0];
    assert.equal(fn.prosecdef, true);
    assert.ok(fn.proconfig.includes('search_path=""'));
    console.log(
      "PASS: map user/global exact caps, private developer exemption, denial, proven concurrent reservations, independent users, retained attempted counts, cleanup, grants, deletion isolation and safe definer configuration",
    );
  } finally {
    await Promise.all(clients.map((c) => c.end()));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
