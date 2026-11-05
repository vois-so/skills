---
name: localize-audio
description: Makes a dubbed voice track in a different language with Vois Studio, and keeps the times of the source audio. It reads segments with start and end times from an SRT file or a JSON file. The agent translates each segment, selects an engine that speaks the target language, and selects a voice. Then a script generates each segment, measures it, and fits it into its time slot with a small speed change. It marks each segment that is too long. Then the agent writes a shorter translation. At the end, it puts each segment at its start time in one track and measures each start. Use when the user says "dub this video into Spanish", "translate the voiceover and keep the timing", "localize my narration", "make a German version of this audio" or "dub these subtitles". The CLI is necessary, so the plan must be Pro, Subscriber, or AppSumo Lifetime Tier 2 or 3. Omni and Craft are only on Pro.
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, ffmpeg and ffprobe, and Node.js 18+.
metadata:
  author: vois-so
  version: "0.1.0"
---

# Localize audio

This skill makes a voice track in a target language. Each segment starts at the same time as in the source audio. The result is:

- `<workdir>/dub.wav`: the full voice track, 24 kHz mono, with silence between the segments.
- `<workdir>/start-check.json`: the expected and measured start of each segment.
- An export in the format that the user wants (for example M4A or MP3).

You (the agent) write the translations. The script `scripts/dub.mjs` does the generation, the time fit, the track and the check.

## Step 1: Make sure that the tools operate

Use the CLI at its install path. Do not change PATH. Do not make an alias.

- macOS: `/Applications/Vois.app/Contents/MacOS/vois-cli`
- Windows: `%LOCALAPPDATA%\Vois\vois-cli.exe`

The script finds the CLI at these paths. If it is at a different path, set `VOIS_CLI` to the full path.

```bash
VOIS="/Applications/Vois.app/Contents/MacOS/vois-cli"
"$VOIS" status --format json
```

If `next_action` is not `ready`, show `purchase_url` to the user (if it is empty, show https://vois.so/pricing) and stop. Do not buy anything. Exit code 2 tells you that Vois Studio is not open. Tell the user to open it, or use `"$VOIS" service start`.

Plan facts: the CLI needs Pro, Subscriber, or AppSumo Lifetime Tier 2 or 3. Omni, Craft and Voice Design are only on Pro. Free is for non-commercial use only.

## Step 2: Get the timed segments

Get one of these from the user:

- An SRT file of the source voice (for example the subtitles of the video).
- A JSON file: `[{ "id": "s1", "start": 0.0, "end": 3.0, "text": "..." }]`, with the times in seconds.

Each segment must have a start time, an end time and the source text. One segment is usually one or two sentences.

Also get the target language and the length of the source media in seconds, if the user has it.

## Step 3: Select the engine

Select an engine that speaks the target language:

| Engine | Languages | Voices | Direction (`instruct`) |
| --- | --- | --- | --- |
| `multilingual` | 23 | Library and cloned voices | No |
| `omni` (Pro) | 30 | Library, cloned and designed voices | Yes |
| `sonic` | 31 | Its 10 built-in voices only (`sonic_cedar`, ...) | No |
| `craft` (Pro) | 10 | Library, cloned and designed voices | Yes |
| `fast` | English, German, Spanish, Italian, Portuguese | Library voices | No |

The full language lists are in [languages](references/languages.md). If two engines speak the language, use `multilingual` for a plain voiceover. Use `omni` or `craft` if the voice must follow a direction (for example "calm and warm").

## Step 4: Select the voice

If the source voice is a Vois Studio library voice, use the same voice ID. Library voices keep the same speaker in the other language.

For a new voice, show the voices:

```bash
"$VOIS" voice list --source all --engine multilingual --format json
```

Generate the first segment with two voices in the target language. Let the user listen and select:

```bash
"$VOIS" tts generate --format json --engine multilingual --language Spanish \
  --voice explainers_ai_voices/clara_west --text "Bienvenidos al taller." --output "$PWD/audition.wav"
```

## Step 5: Make the segment file

```bash
node scripts/dub.mjs init source.srt es --target Spanish \
  --engine multilingual --voice explainers_ai_voices/clara_west
```

The script writes `es/segments.json`. It has the settings and one entry for each segment with an empty `"translation"`. You can change these settings in the file:

| Field | Purpose |
| --- | --- |
| `engine`, `voice`, `target_language` | The engine, voice ID and language name for all segments |
| `instruct` | Direction in plain words for `omni` and `craft`. Other engines do not use it |
| `max_speed` | The maximum speed for the time fit. Keep 1.15 or lower, because a faster voice is not easy to follow |
| `total_s` | The length of the source media in seconds. The track is this long |

## Step 6: Translate each segment

Write the translation of each segment into its `"translation"` field. Follow these rules:

- Translate the meaning, not each word.
- Keep each translation in its segment. Do not move text from one segment to a different segment.
- Make the translation as short as the source text, or shorter. Many languages use more syllables than English for the same meaning.
- Write numbers, units and dates as words, as the voice must speak them.
- Keep the names of persons and brands. Keep the tone of the source text (formal or informal).

## Step 7: Generate and fit the segments

```bash
node scripts/dub.mjs run es
```

For each segment, the script does these steps:

1. It generates the translation with `vois-cli tts generate` at speed 1.0.
2. It removes the silence at the two ends and measures the length.
3. It compares the length with the slot. The slot is the time from the start of the segment to the start of the next segment, less 0.15 s.
4. If the segment is too long, it generates it again with a higher `--speed`. The maximum is `max_speed`.
5. If the segment is too long at that speed, it marks it `REWRITE` with a maximum number of characters.

If one or more segments show `REWRITE`, the script stops with exit code 3. Read `es/fit-report.json`. Write a shorter translation for each of these segments, with no more characters than `max_characters`. Then do the run again. The script keeps the segments that did not change.

If a segment shows `REWRITE` after three rewrites, tell the user. The user can accept a shorter meaning, or move the start of the next segment.

## Step 8: Make and examine the track

When all segments fit, the script puts each segment at its start time in `es/dub.wav`. Then it measures where the voice starts in the track. It compares each measured start with the expected start. Each start must be in 0.3 s of the expected start. The script shows PASS or FAIL for each segment and writes `es/start-check.json`.

Tell the user to listen to the track with the source video or audio. A speaker of the target language must listen for meaning, names and pronunciation.

## Step 9: Export the track

Export the track through Vois Studio in the format that the user wants:

```bash
"$VOIS" export audio --format json -i "$PWD/es/dub.wav" -o "$PWD/es/dub-es.m4a" \
  --audio-format m4a -b 192 --sample-rate 48000 --normalize --target-lufs -16
```

The export must have 5 s of audio or more. Use `--target-lufs -16` for a podcast or a web video, or the number that the platform of the user gives.

If the user has a background track with no voice (music and effects), the user can put the two tracks together in a video editor. Put the dub track at the start of the video.

## When a step fails

| Problem | What to do |
| --- | --- |
| Exit 3 with "does not speak" | The engine does not speak the language. Use an engine from the list in the message. |
| Exit 3 with "no translation" | Write the `"translation"` of each segment. |
| Exit 3 with `REWRITE` | Write a shorter translation for each segment in `fit-report.json`, then do the run again. |
| Exit 2 | Vois Studio is not open. Tell the user to open it, or use `"$VOIS" service start`. |
| Exit 4 | The voice ID is not correct. Get the ID again from `voice list`. |
| Exit 7 | The plan does not include the CLI or this engine. Use `multilingual`, or show `purchase_url`. |
| Exit 13 or a Fast language that is not installed | Tell the user that the package must be downloaded: `"$VOIS" model download --model fast --language es`. |
| Exit 64 | The language name is not correct. Use a name from [languages](references/languages.md). |
| Start check FAIL | Read `start-check.json`. A segment that starts with a very quiet sound can show a late start. Listen to that segment. If the start is correct, tell the user. If not, write a different translation for it. |
