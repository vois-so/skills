# Engines and tags

Select the engine before you write. This page gives the languages and the text cues for each engine of Vois Studio.

## Languages

| Engine | Count | Languages |
|---|---|---|
| Fast | 5 | English. German, Spanish, Italian and Portuguese after `vois-cli model download --model fast --language de` (or `es`, `it`, `pt`). |
| Expressive | 1 | English. |
| Multilingual | 23 | Arabic, Chinese, Danish, Dutch, English, Finnish, French, German, Greek, Hebrew, Hindi, Italian, Japanese, Korean, Malay, Norwegian, Polish, Portuguese, Russian, Spanish, Swahili, Swedish, Turkish. |
| Omni | 30 | Arabic, Burmese, Chinese, Danish, Dutch, English, Finnish, French, German, Greek, Hebrew, Hindi, Indonesian, Italian, Japanese. Also Khmer, Korean, Lao, Malay, Norwegian, Polish, Portuguese, Russian, Spanish, Swahili, Swedish, Tagalog, Thai, Turkish, Vietnamese. |
| Sonic | 31 | Arabic, Bulgarian, Croatian, Czech, Danish, Dutch, English, Estonian, Finnish, French, German, Greek, Hindi, Hungarian, Indonesian. Also Italian, Japanese, Korean, Latvian, Lithuanian, Polish, Portuguese, Romanian, Russian, Slovak, Slovenian, Spanish, Swedish, Turkish, Ukrainian, Vietnamese. |
| Craft | 10 | Chinese, English, French, German, Italian, Japanese, Korean, Portuguese, Russian, Spanish. |

An engine refuses a language that it does not speak. It does not change to a different engine. Select an engine that speaks the language of the script.

## Voices

| Engine | Voices |
|---|---|
| Fast, Expressive, Multilingual | Library voices and cloned voices. |
| Omni | Library voices, cloned voices and designed voices. |
| Craft | Each voice that has a recording: library voices, cloned voices with a transcript, and designed voices. No built-in voices. |
| Sonic | Only the ten built-in Sonic voices: `sonic_cedar`, `sonic_harbor`, `sonic_slate`, `sonic_ridge`, `sonic_ember`, `sonic_coral`, `sonic_juniper`, `sonic_meadow`, `sonic_sage`, `sonic_willow`. |

Get the voice IDs for an engine with this command:

```bash
vois-cli voice list --engine omni --format json
```

A cloned voice keeps the accent of its recording. For a natural read in a different language, use a voice that was recorded in that language.

## Cues that each engine acts on

| Cue | Fast | Expressive | Multilingual | Omni | Sonic | Craft |
|---|---|---|---|---|---|---|
| Words and punctuation | Yes | Yes | Yes | Yes | Yes | Yes |
| The 9 reaction tags | Removed | Acts on them | Removed | Removed | Removed | Removed |
| `--instruct` direction | Ignored | Ignored | Ignored | Acts on it | Ignored | Acts on it |
| `--speed` from 0.5 to 2.0 | Yes | Yes | Yes | Yes | Yes | Yes |
| `[pause=NNN]` in a script | Yes | Yes | Yes | Yes | Yes | Yes |

`[pause=NNN]` applies when Vois Studio generates a script. A direct `vois-cli tts generate` call removes it.

## The 9 reaction tags of Expressive

| Tag | What the listener hears |
|---|---|
| `[laugh]` | A laugh |
| `[chuckle]` | A soft laugh |
| `[gasp]` | A sharp breath in |
| `[sigh]` | A long breath out |
| `[groan]` | A groan |
| `[cough]` | A cough |
| `[clear throat]` | The speaker clears the throat |
| `[sniff]` | A sniff |
| `[shush]` | A sound that asks for quiet |

Put the tag where the reaction starts:

```text
[Host]: [sigh] I told you this would happen.
[Guest]: And when we opened it, [gasp] it was empty.
```

Use one or two tags in a paragraph. Many tags make the performance unnatural.

## Write the same moment for each engine

Expressive. The reaction is a tag in the text:

```text
[Host]: [laugh] Okay, that's a hot take. But seriously...
```

Fast, Multilingual and Sonic. The reaction is in the words:

```text
[Host]: Ha, okay, that's a hot take. But seriously...
```

Omni and Craft. The reaction is in the words, and the tone is in the direction:

```bash
vois-cli tts generate --text "Ha, okay, that's a hot take. But seriously..." \
  --engine omni --language English --voice narrators_ai_voices/morgan_vale \
  --instruct "amused, warm and relaxed, a smile in the voice" --output host.wav
```

A direction is plain words, with less than 2,000 characters, and with no brackets and no parentheses. One `--instruct` applies to all of the text in one call. If two lines must have different directions, make two calls.

## Plans

| Plan | Engines from vois-cli |
|---|---|
| Pro | All six. |
| Subscriber | Fast, Expressive, Multilingual, Sonic. |
| AppSumo Lifetime Tier 2 and 3 | Fast, Expressive, Multilingual, Sonic. |
| Free | No general CLI. `vois-cli speak --follow --play` plays a Sonic voice aloud and saves no file. To make files with the CLI, the user must have purchased export credits. |
