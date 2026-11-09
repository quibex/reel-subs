// render.mjs <work/edit.json> [--out file.mp4] [--concurrency N] [--crf 17] [--preset veryfast]
//
// 1. Remotion renders ONLY the graphics, as transparent PNGs (no video inside Remotion).
// 2. ffmpeg lays them over the untouched source with the source's own colour tags.
// Why: when Remotion re-encodes the whole video, the colour matrix/range changes and skin tones shift.
import fs from "node:fs";
import path from "node:path";
import { abs, browserExecutable, die, ffmpeg, getServeUrl, log, outputTags, overlayGraph, parseArgs, probe, readEdit, req, ffprobeBin, run } from "./lib.mjs";

const { pos, opt } = parseArgs();
if (!pos[0]) die("usage: node render.mjs <work/edit.json> [--out file.mp4]");
const editPath = abs(pos[0]);
const edit = readEdit(editPath);
const work = path.dirname(editPath);
const info = probe(edit.source);
const out = abs(opt.out || edit.output || path.join(path.dirname(edit.source), "final.mp4"));
if (out === path.resolve(edit.source)) die("output would overwrite the source — set a different `output`.");

// keep timing in sync with the actual file even if edit.json is stale
edit.video = { ...edit.video, width: info.width, height: info.height, fps: info.fps, durationInFrames: info.durationInFrames };

const { selectComposition, renderFrames } = req("@remotion/renderer");
const serveUrl = await getServeUrl();
const be = browserExecutable();
const composition = await selectComposition({ serveUrl, id: "Overlay", inputProps: edit, browserExecutable: be });

const frames = path.join(work, "frames");
fs.rmSync(frames, { recursive: true, force: true });
fs.mkdirSync(frames, { recursive: true });
const N = composition.durationInFrames;
log(`rendering ${N} overlay frames (${(N / info.fps).toFixed(1)} s)…`);
const t0 = Date.now();
let shown = -1;
await renderFrames({
  composition, serveUrl, inputProps: edit, outputDir: frames, imageFormat: "png",
  imageSequencePattern: "f-[frame].[ext]",
  concurrency: opt.concurrency ? Number(opt.concurrency) : null,
  browserExecutable: be,
  onStart: () => undefined,
  onFrameUpdate: (done) => {
    const p = Math.floor((done / N) * 10) * 10;
    if (p !== shown) { shown = p; log(`  overlay ${p}%`); }
  },
});
log(`overlay done in ${((Date.now() - t0) / 1000).toFixed(0)} s`);

const pngs = fs.readdirSync(frames).filter((f) => /^f-\d+\.png$/.test(f)).sort();
if (!pngs.length) die("no overlay frames were rendered");
const pad = pngs[0].match(/^f-(\d+)\.png$/)[1].length;
const start = Number(pngs[0].match(/^f-(\d+)\.png$/)[1]);

const audioFile = opt.audio ? abs(opt.audio) : edit.audio ? path.resolve(path.dirname(editPath), edit.audio) : null;
const args = ["-i", edit.source, "-framerate", info.fpsStr, "-start_number", String(start), "-i", path.join(frames, `f-%0${pad}d.png`)];
if (audioFile) args.push("-i", audioFile);
args.push("-filter_complex", overlayGraph(info), "-map", "[v]");
if (audioFile) args.push("-map", "2:a:0", "-c:a", "aac", "-b:a", "256k", "-shortest");
else if (info.audio) args.push("-map", "0:a:0?", ...(info.audio.codec === "aac" ? ["-c:a", "copy"] : ["-c:a", "aac", "-b:a", "256k"]));
args.push(
  "-c:v", "libx264", "-preset", opt.preset || "veryfast", "-crf", String(opt.crf || 17), "-pix_fmt", "yuv420p",
  ...outputTags(info), "-movflags", "+faststart", out,
);
log("compositing on the source (colour-safe)…");
ffmpeg(args);

// sanity check
const r = run(ffprobeBin(), ["-v", "error", "-count_packets", "-select_streams", "v:0", "-show_entries", "stream=nb_read_packets,width,height,color_space,color_range", "-of", "json", out]);
const s = JSON.parse(r.stdout).streams[0];
const diff = Math.abs(Number(s.nb_read_packets) - info.durationInFrames);
log(`output: ${out}`);
log(`  ${s.width}×${s.height}, ${s.nb_read_packets} frames (source ${info.durationInFrames}${diff > 2 ? " — MISMATCH, check fps" : ""}), ${s.color_space}/${s.color_range}`);
if (!opt.keep) fs.rmSync(frames, { recursive: true, force: true });
