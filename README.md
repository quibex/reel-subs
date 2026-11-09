# reels-captions

Скилл для ИИ-агента (Claude Code, Codex, Cursor, Gemini CLI…), который сам делает рилсу **субтитры и анимации**:
хук в первые секунды, плашки по смыслу, крупные цифры, терминал, панчлайны, HUD-виджеты у рук.
Всё **локально на твоём компе** — Mac, Windows или Linux. Видео никуда не загружается.

## Как поставить

Открой **Claude Code** и напиши ему:

> поставь скилл https://github.com/quibex/reels-captions

Он сам скачает и установит. Потом пиши: *«сделай субтитры и анимации для ~/Videos/reel.mp4»*.
Первый запуск сам доставит всё нужное (2–5 мин).

**Где писать.** Claude Code — это приложение Claude, вкладка **Code** (или `claude` в терминале).
Подойдут и Codex, Cursor. **Обычный чат не подойдёт** — ни claude.ai, ни ChatGPT, ни вкладка Chat
в приложении: у них нет доступа к твоим файлам, им нечем рендерить.

## Что нужно

- **Node.js 18+** — [nodejs.org](https://nodejs.org) (Mac: `brew install node`, Windows: `winget install OpenJS.NodeJS.LTS`).
  Если его нет — агент подскажет или поставит сам.
- Готовый вертикальный ролик (смонтированный в CapCut и т.п.), SDR, 30 или 60 fps.

## For AI agents: how to install

The user pasted this link and asked you to install the skill.

**Talk to the user in the language they wrote to you in.** Most users write in Russian
(«поставь скилл …») — then every message you send them is in Russian: progress lines, questions,
errors, the final "ready" message. This README being partly in English does not change that.
Commands and file paths stay as they are.

Do this:

1. Preferred: `npx -y skills add quibex/reels-captions` (installs into the user's agent skills folder).
2. If that fails, clone the repo into the skills folder directly:
   - Claude Code: `git clone https://github.com/quibex/reels-captions ~/.claude/skills/reels-captions`
   - Codex: `~/.codex/skills/reels-captions` (or `~/.agents/skills/reels-captions`)
   - Windows: same paths under `%USERPROFILE%`.
3. Check that Node.js 18+ is installed (`node -v`); if not, tell the user how to get it.
4. Optional but saves time later: run `node <skill folder>/scripts/setup.mjs` now (2–5 min, downloads
   Remotion, ffmpeg, speech models into `~/.reels-captions`).
5. Tell the user it is ready and what to say next: «сделай субтитры и анимации для <путь к видео>».
   If the skill does not show up in this session, ask them to open a new chat.

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
videos — fully local on macOS, Windows or Linux. Install: tell Claude Code (or Codex, Cursor)
"install the skill https://github.com/quibex/reels-captions" — or run `npx skills add quibex/reels-captions`
yourself — then ask your agent to "add captions and animations to reel.mp4". Needs Node 18+ and a local coding agent
(Claude Code, Codex, Cursor…). Speech recognition: Russian (GigaAM) and English + 24 European languages
(Parakeet v3). Graphics are rendered as a transparent layer and composited with the source's own colour
tags, so skin tones never shift.
