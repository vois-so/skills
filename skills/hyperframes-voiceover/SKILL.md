---
name: hyperframes-voiceover
description: Adds a scene-timed voiceover to a HyperFrames composition with Vois Studio, on the user's computer. It reads the narration from SCRIPT.md (or a scenes.json list) and renders one WAV for each line into assets/voiceover/ with vois-cli. Then it measures each take and writes a timing manifest and the audio clips for index.html, with start and length attributes. It also writes one narration track for hyperframes transcribe, and approximate word times and SRT captions. Use when the user asks to "voice this HyperFrames video", "add narration to my composition", "make the voiceover from SCRIPT.md" or "time the scenes to the voice". Also use it for a voice that does not come from a cloud account. A Vois Studio plan with CLI file output is necessary, for example Pro. For directions in plain words, use Omni or Craft on Pro.
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, Node.js 18+, and a HyperFrames project (npx hyperframes).
metadata:
  author: vois-so
  version: "0.1.0"
---

# HyperFrames voiceover with Vois Studio

This skill gives a HyperFrames composition a narration that Vois Studio makes on the user's computer.
It reads the narration in the HyperFrames `SCRIPT.md` shape. It gives one `<audio>` clip for each line, with times on full frames.
The scene lengths come from the lengths of the takes. Thus, the picture and the voice stay aligned when you change a line.

HyperFrames owns the composition. This skill owns the voice files and their times. The audio levels, the captions and the render stay in HyperFrames.

## Before you start

- Vois Studio is open. If no window is necessary, start the headless service: `vois-cli service start`.
- A HyperFrames project with `index.html`. For a new project, use `npx hyperframes init <name>`.
- Node.js 18 or higher.
- A plan with CLI file output. Use the table below. Do not buy a plan for the user.

| Plan | What this skill can do |
| --- | --- |
| Pro | All steps, all engines, Omni and Craft directions, commercial use |
| Subscriber, AppSumo Lifetime Tier 2 or 3 | All steps with Fast, Expressive, Multilingual or Sonic. No Omni or Craft. Commercial use: Subscriber and Tier 3 only |
| Free with export credits | Each WAV file uses one credit. Non-commercial use only |
| Free without credits | Not possible. `vois-cli speak` plays audio but does not save a file |

The CLI path:

- macOS: `/Applications/Vois.app/Contents/MacOS/vois-cli`
- Windows: `%LOCALAPPDATA%\Vois\vois-cli.exe`

Use the full path in each command. Do not change PATH, and do not make an alias or a link.

```bash
VOIS="/Applications/Vois.app/Contents/MacOS/vois-cli"
"$VOIS" status --format json
```

If `cli_access_enabled` is `false`, show `purchase_url` to the user and stop. The fallback link is https://vois.so/pricing.

## Inputs

Use `SCRIPT.md`, the locked narration of a HyperFrames project. Write the Vois Studio voice ID and the engine in the `**Voice:**` line:

```markdown
# SCRIPT — launch

**Voice:** explainers_ai_voices/clara_west (Vois Studio, engine expressive)
**Voice direction:** Calm and clear, a small smile.

---

## Line 1 — Hook (Frame 1)

**Time:** 0.0 – 3.0s
**Delivery:** Calm, land the last word.

    Your video already has a story. Now it has a voice.

## Line 2 — How it works (Frame 2)

**Time:** 3.0 – 7.0s
**Delivery:** Matter of fact.

    Vois Studio reads each line on your computer, and the clips land on the timeline in order.
```

The script reads these parts:

- The indented block of each `## Line N` section is the spoken text.
- `**Voice:**` gives the voice ID and the engine. A flag can replace them.
- `**Delivery:**` (or `**Voice direction:**` for all lines) is the direction. Only Omni and Craft act on it.
- `**Time:**` is a guide. The script shows it adjacent to the measured length.
- The line id is `l<N>-<label>`, for example `l01-hook`.

If there is no `SCRIPT.md`, give a `scenes.json` list of `{ "id", "text" }` objects. The fields are in [the script and the manifest](references/script-and-manifest.md).

## Step 1: Write each line for the ear

- Use one idea in each sentence. Keep most sentences below 20 words.
- Write numbers, symbols and abbreviations as the voice must say them: "twenty percent", not "20%".
- Use commas and full stops for pauses. The voice stops at them, and the caption cues break at them.
- Plan about 2.5 words for each second. Compare with the `**Time:**` guide of the frame.
- Do not put notes about tone in brackets. Only Expressive makes the sound of its own tags, for example `[sigh]`.

More rules are in [rules for the ear](references/writing-for-the-ear.md).

## Step 2: Select a voice and an engine

```bash
"$VOIS" voice list --source all --engine expressive --format json
```

Use the `id` value with no change. Good voices for explainers: `explainers_ai_voices/clara_west`, `explainers_ai_voices/oscar_bell`, `narrators_ai_voices/david_sterling`.

| Engine | Use it for | Plan |
| --- | --- | --- |
| `expressive` | English narration. The default of the script | Paid plans |
| `omni` | 30 languages, and `**Delivery:**` as a direction | Pro |
| `craft` | 10 languages, cloned and designed voices, directions | Pro |
| `multilingual` | 23 languages | Paid plans |
| `fast` | Fast drafts in English | Paid plans |
| `sonic` | Built-in voices, for example `sonic_cedar`, 31 languages | Paid plans |

The language lists are in [voices and engines](references/voices-and-engines.md). Use a cloned voice only with the consent of the person who owns that voice.

## Step 3: Render and measure

Start the script from the project root. Replace `<skill>` with the folder of this skill.

```bash
node <skill>/scripts/voiceover.mjs --script SCRIPT.md --dry-run
node <skill>/scripts/voiceover.mjs --script SCRIPT.md
```

The script checks Vois Studio and the plan. Then it renders each line and measures each take. If a take is silent or its pace is not usual, it makes one more take with a new seed. It writes these files in `assets/voiceover/`:

| Output | Use |
| --- | --- |
| `<id>.wav` | One take for each line. 24 kHz, mono |
| `voiceover.html` | The `<audio>` clips to paste into `index.html` |
| `voiceover.json` | The manifest: scene start, scene length, clip start and clip length in seconds |
| `narration.wav` | All lines on one track, at composition time. Use it for transcription only |
| `narration.words.json` | Approximate word times in the HyperFrames transcript shape |
| `narration.srt` | Approximate captions as a sidecar file |

It prints a table, for example:

```text
line                     start   clip s   scene start   scene s   guide s
l01-hook                 0.267    3.867         0.000     4.633         3
l02-how-it-works         4.900    5.200         4.633     5.967         4
root data-duration: 10.6
```

When you start the script again, it renders only the lines that changed. Use `--only l01-hook --force` for a new take of one line. Use `--offset 2` when the narration starts 2 seconds into the composition.

On export credits, the script stops before it renders and shows the number of credits. Tell the user. Add `--use-credits` only after the user agrees.

## Step 4: Check the takes

You cannot hear the audio. Do these steps:

- Read the table. If a scene is much longer than its `**Time:**` guide, make the line shorter or change the storyboard.
- Tell the user to listen to each file in `assets/voiceover/`. Get their approval before the last render.
- Do a transcription (Step 6) and compare the words with the script.

To change a take, edit the line, or add `"seed": 7` in `scenes.json`, and start the script again.

## Step 5: Put the clips in the composition

Paste the clips from `voiceover.html` into the root composition. Each clip has an `id`, `data-start`, `data-duration`, `data-track-index` and `data-audio-group="voiceover"`:

```html
<audio id="vo-l01-hook" src="assets/voiceover/l01-hook.wav" data-start="0.267" data-duration="3.867"
       data-track-index="3" data-volume="1" data-audio-group="voiceover"></audio>
```

Set the frame of each line from the manifest. Use `sceneStart` for `data-start` and `sceneDuration` for `data-duration`:

```html
<div id="scene-hook" data-composition-id="hook" data-composition-src="compositions/hook.html"
     data-start="0" data-duration="4.633" data-track-index="0" data-width="1920" data-height="1080"></div>
```

Set the root `data-duration` to `totalSeconds` from the manifest. Then examine the result:

```bash
npx hyperframes lint
npx hyperframes timeline
npx hyperframes check
```

The `timeline` output must show each `vo-` clip at its `start` and the root length at `totalSeconds`.
A full `index.html` example and the rules for clips in sub-compositions are in [composition example](references/composition.md).

## Step 6: Captions

For word times that come from the audio, transcribe the narration track:

```bash
npx hyperframes transcribe assets/voiceover/narration.wav --model small.en
```

The transcript goes to `assets/voiceover/transcript.json`. For a language that is not English, use `--model small --language <code>`, for example `--language es`. A transcriber can spell a name incorrectly ("Voice Studio" for "Vois Studio"). Correct those words to the script text.

If transcription is not possible, use `narration.words.json`. It has the same shape, and the script text is always correct. The times are estimates. The phrase ends align with the measured pauses. The script divides the time of a phrase between its words by syllables.

## Step 7: Music below the voice

If music plays below the voice, give the music its own `<audio>`. Use an `id` with "music" in it, and a group that is not `voiceover`:

```html
<audio id="music" src="assets/bed.mp3" data-start="0" data-duration="10.6" data-track-index="4"
       data-volume="0.5" data-audio-group="music"></audio>
```

Then carve the music against the voice with the carve script of the HyperFrames audio skill (`hyperframes-audio`):

```bash
node <hyperframes-audio skill>/scripts/carve.mjs --comp index.html --bed music
```

The carve script finds the `vo-` clips as the voices. It writes `data-fx-carve`, `data-fx-chain` and `data-automation` on the music clip. For the carve script, ffmpeg and `@hyperframes/core` in the project are necessary. Do not write `data-fx-carve` by hand: the render plays only the chain that the carve script writes. Do not put music or sound effects in the `voiceover` group.

## Step 8: Render and examine

```bash
npx hyperframes render --quality draft --output renders/voice-check.mp4
ffprobe -v error -show_entries stream=codec_type:format=duration -of compact renders/voice-check.mp4
ffmpeg -i renders/voice-check.mp4 -af silencedetect=n=-40dB:d=0.3 -f null - 2>&1 | grep silence_
```

The video must have an audio stream. Its length must be the root `data-duration`. The silences must be at the scene changes. Do the last render (`--quality delivery`) only after the user gives approval for the preview.

## When something fails

| Exit | Cause | What to do |
| --- | --- | --- |
| 2 | Vois Studio is not open | Open it, or start `vois-cli service start`. Then start the script again |
| 3 or 64 | Bad value, or the language is not clear | Examine the voice ID and speed. Give `--language English` |
| 4 | The CLI cannot find a file or a voice | Get the voice ID again with `voice list` |
| 5 | The render did not complete | Make the line longer, remove symbols, or select a different voice |
| 7 | The plan does not include this | Omni and Craft are on Pro. Show `purchase_url` and stop |
| 8 | Quota | Show `purchase_url` and stop |
| 9 or 10 | Busy | The script tries again. If it stops, wait and start it again |
| 11 | Not sufficient memory | Close other apps, or use `expressive` or `fast` |
| 12 or 13 | Model download | Do `vois-cli model download --model <engine>`, or select a different engine |

Other problems:

- The render has no voice: a clip has no `id`, or its `src` is incorrect. `npx hyperframes lint` shows `media_missing_id`.
- A clip stops before its end: the root `data-duration` is shorter than the last clip. Use `totalSeconds`.
- The script finds no lines in `SCRIPT.md`: indent the spoken text by four spaces, below a `## Line N` title.
- The voice says a name incorrectly: use `scenes.json` with a respelled name in `say`, and keep the correct name in `text`.

## Rules

- Do not buy a plan or credits, and do not fill a checkout. Show `purchase_url` and wait for the user.
- Use a cloned voice only with the consent of its owner.
- For commercial use, a paid plan is necessary: Pro, Subscriber or AppSumo Lifetime Tier 3. Free is for non-commercial use.
- Do not claim a view count or an income from the video.
