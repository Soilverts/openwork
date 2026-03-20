#!/usr/bin/env node

/**
 * Packages the Abel bundled skills directory into a zip archive
 * that gets embedded as a Tauri resource.
 *
 * Usage:
 *   node prepare-abel-skills.mjs [--source /path/to/skillsforabel]
 *
 * Environment variables:
 *   ABEL_SKILLS_SOURCE  - Override source directory
 *   ABEL_SKIP_SKILLS    - Set to "1" to skip this step
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync } from "fs";
import { dirname, join, relative, resolve } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

if (process.env.ABEL_SKIP_SKILLS === "1") {
  process.stdout.write("[abel-skills] Skipping (ABEL_SKIP_SKILLS=1)\n");
  process.exit(0);
}

const readArg = (name) => {
  const raw = process.argv.slice(2);
  const direct = raw.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = raw.indexOf(name);
  if (index >= 0 && raw[index + 1]) return raw[index + 1];
  return null;
};

const DEFAULT_SOURCE = resolve(__dirname, "..", "..", "..", "..", "..", "..", "..", "skillsforabel");
const sourceDir = process.env.ABEL_SKILLS_SOURCE || readArg("--source") || DEFAULT_SOURCE;
const outDir = join(__dirname, "..", "src-tauri");
const outZip = join(outDir, "abel-skills.zip");
const manifestPath = join(outDir, "abel-skills-manifest.json");

if (!existsSync(sourceDir)) {
  process.stderr.write(`[abel-skills] Source directory not found: ${sourceDir}\n`);
  process.stderr.write("[abel-skills] Skipping — set ABEL_SKILLS_SOURCE or use --source flag to provide skills\n");
  process.exit(0);
}

function computeDirHash(dir) {
  const hash = createHash("sha256");
  const entries = [];

  function walk(d) {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue;
      const fullPath = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        const rel = relative(dir, fullPath);
        entries.push(rel);
      }
    }
  }

  walk(dir);
  entries.sort();

  for (const rel of entries) {
    const content = readFileSync(join(dir, rel));
    hash.update(rel);
    hash.update(content);
  }

  return hash.digest("hex");
}

function needsRebuild() {
  if (!existsSync(outZip) || !existsSync(manifestPath)) return true;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const currentHash = computeDirHash(sourceDir);
    return manifest.hash !== currentHash;
  } catch {
    return true;
  }
}

function countSkills() {
  let count = 0;
  const categories = new Map();

  function scan(dir, category) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === ".DS_Store") continue;
      if (!entry.isDirectory()) continue;
      const fullPath = join(dir, entry.name);
      if (existsSync(join(fullPath, "SKILL.md"))) {
        count++;
        const cat = category || "other";
        categories.set(cat, (categories.get(cat) || 0) + 1);
      } else {
        scan(fullPath, entry.name);
      }
    }
  }

  scan(sourceDir, null);
  return { count, categories };
}

function main() {
  if (!needsRebuild()) {
    process.stdout.write("[abel-skills] Archive is up to date, skipping\n");
    return;
  }

  process.stdout.write(`[abel-skills] Packaging skills from ${sourceDir}\n`);

  const { count, categories } = countSkills();
  process.stdout.write(`[abel-skills] Found ${count} skills in ${categories.size} categories\n`);
  for (const [cat, num] of categories) {
    process.stdout.write(`[abel-skills]   ${cat}: ${num} skills\n`);
  }

  // Use system zip command to create archive, excluding .DS_Store
  const result = spawnSync(
    "zip",
    ["-r", "-q", outZip, ".", "-x", "*.DS_Store"],
    { cwd: sourceDir, stdio: "inherit" }
  );

  if (result.status !== 0) {
    throw new Error(`zip failed with status ${result.status}`);
  }

  const zipSize = statSync(outZip).size;
  process.stdout.write(`[abel-skills] Archive created: ${outZip} (${(zipSize / 1024 / 1024).toFixed(1)} MB)\n`);

  // Write manifest for cache-busting
  const hash = computeDirHash(sourceDir);
  const manifest = {
    hash,
    skills: count,
    categories: Object.fromEntries(categories),
    preparedAt: new Date().toISOString(),
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

  process.stdout.write(`[abel-skills] Done (hash: ${hash.slice(0, 12)}...)\n`);
}

main();
