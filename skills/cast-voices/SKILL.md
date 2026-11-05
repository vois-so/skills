---
name: cast-voices
description: Casts Vois Studio voices for each role in a brief. Examples are the hosts of a podcast, the characters of an audiobook or a game, and the narrator of an explainer. It reads the plan from status and selects an engine for the language and the plan. It makes a short list from the voice list with the description, category, gender and engines of each voice. It writes a cast table with the role, voice ID, engine and the cause for each selection, and one preview command for each voice. Use when the user says "cast voices for my podcast", "pick voices for these characters", "which Vois voice fits my narrator", "find two hosts that sound different" or "audition voices for this script". Preview files are possible on a plan with the CLI (Pro, Subscriber, AppSumo Lifetime Tier 2 or 3) or on Free with export credits. Omni and Craft are on Pro only. On Free with no credits, the user can only listen to the ten Sonic voices aloud with speak.
license: MIT
compatibility: Vois Studio 2.6.2+ on an Apple Silicon Mac or Windows, vois-cli (Vois Studio installs it), Node.js 18+ for the scripts, and optionally ffprobe.
metadata:
  author: vois-so
  version: "0.1.0"
---

# Cast voices

Use this skill to select one Vois Studio voice for each role in a project.
The result is a cast table, one preview command for each voice, and one preview file for each voice when the plan permits files.
The cast is a proposal. The user listens and gives the last decision.

## Inputs

| Input | Example | If it is not in the brief |
|---|---|---|
| Type of project | A podcast with two hosts | Get it from the user. |
| Roles | Sam: the lead host, warm. Alex: the co-host, full of energy. | Get the roles from the user. |
| Tone | Friendly and curious | Use the type of project to find a tone. |
| Language | English | Get it from the user. Do not guess. |
| Plan | Pro | Read it from `status` (Step 1). |
| A line for each role | A line from the script | Write one short line in the language of the project. |
| Output folder | `/Users/me/show/cast` | Get it from the user. Use an absolute path. |

## Output

- `cast.md` in the output folder: the brief, the cast table, the preview commands and the notes.
- One preview WAV file for each voice, if the plan permits files. Each file has one line of 3 to 8 seconds.

## Rules

1. Use only voice IDs from `voice list`. Do not make an ID from a voice name.
2. Use a cloned voice only when the user tells you to use it. Its `consent_confirmed` must be `true`.
3. Do not make a project, a script, a speaker, a clone or a designed voice. This skill only reads data and writes preview files.
4. Do not change the selected engine of the app. Do not use `model switch`.
5. Do not buy a plan or credits. Show the `purchase_url` from `status` and wait for the user.
6. Write why you selected a voice from the voice data only. Do not tell the user about an accent, an age or a quality that the data does not give.

## Step 1: Find vois-cli and read the plan

Use the full path. Do not change PATH. Do not make an alias or a symbolic link.

| System | Full path |
|---|---|
| macOS (Apple Silicon) | `/Applications/Vois.app/Contents/MacOS/vois-cli` |
| Windows (64-bit) | `%LOCALAPPDATA%\Vois\vois-cli.exe` |

In the commands below, `vois-cli` is the full path.

```bash
vois-cli status --format json
```

If the exit code is 2, Vois Studio is not open. Tell the user to open Vois Studio, then do Step 1 again.
Read `plan_code`, `access_mode`, `next_action` and `purchase_url`. Then find the row for the plan:

| Plan from `status` | Voices to cast | Engines | How the user listens |
|---|---|---|---|
| Pro (`plan_code: pro`) | Library, Sonic, cloned and designed voices | All six | A WAV file from `tts generate` |
| Subscriber, AppSumo Lifetime Tier 2 or 3 (`access_mode: subscription`) | Library, Sonic and cloned voices | Fast, Expressive, Multilingual, Sonic | A WAV file from `tts generate` |
| Free with export credits (`access_mode: payg`) | Library and Sonic voices | Fast, Expressive, Multilingual, Sonic | A WAV file. Each file uses one export credit. |
| Free with no credits (`next_action: buy_credits_or_subscribe`) | The ten Sonic voices only | Sonic | Aloud with `speak`. There is no file. |
| AppSumo Lifetime Tier 1 (`next_action: upgrade_plan`) | The ten Sonic voices only | Sonic | Aloud with `speak`. There is no file. |

Omni, Craft and Voice Design are on Pro only.
On Free with no credits and on Tier 1, `voice list` does not operate. Cast from the Sonic table in [casting guide](references/casting-guide.md).
If a command stops with exit code 7, the plan does not include it. Use a different engine, or show `purchase_url`.

## Step 2: Select one engine for the project

Use the same engine for all roles. Then the voices have the same sound quality.

| Language and use | Engine |
|---|---|
| English, all plans with files | `expressive` |
| English, a fast draft | `fast` |
| English, direction in plain words for each line (Pro) | `omni` or `craft` |
| A language in the Multilingual list | `multilingual` |
| A language that only Omni speaks (Pro) | `omni` |
| A language that only Sonic speaks, or Free with no credits | `sonic` |

The language table for each engine is in [casting guide](references/casting-guide.md).
Sonic speaks only its ten built-in voices. Library voices do not operate with Sonic.

## Step 3: Make a short list for each role

Use [shortlist.mjs](scripts/shortlist.mjs). It reads `voice list --source all --format json` and prints the best voices for the role.

```bash
node scripts/shortlist.mjs --engine expressive --gender female --category podcast \
  --match "warm friendly host guide" --limit 8
node scripts/shortlist.mjs --engine expressive --gender male --category podcast \
  --match "energetic curious tech host" --exclude podcasts_ai_voices/maya_brooks --limit 8
```

| Flag | Use |
|---|---|
| `--engine` | Keep the voices that have this engine in `supported_engines`. |
| `--gender` | `male` or `female`. Use it only when the brief gives it, or to make two roles different. |
| `--category` | A part of the category slug, for example `podcast`, `audiobook`, `narrator` or `villain`. |
| `--match` | Words from the role and the tone. Each word in the name, description, category or tags adds one point. |
| `--language` | A language code, for example `de`. It removes a voice if its `available_languages` does not include the code. |
| `--exclude` | Voice IDs that other roles use. |
| `--source` | `library` (default), `builtin`, `cloned`, `designed` or `all`. With `--engine sonic`, the default is `builtin`. |
| `--from` | A saved copy of the voice list, for an agent with no access to vois-cli. |

Start it in the folder of this skill, or give its full path.
If Node.js is not there, use `vois-cli voice list --engine <id> --gender <g> --category <slug> --format json` and read the JSON.

Some library voices have only a category word as the description, for example `podcasts`. Use the name and the tags of those voices. Listen to them before you select them.

## Step 4: Select one voice for each role

1. **Fit.** The description or the category must agree with the function of the role and the tone.
2. **Contrast.** Roles that speak to each other must have voices that are clearly different. Use a different gender, or different energy words, for example "calm" and "energetic".
3. **One voice, one role.** Do not use one voice for two roles. Give the IDs of the selected voices to `--exclude`.
4. **Engine.** The engine of Step 2 must be in `supported_engines` of the voice.
5. **Language.** If the voice has `available_languages`, it must include the language of the project.
6. **Alternative.** Keep an alternative voice for each role. Write it in the notes. The alternative voice must keep the contrast.

## Step 5: Write the cast table

Write `cast.md` in the output folder. Use this format:

```markdown
# Cast: <project name>

Brief: <type of project>, <language>, <tone>. Plan: <plan>. Engine: <engine>.

| Role | Voice ID | Voice name | Engine | Reason |
|---|---|---|---|---|
| Sam (lead host) | `podcasts_ai_voices/maya_brooks` | Maya Brooks | expressive | "Warm Solo Host": warm and friendly, for the host who leads the talk. Female, a contrast with Alex. |
| Alex (co-host) | `podcasts_ai_voices/kai_mercer` | Kai Mercer | expressive | "Tech Creator": bright, for a tech show and the questions of a co-host. Male, a contrast with Sam. |

Second choices: Sam: `<id>`. Alex: `<id>`. Each second choice keeps the contrast.
```

Write one or two short sentences for each voice in the last column. Give the words of the description in quotation marks.

## Step 6: Give one preview command for each voice

Write one command for each voice in `cast.md`, below the table. Use the line of the role.

Pro, Subscriber, AppSumo Lifetime Tier 2 or 3, and Free with export credits:

```bash
vois-cli tts generate --engine expressive --voice podcasts_ai_voices/maya_brooks --language English \
  --text "Hi, I'm Sam. Welcome to Byte Size." --output "/Users/me/show/cast/preview-sam.wav" --format json
```

Free with no credits, and AppSumo Lifetime Tier 1 (Sonic voices only, aloud, no file):

```bash
printf "Hi, I'm Sam. Welcome to Byte Size.\n" | vois-cli speak --follow --play --language English --voice sonic_coral
```

- `speak` plays the voice aloud on this computer. It does not save a file. You must give `--follow` and `--play`.
- Do not give `tts preview` to the user as a preview. On all plans, it makes an encrypted audition in Vois Studio and writes no file that the user can play. It has no `--engine` flag, and it does not operate with Sonic voices.
- On Free with export credits, each preview file uses one credit. Tell the user the number of files, and get approval before Step 7.

## Step 7: Make and examine the preview files

Use the commands of Step 6. Give `--engine` and `--language` each time.
Then examine each file:

```bash
node scripts/wav-info.mjs /Users/me/show/cast/preview-*.wav
ffprobe -v error -show_entries format=duration -of csv=p=0 "/Users/me/show/cast/preview-sam.wav"
```

A file is correct when it is there and its length is more than 0 seconds. A line of 6 to 12 words gives approximately 2 to 5 seconds.
On Free with no credits, do not play `speak` commands if the user does not tell you to. Give the commands to the user.

| Problem | Exit code | Do this |
|---|---|---|
| Vois Studio is not open | 2 | Tell the user to open Vois Studio. |
| The voice ID is not correct | 4 | Get the ID again from `voice list`. |
| The engine cannot speak the voice (`incompatible_voice`) | 1 | Select a voice with the engine in `supported_engines`. |
| The language is not clear (`language_uncertain`) | 64 | Add `--language`. |
| The plan does not include the engine | 7 | Use an engine of the plan (Step 1), or show `purchase_url`. |
| The audio is almost silent (`near_silent`) | 5 | Write a longer line, or select the second voice. |
| The Sonic queue is full | 10 | Wait a short time, then try again. |

## Step 8: Give the result to the user

1. Show the cast table and the paths of the preview files.
2. Tell the user to listen to each file with headphones.
3. Get the decision of the user for each role. If the user does not like a voice, use the alternative voice. Then do Step 7 again for that role.
4. When the user gives approval, the cast is complete. Write `Approved` and the date in `cast.md`.

## More information

- [casting guide](references/casting-guide.md): categories and words for each type of project, the languages of each engine, the Sonic voices, and an example.
- [shortlist.mjs](scripts/shortlist.mjs) and [wav-info.mjs](scripts/wav-info.mjs): the two scripts. Each script shows how to use it at the top.
