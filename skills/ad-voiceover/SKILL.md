---
name: ad-voiceover
description: "Makes ad voiceovers for 15, 30 and 60 second slots with Vois Studio, on the user's computer, in three directions for each slot (for example warm, energetic and calm). On Pro, it uses Omni with a direction in plain words. On other paid plans, it uses different voices and speeds. It measures each read against its slot. If a read is more than 0.5 s from the slot, it makes a new take at a corrected speed. If that is not sufficient, it tells you how many words to cut or add. Each good read also comes as a file with the full slot length. Use when the user asks for \"a 30 second radio ad\", \"ad reads in three styles\", \"a 15 and 60 second spot\", \"a voiceover for my commercial\", or \"a pre-roll read\". Commercial use is only on a paid plan: Pro, Subscriber or AppSumo Lifetime Tier 3."
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, and Node.js 18+.
metadata:
  author: vois-so
  version: "0.1.0"
---

# Ad voiceover with Vois Studio

This skill makes ad reads that fit their slots: 15, 30 and 60 seconds, or other lengths.
Each slot gets three directions, so the user can select the read that fits the brand.
Each good read also comes as a file with the full slot length, for the ad.

## Commercial use

An ad is commercial use. Tell the user this before you start:

- Commercial use is only on a paid plan: Pro, Subscriber, or AppSumo Lifetime Tier 3.
- Free is for non-commercial use only. Export credits on Free do not change this.
- AppSumo Lifetime Tier 2 has the CLI, but not commercial use.

Read the plan with `vois-cli status --format json` (`plan_code`, `entitlement_tier`). If the plan does not include commercial use, tell the user and show `purchase_url`. Do not buy a plan for the user.

| Plan | Directions | Commercial use |
| --- | --- | --- |
| Pro | Omni with `instruct` in plain words, or voices and speeds | Yes |
| Subscriber | Different voices and speeds (no Omni) | Yes |
| AppSumo Lifetime Tier 3 | Different voices and speeds (no Omni) | Yes |
| AppSumo Lifetime Tier 2 | Different voices and speeds (no Omni) | No |
| Free with export credits | Each take uses one credit | No |

## Before you start

- Vois Studio is open. If no window is necessary, start the headless service: `vois-cli service start`.
- Node.js 18 or higher.

The CLI path:

- macOS: `/Applications/Vois.app/Contents/MacOS/vois-cli`
- Windows: `%LOCALAPPDATA%\Vois\vois-cli.exe`

Use the full path in each command. Do not change PATH, and do not make an alias or a link.

```bash
VOIS="/Applications/Vois.app/Contents/MacOS/vois-cli"
"$VOIS" status --format json
```

If `cli_access_enabled` is `false`, show `purchase_url` to the user and stop. The fallback link is https://vois.so/pricing.

## Step 1: Get the brief

Get from the user:

- The brand, what it sells, and the one message.
- The slots: 15, 30 and 60 seconds, or the lengths that the station or platform gives.
- The CTA, the step that the listener must do next: a website, a phone number, a store, or an app name.
- The legal text, if the ad must have one (for example "Terms apply.").
- The three directions. The default is warm, energetic and calm.

Do not add claims that the user cannot prove, for example "the best", "number one" or "guaranteed".

## Step 2: Write one read for each slot

Use this word budget. It is for a usual pace of about 2.5 words a second.

| Slot | Words | Structure |
| --- | --- | --- |
| 15 s | 30 to 38 | First line, one benefit, CTA |
| 30 s | 62 to 75 | First line, problem, brand, one or two benefits, CTA |
| 60 s | 130 to 150 | First line, short story or problem, brand, three benefits, offer, CTA two times |

- Say the brand name in the first 5 seconds and again at the end.
- Write the CTA as the voice must say it: "northside bakery dot com", "call five five five, zero one nine nine".
- Put the legal text at the end, in the same read. Do not make it faster than the remaining text.
- Use short sentences. Each comma and full stop gives a small pause.

Examples and more rules are in [ad scripts](references/ad-scripts.md).

## Step 3: Select the three directions

On Pro, use Omni and one voice, with a direction in plain words for each read:

```json
"engine": "omni",
"voice": "explainers_ai_voices/clara_west",
"directions": [
  { "id": "warm", "instruct": "warm and friendly, a smile in the voice" },
  { "id": "energetic", "instruct": "energetic and bright, upbeat, quick pace" },
  { "id": "calm", "instruct": "calm and reassuring, unhurried, low and close" }
]
```

On Subscriber or AppSumo Lifetime, Omni is not available. Make the directions different with the voice and the speed:

```json
"engine": "expressive",
"directions": [
  { "id": "warm", "voice": "explainers_ai_voices/clara_west", "speed": 1.0 },
  { "id": "energetic", "voice": "hosts_ai_voices/alex_bright", "speed": 1.08 },
  { "id": "calm", "voice": "explainers_ai_voices/oscar_bell", "speed": 0.95 }
]
```

More directions and voices are in [directions and voices](references/directions-and-voices.md). Use a cloned voice only with the consent of the person who owns that voice.

## Step 4: Write ad.json

```json
{
  "brand": "Northside Bakery",
  "engine": "omni",
  "voice": "explainers_ai_voices/clara_west",
  "language": "English",
  "directions": [
    { "id": "warm", "instruct": "warm and friendly, a smile in the voice" },
    { "id": "energetic", "instruct": "energetic and bright, upbeat, quick pace" },
    { "id": "calm", "instruct": "calm and reassuring, unhurried, low and close" }
  ],
  "reads": [
    { "slot": 15, "text": "..." },
    { "slot": 30, "text": "..." },
    { "slot": 60, "text": "..." }
  ]
}
```

A read can also have `say` (the words for the voice, when they are different from `text`) and `byDirection`. `byDirection` gives one direction its own words, because each direction has its own pace:

```json
{ "slot": 30, "text": "...", "byDirection": { "energetic": "... a longer version for the faster read ..." } }
```

## Step 5: Render and measure

Replace `<skill>` with the folder of this skill.

```bash
node <skill>/scripts/ads.mjs --ad ad.json --dry-run
node <skill>/scripts/ads.mjs --ad ad.json
```

The dry run shows the words and the word budget for each slot. Correct the text before you render. The second command, for each slot and each direction:

1. Renders the read and measures the spoken length (from the first word to the last word).
2. Compares it with the slot. A read is good when it is no more than 0.5 s from the slot, and when it is not longer than the slot.
3. If the read is not good, it renders the read again at a corrected speed. The new speed aims at 0.25 s below the slot. The speed changes by 15 percent at most. The script tries a maximum of 3 takes.
4. If a speed change is not sufficient, it stops for that read and tells you how many words to cut or add.

It prints a table, for example:

```text
read                     slot   spoken   speed   result
30s-warm                   30    29.75    0.97   PASS
30s-energetic              30    25.10    1.00   FAIL: add about 12 word(s) in reads[].byDirection.energetic
30s-calm                   30    29.75    1.06   PASS
```

Exit 0 means that all reads are good. Exit 65 means that one or more reads are not good.

## Step 6: Correct the reads that are not good

For each FAIL line:

1. Add or cut the number of words in the advice. For one direction only, put the new text in `byDirection` for that direction.
2. Start the script again. It renders only the reads that changed.
3. Do this until all reads are good.

Do not change the tolerance to make a read good. If the user gives a different tolerance, use `--tolerance`.

## Step 7: Deliver

| Output | Use |
| --- | --- |
| `ads/fit/<slot>s-<direction>.wav` | The read with 0.05 s of silence before it, padded to the full slot length. Use this file in the ad |
| `ads/takes/<slot>s-<direction>.wav` | The take as Vois Studio made it |
| `ads/report.json`, `ads/report.csv` | The spoken length, speed, number of takes, result and advice for each read |

You cannot hear the audio. Tell the user to listen to the three directions of each slot and to select one. For music below the voice, give the user the `fit` file. For loudness for a platform, export the selected file with `"$VOIS" export with-profile --input <file> --output <file>.m4a --profile youtube_video`.

## When something fails

| Exit | Cause | What to do |
| --- | --- | --- |
| 65 | One or more reads are not good | Change the words as the advice tells you, and start the script again |
| 2 | Vois Studio is not open | Open it, or start `vois-cli service start` |
| 3 or 64 | Bad value, or the language is not clear | Examine the voice ID and speed. Set `"language": "English"` |
| 4 | The CLI cannot find a file or a voice | Get the voice ID again with `voice list` |
| 5 | The render did not complete | Remove symbols, or select a different voice |
| 7 | The plan does not include this | Omni is on Pro. Use the voice and speed directions, or show `purchase_url` |
| 8 | Quota | Show `purchase_url` and stop |
| 9 or 10 | Busy | The script tries again. If it stops, wait and start it again |
| 11 | Not sufficient memory | Close other apps, or use `expressive` |

The script uses `--engine` from `ad.json`. If a direction has `instruct` and the engine is not Omni or Craft, the script shows a NOTE and ignores the direction.

## Rules

- Commercial use is only on Pro, Subscriber or AppSumo Lifetime Tier 3. Say this to the user before the first render.
- Do not buy a plan or credits, and do not fill a checkout. Show `purchase_url` and wait for the user.
- Use a cloned voice only with the consent of its owner. Do not imitate a known person or a known voice.
- Do not write claims that the user cannot prove. Do not promise sales, income or views.
