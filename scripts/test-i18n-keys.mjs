#!/usr/bin/env node

/**
 * Validates i18n translation key consistency between locale files.
 *
 * Checks:
 * 1. All keys in en.ts exist in zh.ts (and vice versa)
 * 2. No empty string values
 * 3. No duplicate keys
 * 4. Placeholder variables ({var}) match between locales
 *
 * Usage: node scripts/test-i18n-keys.mjs
 * Exit code: 0 = pass, 1 = failures found
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const localesDir = join(__dirname, "..", "packages", "app", "src", "i18n", "locales");

function extractKeys(filePath) {
  const content = readFileSync(filePath, "utf8");
  const keys = new Map();
  const keyPattern = /^\s*"([^"]+)":\s*"((?:[^"\\]|\\.)*)"/gm;
  let match;
  while ((match = keyPattern.exec(content)) !== null) {
    const [, key, value] = match;
    if (keys.has(key)) {
      keys.set(key, { value, duplicate: true });
    } else {
      keys.set(key, { value, duplicate: false });
    }
  }
  return keys;
}

function extractPlaceholders(value) {
  const matches = value.match(/\{[^}]+\}/g);
  return matches ? matches.sort() : [];
}

let failures = 0;
let warnings = 0;

function fail(msg) {
  console.error(`  FAIL: ${msg}`);
  failures++;
}

function warn(msg) {
  console.warn(`  WARN: ${msg}`);
  warnings++;
}

console.log("i18n Key Consistency Test");
console.log("=".repeat(50));

// Load locale files
const enKeys = extractKeys(join(localesDir, "en.ts"));
const zhKeys = extractKeys(join(localesDir, "zh.ts"));

console.log(`\n  en.ts: ${enKeys.size} keys`);
console.log(`  zh.ts: ${zhKeys.size} keys`);

// Check 1: Keys in en.ts missing from zh.ts
console.log("\n--- Keys in en.ts missing from zh.ts ---");
let missingInZh = 0;
for (const [key] of enKeys) {
  if (!zhKeys.has(key)) {
    fail(`"${key}" exists in en.ts but not in zh.ts`);
    missingInZh++;
  }
}
if (missingInZh === 0) console.log("  All en.ts keys found in zh.ts");

// Check 2: Keys in zh.ts missing from en.ts
console.log("\n--- Keys in zh.ts missing from en.ts ---");
let missingInEn = 0;
for (const [key] of zhKeys) {
  if (!enKeys.has(key)) {
    fail(`"${key}" exists in zh.ts but not in en.ts`);
    missingInEn++;
  }
}
if (missingInEn === 0) console.log("  All zh.ts keys found in en.ts");

// Check 3: Empty values
console.log("\n--- Empty values ---");
let emptyCount = 0;
for (const [key, { value }] of enKeys) {
  if (value.trim() === "") {
    warn(`en.ts "${key}" has empty value`);
    emptyCount++;
  }
}
for (const [key, { value }] of zhKeys) {
  if (value.trim() === "") {
    warn(`zh.ts "${key}" has empty value`);
    emptyCount++;
  }
}
if (emptyCount === 0) console.log("  No empty values found");

// Check 4: Placeholder consistency
console.log("\n--- Placeholder consistency ---");
let placeholderMismatch = 0;
for (const [key, { value: enValue }] of enKeys) {
  const zhEntry = zhKeys.get(key);
  if (!zhEntry) continue;

  const enPlaceholders = extractPlaceholders(enValue);
  const zhPlaceholders = extractPlaceholders(zhEntry.value);

  if (JSON.stringify(enPlaceholders) !== JSON.stringify(zhPlaceholders)) {
    fail(`"${key}" placeholder mismatch: en=${JSON.stringify(enPlaceholders)} zh=${JSON.stringify(zhPlaceholders)}`);
    placeholderMismatch++;
  }
}
if (placeholderMismatch === 0) console.log("  All placeholders match");

// Check 5: Duplicate keys
console.log("\n--- Duplicate keys ---");
let dupeCount = 0;
for (const [key, { duplicate }] of enKeys) {
  if (duplicate) {
    fail(`en.ts has duplicate key: "${key}"`);
    dupeCount++;
  }
}
for (const [key, { duplicate }] of zhKeys) {
  if (duplicate) {
    fail(`zh.ts has duplicate key: "${key}"`);
    dupeCount++;
  }
}
if (dupeCount === 0) console.log("  No duplicate keys found");

// Summary
console.log("\n" + "=".repeat(50));
if (failures > 0) {
  console.error(`FAILED: ${failures} failures, ${warnings} warnings`);
  process.exit(1);
} else {
  console.log(`PASSED: 0 failures, ${warnings} warnings`);
  process.exit(0);
}
