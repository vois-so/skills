# Directions and voices

## Omni directions (Pro)

Omni uses a direction in plain words with `instruct`. Give the emotion, the pace and the energy. Keep it below 2,000 characters. Do not use brackets or parentheses.

| Direction id | `instruct` |
| --- | --- |
| `warm` | `warm and friendly, a smile in the voice` |
| `energetic` | `energetic and bright, upbeat, quick pace` |
| `calm` | `calm and reassuring, unhurried, low and close` |
| `confident` | `confident and clear, steady pace, strong ends of sentences` |
| `playful` | `playful and light, quick, a small laugh in the voice` |
| `premium` | `smooth and low, slow pace, long pauses between sentences` |
| `urgent` | `urgent but friendly, quick pace, short pauses` |

Craft (Pro) also uses `instruct`, with a library voice, a cloned voice or a voice from Voice Design, in 10 languages. Set `"engine": "craft"` to use it.

Omni speaks 30 languages. Set `"language"` in `ad.json`, for example `"Spanish"`.

## Voice and speed directions (Subscriber, AppSumo Lifetime, or Pro)

Without Omni, make the three directions different with the voice and the speed. Use `"engine": "expressive"` for English, or `"engine": "multilingual"` for other languages.

| Direction id | `voice` | `speed` |
| --- | --- | --- |
| `warm` | `explainers_ai_voices/clara_west` | 1.0 |
| `energetic` | `hosts_ai_voices/alex_bright` | 1.08 |
| `calm` | `explainers_ai_voices/oscar_bell` | 0.95 |
| `premium` | `announcers_ai_voices/velvet_voice` | 0.95 |
| `broadcast` | `announcers_ai_voices/marcus_media` | 1.0 |
| `trailer` | `announcers_ai_voices/thunder_mike` | 0.95 |

Expressive also makes the sound of a small set of tags in the text, for example `[chuckle]`. Use them only when the sound helps the ad.

## Get the voice list

```bash
VOIS="/Applications/Vois.app/Contents/MacOS/vois-cli"   # Windows: "$env:LOCALAPPDATA\Vois\vois-cli.exe"
"$VOIS" voice list --source all --format json
"$VOIS" voice search --query "announcer" --format json
```

Use the `id` value with no change. The list can change. Always get the current list.

## One voice or three voices

- One voice with three Omni directions: the user compares only how the voice reads. This is the best test of the script.
- Three voices: the user compares the voice and how it reads. Use this when Omni is not on the plan, or when the brand has no voice at this time.

## Cloned and designed voices

- A cloned voice is only for a person who gives consent. Do not clone a celebrity, an actor or a known voice for an ad.
- A designed voice (Voice Design, Pro) is a new voice from a description. Make and save it in Vois Studio first. Then use its `designed_` id.
