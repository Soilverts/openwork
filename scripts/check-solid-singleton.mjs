#!/usr/bin/env node

/**
 * Verifies that only one copy of solid-js is resolved in the dependency tree.
 *
 * Multiple solid-js instances cause silent reactivity failures — SSE events
 * won't trigger UI updates because signals come from a different solid-js copy.
 * This is the #1 pitfall in Abel's development (documented in 踩坑记录).
 *
 * Usage: node scripts/check-solid-singleton.mjs
 * Exit code: 0 = single instance, 1 = multiple instances found
 */

import { spawnSync } from "child_process";

const result = spawnSync("pnpm", ["list", "solid-js", "--depth", "0", "-r", "--json"], {
  encoding: "utf8",
  cwd: process.cwd(),
});

if (result.status !== 0) {
  console.error("Failed to run pnpm list:", result.stderr);
  process.exit(1);
}

try {
  const packages = JSON.parse(result.stdout);
  const solidVersions = new Set();
  const solidLocations = [];

  for (const pkg of packages) {
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    for (const [name, info] of Object.entries(deps)) {
      if (name === "solid-js") {
        const version = info.version;
        solidVersions.add(version);
        solidLocations.push({ package: pkg.name, version, path: info.path });
      }
    }
  }

  console.log("solid-js Instance Check");
  console.log("=".repeat(50));
  console.log(`\n  Instances found: ${solidLocations.length}`);
  console.log(`  Unique versions: ${solidVersions.size}`);

  for (const loc of solidLocations) {
    console.log(`  - ${loc.package}: v${loc.version}`);
  }

  if (solidVersions.size > 1) {
    console.error(`\n  FAIL: Multiple solid-js versions detected!`);
    console.error(`  Versions: ${[...solidVersions].join(", ")}`);
    console.error(`\n  This WILL cause silent reactivity failures.`);
    console.error(`  Fix: Ensure all packages pin the same solid-js version.`);
    console.error(`  See: abel-app/vite.config.ts resolve.alias for the runtime fix.`);
    process.exit(1);
  }

  console.log(`\n  PASSED: Single solid-js version (${[...solidVersions][0]})`);
  process.exit(0);
} catch (err) {
  console.error("Failed to parse pnpm output:", err.message);
  process.exit(1);
}
