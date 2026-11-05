---
name: direct-a-voice
description: Gives a Vois Studio voice a direction in plain words for each line. It makes the takes with Omni or Craft and helps you select the best take. It writes directions that obey the rules (less than 2,000 characters, no brackets or parentheses) and has a library of direction patterns. It compares two directions on the same line. It also gives a different method for plans without Omni and Craft. Use when the user says "make it sound warmer", "direct the voice", "more emotion on this line", "say it like a news anchor", "the read is flat", "add delivery notes" or "try it two ways". Omni and Craft are on the Pro plan. On Subscriber, AppSumo Lifetime and Free without export credits, the skill uses words, punctuation, speed and Expressive reaction tags.
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, and Node.js 18+ for the render script.
metadata:
  author: vois-so
  version: "0.1.0"
---

# Voice direction

This skill does one task. It tells a voice how to say each line. Then it makes the takes and helps you select the best take.

A direction is a short text in plain words, for example "calm and warm, unhurried". You give it to Omni or Craft with `--instruct`. It changes the pace, the emotion, the tone and the energy. It does not change the words.

## What you must have

- The lines of the script, as clean spoken text.
- The language of each line.
- A voice ID.
- What the user wants each line to do for the listener, for example "calm the listener" or "make the listener smile".

## Set up vois-cli

Use the full path. Do not change PATH, and do not make an alias or a symlink.

| System | vois-cli path |
|---|---|
| macOS | `/Applications/Vois.app/Contents/MacOS/vois-cli` |
| Windows | `%LOCALAPPDATA%\Vois\vois-cli.exe` |

Vois Studio must be open. If it is not open, start the service with `vois-cli service start`. Then get the status:

```bash
vois-cli status --format json
vois-cli model status
```

Read `entitlement_tier` in the status. Read the "Engine Availability" lines in the model status.

## Step 1. Find what the plan permits

| Plan | Omni and Craft | What to do |
|---|---|---|
| Pro | Yes | Do steps 2 to 7. |
| Free with export credits | Yes, each saved file uses one credit | Tell the user about the credits. Then do steps 2 to 7. |
| Free without credits | No files from the CLI | The user can try Omni and Craft in the Vois Studio window. For files, use the method in "Plans without Omni and Craft". |
| Subscriber | No | Use the method in "Plans without Omni and Craft". |
| AppSumo Lifetime | No | Use the method in "Plans without Omni and Craft". |

Do not buy a plan or credits for the user. Show the `purchase_url` from `vois-cli status --format json` (or https://vois.so/pricing). Then wait for the user.

## Step 2. Select Omni or Craft

| | Omni | Craft |
|---|---|---|
| `--engine` | `omni` | `craft` |
| Languages | 30 | 10: Chinese, English, French, German, Italian, Japanese, Korean, Portuguese, Russian, Spanish |
| Voices | Library, cloned and designed voices | Voices that have a recording: library voices, cloned voices with a transcript, designed voices |
| Free memory | Usual | About 9 GB on a Mac, 11 GB on Windows |

Use Omni if you are not sure. Use Craft for a voice that has a recording, when the computer has sufficient memory.

Get the voice IDs for the engine:

```bash
vois-cli voice list --engine omni --format json
```

An engine refuses a language that it does not speak. It does not change to a different engine.

## Step 3. Make the line clean

- Put only the spoken words in the text. Put each note about the read in the direction.
- Remove bracket tags, for example `[laugh]` or `[sigh]`. Omni and Craft remove them and do not say them.
- Put a laugh or a sigh in the words: "Ha, okay, that's a fair point." Then add "amused" to the direction.
- Write numbers and symbols as words.

## Step 4. Write the direction

Use this pattern. Use two to four of the parts:

**emotion** + **pace** + **energy or tone** + **change in the line**

Examples:

- "calm and warm, unhurried"
- "bright and excited, quick, building to the last sentence"
- "quiet and tense, slow, almost a whisper at the end"
- "tired but kind, slow, a soft smile"

Rules:

1. Use plain words, as for a voice actor.
2. Keep it less than 2,000 characters. Most good directions have 5 to 20 words.
3. Do not use brackets or parentheses: `( ) [ ]`. Vois Studio refuses them.
4. One `--instruct` applies to all of the text in one call. If two lines must have different directions, make two calls.
5. Tell how the voice sounds. Do not write a sound at a specified word. A direction cannot put a cough or a laugh at a specified time.
6. Do not give two opposite directions, for example "fast and slow".
7. A direction changes the performance. It does not change the speaker. For a new voice, use Voice Design (Pro).
8. Use "a little" or "slightly" for a small change. Use "very" only if the first take is too flat.

The library of directions for each type of content is in [direction patterns](references/direction-patterns.md).

## Step 5. Make the takes

Write a plan file. Give each line an ID, the text and the direction:

```json
{
  "engine": "omni",
  "voice": "narrators_ai_voices/morgan_vale",
  "language": "English",
  "seed": 7,
  "lines": [
    { "id": "open", "text": "The results came in this morning.", "instruct": "calm and warm, unhurried" },
    { "id": "turn", "text": "We did it. Every test passed.", "instruct": "bright and excited, rising energy" }
  ]
}
```

Make sure that the plan is correct. Then make the takes:

```bash
node scripts/direct-lines.mjs plan.json --out takes --dry-run
node scripts/direct-lines.mjs plan.json --out takes
```

The script is at `scripts/direct-lines.mjs` in this skill folder.

- `--dry-run` examines the plan and shows each command. It makes no audio.
- The script makes `takes/<id>.wav` for each line. It writes `takes/directions.json` with the seed, the length and the result of each take.
- `--takes 3` makes three takes of each line, with seeds 7, 1007 and 2007.
- `--only open,turn` makes only these lines again. `--force` replaces the files.
- It stops at the first error that will occur again on each line, for example exit code 7 or 11.

For one line, you can also use the command directly:

```bash
vois-cli tts generate --text "We did it. Every test passed." --engine omni --language English \
  --voice narrators_ai_voices/morgan_vale --seed 7 \
  --instruct "bright and excited, rising energy" --output /absolute/path/turn.wav --format json
```

## Step 6. Compare two directions

If you are not sure which direction is better, make the same line two times. Use the same seed and change only the direction:

```json
{
  "engine": "omni",
  "voice": "narrators_ai_voices/morgan_vale",
  "language": "English",
  "seed": 7,
  "lines": [
    { "id": "news-calm", "text": "We did it. Every test passed.", "instruct": "calm and warm, quiet pride" },
    { "id": "news-excited", "text": "We did it. Every test passed.", "instruct": "bright and excited, almost laughing" }
  ]
}
```

Tell the user to listen to the two files. Then keep the direction that the user selects.

## Step 7. Correct the take

| Problem | What to do |
|---|---|
| No change from the direction | Use more concrete words: "slow, with long pauses between sentences", not "thoughtful". |
| Too much performance | Add "a little" or "slightly". Remove one part of the direction. |
| The pace is not correct | Use `--speed` from 0.5 to 2.0. A direction about pace is not a measurement. |
| One word is incorrect | Correct the word in the text, or add a pronunciation entry. Do not change the direction. |
| The take is good, but one part is not | Make the take again with a new seed, for example `--takes 3`. |
| The emotion changes at the incorrect word | Divide the line into two lines, each with its own direction. |

In the Vois Studio window, you can add a direction to a part of a line. It applies until the next direction in the turn of that speaker. With vois-cli, one direction applies to all of the text in one call.

## Plans without Omni and Craft

Subscriber, AppSumo Lifetime and Free without credits do not have Omni or Craft in the CLI. Fast, Expressive, Multilingual and Sonic ignore `--instruct`. Do not send a direction to them. Put the direction into the script with these methods:

| Direction | Method without `--instruct` |
|---|---|
| Calm, slow | Short sentences. Full stops, not commas. `--speed 0.9`. |
| Excited, fast | Short lines with an exclamation mark at the end of the most important line. `--speed 1.1`. |
| Tense, then stronger | Very short sentences, then one long sentence. A pause token before the turn. |
| Sad, tired | Expressive with `[sigh]` before the line. Words that show it: "I don't know anymore." |
| Amused | Expressive with `[chuckle]` or `[laugh]` where the laugh starts. |
| Surprised | Expressive with `[gasp]`. A question: "Wait. All of them?" |
| Warm, personal | Speak to one listener: "you". Contractions. A voice with a warm tone from the voice library. |

The 9 Expressive tags are `[laugh]`, `[chuckle]`, `[gasp]`, `[sigh]`, `[groan]`, `[cough]`, `[clear throat]`, `[sniff]` and `[shush]`. Only Expressive uses them, and only in English.

```bash
vois-cli tts generate --text "[sigh] I told you this would happen." --engine expressive \
  --language English --voice narrators_ai_voices/morgan_vale --output /absolute/path/sigh.wav
```

Tell the user that Omni and Craft are on Pro. Show the `purchase_url`. Do not buy.

## If a command stops with an error

| Exit code or message | Cause | What to do |
|---|---|---|
| 1 with `OMNI_INVALID_DIRECTION` | The direction has a bracket or a parenthesis, or it has 2,000 characters or more. | Correct the direction. The render script finds these problems before it starts. |
| 2 | Vois Studio is not open. | Open Vois Studio, or start the service with `vois-cli service start`. |
| 4 | The voice ID is not in the voice list. | Get the list with `vois-cli voice list --engine omni --format json`. |
| 5 | The generation did not complete. | Make the line shorter. Try again one time. |
| 7 | The plan does not include Omni or Craft. | Use "Plans without Omni and Craft". Show the `purchase_url`. |
| 11 | The computer does not have sufficient free memory. | Close other apps, or use Omni, not Craft. |
| 12 or 13 | The engine did not download, or it is not available at this time. | Download it with `vois-cli model download --model omni` (or `craft`). |
| 64 | Vois Studio cannot identify the language. | Give `--language` with a language name. |

Vois Studio does not change to a different engine when a generation stops with an error. Do not change the engine without the approval of the user.

## Output

- One file for each line, with the direction that made it.
- `directions.json` with the seed, the direction and the length of each take.
- The direction and the seed of each take that the user selects. With them, you can usually make the same take again.
