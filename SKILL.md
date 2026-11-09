---
name: reel-subs
description: Add subtitles and motion graphics (hook, info cards, big numbers, terminal, punchlines, HUD widgets) to a vertical talking-head video for Reels / Shorts / TikTok — fully on the user's computer, no cloud. Local speech recognition (Russian, English and 24 more languages), graphics written as code with Remotion, colour-safe compositing with ffmpeg. Use when the user asks to add captions/subtitles/animations/plates/text to their reel or short video. Not for generating video from scratch.
---

# reel-subs — subtitles & animations for reels

You turn a finished talking-head cut (exported from CapCut / Premiere / phone) into a reel with
phrase-by-phrase captions and clean motion graphics. Everything runs locally on the user's machine.

**How it works:** speech → words with timings (sherpa-onnx, offline) → you write `edit.json`
(captions + graphic items) → Remotion renders ONLY a transparent graphics layer → ffmpeg lays it over
the untouched source with the source's own colour tags. Never render the whole video through Remotion:
that re-encodes with a different colour matrix and skin tones shift.

`SKILL_DIR` below = the folder containing this file. `ENGINE` = `~/.reel-subs/engine`
(on Windows `%USERPROFILE%\.reel-subs\engine`; or `$REELS_HOME/engine` if that env var is set).
All scripts are plain Node — run them with `node`, the same way on macOS, Windows and Linux.

**Talk to the user in their language.** Reply in the language the user writes to you in (usually
Russian), even though this file is in English: progress lines, questions, errors, the final summary.
Commands, paths and JSON keys stay as they are.

**Read the user's preferences first.** If `~/.reel-subs/preferences.md` exists (or
`$REELS_HOME/preferences.md`), read it before step 1 and follow it: it holds what this user asked for in
earlier sessions and it overrides the defaults in this file. See "Learning the user's taste" below.

## 0. Setup (first time, or when `doctor` says NOT READY)

```
node SKILL_DIR/scripts/setup.mjs            # Russian speech model (default)
node SKILL_DIR/scripts/setup.mjs --lang multi   # English + 24 European languages
```
Needs only Node.js 18+. If `node` is missing, tell the user to install the LTS from nodejs.org
(macOS: `brew install node` also works; Windows: `winget install OpenJS.NodeJS.LTS`) and stop.
Setup copies the engine to `ENGINE`, runs `npm install` (Remotion, ffmpeg/ffprobe binaries, sherpa-onnx),
downloads the speech model (~170 MB ru / ~490 MB multi) and headless Chrome. It is idempotent.
Takes 2–5 minutes the first time — say so in one line. It ends with `READY`.

If it prints `✗ headless browser`: Remotion's Chrome download is blocked on this network and no
installed Chrome/Edge was found → ask the user to install Google Chrome, then rerun setup.

## 1. Prepare

```
node ENGINE/scripts/prepare.mjs "<video>" [--lang ru|multi] [--audio clean_voice.wav]
```
- `--lang`: `ru` (GigaAM, best for Russian) or `multi` (English, German, Spanish, French, Ukrainian…).
  Pick by the language spoken in the video; ask only if unclear. Missing models download automatically.
- `--audio`: if the user has a cleaned voice track (Auphonic, Adobe Podcast…), use it — better
  recognition, and render puts it into the final video.
- Creates `<video name>.reels/` next to the video: `transcript.txt`, `words.json`, `edit.json` (draft).
- Stops on HDR video with an explanation (overlaying on HDR shifts colours) — relay it to the user.

## 2. Understand the video

1. Read `transcript.txt` (phrases with timecodes) and skim `words.json` for exact word times.
2. Look at the frames: `node ENGINE/scripts/look.mjs "<video>" --every 1` → open the sheet image.
   Note where the face is (top / middle), where hands gesture, where a screen / product is shown,
   where cuts happen. For a long video, sheet it in parts (`--from 0 --to 30`).

## 3. Fix the captions (`edit.json` → `captions`)

The draft pages are already split by phrase (~2 s, ≤ 32 chars). Your job:
- Fix recognition mistakes: product names, English terms, numbers (`четыре бакса` → `$4`),
  brand spellings. Recognition has no punctuation — add only what helps reading, mostly none.
- Keep the speaker's own words and language; do not translate unless asked.
- Merge/split pages so each is one natural phrase. Keep `startMs`/`endMs` aligned to `words.json`.
- Markup inside caption text: `*word*` → accent colour (rarely, for the key word), `~word~` → red
  (a slip of the tongue the speaker jokes about).
- List words you were unsure about in your final message instead of guessing silently.

## 4. Plan the graphics (`edit.json` → `items`)

Full field reference with examples: `SKILL_DIR/reference/edit-schema.md` — read it before writing items.

- **hook** — the first 2–4 s, until the first cut or joke: the essence of the video in one short line,
  in the speaker's language. Captions hide automatically while it's on.
- **card** — a key point: `label` (small caps) + `title` and/or `chips` that appear on the words
  they illustrate (`at`), `on: true` for the result chip, `strikeAt` to cross something out.
- **big** — a number or one word the speaker emphasises ("$1", "5000").
- **terminal** — only when talking about code, agents, commands.
- **punch** — a joke / self-irony: `a` gets crossed out, `b` lands big. Captions hide automatically.
- **pop** — small HUD widgets that snap in next to the hands when the speaker gestures
  ("and these animations go…"). Place them **~0.3 s before** the word: recognised timings lag.
- **badge** — a persistent tag top-left (episode number etc.), only if the user wants one.

Rules:
- **Never cover the face.** Cards default to the upper third (`top: 260`). If the face is in the upper
  half of the frame, use `top: 1110` (low). Also don't cover what the speaker is pointing at.
- Everything stays inside the safe zone (cards are 840 px wide, centred) — don't move things to the edges.
- Density: one graphic per 5–10 s on average, timed to the words. No captions-in-a-box that repeat
  what is being said, no explaining the obvious, no bouncy/childish motion.
- First mention of a product/project: the card should say what it is in a few words — viewers are new.
- Times are seconds in the source video. Items may overlap captions; hook/punch hide them.
- Don't invent facts: chips and cards say exactly what the speaker says.

## 5. Preview — always look before the full render

```
node ENGINE/scripts/preview.mjs "<work>/edit.json"            # a frame inside every item
node ENGINE/scripts/preview.mjs "<work>/edit.json" --at 1.2,7,15
```
Open `previews/sheet.jpg` (and single `at_<t>.jpg` when needed). Check: face clear, text fits,
nothing hits the edges, captions readable. Fix `edit.json` and preview again. ~10–30 s per run.

## 6. Render

```
node ENGINE/scripts/render.mjs "<work>/edit.json" [--out file.mp4]
```
~1–4 min per minute of video. Output defaults to `<video name>_final.mp4` next to the source.
It prints the output frame count vs the source — if it says MISMATCH, tell the user.
Then give the user: the output path, a 2–3 line summary of what you added, doubtful words.

## Revisions

Edit `edit.json` → preview the changed moments → render again. Never re-run `prepare.mjs --force`
after the user approved captions (it would reset them). Copy `edit.json` before big changes.

## Learning the user's taste

The skill should get better for this user every time. Their notes live in
`~/.reel-subs/preferences.md` (`$REELS_HOME/preferences.md` if set) — outside the skill folder and
outside `ENGINE`, so updating the skill or re-running setup never wipes them.

When to offer saving:
- The user corrects the same kind of thing twice (font, colours, caption size or position, how much
  graphics, hook wording, which words get the accent…).
- The user says something like «запомни», «в следующий раз делай так», «мне так больше нравится».
- At the end of a session with revisions: list the corrections in 2–4 short lines and ask once
  whether to save them for next time.

How:
- Always ask first, show exactly what you will write, write only after a yes. Never save on your own.
- Write rules, not history: «Шрифт подписей крупнее: captionSize 60», «Хук без эмодзи»,
  «Не больше одной плашки на 10 с». Group them under short headings (Style, Captions, Graphics,
  Wording). Update or remove an old rule instead of adding a contradicting one.
- Style values that `edit.json` → `style` supports go in as exact values, so you can copy them into
  every new `edit.json`.
- If a wish needs a code change (a new font, a new animation, a different card look), make it in
  `ENGINE/src/` and also record it under **Engine changes** in `preferences.md`: which file, what
  changed, why. Setup copies the engine again and overwrites edited files (new files survive), so
  after any setup run check this list and re-apply what is missing.
- The user can also edit `preferences.md` by hand or just tell you what to change in it.

## Customising

- Colours / sizes: `edit.json` → `style` (`accent`, `captionSize`, `captionTop`, `font`).
- New kinds of graphics: add a component in `ENGINE/src/components/`, a type in `src/types.ts`
  and a case in `src/Overlay.tsx` — the bundle rebuilds automatically on the next preview.
  Keep the layer transparent (no background, no video inside Remotion).
- `npm run studio` inside `ENGINE` opens Remotion Studio for live tweaking.

## Troubleshooting

- `doctor`: `node ENGINE/scripts/doctor.mjs` — prints ✓/✗ for every dependency.
- Variable frame rate warning → ask the user to export at constant 30 or 60 fps.
- Not 9:16 → graphics are laid out for vertical video; they're scaled to fit, but say so.
- Windows: use the same commands; quote paths with spaces. PowerShell and cmd both work.
- Native speech engine blocked (Windows Smart App Control, antivirus): nothing to do — `prepare.mjs`
  switches to the WASM build by itself and says so. It is single-threaded, ~5× slower (still well under
  a minute per minute of video), and the words are nearly identical. Don't ask the user to turn
  Smart App Control off. Force a build with `--asr native|wasm` or `REELS_ASR=native|wasm`.
- Nothing is uploaded anywhere: models and Chrome are downloaded once, then it all runs offline.
