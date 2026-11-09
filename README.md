# reels-captions

Скилл для ИИ-агента (Claude Code, Codex, Cursor, Gemini CLI…), который сам делает рилсу **субтитры и анимации**:
хук в первые секунды, плашки по смыслу, крупные цифры, терминал, панчлайны, HUD-виджеты у рук.
Всё **локально на твоём компе** — Mac, Windows или Linux. Видео никуда не загружается.

```
npx skills add quibex/reels-captions
```
Потом в агенте: *«сделай субтитры и анимации для ~/Videos/reel.mp4»*. Первый запуск сам поставит всё нужное (2–5 мин).

## Что нужно

- **Node.js 18+** — [nodejs.org](https://nodejs.org) (Mac: `brew install node`, Windows: `winget install OpenJS.NodeJS.LTS`)
- **Агент, который работает на твоём компьютере:** Claude Code, Codex CLI / приложение Codex, Cursor и т.п.
  Веб-чат (ChatGPT / claude.ai в браузере) не подойдёт — ему нечем рендерить у тебя.
- Готовый вертикальный ролик (смонтированный в CapCut и т.п.), SDR, 30 или 60 fps.

Всё остальное скилл ставит сам в `~/.reels-captions` (Remotion, ffmpeg, распознавание речи, модели, headless Chrome).

## Как это работает

```
видео ─► распознавание речи локально (sherpa-onnx: GigaAM для русского, Parakeet для EN + 24 языков)
      ─► агент пишет edit.json: субтитры по фразам + графика по таймингам слов
      ─► Remotion рендерит ТОЛЬКО прозрачный слой графики
      ─► ffmpeg накладывает слой на исходник с его же цветовыми тегами
```
Последний шаг — главная фишка: если прогнать всё видео через Remotion, он перекодирует его в другой
цветовой матрице и **съезжает цвет кожи**. Здесь исходные пиксели не трогаются.

## Установка без `npx skills`

Скопируй папку репо:
- Claude Code: `~/.claude/skills/reels-captions` (Windows: `%USERPROFILE%\.claude\skills\reels-captions`)
- Codex: `~/.codex/skills/reels-captions` или `~/.agents/skills/reels-captions`



## Ручной запуск (без агента)

```
node scripts/setup.mjs                         # один раз (--lang multi для английского и др.)
node ~/.reels-captions/engine/scripts/prepare.mjs reel.mp4
#   → reel.reels/transcript.txt, edit.json — правишь субтитры и добавляешь items
node ~/.reels-captions/engine/scripts/preview.mjs reel.reels/edit.json
node ~/.reels-captions/engine/scripts/render.mjs reel.reels/edit.json
```
Формат `edit.json` — [reference/edit-schema.md](reference/edit-schema.md).

## Лицензии

Код — MIT. [Remotion](https://www.remotion.dev/license) бесплатен для физлиц и компаний до 3 человек,
дальше нужна их лицензия. Модели распознавания качаются с релизов
[k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx) под лицензиями авторов (GigaAM, NVIDIA Parakeet).
Шрифты Onest и Martian Mono — OFL.

---

### English

An agent skill that adds phrase-by-phrase captions and clean motion graphics to vertical talking-head
videos — fully local on macOS, Windows or Linux. Install: `npx skills add quibex/reels-captions`, then ask
your agent to "add captions and animations to reel.mp4". Needs Node 18+ and a local coding agent
(Claude Code, Codex, Cursor…). Speech recognition: Russian (GigaAM) and English + 24 European languages
(Parakeet v3). Graphics are rendered as a transparent layer and composited with the source's own colour
tags, so skin tones never shift.
