// prepare.mjs <video> [--lang ru|multi] [--audio clean.wav] [--work dir] [--force]
//
// 1. probes the video (size, fps, colour tags, HDR check)
// 2. extracts 16 kHz mono speech and recognises it LOCALLY (sherpa-onnx; nothing leaves the computer)
// 3. writes into the work dir:
//      words.json       every word with start/end (s)
//      transcript.txt   phrases with timecodes — read this to plan the edit
//      edit.json        draft: auto caption pages, no graphics yet (not overwritten unless --force)
import fs from "node:fs";
import path from "node:path";
import { MODELS, MODEL_DEFS, abs, die, ensureModel, ffmpeg, log, parseArgs, probe, req } from "./lib.mjs";

const { pos, opt } = parseArgs();
const video = pos[0];
if (!video) die("usage: node prepare.mjs <video> [--lang ru|multi] [--audio clean.wav] [--work dir] [--force]");
const lang = opt.lang === "multi" || opt.lang === "en" ? "multi" : "ru";
const src = abs(video);
const info = probe(src);

if (info.color.hdr && !opt["allow-hdr"]) {
  die(
    `this video is HDR (${info.color.transfer}). Overlaying graphics on HDR shifts colours on most phones.\n` +
      `Export it as SDR (CapCut: Export → turn HDR off; iPhone: Settings → Camera → Formats → HDR off) and run again,\n` +
      `or pass --allow-hdr to continue anyway.`,
  );
}
if (info.vfr) log(`warning: variable frame rate (${info.fpsStr} nominal). Export from your editor at a constant 30/60 fps for perfect sync.`);
const aspect = info.width / info.height;
if (Math.abs(aspect - 9 / 16) > 0.02) log(`warning: ${info.width}×${info.height} is not 9:16 — graphics are laid out for vertical reels.`);

const base = path.basename(src, path.extname(src));
const work = abs(opt.work || path.join(path.dirname(src), `${base}.reels`));
fs.mkdirSync(work, { recursive: true });
const audioSrc = opt.audio ? abs(opt.audio) : src;
if (!info.audio && !opt.audio) die("the video has no audio track — nothing to transcribe (pass --audio voice.wav)");

/* ---------------------------------------------------------------- models */
await ensureModel("vad");
await ensureModel(lang);
const M = MODEL_DEFS[lang];
const mdir = path.join(MODELS, M.dir);

/* ---------------------------------------------------------------- audio */
const wav = path.join(work, "speech16k.wav");
log("extracting audio…");
ffmpeg(["-i", audioSrc, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav]);

/* ---------------------------------------------------------------- ASR */
const sherpa = req("sherpa-onnx-node");
const w = sherpa.readWave(wav);
const SR = w.sampleRate;
const vad = new sherpa.Vad(
  {
    sileroVad: {
      model: path.join(MODELS, MODEL_DEFS.vad.file),
      threshold: 0.45, minSilenceDuration: 0.25, minSpeechDuration: 0.2, maxSpeechDuration: 15, windowSize: 512,
    },
    sampleRate: SR, numThreads: 1, debug: false,
  },
  120,
);
const segs = [];
const drain = () => {
  while (!vad.isEmpty()) {
    const s = vad.front(false);
    segs.push({ start: s.start / SR, samples: Float32Array.from(s.samples) });
    vad.pop();
  }
};
for (let i = 0; i < w.samples.length; i += 512) {
  vad.acceptWaveform(w.samples.subarray(i, i + 512));
  drain();
}
vad.flush();
drain();
log(`speech segments: ${segs.length}`);

const rec = new sherpa.OfflineRecognizer({
  featConfig: { sampleRate: 16000, featureDim: lang === "ru" ? 64 : 128 },
  modelConfig: {
    transducer: { encoder: path.join(mdir, M.files.encoder), decoder: path.join(mdir, M.files.decoder), joiner: path.join(mdir, M.files.joiner) },
    tokens: path.join(mdir, M.files.tokens),
    modelType: "nemo_transducer",
    numThreads: 4,
    debug: false,
  },
  decodingMethod: "greedy_search",
});

const words = [];
const lines = [];
for (const seg of segs) {
  const st = rec.createStream();
  st.acceptWaveform({ samples: seg.samples, sampleRate: SR });
  rec.decode(st);
  const r = rec.getResult(st);
  const text = (r.text || "").trim();
  if (!text) continue;
  const segEnd = seg.start + seg.samples.length / SR;
  lines.push({ start: seg.start, end: segEnd, text });
  // Tokens → words. GigaAM: characters, " " = word break. Parakeet: BPE pieces, a leading space/▁ starts a word.
  let cur = null;
  const close = () => { if (cur && cur.w.trim()) words.push(cur); cur = null; };
  (r.tokens || []).forEach((tok, i) => {
    const ts = seg.start + (r.timestamps?.[i] ?? 0);
    if (tok === " " || tok === "▁") return close();
    const starts = /^[ ▁]/.test(tok);
    const piece = tok.replace(/^[ ▁]+/, "");
    if (starts) close();
    if (!cur) cur = { w: "", start: ts, last: ts };
    cur.w += piece;
    cur.last = ts;
  });
  close();
  words.forEach((wd) => { if (wd.segEnd === undefined && wd.last !== undefined) wd.segEnd = segEnd; });
}
for (let i = 0; i < words.length; i++) {
  const wd = words[i];
  const next = words[i + 1];
  const cap = Math.min(wd.last + 0.3, wd.segEnd);
  wd.end = Math.max(wd.start + 0.08, next ? Math.min(next.start, cap) : cap);
  wd.start = +wd.start.toFixed(3);
  wd.end = +wd.end.toFixed(3);
  delete wd.last;
  delete wd.segEnd;
}
if (!words.length) log("warning: no speech recognised — check the language (--lang) or the audio.");

/* ---------------------------------------------------------------- caption pages */
// Phrase pages: break on a pause, at ~32 characters or ~2.3 s. The agent then fixes words by hand.
let pages = [];
let pg = null;
const len = (ws) => ws.map((x) => x.w).join(" ").length;
for (const wd of words) {
  const last = pg?.[pg.length - 1];
  if (pg && (wd.start - last.end > 0.4 || len([...pg, wd]) > 32 || wd.end - pg[0].start > 2.3)) { pages.push(pg); pg = null; }
  (pg ??= []).push(wd);
}
if (pg) pages.push(pg);
// don't leave a short word ("с", "и", "на", "the", "a") dangling at the end of a page
for (let i = 0; i < pages.length - 1; i++) {
  const p = pages[i], n = pages[i + 1];
  if (p.length > 1 && p[p.length - 1].w.length <= 2 && n[0].start - p[p.length - 1].end < 0.3) n.unshift(p.pop());
}
// fold one-word orphans into the previous page when it still fits
pages = pages.reduce((acc, p) => {
  const prev = acc[acc.length - 1];
  if (prev && p.length === 1 && p[0].start - prev[prev.length - 1].end < 0.3 && len([...prev, ...p]) <= 40) prev.push(...p);
  else acc.push(p);
  return acc;
}, []);
const captions = pages.map((p, i) => {
  const next = pages[i + 1];
  const endS = p[p.length - 1].end;
  const end = next && next[0].start - endS < 0.35 ? next[0].start : endS + 0.25;
  return { startMs: Math.round(p[0].start * 1000), endMs: Math.round(end * 1000), text: p.map((x) => x.w).join(" ") };
});

/* ---------------------------------------------------------------- write */
const fmt = (s) => s.toFixed(2).padStart(6, " ");
fs.writeFileSync(path.join(work, "words.json"), JSON.stringify(words, null, 0));
fs.writeFileSync(path.join(work, "transcript.txt"), lines.map((l) => `[${fmt(l.start)} – ${fmt(l.end)}] ${l.text}`).join("\n") + "\n");
fs.writeFileSync(path.join(work, "probe.json"), JSON.stringify(info, null, 2));

const editPath = path.join(work, "edit.json");
if (fs.existsSync(editPath) && !opt.force) {
  log(`edit.json already exists — kept it (use --force to regenerate). New captions draft: captions.auto.json`);
  fs.writeFileSync(path.join(work, "captions.auto.json"), JSON.stringify(captions, null, 1));
} else {
  const edit = {
    source: src,
    output: path.join(path.dirname(src), `${base}_final.mp4`),
    audio: opt.audio ? abs(opt.audio) : null,
    video: { width: info.width, height: info.height, fps: info.fps, durationInFrames: info.durationInFrames },
    style: {},
    captions,
    captionsOff: [],
    items: [],
  };
  fs.writeFileSync(editPath, JSON.stringify(edit, null, 1));
}

log(`done: ${info.width}×${info.height} @ ${info.fps.toFixed(3)} fps, ${info.duration.toFixed(1)} s, ${words.length} words, ${captions.length} caption pages`);
log(`work dir: ${work}`);
log(`next: read transcript.txt, fill edit.json (captions + items), then preview.mjs / render.mjs`);
