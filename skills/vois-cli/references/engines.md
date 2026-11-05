# Engines, languages and voices

Vois Studio has six engines. Use only these six IDs with `--engine`: `fast`, `expressive`, `multilingual`, `omni`, `sonic`, `craft`.
`model list --format json` shows if each engine is installed (`installed`), loaded (`initialized`) and on this plan (`available`).

## Languages

Count: Fast 1 (plus 4 after a download), Expressive 1, Multilingual 23, Omni 30, Sonic 31, Craft 10.
"Download" for Fast means that the language operates after `model download --model fast --language <code>`. The code is `de`, `es`, `it` or `pt`.

| Language | Fast | Expressive | Multilingual | Omni | Sonic | Craft |
|---|---|---|---|---|---|---|
| Arabic |  |  | Yes | Yes | Yes |  |
| Bulgarian |  |  |  |  | Yes |  |
| Burmese |  |  |  | Yes |  |  |
| Chinese |  |  | Yes | Yes |  | Yes |
| Croatian |  |  |  |  | Yes |  |
| Czech |  |  |  |  | Yes |  |
| Danish |  |  | Yes | Yes | Yes |  |
| Dutch |  |  | Yes | Yes | Yes |  |
| English | Yes | Yes | Yes | Yes | Yes | Yes |
| Estonian |  |  |  |  | Yes |  |
| Finnish |  |  | Yes | Yes | Yes |  |
| French |  |  | Yes | Yes | Yes | Yes |
| German | Download |  | Yes | Yes | Yes | Yes |
| Greek |  |  | Yes | Yes | Yes |  |
| Hebrew |  |  | Yes | Yes |  |  |
| Hindi |  |  | Yes | Yes | Yes |  |
| Hungarian |  |  |  |  | Yes |  |
| Indonesian |  |  |  | Yes | Yes |  |
| Italian | Download |  | Yes | Yes | Yes | Yes |
| Japanese |  |  | Yes | Yes | Yes | Yes |
| Khmer |  |  |  | Yes |  |  |
| Korean |  |  | Yes | Yes | Yes | Yes |
| Lao |  |  |  | Yes |  |  |
| Latvian |  |  |  |  | Yes |  |
| Lithuanian |  |  |  |  | Yes |  |
| Malay |  |  | Yes | Yes |  |  |
| Norwegian |  |  | Yes | Yes |  |  |
| Polish |  |  | Yes | Yes | Yes |  |
| Portuguese | Download |  | Yes | Yes | Yes | Yes |
| Romanian |  |  |  |  | Yes |  |
| Russian |  |  | Yes | Yes | Yes | Yes |
| Slovak |  |  |  |  | Yes |  |
| Slovenian |  |  |  |  | Yes |  |
| Spanish | Download |  | Yes | Yes | Yes | Yes |
| Swahili |  |  | Yes | Yes |  |  |
| Swedish |  |  | Yes | Yes | Yes |  |
| Tagalog |  |  |  | Yes |  |  |
| Thai |  |  |  | Yes |  |  |
| Turkish |  |  | Yes | Yes | Yes |  |
| Ukrainian |  |  |  |  | Yes |  |
| Vietnamese |  |  |  | Yes | Yes |  |

- With `--engine`, an engine that cannot speak the language stops the task. Vois Studio does not send the task to a different engine.
- Give the language as a name, for example `--language Hindi`.
- With `--language auto`, Vois Studio finds the language from the text. Short text, names and mixed languages can stop with exit code 64 (`language_uncertain`). Give the language for all production work.
- A cloned voice keeps the accent of its recording. A different language does not give it a native accent.

## Select an engine

| Use | Engine |
|---|---|
| An English draft in a short time | Fast |
| English with reaction sounds, for example a laugh or a sigh | Expressive |
| A language in the Multilingual list, with a library voice | Multilingual |
| Direction in plain words, a language that only Omni speaks, or Voice Design (Pro) | Omni |
| Built-in voices on all plans, or a language that only Sonic speaks | Sonic |
| Direction in plain words for library voices, cloned voices or designed voices in its 10 languages (Pro) | Craft |

On Subscriber and AppSumo Lifetime plans, do not select Omni or Craft. The task stops with exit code 7.

## Direction and tags

| Engine | Reaction tags in the text | `--instruct` |
|---|---|---|
| Fast | Removed | Ignored |
| Expressive | Played | Ignored |
| Multilingual | Removed | Ignored |
| Omni | Removed | Used |
| Sonic | Removed | Ignored |
| Craft | Removed | Used |

Expressive plays these nine tags only: `[laugh]`, `[chuckle]`, `[gasp]`, `[sigh]`, `[groan]`, `[cough]`, `[clear throat]`, `[sniff]`, `[shush]`.
Do not write other tags, for example `[happy]` or `[whisper]`. No engine plays them.

Rules for `--instruct` (Omni and Craft):

- Write the direction in plain words, for example `"calm and steady, a slow pace"`.
- Use less than 2,000 characters.
- Do not use brackets or parentheses.
- One command has one direction for all of its text.
- Put the direction in `--instruct`, not in the text that the voice speaks.

## Voices and engines

| Voice | Engines |
|---|---|
| Library voices | Fast, Expressive, Multilingual, Omni, Craft. Not Sonic. |
| Built-in Fast voices (`alba` and other names) | Fast only. |
| Built-in Sonic voices (`sonic_<name>`) | Sonic only. |
| Cloned voices (`cloned_<slug>`) | The engines in `supported_engines`. Not Sonic. |
| Voices from Voice Design (`designed_<slug>`) | The engines in `supported_engines`. Not Sonic. |

The `supported_engines` field of each voice in `voice list --format json` is correct for that voice. Use it.

The ten Sonic voices:

| Male | Female |
|---|---|
| `sonic_cedar` (default) | `sonic_coral` |
| `sonic_harbor` | `sonic_juniper` |
| `sonic_slate` | `sonic_meadow` |
| `sonic_ridge` | `sonic_sage` |
| `sonic_ember` | `sonic_willow` |

## Speed and settings for Omni

| Flag | Range | Default |
|---|---|---|
| `--speed` | 0.5 to 2.0 | 1.0 |
| `--diffusion-steps` (Omni) | 4 to 64 | 10 |
| `--guidance-scale` (Omni) | 0.5 to 5.0 | 2.0 |

More diffusion steps make the task slower.

## Download and memory

| Engine | Download |
|---|---|
| Fast | 247 MB |
| Sonic | 381 MB |
| Expressive | 1.4 GB |
| Multilingual | 1.5 GB |
| Craft | 4.3 GB |
| Omni | 4.6 GB |

Craft uses approximately 9 GB of memory on a Mac and 11 GB on Windows.
If there is not sufficient memory, the task stops with exit code 11. Vois Studio does not use a different engine.

## Selected engine and loaded engine

- `tts generate` and `tts batch-file` use `--engine`, then `VOIS_ENGINE`, then `cli.toml`. They do not use the engine that the user selected in the app.
- `script generate` uses the engine that the user selected in the app.
- `model switch --engine <id>` loads an engine and changes the selected engine of the app. Get approval first.
- `tts_engine` in `status` and `active_engine` in `model status` show one engine in memory. It is not always the selected engine.
