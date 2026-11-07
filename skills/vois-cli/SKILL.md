---
name: vois-cli
description: Operates Vois Studio from the command line with vois-cli to make voice audio files on the computer of the user. It finds the CLI and reads the plan from status. It selects an engine and a voice ID. It generates one file or a batch, makes a script with speakers, and exports for a platform. It also cancels a task and reads the exit codes. Use when the user says "generate a voiceover with Vois", "turn this text into a WAV", "batch these lines", "export this for Spotify", "use vois-cli", "automate Vois Studio" or "make audio with Vois". The CLI operates on the Pro plan, a Subscriber plan, AppSumo Lifetime Tier 2 or 3, or Free with export credits. On Free with no credits, only speak operates, and it speaks the text aloud with no file.
license: MIT
compatibility: Vois Studio 2.6.2+ on an Apple Silicon Mac or Windows, vois-cli (Vois Studio installs it), and optionally ffprobe or Node.js 18+ to examine the output files.
metadata:
  author: vois-so
  version: "0.2.0"
---

# Vois CLI

Use this skill to make voice audio with Vois Studio from a terminal or an agent.
vois-cli is a remote control for Vois Studio. It does not make audio itself.
Vois Studio must be open on the same computer, with the same user account.

## Hard rules

1. Use `status --format json` before each new task. Do the step that `next_action` gives.
2. Use vois-cli on the computer that has Vois Studio open, as the same user account of the computer. A cloud agent cannot connect to it.
3. Use an absolute path for each input file and each output file. Vois Studio opens the files in its own process.
4. Add `--format json` when you must read the result. The result goes to stdout. An error object goes to stderr.
5. Use only the voice IDs that `voice list` gives. Do not make an ID from a voice name.
6. Get approval from the user before a command that changes data in Vois Studio. The list is in [Commands that change data](#commands-that-change-data).
7. Do not replace a file of the user without approval.
8. Do not buy a plan or credits for the user. Do not fill in a checkout page. Show the `purchase_url` and wait for the user.
9. Clone a voice only with the consent of the person who owns the voice.
10. Do not read, type or keep a license key. The user types it.

## Step 1: Find vois-cli

Vois Studio installs the CLI. Use the full path.
Do not change PATH. Do not make an alias or a symbolic link.

| System | Full path |
|---|---|
| macOS (Apple Silicon) | `/Applications/Vois.app/Contents/MacOS/vois-cli` |
| Windows (64-bit) | `%LOCALAPPDATA%\Vois\vois-cli.exe` |

```bash
"/Applications/Vois.app/Contents/MacOS/vois-cli" --version
```

```powershell
& "$env:LOCALAPPDATA\Vois\vois-cli.exe" --version
```

If Vois Studio is in a different folder on Windows, get the folder name from the user.
In the commands below, `vois-cli` is the full path. Put the full path in each command.

## Step 2: Read the status

```bash
vois-cli status --format json
```

If the exit code is 2, Vois Studio is not open. Tell the user to open Vois Studio.
On a computer with no desktop session, get approval and then use `vois-cli service start`.
This command starts Vois Studio with no window.

| Field | What it shows |
|---|---|
| `status` | `running` when Vois Studio answers. |
| `version` | The version of Vois Studio. This skill agrees with 2.6.2 and 2.6.3. Some flags and exit codes are only in 2.6.3 and after. The text tells you which. |
| `cli_access_enabled` | `true` when this plan can use the CLI. |
| `access_mode` | `subscription` for a paid plan. `payg` for Free with export credits. |
| `plan_code`, `entitlement_tier` | The plan. Use these values, not your memory of the plans. |
| `credit_balance` | The export credits on Free. It is always 0 on a paid plan. |
| `next_action` | The next step. See the table below. |
| `purchase_url` | The page to show the user. If it is empty, use https://vois.so/pricing. |

| `next_action` | Do this |
|---|---|
| `ready` | Continue. |
| `register` | There is no license. Tell the user to get a Free license in Vois Studio. Then stop. |
| `buy_credits_or_subscribe` | Free with no credits. Only `speak` operates. Show `purchase_url`. Then stop. |
| `upgrade_plan` | This plan has no CLI, for example AppSumo Lifetime Tier 1. Show `purchase_url`. Then stop. |
| `connect_and_retry` | Vois Studio cannot examine the paid plan online. Tell the user to connect to the internet. Then use `status` again. |
| `contact_support` | Stop. Tell the user to send an email to `support@vois.so`. Do not do the last command again. |

## Step 3: Know what the plan permits

| Plan | What the CLI can do |
|---|---|
| Free | There is no general CLI. Only `speak --follow --play` operates. It speaks the text aloud and does not save it. Free is for non-commercial use. |
| Free with export credits | Generate and export files. Each file uses one credit. `export compile-script` and `export compile-project` do not operate. |
| Pro | All of the CLI, all six engines, Voice Design, voice cloning and commercial use. |
| Subscriber (closed to new sales) | The CLI and voice cloning. No Omni, no Craft and no Voice Design. |
| AppSumo Lifetime | Tier 2 and Tier 3 have the CLI. No Omni, no Craft and no Voice Design. Commercial use is on Tier 3 only. Tier 1 has only `speak`. |

If a command stops with exit code 7, the plan does not include that function.
Do not try the same command again on the same plan.
Use an engine that the plan includes, or show `purchase_url` to the user.

## Step 4: Select the engine

`tts generate` does not use the engine that the user selected in the app. Always give `--engine`.
Without `--engine`, Vois Studio selects the engine from the Expressive preset, the voice and the language.

| Engine | `--engine` | Languages | Voices | Direction | Plan |
|---|---|---|---|---|---|
| Fast | `fast` | English. German, Spanish, Italian and Portuguese after their download. | Library voices and the built-in Fast voices | None | All CLI plans |
| Expressive | `expressive` | English | Library, cloned and designed voices | Nine reaction tags, for example `[laugh]` | All CLI plans |
| Multilingual | `multilingual` | 23 languages | Library, cloned and designed voices | None | All CLI plans |
| Omni | `omni` | 30 languages | Library, cloned and designed voices | `--instruct` in plain words | Pro |
| Sonic | `sonic` | 31 languages | The ten built-in Sonic voices only | None. `--speed` sets the rate. | All plans |
| Craft | `craft` | 10 languages | Library, cloned and designed voices | `--instruct` in plain words | Pro |

- If an engine cannot speak the language, Vois Studio stops the task. It does not use a different engine.
- Only Omni and Craft use `--instruct`. Write it in plain words, in less than 2,000 characters, with no brackets and no parentheses.
- Only Expressive plays reaction tags. The other engines remove them.
- `model list --format json` shows each engine, if it is installed, and if it is `available` on this plan.

The language lists, the tags and the speed limits are in [engines](references/engines.md).

## Step 5: Select a voice

```bash
vois-cli voice list --source all --format json
vois-cli voice list --engine omni --gender female --format json
vois-cli voice search --query "narrator" --format json
vois-cli voice get --id podcasts_ai_voices/maya_brooks --format json
```

| Type of voice | ID | Example |
|---|---|---|
| Library | `category/slug` | `podcasts_ai_voices/maya_brooks`, `catalog/jules-en-v2` |
| Built-in Fast | a name | `alba` |
| Built-in Sonic | `sonic_<name>` | `sonic_cedar` |
| Cloned | `cloned_<slug>` | `cloned_marko` |
| From Voice Design | `designed_<slug>` | `designed_british_gentleman` |

Read these JSON fields: `id`, `name`, `source`, `gender`, `description`, `category`, `supported_engines`.
Some library voices also have `available_languages` and `tags`.

- The engine must be in `supported_engines` of the voice. If it is not, the task stops with exit code 1 and `data.reason: "incompatible_voice"`.
- In Vois Studio 2.6.3 and after, a voice ID that does not identify a voice stops with exit code 4 and `data.reason: "voice_not_found"`. This occurs on all engines, and in `speaker create` and `speaker update`. Use `voice list --source all --format json`, then use a correct ID. Do not try the same ID again.
- Sonic speaks only its built-in voices. Male: `sonic_cedar` (default), `sonic_harbor`, `sonic_slate`, `sonic_ridge`, `sonic_ember`. Female: `sonic_coral`, `sonic_juniper`, `sonic_meadow`, `sonic_sage`, `sonic_willow`.
- If a voice has `needs_recreate: true`, it cannot generate. The user must make it again in Vois Studio.
- Use a cloned voice only when the user tells you to use it. Its `consent_confirmed` must be `true`.

## Step 6: Generate one file

```bash
vois-cli tts generate --engine sonic --voice sonic_willow --language English \
  --text "Your export is ready." \
  --output "/Users/me/audio/ready.wav" --format json

vois-cli tts generate --engine omni --voice podcasts_ai_voices/maya_brooks --language English \
  --instruct "warm and calm, a slow pace" \
  --text "Welcome back to the show." \
  --output "/Users/me/audio/welcome.wav" --format json

# Long text from a file: --text - reads stdin
vois-cli tts generate --engine fast --voice podcasts_ai_voices/ellis_grant --language English \
  --text - --output "/Users/me/audio/intro.wav" --format json < "/Users/me/audio/intro.txt"
```

- Always give `--language`. With the default `auto`, short text can stop with exit code 64 and `data.reason: "language_uncertain"`.
- The output is a WAV file at 24 kHz, mono.
- The JSON result gives `path`, `duration_secs`, `engine_used`, `voice` and `credit_charged`.

Examine each file before you tell the user that it is complete:

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 "/Users/me/audio/ready.wav"
node scripts/wav-info.mjs "/Users/me/audio/ready.wav"
```

The file is correct when it is there, and its length is more than 0 seconds and near `duration_secs`.
[wav-info.mjs](scripts/wav-info.mjs) uses only Node.js 18+. Start it in the folder of this skill, or give its full path.

## Step 7: Generate a batch

Write one line of text for each output file. Vois Studio ignores empty lines.

```bash
vois-cli tts batch-file --input "/Users/me/audio/lines.txt" --output-dir "/Users/me/audio/out" \
  --engine fast --voice podcasts_ai_voices/maya_brooks --language English \
  --prefix line --skip-existing --format json
```

- The files are `line_0001.wav`, `line_0002.wav` and the subsequent numbers. The number counts only the lines with text.
- Vois Studio makes the output folder if there is no folder.
- For Omni and Craft, `--instruct` (or `-I`) applies to all lines.
- If one or more lines fail, the exit code is 5. `failed_lines` gives the line numbers. Correct those lines. Then do the same command again. `--skip-existing` keeps the files that are complete.
- In Vois Studio 2.6.3 and after, `--seed <number>` sends the same seed with each line. Sonic does not use the seed. A result with `"status": "success"` shows its `seed`, but not on Sonic. A result with `"status": "failed"` or `"status": "interrupted"` does not show a `seed`.

## Step 8: Make a script with speakers

Use a script for dialogue with two or more voices. Get approval first, because this makes a project in Vois Studio.

```bash
vois-cli project create --name "Episode 1" --format json
vois-cli script create --project 128 --title "Episode 1" --content-file "/Users/me/ep1.txt" --format json
vois-cli speaker create --script 246 --name Host --voice podcasts_ai_voices/maya_brooks --format json
vois-cli speaker create --script 246 --name Guest --voice podcasts_ai_voices/ellis_grant --format json
vois-cli script generate --id 246 --language English --format json
vois-cli export compile-script --script 246 --format json
```

- Each line of the script file starts with `[Speaker Name]:`. The speaker name must be the same as the `--name` of a speaker, with the same capital letters.
- Make the script with its text first. Then add the speakers. In Vois Studio 2.6.3 and after, `speaker create` adds a speaker only if the script text has the speaker tag of that speaker. If not, the command stops with exit code 1 and `data.reason: "speaker_not_in_script"`.
- `[pause=800]` on its own line adds 800 ms of silence.
- `script generate` uses the engine that the user selected in Vois Studio. Read `engine_used` in the result. In Vois Studio 2.6.3 and after, `--engine <id>` sets the engine for this command only. `--instruct` (or `-I`) gives a direction to each line for Omni and Craft. `--engine` does not change the selected engine of the app. Before the audio starts, Vois Studio examines the language of each line.
- `model switch --engine <id>` changes the selected engine of the app. Get approval first.
- `export compile-script` writes `audio/script_<id>.wav` in the data folder of Vois Studio. The human output shows the full path. In Vois Studio 2.6.3 and after, `--output <absolute path>` also writes a copy to that path, and the JSON result has `output`. Then use `export with-profile` to make the file for the user.
- On Free with export credits, `export compile-script` does not operate. Use `tts generate` for each line.

The script format, the speaker rules and the clean-up steps are in [scripts](references/scripts.md).

## Step 9: Export for a platform

```bash
vois-cli export with-profile --input "/Users/me/audio/episode.wav" \
  --output "/Users/me/audio/episode.mp3" --profile spotify_podcasts --format json
```

| `--profile` | Format | Loudness | Use the suffix |
|---|---|---|---|
| `acx_audiobook` | MP3 | -20 LUFS (-17 LUFS in 2.6.3 and after) | `.mp3` |
| `apple_podcasts` | AAC | -16 LUFS | `.m4a` |
| `spotify_podcasts` | MP3 | -16 LUFS | `.mp3` |
| `youtube_video` | AAC | -14 LUFS | `.m4a` |
| `generic_hq` | WAV | -19 LUFS | `.wav` |

- An export must have 5 seconds of audio or more. Shorter audio stops with exit code 64 and `data.reason: "audio_too_short"`. Put the lines together into a longer file. Do not add silence to hide an empty file.
- The JSON result gives `mastering.output_lufs` and `mastering.target_met`. Tell the user if `target_met` is `false`.
- `export mp3` and `export audio` make other formats. Their flags are in [commands](references/commands.md).

## Cancel a task

- Press Ctrl-C in the shell that started the task. This stops only that task.
- From a different shell, use `vois-cli tts cancel --format json`. The result `{"cancelled": true}` shows that a task stopped.
- `tts cancel` stops all tasks that CLI clients started. It does not stop a task in the app, or the voice from `speak`.
- A canceled task stops with exit code 130 and `data.reason: "cancelled"`. It writes no output file.
- Do not start the task again if the user does not tell you to.

## Exit codes

| Exit code | What it shows | Do this |
|---|---|---|
| 0 | Success | Examine the output file. |
| 1 | General error, also `incompatible_voice` | Read the message. Select a voice that the engine can speak. |
| 2 | Vois Studio is not open | Tell the user to open Vois Studio. |
| 3 | Arguments that are not correct, or a delete with no `--force` | Correct the command. Get approval before you add `--force`. |
| 4 | Not found | Get the ID again from a list command. |
| 5 | The generation fails, also for part of a batch | Read the message and `failed_lines`. Generate only those lines again. |
| 6 | The export fails | Use `status`. Read [errors](references/errors.md) before you try again. |
| 7 | A license is necessary | Stop. Show `purchase_url`. |
| 8 | The quota is full | Stop. Tell the user. |
| 9 | Timeout | Vois Studio did not answer. Wait, then try one time. |
| 10 | The Sonic queue is full | Wait a short time, then try again. |
| 11 | Not sufficient memory for the engine | Tell the user to close other apps, or use a smaller engine. |
| 12 | The model download fails | Make sure that there is a connection. Get approval before you download again. |
| 13 | The engine package is not available at this time | Use a different engine. Tell the user. |
| 64 | A flag is not correct, `language_uncertain` or `audio_too_short` | Correct the flags, add `--language`, or make the audio longer. |
| 130 | Canceled | Do not start the task again automatically. |

The `data.reason` values and the export credit recovery steps are in [errors](references/errors.md).

## Commands that change data

Get approval from the user before you use these commands:

- `service start`, `service stop`
- `license activate`, `license deactivate`, `credits reconcile`
- `model switch`, `model download` (a download can be 5 GB)
- `voice clone`, `voice clone-delete`, `voice design-delete`
- `project`, `script` and `speaker` commands that create, update, delete or reorder
- `script generate` (it replaces the current takes of the script)
- `mastering set`, `mastering reset`, `pronunciation` changes, `settings set-consent`

These commands only read data, and approval is not necessary: `status`, `voice list`, `voice get`, `voice search`, `model list`, `model status`, `tts status`, `export profiles`, `project list`, `script get`, `script segments`, `speaker list`.

A delete command stops with exit code 3 if you do not add `--force`. Add `--force` only after the user gives approval for the delete.

## Checkout is for the user only

- Show the `purchase_url` from `status`. If it is empty, show https://vois.so/pricing.
- Do not select a plan or a credit pack for the user. Do not open or fill in a checkout page.
- When the user tells you that the checkout is complete, use `vois-cli credits sync --format json` one time.
- If `credit_balance` stays at 0, do `credits sync` again, a maximum of five times in 30 seconds.
- If the balance stays at 0, tell the user to send the receipt to `support@vois.so`. Do not buy again.

## Speak the text aloud

`speak` speaks the text aloud on this computer with a Sonic voice, on all plans. It does not save a file.

```bash
printf 'The export is complete.\n' | vois-cli speak --follow --play --language English --voice sonic_cedar
```

You must give `--follow` and `--play`. For a Sonic file, use `tts generate --engine sonic` (Step 6).

## More information

- [commands](references/commands.md): the flags of each command that this skill uses, from `--help` of versions 2.6.2 and 2.6.3.
- [engines](references/engines.md): languages, tags, direction, and the rules for engines and voices.
- [scripts](references/scripts.md): script format, speakers, pauses and clean-up.
- [errors](references/errors.md): `data.reason` values, export credit recovery and timeouts.

If this skill and the installed `vois-cli <group> <command> --help` do not agree, use `--help`.
