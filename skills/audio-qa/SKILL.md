---
name: audio-qa
description: Examines voice audio from Vois Studio before you give it to the user or publish it. It compares a transcript of each line with the script and gives the word error rate. It makes a new take with a new seed when a line has a problem, with 3 takes at most. It finds samples at full scale and near silence. It normalizes the loudness to a target, for example -16 LUFS for a stereo podcast, -19 LUFS for mono, and -1 dBTP. A Node.js script does all the checks and writes a report. Use when the user says "check the audio", "QA these files", "did it say everything", "is the audio clipping", "normalize the loudness", "make it podcast loud" or "verify the voiceover before I upload it". The checks work on each WAV file. Retakes from vois-cli are available on Pro, Subscriber, AppSumo Lifetime Tier 2 or 3, and the Free plan with export credits.
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, Node.js 18+, and optionally ffmpeg and a local transcript tool (whisper or whisper.cpp).
metadata:
  author: vois-so
  version: "0.1.0"
---

# Audio QA

This skill does one task. It examines generated voice audio before you give it to the user. It finds missing words, incorrect words, samples at full scale and silence. It makes new takes of the lines that fail. Then it sets the loudness to the target of the platform.

## What you must have

- The WAV files from Vois Studio.
- The script text of each file. Without the text, the skill can examine only the signal.
- The engine, the voice, the language and the seed of each file, for retakes.
- The loudness target. If the user does not know, use the table in step 5.

## Set up the tools

Use the full path of vois-cli. Do not change PATH, and do not make an alias or a symlink.

| System | vois-cli path |
|---|---|
| macOS | `/Applications/Vois.app/Contents/MacOS/vois-cli` |
| Windows | `%LOCALAPPDATA%\Vois\vois-cli.exe` |

For retakes, Vois Studio must be open. If it is not open, start the service with `vois-cli service start`.

Find the other tools:

```bash
node --version
which ffmpeg whisper whisper-cli whisper-cpp
```

On Windows, use `where`, not `which`.

| Tool | Use | If it is not installed |
|---|---|---|
| Node.js 18+ | Necessary for the QA script. | Install it from nodejs.org. |
| ffmpeg | Loudness measurement and normalization. | The script does not measure loudness. |
| `whisper` or `whisper-cli` | Transcript of each line. | The script examines only the length and the silence. |

A transcript tool is strongly recommended. Without it, the script cannot find an incorrect word or a missing word in a line of the correct length. The install steps are in [tools](references/tools.md). Get the approval of the user before you install a tool. The models are large downloads.

## Step 1. Write the manifest

The manifest tells the script the text and the settings of each file. Paths are relative to the manifest.

```json
{
  "language": "English",
  "engine": "fast",
  "voice": "narrators_ai_voices/morgan_vale",
  "seed": 11,
  "lines": [
    { "id": "intro", "file": "intro.wav", "text": "Welcome back to the show. Today we test our backups." },
    { "id": "numbers", "file": "numbers.wav", "text": "In twenty twenty-four, more than half of teams found broken backups." }
  ]
}
```

- `text` is the spoken text that went to Vois Studio. Remove speaker tags. The script removes bracket tags.
- A line can have its own `engine`, `voice`, `language`, `seed`, `speed` or `instruct`.
- Use one file for each line or paragraph. A short file gives a clear word error rate and a fast retake.

If you make the files, write the seed in the manifest. Then a retake uses a different seed:

```bash
vois-cli tts generate --text "Welcome back to the show. Today we test our backups." \
  --engine fast --language English --voice narrators_ai_voices/morgan_vale \
  --seed 11 --output /absolute/path/intro.wav --format json
```

## Step 2. Do the checks

```bash
node scripts/audio-qa.mjs manifest.json --report report.json
```

The script is at `scripts/audio-qa.mjs` in this skill folder. For WAV files without text, give the files: `node scripts/audio-qa.mjs a.wav b.wav`.

The script examines each file:

| Item | Status FAIL | Status WARN |
|---|---|---|
| Word error rate | More than `--max-wer` (default 0.15) | |
| Samples at full scale | Three or more in a sequence | One or two |
| Near silence | Less than 0.3 s of voice, or the level is less than -45 dBFS | |
| Silent audio at the start or the end | | More than 1 s at the start, more than 1.5 s at the end |
| Long pause in the voice | | More than 2 s |
| Length | | Less than half or more than two times the estimate (150 words a minute) |
| Loudness | | Shown for each file, not a fail |

It shows a table: status, take, length, peak, samples at full scale, LUFS, true peak and word error rate. For each line with a word error, it shows the expected text and the text that it heard. The JSON report has all values.

Exit code 0 means that all lines pass. Exit code 1 means that one or more lines fail. Exit code 2 means an error in the command or the manifest.

## Step 3. Read the word errors

The word error rate is the number of word changes divided by the number of words in the script. 0 is a perfect match. 0.15 is about one error in seven words.

Before you make a retake, read the expected text and the heard text:

- A name or a brand with a different spelling in the transcript is not always an error in the audio. Listen to the line.
- The script changes digits in an English transcript into words, for example "2024" into "twenty twenty-four". Other languages can show a number difference that is not an error.
- A transcript can write a word from a different language in a different script. Look at the meaning before you make a retake.
- A word that the voice says incorrectly each time is a pronunciation problem. A retake does not correct it. Correct the word in the script or in the pronunciation dictionary.

## Step 4. Make retakes

Add `--retake` to make a new take of each line that fails:

```bash
node scripts/audio-qa.mjs manifest.json --retake --tries 3 --keep-best --report report.json
```

- The script makes take 2 with the seed plus 1000, and take 3 with the seed plus 2000.
- It stops when a take passes, or after `--tries` takes. The maximum is 3 takes by default.
- It writes each retake in the folder of the line file: `intro.retake2.wav`.
- With `--keep-best`, it replaces the line file with the best take. It keeps the first take as `intro.take1.wav`.
- It stops the retakes on exit code 2, 7, 8, 11, 12 or 13. These errors do not change with a new seed.
- A line without `text` or `engine` gets no retake.

If a line fails after three takes, do not make more takes. Tell the user. Then examine the cause: the text, the pronunciation or the voice.

Each retake on Free with export credits uses one credit. Tell the user before you start.

## Step 5. Normalize the loudness

Select the target for the platform:

| Platform | Integrated loudness | Limit for the true peak |
|---|---|---|
| Podcast, stereo | -16 LUFS | -1 dBTP |
| Podcast, mono | -19 LUFS | -1 dBTP |
| Audiobook (ACX) | Use `--target-lufs -20` as a start. Then make sure that RMS is -23 to -18 dB. | -3 dB peak |
| Radio and TV (EBU R 128) | -23 LUFS | -1 dBTP |
| Video platforms | -14 LUFS | -1 dBTP |

Voice audio from Vois Studio is mono. Use -19 LUFS for a mono podcast file. Use -16 LUFS if the file that you give to the user is stereo.

Write a normalized copy of each file:

```bash
node scripts/audio-qa.mjs manifest.json --target-lufs -19 --true-peak -1 --normalize-dir normalized
```

The script measures each file, then normalizes it in two passes with ffmpeg. It keeps the sample rate and the channels. It shows the loudness after the change. The files that you give to the script do not change.

Normalize the full file, not only each line. Lines with the same loudness can be different in the full file. More information and the ffmpeg commands are in [loudness](references/loudness.md).

You can also export with Vois Studio. This uses the mastering of Vois Studio and needs 5 s of audio or more:

```bash
vois-cli export audio --input final.wav --output final.mp3 --audio-format mp3 --normalize --target-lufs -16
```

On Free, each export uses one export credit.

## Step 6. Give the report

Give the user:

- The table from the script, with each status.
- Each line that has a problem after all takes, with the expected text and the heard text.
- The loudness target and the loudness of each normalized file.
- The path of `report.json`.
- If no transcript tool was installed, tell the user that the script did not examine the words.

## If a command stops with an error

| Problem | Cause | What to do |
|---|---|---|
| Exit code 2 from the script | A flag or the manifest is not correct. | Read the message. Correct the manifest. |
| `--retake needs vois-cli` | vois-cli is not at the standard path. | Give `--cli <path>`. |
| A retake stops with exit 2 | Vois Studio is not open. | Open Vois Studio, or start the service with `vois-cli service start`. |
| A retake stops with exit 7 | The plan does not include the CLI or the engine. | Show the `purchase_url` from `vois-cli status --format json`. Do not buy. |
| A retake stops with exit 11 | The computer does not have sufficient free memory. | Close other apps. Try again. |
| A `transcript:` message | The transcript tool stopped with an error. | Do the whisper command by hand on one file to see the error. |
| No loudness values | ffmpeg is not installed. | Install ffmpeg (see [tools](references/tools.md)), or use `vois-cli export audio --normalize`. |
| `cannot read the WAV` | The file is not a WAV file. | Change it into a WAV file with ffmpeg: `ffmpeg -i in.mp3 out.wav`. |

## Output

- `report.json` with each check, each take and its seed.
- The best take of each line.
- A normalized copy of each file, if you used `--normalize-dir`.
- A short report to the user, with each line that has a problem.
