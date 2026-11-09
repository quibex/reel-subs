# edit.json reference

One file per video, created by `prepare.mjs` in `<video>.reels/edit.json`. You edit `captions`,
`items`, `style`, `captionsOff`. Times are **seconds of the source video** (captions use ms).
Layout coordinates are on a **1080×1920** canvas (scaled to the real video at compositing).

```jsonc
{
  "source": "/abs/path/video.mp4",          // set by prepare — don't change
  "output": "/abs/path/video_final.mp4",    // where render writes
  "audio": null,                            // or a cleaned voice track to use in the final video
  "video": { "width": 1080, "height": 1920, "fps": 30, "durationInFrames": 1650 }, // set by prepare
  "style": {
    "accent": "#2DD4BF",     // chips, labels, corners, *accent* words
    "captionSize": 52,       // px
    "captionTop": 1420,      // px from the top; lower it (e.g. 1500) if captions cover gestures
    "captionWeight": 600,
    "font": "Onest",         // bundled: Onest (Latin + Cyrillic). Mono: Martian Mono
    "mono": "Martian Mono"
  },
  "captions": [ { "startMs": 2600, "endMs": 4500, "text": "Субтитры я делаю *кодом*" } ],
  "captionsOff": [[48.2, 52.0]],             // extra ranges with captions hidden (hook/punch are automatic)
  "items": [ /* see below */ ]
}
```

## Layout cheat-sheet

| zone | `top` | when |
|---|---|---|
| upper third (default for cards) | 260 | face is in the middle/lower part |
| low | 1110 | face is in the upper half of the frame |
| hook (default) | 1230 | first seconds; go 1300–1440 if something important is at 1230 |
| captions | 1420 | `style.captionTop` |

Cards are 840 px wide, centred (120 px safe margin on both sides). Pops are positioned by
their centre `x`, `y` — keep `x` within 220…860.

## Items

### hook
```json
{ "type": "hook", "from": 0, "to": 3.2, "text": "Друг сказал, что мой продукт — говно" }
```
White bold text on a black plate. Short (≤ ~45 chars → 1–2 lines). Use U+2011 (non-breaking hyphen)
inside hyphenated words so they don't break: `ИИ‑видео`.

### card
```json
{
  "type": "card", "from": 5.1, "to": 10.4, "label": "как работает", "title": "Идея → готовый ролик",
  "sub": "optional one-line subtitle",
  "chips": [
    { "text": "идея", "at": 5.6 },
    { "text": "сценарий", "at": 6.3, "check": true },
    { "text": "монтаж руками", "at": 7.0, "strikeAt": 7.6 },
    { "text": "MP4", "at": 8.2, "on": true }
  ],
  "top": 260
}
```
`label` / `title` / `sub` / `chips` are all optional — use what fits. `at` = when a chip appears;
put it on the word it illustrates (from `words.json`), ~0.1 s early.

### big
```json
{ "type": "big", "from": 22.9, "to": 25.0, "label": "цена ролика", "value": "$1" }
```
Huge value (auto-sized to fit, or `size`). For one number/word the speaker stresses.

### terminal
```json
{
  "type": "terminal", "from": 30, "to": 36, "file": "agents.log",
  "lines": [
    { "at": 30.3, "text": "собрать баги", "tone": "cmd" },
    { "at": 31.8, "text": "запуск: agent-1, agent-2", "tone": "cmd" },
    { "at": 33.2, "text": "✓ работают всю ночь", "tone": "ok" }
  ]
}
```
Typewriter lines. `tone`: `cmd` (with `>` prompt), `ok` (accent), `dim`.

### punch
```json
{ "type": "punch", "from": 40.2, "to": 42.6, "label": "план", "a": "лечь спать в 23:00", "b": "4 утра" }
```
`a` appears and gets crossed out at ~0.5 s, `b` lands at ~0.85 s. Without `a` it's just a big line.

### pop
```json
{ "type": "pop", "from": 14.7, "to": 17.0, "widget": "ring", "x": 300, "y": 900, "label": "render" }
```
`widget`: `ring` (progress ring, `value` overrides the %), `chart` (rising bars), `progress`
(bar), `check` (big ✓), `code` (`value` = text, default `<Motion />`). Snaps in within 2 frames.
Several pops around the hands = the "chik-chik" effect. Start them ~0.3 s before the word.

### badge
```json
{ "type": "badge", "text": "#день12", "from": 0 }
```
Top-left tag; `to` defaults to the end of the video.

## Minimal complete example

```json
{
  "source": "C:\\Users\\me\\Videos\\reel.mp4",
  "output": "C:\\Users\\me\\Videos\\reel_final.mp4",
  "audio": null,
  "video": { "width": 1080, "height": 1920, "fps": 30, "durationInFrames": 900 },
  "style": {},
  "captions": [
    { "startMs": 3100, "endMs": 5200, "text": "Я сделал сервис за выходные" },
    { "startMs": 5200, "endMs": 7400, "text": "и он уже приносит *$1* с ролика" }
  ],
  "captionsOff": [],
  "items": [
    { "type": "hook", "from": 0, "to": 3.0, "text": "Сервис за выходные" },
    { "type": "card", "from": 3.1, "to": 7.5, "label": "проект", "title": "ReelPipe",
      "chips": [ { "text": "идея", "at": 3.4 }, { "text": "MP4", "at": 4.2, "on": true } ] },
    { "type": "big", "from": 7.6, "to": 9.4, "label": "за ролик", "value": "$1" }
  ]
}
```
