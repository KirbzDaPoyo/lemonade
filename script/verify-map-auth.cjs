const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { pathToFileURL } = require("node:url");
const { runInNewContext } = require("node:vm");
const ts = require("typescript");
(async () => {
  const jose = await import(
    pathToFileURL(
      path.join(
        os.tmpdir(),
        "lemonade-map-validation/node_modules/jose/dist/webapi/index.js",
      ),
    ).href
  );
  const { privateKey, publicKey } = await jose.generateKeyPair("RS256");
  const jwk = await jose.exportJWK(publicKey);
  jwk.kid = "fixture";
  jwk.alg = "RS256";
  const server = http.createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ keys: [jwk] }));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const issuer = `http://127.0.0.1:${server.address().port}`;
  const load = (file, stubs = {}) => {
    const exports = {};
    runInNewContext(
      ts.transpileModule(fs.readFileSync(file, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      {
        exports,
        require: (name) => {
          if (name in stubs) return stubs[name];
          throw Error(name);
        },
        Deno: { env: { get: () => issuer } },
        URL,
        Request,
        Response,
        AbortController,
        setTimeout,
        clearTimeout,
        Error,
        fetch,
      },
    );
    return exports;
  };
  try {
    const auth = load("supabase/functions/_shared/clerkAuth.ts", {
      "npm:jose@6.1.3": jose,
    });
    const { createLocationHandler } = load(
      "supabase/functions/_shared/placeLocations.ts",
    );
    let calls = 0;
    const handler = createLocationHandler({
      authenticate: async (req) => (await auth.requireClerkUser(req)).userId,
      owned: async (ids, subject) =>
        ids
          .filter((id) => id === subject + "-place")
          .map((id) => ({ id, place_id: "fixture-google" })),
      reserve: async () => "ok",
      apiKey: "fixture",
      fetch: async () => {
        calls++;
        return Response.json({
          id: "fixture-google",
          location: { latitude: 25, longitude: 121 },
        });
      },
    });
    const token = async (
      sub = "owner",
      role = "authenticated",
      iss = issuer,
      exp = "2m",
      key = privateKey,
    ) =>
      new jose.SignJWT({ role })
        .setProtectedHeader({ alg: "RS256", kid: "fixture" })
        .setIssuer(iss)
        .setSubject(sub)
        .setIssuedAt()
        .setExpirationTime(exp)
        .sign(key);
    const req = (bearer, ids = ["owner-place"]) =>
      new Request("http://fixture/place-locations", {
        method: "POST",
        headers: bearer ? { Authorization: "Bearer " + bearer } : {},
        body: JSON.stringify({ ids }),
      });
    const good = await token();
    assert.equal((await handler(req(good))).status, 200);
    assert.equal(calls, 1);
    for (const invalid of [
      undefined,
      await token("owner", "anon"),
      await token("owner", "authenticated", "http://wrong.test"),
      await token("owner", "authenticated", issuer, "-1m"),
      await token(""),
    ])
      assert.equal((await handler(req(invalid))).status, 401);
    const wrongKey = await jose.generateKeyPair("RS256");
    assert.equal(
      (
        await handler(
          req(
            await token(
              "owner",
              "authenticated",
              issuer,
              "2m",
              wrongKey.privateKey,
            ),
          ),
        )
      ).status,
      401,
    );
    assert.equal((await handler(req(await token("other")))).status, 404);
    assert.equal(calls, 1);
    console.log(
      "PASS: actual Clerk verification with local RSA/JWKS: signature, issuer, role, expiration, subject, cross-owner refusal; minimal mocked Google success. No live provider calls.",
    );
  } finally {
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
