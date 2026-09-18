const fs = require("node:fs");
const assert = require("node:assert/strict");
const raw = fs.readFileSync("dist/release-0.7-native-config.json", "utf8");
const config = JSON.parse(raw.slice(raw.indexOf("{")));
const manifest = config._internal.modResults.android.manifest.manifest;
const permissions = (manifest["uses-permission"] ?? [])
  .filter((p) => p.$["tools:node"] !== "remove")
  .map((p) => p.$["android:name"]);
assert.ok(permissions.includes("android.permission.ACCESS_COARSE_LOCATION"));
assert.ok(permissions.includes("android.permission.ACCESS_FINE_LOCATION"));
assert.ok(
  !permissions.includes("android.permission.ACCESS_BACKGROUND_LOCATION"),
);
assert.ok(
  !permissions.includes("android.permission.FOREGROUND_SERVICE_LOCATION"),
);
const plist = config._internal.modResults.ios.infoPlist;
assert.ok(plist.NSLocationWhenInUseUsageDescription.includes("saved places"));
assert.ok(!plist.NSLocationAlwaysAndWhenInUseUsageDescription);
assert.ok(!plist.NSLocationAlwaysUsageDescription);
assert.ok(!(plist.UIBackgroundModes ?? []).includes("location"));
console.log(
  "PASS: introspected native configuration has coarse/fine foreground access and when-in-use text, no always/background location or location foreground-service permission.",
);
console.log("Active Android permissions:", permissions.join(", "));
