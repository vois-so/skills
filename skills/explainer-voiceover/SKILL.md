---
name: explainer-voiceover
description: Makes the narration of an explainer video, scene by scene, for a video editor (Premiere Pro, DaVinci Resolve, Final Cut Pro, CapCut) with Vois Studio, on the user's computer. It writes each scene for the ear and renders one WAV for each scene with vois-cli. Then it puts all scenes on one narration track with the correct silences. It also writes SRT captions and a sheet with the start of each scene. If ffmpeg is on the computer, ffmpeg connects and pads the clips. If not, a built-in joiner does it. Use when the user asks for "a voiceover for my explainer", "narration for these scenes", "a VO track and captions for Premiere or Resolve", "fit the narration to my cut", or "an SRT for my voiceover". A Vois Studio plan with CLI file output is necessary, for example Pro. For directions in plain words, use Omni or Craft on Pro.
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, Node.js 18+, and ffmpeg (optional).
metadata:
  author: vois-so
  version: "0.1.0"
---

# Explainer voiceover with Vois Studio

This skill makes the narration of an explainer video, scene by scene, on the user's computer.
The user gets files that all video editors import: one WAV for each scene, one narration track, SRT captions and a timing sheet.
The narration track and the captions start at time 0. Put them at the start of the timeline, and they align with no more work.

## Before you start

- Vois Studio is open. If no window is necessary, start the headless service: `vois-cli service start`.
- Node.js 18 or higher.
- ffmpeg is optional. With ffmpeg, the narration track is 48 kHz, the usual rate of video projects. Without ffmpeg, the script connects the clips itself at 24 kHz. All editors in this skill import 24 kHz audio.
- A plan with CLI file output. Use the table below. Do not buy a plan for the user.

| Plan | What this skill can do |
| --- | --- |
| Pro | All steps, all engines, Omni and Craft directions, commercial use |
| Subscriber, AppSumo Lifetime Tier 2 or 3 | All steps with Fast, Expressive, Multilingual or Sonic. No Omni or Craft. Commercial use: Subscriber and Tier 3 only |
| Free with export credits | Each WAV file uses one credit, and `--master` uses one more. Non-commercial use only |
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

Get the scenes from the user, or divide their script into scenes. Write `scenes.json`:

```json
{
  "voice": "explainers_ai_voices/naveen_patel",
  "engine": "expressive",
  "language": "English",
  "fps": 25,
  "scenes": [
    { "id": "problem", "text": "Most explainer videos lose people in the first ten seconds." },
    { "id": "fix", "text": "So start with the problem, then show the fix, one step at a time.", "seconds": 6 },
    { "id": "close", "text": "That is the whole method. Try it on your next video." }
  ]
}
```

| Field | What it does |
| --- | --- |
| `id` | The scene name. Letters, digits, `-` and `_` |
| `text` | The narration and the caption text |
| `say` | Optional. The words for the voice, when they are different from `text` |
| `instruct` | Optional. A direction in plain words. Omni and Craft only |
| `seconds` | Optional. The fixed length of the scene in an edit that exists. The script tells you when the line is too long for it |
| `fps` | The frame rate of the editor project. Scene starts sit on its frames |

Without `seconds`, the scene length is the line length, plus `lead` (0.3 s) before it and `tail` (0.7 s) after it.

## Step 1: Write each scene for the ear

- Use one idea in each sentence. Keep most sentences below 20 words.
- Write numbers, symbols and abbreviations as the voice must say them: "twenty percent", not "20%".
- Use commas and full stops for pauses. The voice stops at them, and the caption cues break at them.
- Plan about 2.5 words for each second. A 6-second scene holds about 15 words.
- Do not put notes about tone in brackets. Only Expressive makes the sound of its own tags, for example `[sigh]`.

More rules are in [rules for the ear](references/writing-for-the-ear.md).

## Step 2: Select a voice and an engine

```bash
"$VOIS" voice list --source all --engine expressive --format json
```

Use the `id` value with no change. Good explainer voices: `explainers_ai_voices/clara_west`, `explainers_ai_voices/naveen_patel`, `explainers_ai_voices/oscar_bell`.

| Engine | Use it for | Plan |
| --- | --- | --- |
| `expressive` | English narration. The default of the script | Paid plans |
| `omni` | 30 languages, and a direction in plain words with `instruct` | Pro |
| `craft` | 10 languages, cloned and designed voices, `instruct` | Pro |
| `multilingual` | 23 languages | Paid plans |
| `fast` | Fast drafts in English | Paid plans |
| `sonic` | Built-in voices, for example `sonic_cedar`, 31 languages | Paid plans |

The language lists are in [voices and engines](references/voices-and-engines.md). Use a cloned voice only with the consent of the person who owns that voice.

## Step 3: Render, join and caption

Replace `<skill>` with the folder of this skill.

```bash
node <skill>/scripts/explainer.mjs --scenes scenes.json --dry-run
node <skill>/scripts/explainer.mjs --scenes scenes.json
```

The dry run shows the plan and a length estimate for each scene. It tells you when a line is possibly too long for its `seconds`. The second command:

1. Checks Vois Studio and the plan.
2. Renders each scene to `voiceover/scenes/01-<id>.wav`. If a take is silent or its pace is not usual, it makes one more take with a new seed.
3. Joins and pads all takes into `voiceover/narration.wav`. It uses ffmpeg if ffmpeg is on the computer (48 kHz). Else it uses its built-in joiner (24 kHz).
4. Writes `voiceover/narration.srt`, `voiceover/timing.csv` and `voiceover/timing.json`.

It prints a table, for example:

```text
#   scene             start          length   voice ends     note
 1  problem           00:00:00.000     4.64   00:00:03.720
 2  fix               00:00:04.640     6.00   00:00:08.610
 3  close             00:00:10.640     3.64   00:00:13.960
total 00:00:14.280 (14.28 s), narration.wav at 48000 Hz, joined with ffmpeg
```

When you start the script again, it renders only the scenes that changed. A change to `seconds`, `lead`, `tail` or `fps` changes only the timing.

On export credits, the script stops before it renders and shows the number of credits. Tell the user. Add `--use-credits` only after the user agrees.

All flags and the output formats are in [script and output files](references/output-files.md).

## Step 4: Check the result

1. If the script stops with exit 65, a scene is longer than its `seconds`. The `note` column gives the number of words to cut. Edit the line, or set a speed of 1.1, and start the script again.
2. Read the `length` column. A scene that is much longer than the visual for it is a problem.
3. Tell the user to listen to `voiceover/narration.wav`. Get their approval before they edit the video with it.
4. If a transcriber (for example Whisper) is on the computer, transcribe `narration.wav`. Compare the words with the script.

## Step 5: Optional: a mastered copy

Vois Studio can master the narration track to the loudness of a platform. The track must be 5 seconds or longer.

```bash
node <skill>/scripts/explainer.mjs --scenes scenes.json --master youtube_video
```

This writes `voiceover/narration-youtube_video.m4a` at -14 LUFS. Get the list of export profiles with `"$VOIS" export profiles`. The mastered copy has the same times as `narration.wav`.

## Step 6: Import into the editor

Put `narration.wav` (or the mastered copy) on an audio track at the start of the timeline. Then import `narration.srt` as captions. Use `timing.csv` to put markers or cuts at the scene starts. Menu names can be different in your version of the editor.

| Editor | Narration | Captions |
| --- | --- | --- |
| Premiere Pro | `File > Import`, then put it on A1 at 00:00:00:00 | `File > Import` `narration.srt`, then put it on the timeline |
| DaVinci Resolve | Import into the Media Pool, then put it at the timeline start | `File > Import > Subtitle`, then put it on the timeline |
| Final Cut Pro | `File > Import > Media`, then put it at the start of the project | `File > Import > Captions` |
| CapCut (desktop) | Import, then put it on the audio track at 0 | Captions panel, import of local captions |

DaVinci Resolve starts a timeline at 01:00:00:00. Put the narration at the timeline start, not at 00:00:00:00. If the captions do not align, set the start timecode of the timeline to 00:00:00:00 and import them again.

To move scenes one by one, use the WAVs in `voiceover/scenes/` with the `start` column of `timing.csv`. More editor steps are in [editor import](references/editor-import.md).

## When something fails

| Exit | Cause | What to do |
| --- | --- | --- |
| 65 | A scene is longer than its `seconds` | Cut words, or set `speed` to 1.1, and start the script again. The script wrote all files |
| 2 | Vois Studio is not open | Open it, or start `vois-cli service start`. Then start the script again |
| 3 or 64 | Bad value, or the language is not clear | Examine the voice ID and speed. Set `"language": "English"` |
| 4 | The CLI cannot find a file or a voice | Get the voice ID again with `voice list` |
| 5 | The render did not complete | Make the line longer, remove symbols, or select a different voice |
| 6 | The join or the export did not complete | Start the script again with `--joiner node`. A mastered copy needs 5 seconds or more |
| 7 | The plan does not include this | Omni and Craft are on Pro. Show `purchase_url` and stop |
| 8 | Quota | Show `purchase_url` and stop |
| 9 or 10 | Busy | The script tries again. If it stops, wait and start it again |
| 11 | Not sufficient memory | Close other apps, or use `expressive` or `fast` |

If ffmpeg is not on the computer, the script uses its built-in joiner and the narration track is 24 kHz. This is correct for all editors in this skill. To get 48 kHz, install ffmpeg (macOS: `brew install ffmpeg`, Windows: `winget install Gyan.FFmpeg`) and start the script again. It does not render again.

## Rules

- Do not buy a plan or credits, and do not fill a checkout. Show `purchase_url` and wait for the user.
- Use a cloned voice only with the consent of its owner.
- For commercial use, a paid plan is necessary: Pro, Subscriber or AppSumo Lifetime Tier 3. Free is for non-commercial use.
- Do not claim a view count or an income from the video.
