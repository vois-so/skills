# Voices and engines

## Get the voice list

```bash
VOIS="/Applications/Vois.app/Contents/MacOS/vois-cli"   # Windows: "$env:LOCALAPPDATA\Vois\vois-cli.exe"
"$VOIS" voice list --source all --format json            # library, built-in, cloned and designed voices
"$VOIS" voice list --source all --engine omni --format json
"$VOIS" voice search --query "explainer" --format json  # search names, descriptions and tags
```

Each voice has an `id`, a `name`, a `description`, a `gender` and `supported_engines`. Give the `id` to `--voice` or to `"voice"` in `short.json` with no change. Library voices look like `explainers_ai_voices/clara_west`. Cloned voices start with `cloned_`. Voices from Voice Design start with `designed_`. Sonic voices look like `sonic_cedar`.

## Voices for Shorts

| Voice ID | Voice type |
| --- | --- |
| `hosts_ai_voices/alex_bright` | Energetic content host (male) |
| `energetic_ai_voices/young_american_female_voice` | Energetic and young (female) |
| `hosts_ai_voices/jamie_cruz` | Enthusiastic interviewer (female) |
| `hosts_ai_voices/the_nightowl` | Smooth late-night voice for mystery stories (male) |
| `storytellers_ai_voices/grandma_rose` | Warm and calm stories (female) |
| `announcers_ai_voices/thunder_mike` | Large trailer voice, for a dramatic hook (male) |

## Voices for video narration

These library voices work with Fast, Expressive, Multilingual, Omni and Craft:

| Voice ID | Voice type |
| --- | --- |
| `explainers_ai_voices/clara_west` | Clean, modern explainer (female) |
| `explainers_ai_voices/oscar_bell` | Calm tutorial voice (male) |
| `explainers_ai_voices/naveen_patel` | Calm technical instructor (male) |
| `explainers_ai_voices/june_rivers` | Bright voice for young viewers (female) |
| `narrators_ai_voices/david_sterling` | Documentary narrator (male) |
| `narrators_ai_voices/morgan_vale` | Story narrator (female) |
| `hosts_ai_voices/alex_bright` | Energetic content host (male) |
| `announcers_ai_voices/velvet_voice` | Premium brand voice (female) |

The list can change. Always get the current list with `voice list`.

## Engines

| Engine | Languages | Direction | Plan |
| --- | --- | --- | --- |
| Fast (`fast`) | English. German, Spanish, Italian and Portuguese after a download | None | Paid plans |
| Expressive (`expressive`) | English | Its own tags in the text, for example `[sigh]` | Paid plans |
| Multilingual (`multilingual`) | 23 languages | None | Paid plans |
| Omni (`omni`) | 30 languages | `--instruct` in plain words | Pro |
| Craft (`craft`) | 10 languages | `--instruct` in plain words. Library, cloned and designed voices only | Pro |
| Sonic (`sonic`) | 31 languages | None. Built-in `sonic_*` voices only | Paid plans |

The languages of each engine:

```text
Omni (30)          Arabic, Burmese, Chinese, Danish, Dutch, English, Finnish, French, German, Greek,
                   Hebrew, Hindi, Indonesian, Italian, Japanese, Khmer, Korean, Lao, Malay, Norwegian,
                   Polish, Portuguese, Russian, Spanish, Swahili, Swedish, Tagalog, Thai, Turkish, Vietnamese
Craft (10)         Chinese, English, French, German, Italian, Japanese, Korean, Portuguese, Russian, Spanish
Multilingual (23)  Arabic, Chinese, Danish, Dutch, English, Finnish, French, German, Greek, Hebrew, Hindi,
                   Italian, Japanese, Korean, Malay, Norwegian, Polish, Portuguese, Russian, Spanish,
                   Swahili, Swedish, Turkish
```

An engine refuses a language that it does not speak. It does not send the line to a different engine. Set the language with `"language"` in `short.json`. The script sends English when you do not set a language. With `auto`, the CLI can stop a short line with exit 64.

`vois-cli tts generate` does not use the engine that you selected in the app. The script always sends `--engine`. The default is `expressive`.

## Directions for Omni and Craft

Write the direction in plain words. Give the emotion, the pace and the energy:

- "warm and friendly, a smile in the voice"
- "calm and steady, unhurried"
- "energetic and bright, quick pace"
- "serious and low, short pauses"

Keep it below 2,000 characters. Do not use brackets or parentheses.

## Cloned voices

Use a cloned voice only with the consent of the person who owns that voice. This skill does not make clones.
