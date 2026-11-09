#!/usr/bin/env node
// setup.mjs [--lang ru|multi] [--check]
//
// One-time install (safe to re-run any time — it only does what's missing):
//   1. copies the engine to ~/.reel-subs/engine (or $REELS_HOME/engine)
//   2. npm install there: Remotion, React, fonts, ffmpeg/ffprobe binaries, sherpa-onnx (speech recognition)
//   3. downloads the speech model and headless Chrome, then runs the doctor
// Needs only Node.js 18+. Works the same on macOS, Windows and Linux.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const lang = args.includes("--lang") ? args[args.indexOf("--lang") + 1] : "ru";
const checkOnly = args.includes("--check");
const log = (...a) => console.log("[reels-setup]", ...a);

const [maj] = process.versions.node.split(".").map(Number);
if (maj < 18) {
  console.error(`Node.js ${process.versions.node} is too old. Install Node 20+ (https://nodejs.org) and run again.`);
  process.exit(1);
}

const SKILL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const HOME = process.env.REELS_HOME || path.join(os.homedir(), ".reel-subs");
const DEST = path.join(HOME, "engine");
const node = process.execPath;
const doctor = () => spawnSync(node, [path.join(DEST, "scripts", "doctor.mjs"), "--fix", "--lang", lang], { stdio: "inherit" }).status;

if (checkOnly) {
  if (!fs.existsSync(path.join(DEST, "scripts", "doctor.mjs"))) { log("engine not installed yet — run setup without --check"); process.exit(1); }
  process.exit(spawnSync(node, [path.join(DEST, "scripts", "doctor.mjs"), "--lang", lang], { stdio: "inherit" }).status ?? 1);
}

// 1. copy engine (keep node_modules / bundle / user-added components untouched)
const hash = (f) => (fs.existsSync(f) ? crypto.createHash("sha1").update(fs.readFileSync(f)).digest("hex") : "");
const oldPkg = hash(path.join(DEST, "package.json"));
fs.mkdirSync(DEST, { recursive: true });
fs.cpSync(path.join(SKILL, "engine"), DEST, {
  recursive: true,
  force: true,
  filter: (src) => !/[\\/](node_modules|\.bundle)([\\/]|$)/.test(path.relative(SKILL, src)),
});
log(`engine → ${DEST}`);

// 2. npm install when deps changed or are missing
const needInstall = oldPkg !== hash(path.join(DEST, "package.json")) || !fs.existsSync(path.join(DEST, "node_modules", "remotion"));
if (needInstall) {
  log("installing dependencies (1–3 min the first time)…");
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const r = spawnSync(npm, ["install", "--no-audit", "--no-fund", "--loglevel=error"], { cwd: DEST, stdio: "inherit", shell: process.platform === "win32" });
  if (r.status !== 0) {
    console.error("\nnpm install failed. Check your internet connection / proxy and run setup again.");
    process.exit(1);
  }
} else log("dependencies up to date");

// 3. models + browser + checks
const st = doctor();
if (st !== 0) process.exit(st ?? 1);
log(`all set. Scripts: ${path.join(DEST, "scripts")}`);
