---
name: game-barks
description: Makes NPC voice lines for a game from a spreadsheet with Vois Studio. It reads a CSV with an id, a character, the line and a direction for each row. It gives each character one voice and selects an engine for each line type. It generates one WAV for each line, with the id as the file name. It writes a manifest (JSON and CSV) that Unity, Unreal Engine or Godot can read, and on the next batch it generates only the lines that changed. Use when the user says "voice my NPC lines", "generate barks from this spreadsheet", "batch game dialogue", "make voice files for my game" or "regenerate the changed lines". The CLI is necessary, so the plan must be Pro, Subscriber, or AppSumo Lifetime Tier 2 or 3. For a commercial game, use Pro or AppSumo Lifetime Tier 3.
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, Node.js 18+, and ffmpeg and ffprobe for the file check.
metadata:
  author: vois-so
  version: "0.1.0"
---

# Game barks

This skill changes a dialogue spreadsheet into voice files for a game:

- `out/<id>.wav`: one file for each row, 24 kHz mono 16-bit PCM.
- `out/manifest.json` and `out/manifest.csv`: the line ID, character, file, length, engine and voice for each line.

The game finds each line by its stable ID. It does not make a file name from the spoken text. Vois Studio generates the audio on the computer of the user, so a change to a quest costs only the time to generate again.

## Step 1: Make sure that the tools operate

Use the CLI at its install path. Do not change PATH. Do not make an alias.

- macOS: `/Applications/Vois.app/Contents/MacOS/vois-cli`
- Windows: `%LOCALAPPDATA%\Vois\vois-cli.exe`

The scripts find the CLI at these paths. If it is at a different path, set `VOIS_CLI` to the full path.

```bash
VOIS="/Applications/Vois.app/Contents/MacOS/vois-cli"
"$VOIS" status --format json
```

If `next_action` is not `ready`, show `purchase_url` to the user (if it is empty, show https://vois.so/pricing) and stop. Do not buy anything. Exit code 2 tells you that Vois Studio is not open. Tell the user to open it, or use `"$VOIS" service start`.

Plan facts:

- The CLI needs Pro, Subscriber, or AppSumo Lifetime Tier 2 or 3.
- Craft, Omni and Voice Design are only on Pro.
- Free with export credits uses one credit for each line. Free is for non-commercial use only.

## Step 2: Prepare the spreadsheet

Get the CSV from the user (UTF-8, with a header row). The columns:

| Column | Necessary | Contents |
| --- | --- | --- |
| `id` | Yes | A stable line ID, for example `guard_alert_01`. Letters, digits, `_`, `-` and `.` only. It is the file name |
| `character` | Yes | A character ID, for example `guard`. It must be in `cast.json` |
| `line` | Yes | The spoken text |
| `direction` (or `emotion`) | No | How the voice speaks the line, in plain words, for example `alarmed and loud` |
| `type` | No | `bark`, `dialogue` or `system`, or a type that you add to `cast.json` |
| `engine` | No | Set the engine for one row |
| `language` | No | Set the language for one row |

Rules for the IDs:

- Do not change an ID after the game uses it. Change the text and keep the ID.
- Do not use the text or the character name as the ID. A character name can change.
- Use one row for each file. Two rows with the same ID stop the script.

## Step 3: Select a voice for each character

Show the game voices:

```bash
"$VOIS" voice list --source all --format json
```

Good categories are `npcs_ai_voices`, `heroes_ai_voices`, `villains_ai_voices`, `companions_ai_voices`, `creatures_ai_voices`, `machines_ai_voices` and `video_games_ai_voices`. Use the `id` values with no change.

Give each character one voice for the full game. Generate one typical line with two or three voices, and let the user select:

```bash
"$VOIS" tts generate --format json --engine expressive --language English \
  --voice npcs_ai_voices/blacksmith_bruno --text "Need a blade sharpened? Come back at sunrise." \
  --output "$PWD/auditions/blacksmith_bruno.wav"
```

If no library voice is correct for a character, the user can clone the voice of a person (Pro or Subscriber). Clone a voice only with the consent of that person.

## Step 4: Select an engine for each line type

Write `cast.json`. Set one engine for each line type, and a voice for each character:

```json
{
  "language": "English",
  "default_type": "bark",
  "characters": {
    "guard": { "voice": "npcs_ai_voices/town_crier_herald" },
    "merchant": { "voice": "npcs_ai_voices/merchant_mira" }
  },
  "types": {
    "bark": { "engine": "expressive", "max_seconds": 4 },
    "dialogue": { "engine": "craft" },
    "system": { "engine": "fast" }
  }
}
```

| Line type | Engine | Why |
| --- | --- | --- |
| `bark`: alerts, reactions, combat calls | `expressive` | English. It makes the sounds for `[sigh]`, `[laugh]`, `[gasp]`, `[groan]`, `[cough]`, `[chuckle]`, `[sniff]`, `[clear throat]` and `[shush]` in the text. It does not use the direction |
| `dialogue`: quest and story lines | `craft` (Pro) | It uses the direction column as plain-words direction. 10 languages |
| `system`: tutorial and menu lines | `fast` | The fastest engine. English, German, Spanish, Italian, Portuguese |
| Lines in other languages | `multilingual` (23), `omni` (30, Pro, uses the direction), `sonic` (31, built-in voices only) | Set `language` on the row or in `cast.json` |

Without Pro, use `expressive` for dialogue. Then put the emotion in the words and the tags, because the direction column has no effect. A character can also set its own engine (`"engine"` in its entry).

For a direction, use plain words: `"tired, quiet, a little angry"`. Do not use brackets or parentheses. Use less than 2,000 characters.

## Step 5: Do a dry run

```bash
node scripts/render-barks.mjs lines.csv cast.json out --dry-run
```

The dry run reads all rows and shows the engine, language and voice for each row. It generates no audio. It stops with a list of problems if it finds one. Examples are an ID that is not correct or not unique, a character with no voice, or a direction with brackets. It also tells you which rows have a direction that their engine does not use.

## Step 6: Generate the lines

```bash
node scripts/render-barks.mjs lines.csv cast.json out
```

For each row, the script uses `vois-cli tts generate` with the voice, engine, language and speed. For Omni and Craft, it adds `--instruct` with the direction. It writes `out/<id>.wav`. Then it writes `out/manifest.json` and `out/manifest.csv`.

The script keeps a hash of the text, voice, engine, language, speed and direction for each line. On the next run, it generates only the new and changed rows. Use these flags for a retake:

```bash
node scripts/render-barks.mjs lines.csv cast.json out --only merchant_haggle_01 --force
```

If a row fails, the script continues with the other rows. At the end, it writes `out/failed.json` and stops with exit code 5.

## Step 7: Examine the files

```bash
node scripts/check-manifest.mjs out --csv lines.csv
```

The check makes sure that each manifest line has its WAV, the SHA-256 did not change, and the file is 24 kHz mono PCM. It also finds lines that are almost silent and lines with a peak at 0 dB. It shows the rows of the spreadsheet that have no audio at this time.

Tell the user to listen to each new line. Give the user the lines with a `warning` in the manifest first (a bark that is too long for its type). For a long batch, give the user the lines in groups of one character or one scene.

## Step 8: Put the files in the game

Give the user the `out` folder. The game loads `<id>.wav` with the ID from the manifest. Examples for Unity, Unreal Engine and Godot are in [engine import](references/engine-import.md).

Tell the user:

- The number of lines, and the path of the manifest.
- The engine of each line type.
- The lines that have no audio or have a warning.

## When a step fails

| Problem | What to do |
| --- | --- |
| Exit 2 | Vois Studio is not open. Tell the user to open it, or use `"$VOIS" service start`. |
| Exit 3 with a list of rows | Correct the CSV or `cast.json`. Do the dry run again. |
| Exit 7 | The plan does not include the CLI or this engine (Craft and Omni are only on Pro). Use `expressive`, or show `purchase_url`. |
| A row with exit 4 in `failed.json` | The voice ID is not correct. Get it again from `voice list`. |
| A row with exit 5 and `near_silent` | The line is too short or the voice cannot speak it. Make the line longer, or select a different voice. |
| A row with exit 64 | The language is not clear. Set `language` on the row or in `cast.json`. |
| A row with exit 11 | The computer does not have sufficient free memory for this engine. Close other apps, or use `expressive`. |
| FAIL in the check: SHA-256 differs | A person or a tool changed the WAV. Generate the line again with `--only <id> --force`. |
