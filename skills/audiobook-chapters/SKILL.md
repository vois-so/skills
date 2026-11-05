---
name: audiobook-chapters
description: Makes a retail audiobook from a manuscript with Vois Studio. It divides the text into chapters and makes a batch plan. It narrates each chapter with one narrator voice and optional character voices. It exports chapter MP3 files and measures them against usual retail numbers. Examples are 44.1 kHz, 192 kbps CBR, -23 to -18 dB RMS, peaks at or below -3 dB, and room tone at the two ends. It also makes an M4B with chapter marks and a retail sample. Use when the user says "turn my book into an audiobook", "narrate my manuscript", "make chapter MP3s for ACX", "make an M4B with chapters" or "make an audiobook sample". The CLI is necessary, so the plan must be Pro, Subscriber, or AppSumo Lifetime Tier 2 or 3. To sell the audiobook, use Pro or AppSumo Lifetime Tier 3.
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, ffmpeg and ffprobe, and Node.js 18+.
metadata:
  author: vois-so
  version: "0.1.0"
---

# Audiobook chapters

This skill changes a manuscript into retail audiobook files with Vois Studio:

- One MP3 file for each chapter, with measured loudness, peak and room tone.
- One M4B file with a chapter mark at the start of each chapter.
- One retail sample MP3.

Vois Studio makes the voice on the computer of the user. The scripts in `scripts/` do the batch work. They use `vois-cli` for narration and export, and ffmpeg for the pauses, the M4B and the measurements.

## Step 1: Make sure that the tools operate

The CLI is at these paths. Do not change PATH. Do not make an alias.

- macOS: `/Applications/Vois.app/Contents/MacOS/vois-cli`
- Windows: `%LOCALAPPDATA%\Vois\vois-cli.exe`

The scripts find the CLI at these paths. If the CLI is at a different path, set `VOIS_CLI` to the full path.

```bash
VOIS="/Applications/Vois.app/Contents/MacOS/vois-cli"
"$VOIS" status --format json
ffmpeg -version | head -1
node --version
```

Read `next_action` in the status result:

| `next_action` | What to do |
| --- | --- |
| `ready` | Continue with step 2. |
| `register` | Vois Studio has no licence. Tell the user to do the registration in Vois Studio, or to use `vois-cli license activate`. Stop. |
| `buy_credits_or_subscribe` or `upgrade_plan` | Show `purchase_url` to the user (if it is empty, show https://vois.so/pricing). Stop and wait. Do not buy anything. |
| `connect_and_retry` | Tell the user to connect to the internet. Then do the status command again. |

If the status command gives exit code 2, Vois Studio is not open. Tell the user to open Vois Studio, or use `"$VOIS" service start`.

Plan facts:

- The CLI needs Pro, Subscriber, or AppSumo Lifetime Tier 2 or 3.
- Free with export credits can use the CLI, but each `tts generate --output` and each export uses one credit. A book uses many credits.
- Free is for non-commercial use only. To sell the audiobook, the user needs Pro or AppSumo Lifetime Tier 3.

## Step 2: Select the retailer first

Tell the user to select the retailer before you narrate. The retailer controls the file rules, the disclosure for AI narration, and the file names.

- Standard ACX uploads do not accept AI narration from other tools. Tell the user this before you start.
- Other stores have different rules for AI narration and for the disclosure. Tell the user to read the current rules of the retailer.

The scripts measure these values. They are usual retail numbers (for example, the ACX numbers). Do a check of the current rules of your retailer, because they can change.

| Item | Value that the scripts measure |
| --- | --- |
| Format | MP3, 44.1 kHz, 192 kbps CBR |
| Loudness | RMS from -23 dB to -18 dB |
| Peak | -3 dB or lower |
| Noise floor | -60 dB or lower |
| Room tone | 0.5 to 1 s at the start, 1 to 5 s at the end |
| Length | 120 minutes or less for each file |
| Channels | The same number in all files |
| Retail sample | 1 to 5 minutes |

## Step 3: Prepare the manuscript

Get the manuscript as plain text or Markdown. Read [manuscript format](references/manuscript-format.md) and prepare the text:

- Put a heading line (`## Chapter 1: Title`) at the start of each chapter.
- Add an "Opening Credits" chapter and a "Closing Credits" chapter if the retailer tells you to.
- Write numbers, dates and abbreviations as the narrator must speak them.
- Put a line for a character voice on its own line, as `[Name]: text`. Keep "she said" in the narrator text.

## Step 4: Make the batch plan

Select a narrator voice. Show the voices that can read for a long time:

```bash
"$VOIS" voice list --source all --format json
```

Use the `id` values with no change. Good categories for a narrator are `audiobooks_ai_voices`, `narrators_ai_voices` and `storytellers_ai_voices`. The `supported_engines` list of the voice must include the engine of the plan.

Give the user two or three voices to compare. Generate the same test text of 1 to 2 minutes with each voice. Use text with description, dialogue, names and a change of emotion:

```bash
"$VOIS" tts generate --format json --engine expressive --language English \
  --voice audiobooks_ai_voices/eleanor_vale --text "$(cat test-passage.txt)" \
  --output "$PWD/auditions/eleanor_vale.wav"
```

The user listens and selects one voice. Then make the plan:

```bash
node scripts/split-manuscript.mjs manuscript.md book \
  --voice audiobooks_ai_voices/eleanor_vale --title "Book Title" --author "Author Name"
```

The script writes `book/plan.json`. It shows each chapter with its number of words and an estimate of its minutes (150 words a minute). Show this table to the user. If the manuscript has character lines, set a voice for each speaker in `"voices"` in `plan.json`.

Engine selection (`"engine"` and `"language"` in `plan.json`):

| Engine | Languages | Use it for |
| --- | --- | --- |
| `expressive` (default) | English | Long English narration |
| `craft` | 10 | Pro. Direction in plain words: set `"instruct"` in the plan or on one block |
| `multilingual` | 23 | A book in a language other than English |
| `omni` | 30 | Pro. Other languages, with direction in `"instruct"` |
| `fast` | English, German, Spanish, Italian, Portuguese | Draft audio only |

For each plan field, refer to [plan fields](references/plan-fields.md).

## Step 5: Narrate one chapter, then get approval

Narrate the first chapter only:

```bash
node scripts/render-chapters.mjs book --only 01
```

The script does these steps for each chapter:

1. It generates one WAV for each block with `vois-cli tts generate`. It keeps each block, so a retake changes only one block.
2. It puts the blocks together with pauses (600 ms between paragraphs, 1.6 s at a scene break) and adds room tone (0.5 s at the start, 2 s at the end).
3. It limits the loudest peaks with ffmpeg. After this, no peak is more than 15 dB above the RMS of the voice.
4. It exports `book/mp3/01 - <title>.mp3` through Vois Studio (`export audio`, MP3, 192 kbps, 44.1 kHz, normalized to -20 LUFS).
5. It measures the MP3. If the peak or the RMS is not in the limits, it exports again with a different loudness target (maximum 4 tries).

The script shows PASS or FAIL and writes all values to `book/qc.json`.

Tell the user to listen to all of chapter 01 on headphones. The user listens for these problems:

- Missing words, or words that occur two times.
- Incorrect names, numbers and abbreviations.
- An incorrect speaker.
- A pause that changes what a sentence tells the listener.

Do not narrate the other chapters before the user gives approval for chapter 01.

## Step 6: Correct and narrate the remaining chapters

To correct one block, change its `"text"` in `plan.json` and start the script again. The script generates only the changed blocks. To generate a block again with the same text, give its chapter and block number:

```bash
node scripts/render-chapters.mjs book --only 01 --redo 01:7
```

When the user gives approval for chapter 01, narrate all chapters:

```bash
node scripts/render-chapters.mjs book
```

Do this in groups of 3 to 5 chapters for a long book (`--only 02,03,04`). After each group, tell the user which chapters to listen to. When the user gives approval for a chapter, set its `"status"` to `"approved"` in `plan.json`.

## Step 7: Make the M4B

```bash
node scripts/make-m4b.mjs book --cover cover.jpg
```

The script puts the chapter MP3s in sequence in one M4B file (AAC, 64 kbps for mono). It adds a chapter mark with the chapter title at the start of each chapter. Then it reads the marks back with ffprobe and shows PASS or FAIL. To examine the marks with ffprobe:

```bash
ffprobe -v error -show_chapters -of compact "book/Book Title.m4b"
```

The M4B is for stores and players that accept M4B. Upload the chapter MP3s to a retailer that asks for one file for each chapter.

## Step 8: Make the retail sample

Select 1 to 5 minutes of narration. Do not use the credits. Do not use explicit content. Cut the part from the chapter WAV, then export it through Vois Studio:

```bash
ffmpeg -y -ss 95 -t 180 -i book/wav/03.wav -af "afade=t=in:d=0.3,afade=t=out:st=178:d=2" book/sample.wav
"$VOIS" export audio --format json -i "$PWD/book/sample.wav" -o "$PWD/book/sample.mp3" \
  --audio-format mp3 -b 192 --sample-rate 44100 --normalize --target-lufs -20
node scripts/check-retail.mjs --sample book/sample.mp3
```

## Step 9: Give the files to the user

Tell the user:

- The path of each chapter MP3, and the PASS or FAIL result from `book/qc.json`.
- The path of the M4B and the number of chapter marks.
- The path of the sample.
- The user must play each exported file before the upload.
- The user must read the current rules of the retailer, and its rules for the AI narration disclosure.

## When a step fails

| Problem | What to do |
| --- | --- |
| Exit 2 | Vois Studio is not open. Tell the user to open it, or use `"$VOIS" service start`. |
| Exit 4 | The voice ID is not correct. Get the ID again from `voice list`. |
| Exit 5 | Vois Studio did not generate one block. Start the script again. It continues at that block. If the block stops the script again, make a small change to its text, or select a different voice. |
| Exit 7 | The plan does not include this engine or the CLI. Show `purchase_url` from the status command and stop. |
| Exit 11 | The computer does not have sufficient free memory for the engine. Tell the user to close other apps. An alternative is to use `expressive`, not `craft` or `omni`. |
| Exit 13 | The engine is not available to download at this time. Use a different engine. |
| Exit 64 | The language is not clear, or the export is shorter than 5 s. Set `"language"` in the plan. A chapter must have 5 s of audio or more. |
| RMS too low and peak too high | Set `"crest_db"` in `plan.json` to 13 and use `--export-only` for that chapter. |
| Room tone FAIL | Set `"head_ms"` or `"tail_ms"` in `plan.json` and use the script again with `--only <id>`. |
| M4B check FAIL | Make sure that each chapter has one MP3 in `book/mp3/`. Make sure that the titles in `plan.json` did not change after the export. |

The scripts do not change the mastering settings of Vois Studio. They do not make projects, speakers or pronunciation entries in Vois Studio.
