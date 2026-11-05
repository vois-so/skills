---
name: faceless-short
description: Makes the voice and captions of a 30 to 60 second vertical Short (YouTube Shorts, TikTok, Instagram Reels) with Vois Studio, on the user's computer. It writes a hook for the first 2 seconds and a script of 110 to 160 words for one voice. Then it renders each line with vois-cli and makes one tight voice track. It writes SRT captions of 1 to 3 words and word times for animated captions, and examines the hook time and the length. Use when the user asks for "a faceless Short", "a TikTok voiceover", "a Reels script with captions", "a 45 second narration for a Short", or "a hook and a script for YouTube Shorts". A Vois Studio plan with CLI file output is necessary, for example Pro. It makes no promise of views, followers or money.
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, and Node.js 18+.
metadata:
  author: vois-so
  version: "0.1.0"
---

# Faceless Short with Vois Studio

This skill makes the audio part of a faceless Short: the hook, the script, the voice and the captions.
The video has no face on camera. Stock clips, screen recordings or images give the picture, and the voice tells the story.
The result is one voice track that starts at time 0, captions for the editor, and a report of the checks.

## Before you start

- Vois Studio is open. If no window is necessary, start the headless service: `vois-cli service start`.
- Node.js 18 or higher.
- A plan with CLI file output. Use the table below. Do not buy a plan for the user.

| Plan | What this skill can do |
| --- | --- |
| Pro | All steps, all engines, Omni and Craft directions, commercial use |
| Subscriber, AppSumo Lifetime Tier 2 or 3 | All steps with Fast, Expressive, Multilingual or Sonic. Commercial use: Subscriber and Tier 3 only |
| Free with export credits | Each line uses one credit, and `--master` uses one more. Non-commercial use only. A monetized channel is commercial use |
| Free without credits | Not possible. `vois-cli speak` plays audio but does not save a file |

The CLI path:

- macOS: `/Applications/Vois.app/Contents/MacOS/vois-cli`
- Windows: `%LOCALAPPDATA%\Vois\vois-cli.exe`

Use the full path in each command. Do not change PATH, and do not make an alias or a link.

```bash
VOIS="/Applications/Vois.app/Contents/MacOS/vois-cli"
"$VOIS" status --format json
```

If `cli_access_enabled` is `false`, show `purchase_url` to the user and stop. The fallback link is https://vois.so/pricing.

## Step 1: Get the topic and the one point

Get from the user:

- The topic, and the one thing that the viewer must know at the end.
- The platform: YouTube Shorts, TikTok or Reels. The audio is the same for all three.
- The facts. Do not add numbers or claims that the user did not give or that you cannot show a source for.

## Step 2: Write the hook

The hook is the first line. The viewer must hear all of it in the first 2 seconds.

- Use 5 to 8 words. The script stops you at more than 9 words.
- Start with the strongest word. Do not start with "Hi", "So" or the channel name.
- Make a statement that the next lines prove, or ask one question that the next lines answer.
- Do not promise views, followers, money or a result that the video cannot give.

| Type of hook | Example |
| --- | --- |
| Surprise | "Your phone battery is lying to you." |
| Mistake | "You are watering your plants wrong." |
| Question | "Why do planes fly so high?" |
| Number | "Three words that end an argument." |

More hook types and full scripts are in [script patterns](references/script-patterns.md).

## Step 3: Write the script

Use 110 to 160 words in total, with the hook. At the usual pace of this skill, that is about 30 to 50 seconds.

| Section | Seconds | What it does |
| --- | --- | --- |
| The hook | 0 to 2 s | Stops the scroll |
| Setup | 2 to 8 s | Says why the hook is correct, or what the problem is |
| Body | 8 to 45 s | Three short points, or a story in three steps |
| Close | Last 5 s | Gives the one point again, or connects back to the hook for a loop |

- Write one sentence for each line in the script file. A line is one caption phrase and one take.
- Use short words and short sentences. Keep most sentences below 15 words.
- Write numbers and symbols as the voice must say them: "forty percent", not "40%".
- Use "you". Speak to one person.
- A last instruction to the viewer is optional. If you use one, keep it to one sentence, for example "Follow for part two."

Write `short.json`:

```json
{
  "voice": "hosts_ai_voices/alex_bright",
  "engine": "expressive",
  "language": "English",
  "lines": [
    { "id": "hook", "text": "Your phone battery is lying to you." },
    { "id": "why", "text": "That percentage is a guess, built from voltage and temperature." },
    { "id": "close", "text": "So charge it when it suits you, not when the number says so." }
  ]
}
```

The first line is the hook. A line can also have `say` (the words for the voice, when they are different from `text`), `speed` and `seed`.

## Step 4: Select one voice

Use one voice for the full Short.

```bash
"$VOIS" voice list --source all --engine expressive --format json
```

| Voice ID | Good for |
| --- | --- |
| `hosts_ai_voices/alex_bright` | Energetic facts and advice (male) |
| `energetic_ai_voices/young_american_female_voice` | Energetic facts and advice (female) |
| `narrators_ai_voices/david_sterling` | Documentary, history, science (male) |
| `hosts_ai_voices/the_nightowl` | Mystery and night stories (male) |
| `storytellers_ai_voices/grandma_rose` | Calm stories (female) |
| `explainers_ai_voices/clara_west` | How-to videos and app advice (female) |

On Pro, Omni can use a direction for the full Short: add `"engine": "omni"` and `"instruct": "energetic and bright, quick pace"`. More voices and the engine table are in [voices and engines](references/voices-and-engines.md).
Use a cloned voice only with the consent of the person who owns that voice.

## Step 5: Render and check

Replace `<skill>` with the folder of this skill.

```bash
node <skill>/scripts/short.mjs --script short.json
```

The script:

1. Counts the words. If the total is not 110 to 160, it stops before it renders (exit 65).
2. Examines Vois Studio and the plan.
3. Renders each line to `short/lines/`. It cuts the silence at the two ends of each take.
4. Connects the lines with 0.25 s of silence into `short/short.wav`. The voice starts at 0.04 s.
5. Writes `short/short.srt` (cues of 1 to 3 words), `short/short.words.json` and `short/report.json`.
6. Examines the result and prints PASS or FAIL for each check.

| Item | Rule | If the rule is not correct |
| --- | --- | --- |
| Words | 110 to 160 | Add or cut words. The message gives the number |
| Length | 30 to 60 seconds | Add or cut words, or change `speed` by 0.05 |
| The hook | Stops by 2.0 s | Cut the hook to 6 to 8 words, or set `"speed": 1.1` on the hook line |
| Voice start | Starts by 0.2 s | Remove a pause or a symbol at the start of the hook |

Exit 0 means that all checks are correct. Exit 65 means that one or more checks are not correct, but the script wrote all files. Change the line and start the script again. It renders only the lines that changed.

On export credits, the script stops before it renders and shows the number of credits. Tell the user. Add `--use-credits` only after the user agrees.

For a test with a small number of words, add `--draft`. It does not stop for the word and length checks.

## Step 6: Optional: master for the platform

```bash
node <skill>/scripts/short.mjs --script short.json --master youtube_video
```

This writes `short/short-youtube_video.m4a` at -14 LUFS, with the same times as `short.wav`. The level is correct for Shorts, TikTok and Reels.

## Step 7: Give the files to the editor

| Output | Use |
| --- | --- |
| `short.wav` or `short-youtube_video.m4a` | The voice track. Put it at 0 on a 1080 x 1920 timeline |
| `short.srt` | Captions of 1 to 3 words. Import them as captions, then make them large and put them in the center |
| `short.words.json` | Word times (`text`, `start`, `end` in seconds) for animated captions in code |
| `report.json` | The checks, the hook time and the start of each line |

Keep the captions out of the bottom 20 percent and the right edge of the frame. The platform buttons and the description are in those areas. Change the picture at each line start in `report.json`, or more frequently. Caption and editor steps are in [captions and edit](references/captions-and-edit.md).

You cannot hear the audio. Tell the user to listen to `short.wav`. Get their approval before they edit the video.

## When something fails

| Exit | Cause | What to do |
| --- | --- | --- |
| 65 | A check is not correct | Read the FAIL lines. Change the script, and start it again |
| 2 | Vois Studio is not open | Open it, or start `vois-cli service start` |
| 3 or 64 | Bad value, or the language is not clear | Examine the voice ID and speed. Set `"language": "English"` |
| 4 | The CLI cannot find a file or a voice | Get the voice ID again with `voice list` |
| 5 | The render did not complete | Make the line longer, remove symbols, or select a different voice |
| 7 | The plan does not include this | Omni and Craft are on Pro. Show `purchase_url` and stop |
| 8 | Quota | Show `purchase_url` and stop |
| 9 or 10 | Busy | The script tries again. If it stops, wait and start it again |
| 11 | Not sufficient memory | Close other apps, or use `expressive` or `fast` |

## Rules

- Do not promise views, followers, reach or money, in the script or to the user. The script shows a WARNING for words, for example "go viral" or "passive income".
- Do not add facts that the user did not give or that you cannot show a source for.
- Do not buy a plan or credits, and do not fill a checkout. Show `purchase_url` and wait for the user.
- Use a cloned voice only with the consent of its owner.
- For commercial use, a paid plan is necessary: Pro, Subscriber or AppSumo Lifetime Tier 3. Free is for non-commercial use.
