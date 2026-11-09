// Shared helpers. Pure Node — no bash, no Python — so the same code runs on macOS, Windows and Linux.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

export const ENGINE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const HOME = process.env.REELS_HOME || path.join(os.homedir(), ".reel-subs");
export const MODELS = path.join(HOME, "models");
export const req = createRequire(path.join(ENGINE, "package.json"));
export const IS_WIN = process.platform === "win32";

// Remotion keeps its downloaded Chrome next to the nearest package.json of the *current directory*.
// Work from the engine dir so Chrome lives in ENGINE/node_modules/.remotion and never lands in the
// user's video folders. User paths are resolved against the directory the script was started in.
export const CWD = process.cwd();
process.chdir(ENGINE);
export const abs = (p) => path.resolve(CWD, String(p));

/* ------------------------------------------------------------------ cli */
export const parseArgs = (argv = process.argv.slice(2)) => {
  const pos = [];
  const opt = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const [k, v] = a.slice(2).split("=");
      if (v !== undefined) opt[k] = v;
      else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith("--")) opt[k] = argv[++i];
      else opt[k] = true;
    } else pos.push(a);
  }
  return { pos, opt };
};
export const log = (...a) => console.log("[reels]", ...a);
export const die = (msg) => {
  console.error(`\n[reels] ERROR: ${msg}\n`);
  process.exit(1);
};

/* ------------------------------------------------------------------ binaries */
export const ffmpegBin = () => {
  const p = req("ffmpeg-static");
  if (!p || !fs.existsSync(p)) die("ffmpeg binary missing — run setup again (npm install inside the engine).");
  return p;
};
export const ffprobeBin = () => {
  const p = req("ffprobe-static").path;
  if (!p || !fs.existsSync(p)) die("ffprobe binary missing — run setup again.");
  return p;
};
export const run = (bin, args, { quiet = true, allowFail = false } = {}) => {
  const r = spawnSync(bin, args, { encoding: "utf8", maxBuffer: 1 << 28, stdio: quiet ? "pipe" : "inherit" });
  if (r.error) {
    if (allowFail) return r;
    die(`${path.basename(bin)} failed to start: ${r.error.message}`);
  }
  if (r.status !== 0 && !allowFail) {
    const tail = (r.stderr || "").trim().split("\n").slice(-15).join("\n");
    die(`${path.basename(bin)} exited with ${r.status}\n${tail}`);
  }
  return r;
};
export const ffmpeg = (args, opts) => run(ffmpegBin(), ["-hide_banner", "-y", ...args], opts);

/* ------------------------------------------------------------------ probe */
const ratio = (s) => {
  if (!s || s === "0/0") return NaN;
  const [a, b] = String(s).split("/").map(Number);
  return b ? a / b : a;
};
export const probe = (file) => {
  file = abs(file);
  if (!fs.existsSync(file)) die(`file not found: ${file}`);
  const r = run(ffprobeBin(), ["-v", "error", "-print_format", "json", "-show_streams", "-show_format", file]);
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === "video");
  const a = j.streams.find((s) => s.codec_type === "audio");
  if (!v) die(`no video stream in ${file}`);
  let rot = 0;
  for (const sd of v.side_data_list ?? []) if (typeof sd.rotation === "number") rot = sd.rotation;
  if (v.tags?.rotate) rot = Number(v.tags.rotate);
  const swap = Math.abs(rot) % 180 === 90;
  const width = swap ? v.height : v.width;
  const height = swap ? v.width : v.height;
  const fpsStr = v.r_frame_rate && v.r_frame_rate !== "0/0" ? v.r_frame_rate : v.avg_frame_rate;
  const fps = ratio(fpsStr);
  const avg = ratio(v.avg_frame_rate);
  const duration = Number(v.duration || j.format.duration);
  const nb = Number(v.nb_frames);
  const durationInFrames = Number.isFinite(nb) && nb > 0 ? nb : Math.round(duration * fps);
  const transfer = v.color_transfer || "unknown";
  const primaries = v.color_primaries || "unknown";
  const hdr = ["smpte2084", "arib-std-b67"].includes(transfer) || primaries === "bt2020";
  // SDR colour tags of the source: we encode the result with the SAME tags,
  // and convert the RGBA overlay with the SAME matrix → source pixels never change.
  let matrix = v.color_space && v.color_space !== "unknown" ? v.color_space : height >= 720 || width >= 720 ? "bt709" : "smpte170m";
  if (matrix === "bt470bg") matrix = "smpte170m";
  const range = v.color_range === "pc" || /^yuvj/.test(v.pix_fmt || "") ? "pc" : "tv";
  return {
    file,
    width, height, rotation: rot,
    fps, fpsStr, vfr: Number.isFinite(avg) && Math.abs(avg - fps) / fps > 0.01,
    duration, durationInFrames,
    pixFmt: v.pix_fmt, codec: v.codec_name,
    color: { matrix, range, transfer, primaries, hdr },
    audio: a ? { codec: a.codec_name, channels: a.channels, sampleRate: Number(a.sample_rate) } : null,
  };
};
export const scaleMatrix = (m) => (m === "bt709" ? "bt709" : m === "smpte240m" ? "smpte240m" : "bt601");
export const colorTags = (c) => {
  const m = c.matrix === "bt709" ? "bt709" : c.matrix;
  const prim = c.primaries !== "unknown" && !c.hdr ? c.primaries : m === "bt709" ? "bt709" : "smpte170m";
  const trc = c.transfer !== "unknown" && !c.hdr ? c.transfer : m === "bt709" ? "bt709" : "smpte170m";
  return ["-colorspace", m, "-color_primaries", prim, "-color_trc", trc, "-color_range", c.range];
};

// filter_complex that lays the transparent overlay (input 1) on the source (input 0).
// The source is only re-encoded, never colour-converted (except full-range → TV-range, done exactly).
// The overlay's RGBA → YUV conversion uses the source's own matrix and range.
export const overlayGraph = (info) => {
  const m = scaleMatrix(info.color.matrix);
  const base = info.color.range === "pc" ? `[0:v]scale=in_range=pc:out_range=tv,format=yuv420p[b]` : `[0:v]format=yuv420p[b]`;
  return (
    `${base};` +
    `[1:v]format=rgba,scale=${info.width}:${info.height}:force_original_aspect_ratio=decrease:out_color_matrix=${m}:out_range=tv,format=yuva420p[ov];` +
    `[b][ov]overlay=(W-w)/2:(H-h)/2:format=yuv420:eof_action=pass[v]`
  );
};
export const outputTags = (info) => colorTags({ ...info.color, range: "tv" });

/* ------------------------------------------------------------------ models */
const REL = "https://github.com/k2-fsa/sherpa-onnx/releases/download/asr-models";
export const MODEL_DEFS = {
  vad: { kind: "file", url: `${REL}/silero_vad.onnx`, file: "silero_vad.onnx", size: "0.6 MB" },
  ru: {
    kind: "tar",
    name: "GigaAM v2 (Russian)",
    url: `${REL}/sherpa-onnx-nemo-transducer-giga-am-v2-russian-2025-04-19.tar.bz2`,
    dir: "sherpa-onnx-nemo-transducer-giga-am-v2-russian-2025-04-19",
    files: { encoder: "encoder.int8.onnx", decoder: "decoder.onnx", joiner: "joiner.onnx", tokens: "tokens.txt" },
    size: "~170 MB",
  },
  multi: {
    kind: "tar",
    name: "Parakeet TDT 0.6B v3 (English + 24 European languages)",
    url: `${REL}/sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8.tar.bz2`,
    dir: "sherpa-onnx-nemo-parakeet-tdt-0.6b-v3-int8",
    files: { encoder: "encoder.int8.onnx", decoder: "decoder.int8.onnx", joiner: "joiner.int8.onnx", tokens: "tokens.txt" },
    size: "~490 MB",
  },
};
export const modelReady = (key) => {
  const d = MODEL_DEFS[key];
  if (d.kind === "file") return fs.existsSync(path.join(MODELS, d.file));
  return Object.values(d.files).every((f) => fs.existsSync(path.join(MODELS, d.dir, f)));
};

const hasCmd = (cmd) => !spawnSync(cmd, ["--version"], { stdio: "ignore" }).error;

const download = async (url, dest) => {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = dest + ".part";
  if (hasCmd("curl")) {
    // curl ships with macOS and Windows 10+; it respects system proxies and resumes.
    const r = spawnSync("curl", ["-fL", "--progress-bar", "--retry", "3", "-C", "-", "-o", tmp, url], { stdio: "inherit" });
    if (r.status === 0) return fs.renameSync(tmp, dest);
    log("curl failed, falling back to built-in download…");
  }
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok || !res.body) die(`download failed (${res.status}): ${url}`);
  const total = Number(res.headers.get("content-length")) || 0;
  const out = fs.createWriteStream(tmp);
  let got = 0, shown = -1;
  for await (const chunk of res.body) {
    out.write(chunk);
    got += chunk.length;
    const pct = total ? Math.floor((got / total) * 100) : -1;
    if (pct >= 0 && pct % 10 === 0 && pct !== shown) { shown = pct; log(`  ${pct}%`); }
  }
  await new Promise((r) => out.end(r));
  fs.renameSync(tmp, dest);
};

const extractTarBz2 = async (file, dir) => {
  // System tar handles .tar.bz2 on macOS, Linux and Windows 10+ (bsdtar).
  const r = spawnSync("tar", ["-xjf", file, "-C", dir], { stdio: "inherit" });
  if (r.status === 0) return;
  log("system tar failed, extracting with JS (slower)…");
  const bz = req("unbzip2-stream");
  const tar = req("tar");
  await new Promise((resolve, reject) => {
    fs.createReadStream(file).pipe(bz()).pipe(tar.x({ cwd: dir })).on("finish", resolve).on("error", reject);
  });
};

export const ensureModel = async (key) => {
  const d = MODEL_DEFS[key];
  if (modelReady(key)) return;
  log(`downloading model ${d.name ?? key} (${d.size}) — one time only…`);
  fs.mkdirSync(MODELS, { recursive: true });
  if (d.kind === "file") return download(d.url, path.join(MODELS, d.file));
  const arc = path.join(MODELS, path.basename(d.url));
  if (!fs.existsSync(arc)) await download(d.url, arc);
  await extractTarBz2(arc, MODELS);
  if (!modelReady(key)) die(`model ${key} extracted but files are missing in ${path.join(MODELS, d.dir)}`);
  fs.rmSync(arc, { force: true });
  log(`model ${key} ready`);
};

/* ------------------------------------------------------------------ remotion */
// Remotion downloads its own Chrome Headless Shell. If that is blocked, we fall back to an
// installed Chrome/Chromium (saved by doctor.mjs into ~/.reel-subs/browser.txt) or $REELS_BROWSER.
const BROWSER_FILE = path.join(HOME, "browser.txt");
export const browserExecutable = () => {
  if (process.env.REELS_BROWSER) return process.env.REELS_BROWSER;
  if (fs.existsSync(BROWSER_FILE)) {
    const p = fs.readFileSync(BROWSER_FILE, "utf8").trim();
    if (p && fs.existsSync(p)) return p;
  }
  return null;
};
export const saveBrowser = (p) => fs.writeFileSync(BROWSER_FILE, p);
export const systemChromeCandidates = () => {
  const L = process.env.LOCALAPPDATA || "";
  return [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
    path.join(L, "Google\\Chrome\\Application\\chrome.exe"),
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser",
  ].filter((p) => p && fs.existsSync(p));
};

const newestMtime = (dir) => {
  let m = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    m = Math.max(m, e.isDirectory() ? newestMtime(p) : fs.statSync(p).mtimeMs);
  }
  return m;
};
// Bundle once, reuse until src/ changes (agents may add their own components).
export const getServeUrl = async () => {
  const out = path.join(ENGINE, ".bundle");
  const stamp = path.join(out, "index.html");
  if (fs.existsSync(stamp) && fs.statSync(stamp).mtimeMs > newestMtime(path.join(ENGINE, "src"))) return out;
  log("bundling the Remotion project…");
  const { bundle } = req("@remotion/bundler");
  fs.rmSync(out, { recursive: true, force: true });
  return bundle({ entryPoint: path.join(ENGINE, "src", "index.ts"), outDir: out, onProgress: () => undefined });
};

/* ------------------------------------------------------------------ edit.json */
export const readEdit = (p) => {
  p = p ? abs(p) : p;
  if (!p || !fs.existsSync(p)) die(`edit.json not found: ${p}`);
  let e;
  try { e = JSON.parse(fs.readFileSync(p, "utf8")); } catch (err) { die(`edit.json is not valid JSON: ${err.message}`); }
  if (!e.source || !e.video) die("edit.json must have `source` and `video` (created by prepare.mjs)");
  e.captions ??= [];
  e.items ??= [];
  return e;
};
export const workDirFor = (edit, editPath) => path.dirname(path.resolve(editPath));
export const parseTimes = (s) => String(s).split(",").map((x) => Number(x.trim())).filter((x) => Number.isFinite(x));
