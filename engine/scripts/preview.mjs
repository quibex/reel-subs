// preview.mjs <work/edit.json> [--at 1.2,4,9.5]
//
// Renders single frames of the finished look (source frame + overlay) so you can LOOK before the
// full render: is the face covered? does text overflow? Writes previews/at_<t>.jpg and one
// contact sheet previews/sheet.jpg. Without --at it picks a frame inside every graphic item.
import fs from "node:fs";
import path from "node:path";
import { abs, browserExecutable, die, ffmpeg, getServeUrl, log, overlayGraph, parseArgs, parseTimes, probe, readEdit, req } from "./lib.mjs";

const { pos, opt } = parseArgs();
if (!pos[0]) die("usage: node preview.mjs <work/edit.json> [--at 1,2,3]");
const editPath = abs(pos[0]);
const edit = readEdit(editPath);
const work = path.dirname(editPath);
const info = probe(edit.source);
edit.video = { ...edit.video, width: info.width, height: info.height, fps: info.fps, durationInFrames: info.durationInFrames };
const dur = info.durationInFrames / info.fps;

let times = opt.at ? parseTimes(opt.at) : [];
if (!times.length) {
  for (const it of edit.items) {
    if (it.type === "badge") continue;
    const a = it.from ?? 0, b = it.to ?? dur;
    times.push(Math.min(b - 0.05, a + Math.max(0.6, (b - a) * 0.6)));
  }
  for (const c of edit.captions.filter((_, i) => i % 6 === 2)) times.push((c.startMs + c.endMs) / 2000);
}
times = [...new Set(times.map((t) => +Math.max(0, Math.min(dur - 0.05, t)).toFixed(2)))].sort((a, b) => a - b).slice(0, 16);
if (!times.length) die("nothing to preview — pass --at 1,2,3");

const { openBrowser, selectComposition, renderStill } = req("@remotion/renderer");
const serveUrl = await getServeUrl();
const be = browserExecutable();
const browser = await openBrowser("chrome", { browserExecutable: be });
const composition = await selectComposition({ serveUrl, id: "Overlay", inputProps: edit, puppeteerInstance: browser, browserExecutable: be });

const dir = path.join(work, "previews");
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const outs = [];
for (const [i, t] of times.entries()) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(t * info.fps));
  const ov = path.join(dir, `ov_${i}.png`);
  await renderStill({ composition, serveUrl, inputProps: edit, output: ov, frame, imageFormat: "png", puppeteerInstance: browser });
  const jpg = path.join(dir, `at_${t.toFixed(2)}.jpg`);
  ffmpeg(["-ss", String(frame / info.fps), "-i", edit.source, "-i", ov, "-filter_complex", overlayGraph(info), "-map", "[v]", "-frames:v", "1", "-q:v", "3", jpg]);
  fs.copyFileSync(jpg, path.join(dir, `seq_${String(i).padStart(3, "0")}.jpg`));
  fs.rmSync(ov);
  outs.push(jpg);
}
await browser.close({ silent: true });

const cols = Math.min(4, outs.length);
const rows = Math.ceil(outs.length / cols);
ffmpeg(["-framerate", "1", "-i", path.join(dir, "seq_%03d.jpg"), "-vf", `scale=360:-2,tile=${cols}x${rows}:padding=6:color=white`, "-frames:v", "1", "-q:v", "3", path.join(dir, "sheet.jpg")]);
for (const f of fs.readdirSync(dir)) if (f.startsWith("seq_")) fs.rmSync(path.join(dir, f));
log(`previews (${times.join(", ")} s):`);
for (const o of outs) log(`  ${o}`);
log(`contact sheet: ${path.join(dir, "sheet.jpg")}  (order: left→right, top→bottom)`);
