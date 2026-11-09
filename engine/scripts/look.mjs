// look.mjs <video> [--every 1] [--from 0] [--to end] [--out sheet.jpg]
// Contact sheet of the SOURCE video (one frame every N seconds, left→right, top→bottom),
// so you can see where the face is, where hands move, where the screen is shown.
import fs from "node:fs";
import path from "node:path";
import { abs, die, ffmpeg, log, parseArgs, probe } from "./lib.mjs";

const { pos, opt } = parseArgs();
if (!pos[0]) die("usage: node look.mjs <video> [--every 1] [--from s] [--to s] [--out file.jpg]");
const info = probe(pos[0]);
const every = Number(opt.every || 1);
const from = Number(opt.from || 0);
const to = Math.min(Number(opt.to || info.duration), info.duration);
const n = Math.max(1, Math.floor((to - from) / every));
const cols = Math.min(8, n);
const rows = Math.ceil(n / cols);
const base = path.basename(info.file, path.extname(info.file));
const out = abs(opt.out || path.join(path.dirname(info.file), `${base}.reels`, `look_${from}-${to.toFixed(0)}s_every${every}.jpg`));
fs.mkdirSync(path.dirname(out), { recursive: true });
ffmpeg([
  "-ss", String(from), "-t", String(to - from), "-i", info.file,
  "-vf", `fps=1/${every},scale=240:-2,tile=${cols}x${rows}:padding=4:color=white`,
  "-frames:v", "1", "-q:v", "4", out,
]);
log(`sheet: ${out}`);
log(`${n} frames, every ${every}s from ${from}s; cell k (0-based, left→right, top→bottom) ≈ ${from} + k×${every} s`);
