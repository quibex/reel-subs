// doctor.mjs [--fix] [--lang ru|multi]
// Checks everything the pipeline needs. With --fix it downloads what's missing
// (speech models, headless Chrome for Remotion). Prints READY when all is good.
import { HOME, MODELS, browserExecutable, ensureModel, ffmpegBin, ffprobeBin, log, modelReady, parseArgs, req, run, saveBrowser, systemChromeCandidates } from "./lib.mjs";

const { opt } = parseArgs();
const lang = opt.lang === "multi" || opt.lang === "en" ? "multi" : "ru";
let ok = true;
const check = (name, fn) => {
  try {
    const r = fn();
    log(`✓ ${name}${r ? ` — ${r}` : ""}`);
  } catch (e) {
    ok = false;
    log(`✗ ${name} — ${e.message}`);
  }
};

const [maj] = process.versions.node.split(".").map(Number);
check("Node.js ≥ 18", () => {
  if (maj < 18) throw new Error(`found ${process.versions.node}, install Node 20+ from nodejs.org`);
  return process.versions.node;
});
check("ffmpeg", () => run(ffmpegBin(), ["-version"]).stdout.split("\n")[0]);
check("ffprobe", () => run(ffprobeBin(), ["-version"]).stdout.split("\n")[0]);
check("speech engine (sherpa-onnx)", () => `v${req("sherpa-onnx-node").version}`);
check("Remotion", () => `v${req("remotion/package.json").version}`);

if (opt.fix) {
  await ensureModel("vad");
  await ensureModel(lang);
}
check("VAD model", () => { if (!modelReady("vad")) throw new Error("missing (run with --fix)"); });
check(`ASR model (${lang})`, () => { if (!modelReady(lang)) throw new Error("missing (run with --fix)"); return MODELS; });

const { ensureBrowser } = req("@remotion/renderer");
const tryBrowser = async (be) => {
  // ensureBrowser can also reject from inside a download stream → catch that too
  let unhandled;
  const h = (e) => { unhandled = e; };
  process.on("unhandledRejection", h);
  try {
    const st = await ensureBrowser({ browserExecutable: be, logLevel: "error" });
    await new Promise((r) => setTimeout(r, 300));
    if (unhandled) throw unhandled;
    return st;
  } finally {
    process.off("unhandledRejection", h);
  }
};
let be = browserExecutable();
try {
  const st = await tryBrowser(be);
  log(`✓ headless browser — ${be ?? st?.type ?? "ok"}`);
} catch (e) {
  const cands = systemChromeCandidates();
  let fixed = false;
  for (const c of cands) {
    try {
      await tryBrowser(c);
      saveBrowser(c);
      log(`✓ headless browser — Remotion's download was blocked (${e?.message ?? e}), using installed ${c}`);
      fixed = true;
      break;
    } catch { /* try next */ }
  }
  if (!fixed) {
    ok = false;
    log(`✗ headless browser — ${e?.message ?? e}`);
    log("  Chrome Headless Shell could not be downloaded and no installed Chrome/Edge was found.");
    log("  Install Google Chrome, or set REELS_BROWSER to a Chrome/Chromium binary, then run again.");
  }
}

log(`home: ${HOME}`);
if (ok) log("READY");
else {
  log("NOT READY — fix the ✗ lines above (run setup again, or doctor.mjs --fix)");
  process.exit(1);
}
