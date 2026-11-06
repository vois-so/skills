# vois-cli commands

This file gives the flags of the commands that the vois-cli skill uses.
The flags come from `vois-cli <group> <command> --help` of Vois Studio 2.6.2 and 2.6.3. A flag that is only in 2.6.3 and after shows "2.6.3+".
If a flag is not in this file, look at `--help` before you use it.

All commands accept `--format human`, `--format json` or `--format quiet` (or `-f`).
The default is `human`. Use `json` when a script or an agent reads the result.
Vois Studio uses the first value that it finds: the flag, the environment, `cli.toml`, and then the built-in default.

| In `cli.toml` | In the environment | Values |
|---|---|---|
| `format` | `VOIS_FORMAT` | `human`, `json`, `quiet` |
| `voice` | `VOIS_VOICE` | a voice ID |
| `engine` | `VOIS_ENGINE` | `fast`, `expressive`, `multilingual`, `omni`, `sonic`, `craft` |
| `quality` | `VOIS_QUALITY` | the same six values |
| `language` | `VOIS_LANGUAGE` | a language name, for example `English` |

A key that is not correct in `cli.toml` stops each command with exit code 3. Do not make or change `cli.toml` without approval.

## status

```bash
vois-cli status --format json
```

No other flags. The fields are in the skill, Step 2.

## service

| Command | Flags | What it does |
|---|---|---|
| `service start` | `--wait <SECS>` (default 60) | Starts Vois Studio with no window. If Vois Studio is open, it does nothing. |
| `service stop` | `--wait <SECS>` (default 30) | Stops the service only. It cannot stop the desktop app. |
| `service status` | none | Shows the host: `gui` for the desktop app, or the service. |

## license and credits

| Command | Flags | What it does |
|---|---|---|
| `license status` | none | Shows the license and the access. |
| `license activate` | `[KEY]`, `--force` | The user types the key, or gives it on stdin. `--force` removes the key from a different device. |
| `license deactivate` | `--yes` (`-y`) | Removes the license from this computer. With `--format json`, `--yes` is necessary. |
| `credits sync` | none | Gets the export credit balance from the server. |
| `credits reconcile` | `--charge <ID>` | Use it only when `support@vois.so` tells the user to use it. |

## tts generate

```bash
vois-cli tts generate --engine <id> --voice <id> --language <name> \
  --text "<text>" --output "<absolute path>.wav" --format json
```

| Flag | Value | Notes |
|---|---|---|
| `-t`, `--text` | text, or `-` | `-` reads stdin. Text on stdin also operates without `--text`. |
| `-v`, `--voice` | a voice ID | Default: `VOIS_VOICE`, then `cli.toml`. Sonic uses `sonic_cedar` if there is no Sonic voice. |
| `-o`, `--output` | a path, or `-` | This flag is necessary. `-` writes the WAV bytes to stdout. |
| `-s`, `--speed` | 0.5 to 2.0 | Default 1.0. |
| `-q`, `--quality` | an engine ID | A preference only. Default `expressive`. |
| `--engine` | an engine ID | The engine for this task. Use it each time. |
| `-l`, `--language` | a name or `auto` | Default `auto`. Give the language each time. |
| `--seed` | a number | The same seed can give the same audio on some engines. |
| `-i`, `--instruct` | plain words | Omni and Craft only. The other engines ignore it. |
| `--diffusion-steps` | 4 to 64 | Omni only. Default 10. |
| `--guidance-scale` | 0.5 to 5.0 | Omni only. Default 2.0. |
| `--voice-design-instruct` | plain words | Omni only. A description of the voice. |

With `--output -`, stdout has only the audio. The result line goes to stderr.

## tts batch-file

| Flag | Value | Notes |
|---|---|---|
| `-i`, `--input` | a text file, or `-` | One line of text for each output file. |
| `-o`, `--output-dir` | a folder | This flag is necessary. |
| `-p`, `--prefix` | text | Default `line`. The files are `<prefix>_0001.wav` and the subsequent numbers. |
| `--skip-existing` | none | Does not generate a line again if its file is there. |
| `-I`, `--instruct` | plain words | Omni and Craft only. It applies to all lines. The short flag is a capital `I`. |
| `--seed` | a number | 2.6.3+. The same seed for all lines. Each item of `results` shows its `seed`. |

`--voice`, `--speed`, `--language`, `--quality`, `--engine`, `--diffusion-steps`, `--guidance-scale` and `--voice-design-instruct` are the same as in `tts generate`.

The JSON result has `total`, `success`, `failed`, `skipped`, `failed_lines`, `interrupted` and `results`.

## Other tts commands

| Command | Flags | What it does |
|---|---|---|
| `tts preview` | `--voice`, `--text`, `--language` | Makes an encrypted audition in Vois Studio. It writes no file that you can play. It has no `--engine` flag, and it does not operate with Sonic voices. |
| `tts silence` | `-d`, `--duration <MS>` (necessary), `-o`, `--output` | Writes a silent WAV file. |
| `tts generate-voice-design` | `-d`, `--voice-design` (necessary), `-t`, `-o`, `-s`, `-l`, `--diffusion-steps`, `--guidance-scale` | Pro only. Makes audio from a description of a voice, with Omni. It does not save a voice. |
| `tts cancel` | none | Stops the tasks that CLI clients started. |
| `tts status` | none | Shows the engine that is in memory. |

## voice

| Command | Flags | What it does |
|---|---|---|
| `voice list` | `--source <type>`, `--engine <id>`, `--gender <male or female>`, `--category <slug>` | Shows the voices. The type is `library`, `builtin`, `cloned`, `designed` or `all` (default). |
| `voice get` | `-i`, `--id <ID>` | Shows one voice. An ID that is not there gives exit code 4. |
| `voice search` | `-q`, `--query <TEXT>` | Finds words in the name, the description and the tags. |
| `voice clone-list` | none | Shows the cloned voices. |
| `voice design-list` | none | Shows the designed voices. |
| `voice clone` | `-a`, `--audio <PATH>`, `-n`, `--name`, `--transcript`, `--consent-confirmed`, `--notes` | Clones a voice from 5 to 60 seconds of audio. The transcript must be the words in the recording. Only with the consent of the owner of the voice. |
| `voice clone-delete` | `-s`, `--slug`, `--force` | Deletes a cloned voice. |
| `voice design-delete` | `-s`, `--slug`, `--force` | Deletes a designed voice. |

## project, script and speaker

| Command | Flags |
|---|---|
| `project create` | `-n`, `--name` (necessary), `-d`, `--description` |
| `project list` | none |
| `project get` | `-i`, `--id` |
| `project update` | `-i`, `--id`, `-n`, `--name`, `-d`, `--description` |
| `project delete` | `-i`, `--id`, `--force` |
| `script create` | `-p`, `--project`, `-t`, `--title`, `-c`, `--content`, `--content-file <PATH or ->` |
| `script list` | `-p`, `--project` |
| `script get` | `-i`, `--id` |
| `script update` | `-i`, `--id`, `-t`, `--title`, `-c`, `--content`, `--content-file` |
| `script delete` | `-i`, `--id`, `--force` |
| `script reorder` | `-p`, `--project`, `-o`, `--order <ID,ID,...>` |
| `script generate` | `-i`, `--id`, `-v`, `--voice` (default voice for a line with no speaker), `-s`, `--speed`, `-l`, `--language`, `--engine <id>` (2.6.3+), `-I`, `--instruct` (2.6.3+) |
| `script segments` | `-i`, `--id` |
| `speaker create` | `-s`, `--script`, `-n`, `--name`, `-v`, `--voice`, `-c`, `--color <hex>` |
| `speaker list` | `-s`, `--script` |
| `speaker update` | `-i`, `--id`, `-v`, `--voice`, `-b`, `--blend <JSON>` |
| `speaker delete` | `-i`, `--id` |

In 2.6.3 and after, `script generate --engine` sets the engine for this command only. It does not change the selected engine of the app. `VOIS_ENGINE` and `cli.toml` do not apply to `script generate`. `--instruct` gives a direction to each line. Omni and Craft use it. In 2.6.2, `script generate` has no `--engine` flag and no `--instruct` flag.

In 2.6.3 and after, `speaker create` and `speaker update` do not accept a voice ID that does not identify a voice. They stop with exit code 4 and `data.reason: "voice_not_found"`, and the speaker does not change.

## export

| Command | Flags | What it does |
|---|---|---|
| `export with-profile` | `-i`, `--input`, `-o`, `--output`, `-p`, `--profile` | Masters the audio to the loudness of the export profile. |
| `export mp3` | `-i`, `-o`, `-b`, `--bitrate` (64, 128, 192, 256 or 320, default 192) | Makes an MP3 file. |
| `export audio` | `-i`, `-o`, `--audio-format <format>`, `-b`, `--bit-depth <16, 24 or 32>`, `--sample-rate`, `--normalize`, `--target-lufs` | Makes a file in a different format: `mp3` (default), `wav`, `flac`, `aac` or `m4a`. `--normalize` uses the values from `mastering set`. |
| `export compile-script` | `-s`, `--script`, `-o`, `--output <absolute path>` (2.6.3+) | Puts the lines of a script together into one WAV file in the data folder of Vois Studio. `--output` also writes a copy to the path. The JSON result then has `output`. `-` is not accepted. |
| `export compile-project` | `-p`, `--project`, `-o`, `--output <absolute path>` (2.6.3+) | Puts the scripts of a project together into one file. `--output` is the same as for `compile-script`. |
| `export profiles` | none | Shows the export profiles. |
| `export profile` | `-i`, `--id` | Shows one export profile. |

The input of an export must be a WAV file with 5 seconds of audio or more.

## model

| Command | Flags | What it does |
|---|---|---|
| `model list` | none | Shows the six engines, the download in MB or GB, and if Vois Studio installed each engine. |
| `model status` | none | Shows the engines that are in memory. |
| `model download` | `-m`, `--model <id>`, `-l`, `--language <code>` (Fast only) | Downloads an engine and waits until the install is complete. For Fast, the code is `en` (default), `de`, `es`, `it` or `pt`. |
| `model switch` | `-e`, `--engine <id>`, `--provider <name>`, `--quant <name>` | Loads an engine and makes it the selected engine of the app. The provider is `auto` (default), `coreml`, `directml`, `cpu` or `cuda`. The quant is `auto` (default), `fp16` or `fp32`. |

## speak

```bash
printf 'Text to speak.\n' | vois-cli speak --follow --play --language English --voice sonic_cedar
```

| Flag | Notes |
|---|---|
| `--follow` | Necessary. Reads stdin and speaks each phrase when the phrase ends. |
| `--play` | Necessary. Plays the voice on the default output device. It does not save the voice. |
| `-v`, `--voice` | A Sonic voice. Default `sonic_cedar`. |
| `-s`, `--speed` | 0.5 to 2.0. Default 1.0. |
| `-l`, `--language` | Give the language. With `auto`, a short first phrase can stop with exit code 64. |
| `--seed` | A number for the same result each time. |
| `--owner-key`, `--cancel-session <ID>` | Stop a speak session from a different shell. |
