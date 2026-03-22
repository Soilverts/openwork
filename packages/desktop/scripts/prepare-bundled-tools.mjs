#!/usr/bin/env node

/**
 * Downloads portable Node.js, Python, and git for the target platform.
 * These tools are bundled into the Tauri app so end users don't need to install them.
 *
 * Usage:
 *   node prepare-bundled-tools.mjs [--force] [--node-version 22.16.0] [--git-version 2.47.1]
 *
 * Environment variables:
 *   TAURI_ENV_TARGET_TRIPLE   - Target platform (e.g., aarch64-apple-darwin)
 *   ABEL_NODE_VERSION         - Override Node.js version
 *   ABEL_GIT_VERSION          - Override git version
 *   ABEL_PYTHON_VERSION       - Override Python version
 *   ABEL_PYTHON_RELEASE       - Override python-build-standalone release tag
 *   ABEL_SKIP_BUNDLED_TOOLS   - Set to "1" to skip this step entirely
 */

import { createWriteStream, existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync, readdirSync, statSync, copyFileSync, unlinkSync, rmSync, renameSync } from "fs";
import { dirname, join, resolve } from "path";
import { tmpdir, platform, arch } from "os";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import { createHash } from "crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const hasFlag = (name) => process.argv.slice(2).includes(name);
const readArg = (name) => {
  const raw = process.argv.slice(2);
  const direct = raw.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.split("=")[1];
  const index = raw.indexOf(name);
  if (index >= 0 && raw[index + 1]) return raw[index + 1];
  return null;
};

if (process.env.ABEL_SKIP_BUNDLED_TOOLS === "1") {
  process.stdout.write("[bundled-tools] Skipping (ABEL_SKIP_BUNDLED_TOOLS=1)\n");
  process.exit(0);
}

const force = hasFlag("--force");
const NODE_VERSION = process.env.ABEL_NODE_VERSION || readArg("--node-version") || "22.16.0";
const GIT_VERSION = process.env.ABEL_GIT_VERSION || readArg("--git-version") || "2.53.0";
const MINGIT_TAG = process.env.ABEL_MINGIT_TAG || "2.53.0.2";
const PYTHON_VERSION = process.env.ABEL_PYTHON_VERSION || readArg("--python-version") || "3.13.12";
const PYTHON_RELEASE = process.env.ABEL_PYTHON_RELEASE || readArg("--python-release") || "20260320";

const outDir = join(__dirname, "..", "src-tauri", "bundled-tools");

const resolvedTargetTriple = (() => {
  const envTarget =
    process.env.TAURI_ENV_TARGET_TRIPLE ??
    process.env.CARGO_CFG_TARGET_TRIPLE ??
    process.env.TARGET;
  if (envTarget) return envTarget;
  if (platform() === "darwin") {
    return arch() === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin";
  }
  if (platform() === "linux") {
    return arch() === "arm64" ? "aarch64-unknown-linux-gnu" : "x86_64-unknown-linux-gnu";
  }
  if (platform() === "win32") {
    return arch() === "arm64" ? "aarch64-pc-windows-msvc" : "x86_64-pc-windows-msvc";
  }
  return null;
})();

if (!resolvedTargetTriple) {
  process.stderr.write("[bundled-tools] Could not determine target triple\n");
  process.exit(1);
}

process.stdout.write(`[bundled-tools] Target: ${resolvedTargetTriple}\n`);

const isWindows = resolvedTargetTriple.includes("windows");
const isMacos = resolvedTargetTriple.includes("apple-darwin");
const isLinux = resolvedTargetTriple.includes("linux");

// --- Download utility ---

async function download(url, destPath) {
  process.stdout.write(`[bundled-tools]   Downloading ${url}\n`);
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: { "User-Agent": "abel-bundled-tools" },
      });
      clearTimeout(timeout);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status} for ${url}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      writeFileSync(destPath, buffer);
      return;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      process.stdout.write(`[bundled-tools]   Retry ${attempt}/${maxRetries}: ${err.message}\n`);
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    }
  }
}

function extractTarGz(archivePath, destDir) {
  mkdirSync(destDir, { recursive: true });
  const result = spawnSync("tar", ["-xzf", archivePath, "-C", destDir, "--strip-components=1"], {
    stdio: "inherit",
  });
  if (result.status !== 0) {
    throw new Error(`tar extraction failed with status ${result.status}`);
  }
}

function extractZip(archivePath, destDir) {
  mkdirSync(destDir, { recursive: true });
  if (isWindows || platform() === "win32") {
    const escapedArchive = archivePath.replace(/'/g, "''");
    const escapedDest = destDir.replace(/'/g, "''");
    const result = spawnSync("powershell", [
      "-NoProfile", "-Command",
      `Expand-Archive -Path '${escapedArchive}' -DestinationPath '${escapedDest}' -Force`,
    ], { stdio: "inherit" });
    if (result.status !== 0) {
      throw new Error(`PowerShell Expand-Archive failed with status ${result.status}`);
    }
  } else {
    const result = spawnSync("unzip", ["-q", "-o", archivePath, "-d", destDir], {
      stdio: "inherit",
    });
    if (result.status !== 0) {
      throw new Error(`unzip failed with status ${result.status}`);
    }
  }
}

// Move contents up if extracted into a single subdirectory
function flattenSingleSubdir(dir) {
  const entries = readdirSync(dir);
  if (entries.length === 1) {
    const subdir = join(dir, entries[0]);
    if (statSync(subdir).isDirectory()) {
      const innerEntries = readdirSync(subdir);
      for (const entry of innerEntries) {
        renameSync(join(subdir, entry), join(dir, entry));
      }
      rmSync(subdir, { recursive: true, force: true });
    }
  }
}

// --- Checksum verification ---

async function fetchShasums(version) {
  const url = `https://nodejs.org/dist/v${version}/SHASUMS256.txt`;
  process.stdout.write(`[bundled-tools]   Fetching checksums from ${url}\n`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  const response = await fetch(url, {
    signal: controller.signal,
    headers: { "User-Agent": "abel-bundled-tools" },
  });
  clearTimeout(timeout);
  if (!response.ok) {
    throw new Error(`Failed to fetch SHASUMS256.txt: HTTP ${response.status}`);
  }
  return await response.text();
}

function parseExpectedHash(shasumsText, filename) {
  for (const line of shasumsText.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const [hash, name] = trimmed.split(/\s+/);
    if (name === filename) return hash;
  }
  return null;
}

function computeFileHash(filePath) {
  const data = readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

async function verifyNodeChecksum(filePath, downloadUrl) {
  const filename = downloadUrl.split("/").pop();
  try {
    const shasumsText = await fetchShasums(NODE_VERSION);
    const expectedHash = parseExpectedHash(shasumsText, filename);
    if (!expectedHash) {
      process.stderr.write(`[bundled-tools]   WARNING: No checksum found for ${filename} in SHASUMS256.txt\n`);
      return;
    }
    const actualHash = computeFileHash(filePath);
    if (actualHash !== expectedHash) {
      throw new Error(
        `Checksum mismatch for ${filename}!\n` +
        `  Expected: ${expectedHash}\n` +
        `  Actual:   ${actualHash}\n` +
        `  This may indicate a corrupted download or supply-chain attack.`
      );
    }
    process.stdout.write(`[bundled-tools]   Checksum verified: ${actualHash.slice(0, 16)}...\n`);
  } catch (err) {
    if (err.message.includes("Checksum mismatch")) throw err;
    process.stderr.write(`[bundled-tools]   WARNING: Could not verify checksum: ${err.message}\n`);
  }
}

// --- Version tracking ---

const versionFilePath = join(outDir, "versions.json");

function readVersions() {
  try {
    return JSON.parse(readFileSync(versionFilePath, "utf8"));
  } catch {
    return {};
  }
}

function writeVersions(versions) {
  writeFileSync(versionFilePath, JSON.stringify(versions, null, 2) + "\n");
}

function needsUpdate(component, expectedVersion) {
  if (force) return true;
  const versions = readVersions();
  return versions[component] !== expectedVersion || versions.target !== resolvedTargetTriple;
}

// --- Node.js ---

function nodeDownloadUrl() {
  const v = NODE_VERSION;
  switch (resolvedTargetTriple) {
    case "aarch64-apple-darwin":
      return `https://nodejs.org/dist/v${v}/node-v${v}-darwin-arm64.tar.gz`;
    case "x86_64-apple-darwin":
      return `https://nodejs.org/dist/v${v}/node-v${v}-darwin-x64.tar.gz`;
    case "x86_64-unknown-linux-gnu":
      return `https://nodejs.org/dist/v${v}/node-v${v}-linux-x64.tar.gz`;
    case "aarch64-unknown-linux-gnu":
      return `https://nodejs.org/dist/v${v}/node-v${v}-linux-arm64.tar.gz`;
    case "x86_64-pc-windows-msvc":
      return `https://nodejs.org/dist/v${v}/node-v${v}-win-x64.zip`;
    case "aarch64-pc-windows-msvc":
      return `https://nodejs.org/dist/v${v}/node-v${v}-win-arm64.zip`;
    default:
      throw new Error(`Unsupported target for Node.js: ${resolvedTargetTriple}`);
  }
}

async function prepareNode() {
  const nodeDir = join(outDir, "node");
  if (!needsUpdate("node", NODE_VERSION)) {
    const marker = isWindows ? join(nodeDir, "node.exe") : join(nodeDir, "bin", "node");
    if (existsSync(marker)) {
      process.stdout.write(`[bundled-tools] Node.js ${NODE_VERSION} already prepared\n`);
      return;
    }
  }

  process.stdout.write(`[bundled-tools] Preparing Node.js ${NODE_VERSION}...\n`);

  const url = nodeDownloadUrl();
  const ext = url.endsWith(".zip") ? ".zip" : ".tar.gz";
  const tmpPath = join(tmpdir(), `abel-node${ext}`);

  await download(url, tmpPath);
  await verifyNodeChecksum(tmpPath, url);

  // Clean existing
  if (existsSync(nodeDir)) {
    rmSync(nodeDir, { recursive: true, force: true });
  }
  mkdirSync(nodeDir, { recursive: true });

  if (ext === ".zip") {
    extractZip(tmpPath, nodeDir);
    flattenSingleSubdir(nodeDir);
  } else {
    extractTarGz(tmpPath, nodeDir);
  }

  // Strip unnecessary files to reduce bundle size (~178MB → ~100MB)
  const stripDirs = ["include", "share/doc", "share/man", "share/systemtap"];
  for (const dir of stripDirs) {
    const target = join(nodeDir, dir);
    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
    }
  }

  // Remove .md and LICENSE files from root
  for (const entry of readdirSync(nodeDir)) {
    if (entry.endsWith(".md") || entry === "LICENSE" || entry === "CHANGELOG") {
      try { unlinkSync(join(nodeDir, entry)); } catch { /* ignore */ }
    }
  }

  // Verify
  const nodeBin = isWindows ? join(nodeDir, "node.exe") : join(nodeDir, "bin", "node");
  if (!existsSync(nodeBin)) {
    throw new Error(`Node.js binary not found at ${nodeBin} after extraction`);
  }

  try { unlinkSync(tmpPath); } catch { /* ignore */ }

  process.stdout.write(`[bundled-tools] Node.js ${NODE_VERSION} ready\n`);
}

// --- Git ---

function gitDownloadUrl() {
  if (isWindows) {
    const arch = resolvedTargetTriple.startsWith("aarch64") ? "arm64" : "64-bit";
    return `https://github.com/git-for-windows/git/releases/download/v${MINGIT_TAG}.windows.2/MinGit-${MINGIT_TAG}-${arch}.zip`;
  }
  // macOS: system git is available via Xcode CLT (pre-installed or auto-prompted)
  // Linux: git is available via package manager
  // We skip bundling on these platforms — the Rust code falls back to system git
  return null;
}

async function prepareGit() {
  const gitDir = join(outDir, "git");

  if (!needsUpdate("git", GIT_VERSION)) {
    const marker = isWindows
      ? join(gitDir, "cmd", "git.exe")
      : join(gitDir, "bin", "git");
    if (existsSync(marker)) {
      process.stdout.write(`[bundled-tools] git ${GIT_VERSION} already prepared\n`);
      return;
    }
  }

  const url = gitDownloadUrl();
  if (!url) {
    process.stdout.write(`[bundled-tools] Skipping git bundle for ${resolvedTargetTriple} (system git expected)\n`);
    // Create empty marker so versions.json is still written
    mkdirSync(gitDir, { recursive: true });
    return;
  }

  process.stdout.write(`[bundled-tools] Preparing git ${GIT_VERSION}...\n`);

  const ext = url.endsWith(".zip") ? ".zip" : ".tar.gz";
  const tmpPath = join(tmpdir(), `abel-git${ext}`);

  try {
    await download(url, tmpPath);
  } catch (err) {
    // Git bundling is best-effort on macOS — system git is usually available
    process.stderr.write(`[bundled-tools] WARNING: Failed to download portable git: ${err.message}\n`);
    process.stderr.write(`[bundled-tools] The app will fall back to system git if available.\n`);
    mkdirSync(gitDir, { recursive: true });
    return;
  }

  if (existsSync(gitDir)) {
    rmSync(gitDir, { recursive: true, force: true });
  }
  mkdirSync(gitDir, { recursive: true });

  if (ext === ".zip") {
    extractZip(tmpPath, gitDir);
  } else {
    extractTarGz(tmpPath, gitDir);
  }

  // Make git binary executable on unix
  if (!isWindows) {
    const gitBin = join(gitDir, "bin", "git");
    if (existsSync(gitBin)) {
      chmodSync(gitBin, 0o755);
    }
  }

  try { unlinkSync(tmpPath); } catch { /* ignore */ }

  process.stdout.write(`[bundled-tools] git ${GIT_VERSION} ready\n`);
}

// --- Python (python-build-standalone) ---

function pythonDownloadUrl() {
  // python-build-standalone provides portable, self-contained Python builds.
  // https://github.com/indygreg/python-build-standalone
  // The "install_only" variant is the smallest (~40-60MB compressed).
  const base = `https://github.com/indygreg/python-build-standalone/releases/download/${PYTHON_RELEASE}`;
  const v = PYTHON_VERSION;
  const tag = PYTHON_RELEASE;

  switch (resolvedTargetTriple) {
    case "aarch64-apple-darwin":
      return `${base}/cpython-${v}+${tag}-aarch64-apple-darwin-install_only.tar.gz`;
    case "x86_64-apple-darwin":
      return `${base}/cpython-${v}+${tag}-x86_64-apple-darwin-install_only.tar.gz`;
    case "x86_64-unknown-linux-gnu":
      return `${base}/cpython-${v}+${tag}-x86_64-unknown-linux-gnu-install_only.tar.gz`;
    case "aarch64-unknown-linux-gnu":
      return `${base}/cpython-${v}+${tag}-aarch64-unknown-linux-gnu-install_only.tar.gz`;
    case "x86_64-pc-windows-msvc":
      return `${base}/cpython-${v}+${tag}-x86_64-pc-windows-msvc-install_only.tar.gz`;
    case "aarch64-pc-windows-msvc":
      return `${base}/cpython-${v}+${tag}-aarch64-pc-windows-msvc-install_only.tar.gz`;
    default:
      throw new Error(`Unsupported target for Python: ${resolvedTargetTriple}`);
  }
}

// Returns true if Python was successfully prepared, false on failure.
async function preparePython() {
  const pythonDir = join(outDir, "python");
  const pythonBin = isWindows
    ? join(pythonDir, "python.exe")
    : join(pythonDir, "bin", "python3");

  if (!needsUpdate("python", PYTHON_VERSION)) {
    if (existsSync(pythonBin)) {
      process.stdout.write(`[bundled-tools] Python ${PYTHON_VERSION} already prepared\n`);
      return true;
    }
  }

  process.stdout.write(`[bundled-tools] Preparing Python ${PYTHON_VERSION} (release ${PYTHON_RELEASE})...\n`);

  const url = pythonDownloadUrl();
  const tmpPath = join(tmpdir(), "abel-python.tar.gz");

  try {
    await download(url, tmpPath);
  } catch (err) {
    process.stderr.write(`[bundled-tools] WARNING: Failed to download portable Python: ${err.message}\n`);
    process.stderr.write(`[bundled-tools] Office skills requiring Python will not work.\n`);
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    return false;
  }

  // Clean existing
  if (existsSync(pythonDir)) {
    rmSync(pythonDir, { recursive: true, force: true });
  }
  mkdirSync(pythonDir, { recursive: true });

  // python-build-standalone extracts to a "python/" subdirectory
  extractTarGz(tmpPath, pythonDir);

  // Strip unnecessary files to reduce size
  // Derive the python lib dir name (e.g., "python3.13") from the version
  const pyMinor = `python${PYTHON_VERSION.split(".").slice(0, 2).join(".")}`;
  const libDir = isWindows ? `Lib` : `lib/${pyMinor}`;
  const stripDirs = [
    "share",           // docs, man pages
    "include",         // C headers (not needed for running scripts)
    `${libDir}/test`,           // test suite (~30MB)
    `${libDir}/tests`,
    `${libDir}/idle_test`,
    `${libDir}/idlelib`,        // IDLE GUI (not needed)
    `${libDir}/tkinter`,        // Tk GUI (not needed)
    `${libDir}/ensurepip/_bundled`, // pip wheel (we'll use pip directly)
  ];
  for (const dir of stripDirs) {
    const target = join(pythonDir, dir);
    if (existsSync(target)) {
      rmSync(target, { recursive: true, force: true });
    }
  }

  // Remove __pycache__ directories iteratively (avoids stack overflow on deep trees)
  const queue = [pythonDir];
  while (queue.length > 0) {
    const dir = queue.pop();
    let entries;
    try { entries = readdirSync(dir); } catch { continue; }
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      try {
        if (statSync(fullPath).isDirectory()) {
          if (entry === "__pycache__") {
            rmSync(fullPath, { recursive: true, force: true });
          } else {
            queue.push(fullPath);
          }
        }
      } catch { /* skip broken symlinks */ }
    }
  }

  // Verify binary exists after extraction
  if (!existsSync(pythonBin)) {
    process.stderr.write(`[bundled-tools] WARNING: Python binary not found at ${pythonBin} after extraction\n`);
    process.stderr.write(`[bundled-tools] Office skills requiring Python will not work.\n`);
    try { unlinkSync(tmpPath); } catch { /* ignore */ }
    return false;
  }

  process.stdout.write(`[bundled-tools] Python ${PYTHON_VERSION} ready\n`);
  try { unlinkSync(tmpPath); } catch { /* ignore */ }
  return true;
}

// --- Main ---

async function main() {
  mkdirSync(outDir, { recursive: true });

  await prepareNode();
  await prepareGit();
  const pythonOk = await preparePython();

  // Write version manifest — only include python if it was successfully prepared
  const versions = {
    node: NODE_VERSION,
    git: GIT_VERSION,
    target: resolvedTargetTriple,
    preparedAt: new Date().toISOString(),
  };
  if (pythonOk) {
    versions.python = PYTHON_VERSION;
  }
  writeVersions(versions);

  process.stdout.write(`[bundled-tools] All tools ready in ${outDir}\n`);
}

main().catch((err) => {
  process.stderr.write(`[bundled-tools] FATAL: ${err.message}\n`);
  process.exit(1);
});
