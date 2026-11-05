---
name: write-for-voice
description: Changes written text (a blog post, docs, slides or notes) into a script that a listener can follow and that Vois Studio reads correctly. It makes short sentences and writes numbers and symbols as words. It expands abbreviations and changes lists into spoken sentences. It adds speaker tags and pauses in the Vois Studio script format and applies the rules of the selected engine. Use when the user says "turn this into a script", "make this sound spoken", "write this for voiceover", "convert my blog post to audio", "prepare this for text to speech" or "the voice reads this badly". A plan is not necessary to write the script. For the test file, vois-cli must have Pro, Subscriber, AppSumo Lifetime Tier 2 or 3, or export credits on the Free plan.
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, and Node.js 18+ for the script check.
metadata:
  author: vois-so
  version: "0.1.0"
---

# Write for voice

This skill does one task. It changes written text into a script for the ear. Then it makes one test file with Vois Studio. Then you can hear the result.

A reader can go back and read a sentence again. A listener cannot. Thus each sentence must be clear the first time that the listener hears it.

## What you must have

- The source text.
- The language of the script.
- The engine. If the user does not know, use the table in step 1.
- The speakers: one narrator, or the names of each speaker.
- A path for the script file, for example `episode-01.script.txt`.

## Set up vois-cli

Use the full path. Do not change PATH, and do not make an alias or a symlink.

| System | vois-cli path |
|---|---|
| macOS | `/Applications/Vois.app/Contents/MacOS/vois-cli` |
| Windows | `%LOCALAPPDATA%\Vois\vois-cli.exe` |

Vois Studio must be open. If it is not open, start the service with `vois-cli service start`. Then get the status:

```bash
vois-cli status --format json
```

Read `entitlement_tier` and `credit_balance`. They tell you which plan applies.

| Plan | What this skill can do |
|---|---|
| Pro | All steps, with all engines. |
| Subscriber, AppSumo Lifetime Tier 2 or 3 | All steps. Omni and Craft are not available. |
| Free with export credits | All steps. Each test file uses one credit. |
| Free without credits | Steps 1 to 7. For step 8, use `vois-cli speak --follow --play` to hear the script with a Sonic voice. It does not save a file. |

Do not buy a plan or credits for the user. Show the `purchase_url` from `vois-cli status --format json` (or https://vois.so/pricing). Then wait for the user.

## Step 1. Select the engine first

Each engine uses different cues in the text. Select the engine before you write. A cue for one engine can have no effect on a different engine.

| Engine | `--engine` | Languages | Cues in the text that the engine uses | `--instruct` |
|---|---|---|---|---|
| Fast | `fast` | English, plus German, Spanish, Italian and Portuguese after download | Words and punctuation | Ignored |
| Expressive | `expressive` | English | Words, punctuation and 9 reaction tags | Ignored |
| Multilingual | `multilingual` | 23 | Words and punctuation | Ignored |
| Omni (Pro) | `omni` | 30 | Words and punctuation | Used |
| Sonic | `sonic` | 31, built-in Sonic voices only | Words and punctuation | Ignored |
| Craft (Pro) | `craft` | 10, voices that have a recording | Words and punctuation | Used |

The language lists for each engine are in [engines and tags](references/engines.md).

Rules for the cues:

- Only Expressive uses reaction tags. The 9 tags are `[laugh]`, `[chuckle]`, `[gasp]`, `[sigh]`, `[groan]`, `[cough]`, `[clear throat]`, `[sniff]` and `[shush]`. The other engines remove them. Use one or two tags in a paragraph, not more.
- Only Omni and Craft use `--instruct`. It is a direction in plain words, for example `--instruct "calm and warm, unhurried"`. It is not in the script text. The other engines ignore it.
- No engine uses emotion tags, for example `[happy]`, `[sad]`, `[excited]`, `[whisper]` or `[dramatic]`. Do not write them. Put the emotion in the words.

## Step 2. Cut the text into spoken sentences

Apply these rules in this sequence.

1. Remove all text that is only for the eye. Examples are headings, "click here" links, image captions, footnote marks and "see below".
2. Keep one idea in each sentence. Divide a sentence that has more than 20 words. Cut it at "and", "but", "which" or "because".
3. Use active voice. Write "The update removes the files", not "The files are removed by the update".
4. Put the subject and the verb near the start of the sentence.
5. Change long text in parentheses into a new sentence. A listener cannot hear parentheses.
6. Use contractions if the tone is casual: "it's", "you'll", "don't". They are more natural when spoken.
7. Change written links ("Furthermore", "In conclusion", "As mentioned above") into spoken links ("Also", "So", "Here is the important part").
8. Use different sentence lengths. Many short sentences in a sequence are mechanical. Many long sentences make the listener tired.
9. Say the most important point first. Then give more information.
10. Use the key term again. Do not change to a synonym. A listener can think that the synonym is a different thing.

## Step 3. Write numbers and symbols as words

Write each number, unit and symbol as the speaker must say it. Then the script controls the read, and not the engine.

| Written | Spoken |
|---|---|
| 3 | "three" |
| 1,250 | "one thousand two hundred fifty", or "about twelve hundred" |
| 987,000,000 | "just under a billion" |
| 2026 (a year) | "twenty twenty-six" |
| 3:30 pm | "three thirty in the afternoon" |
| 45% | "forty-five percent" |
| $19.99 | "nineteen dollars ninety-nine" |
| 5 GB | "five gigabytes" |
| 200 ms | "two hundred milliseconds" |
| v2.6.2 | "version two point six point two" |
| 10-20 | "ten to twenty" |
| & | "and" |
| / (as in "read/write") | "and", or "or" |
| -> | "then", or "goes to" |
| e.g. | "for example" |
| i.e. | "that is" |
| etc. | "and so on", or give the full list |

Use an approximate number if the accurate value is not important. A listener remembers "about three thousand" better than "two thousand nine hundred forty-one".

For code, URLs, file paths and email addresses, write what the listener must know. For example, write "the settings page on our website", not the full URL. If the listener must type it, say it slowly in parts: "vois dot so, slash pricing".

The full tables are in [spoken words](references/spoken-forms.md).

## Step 4. Expand abbreviations and acronyms

- Write the full name the first time: "the application programming interface, or A P I". After that, use the short name.
- Select how the speaker says each acronym. Some are letters: "A P I", "U R L", "S Q L". Some are words: "NASA", "JSON". Write letters with spaces between them. Then the engine says each letter.
- Expand written abbreviations: "approx." becomes "about", "vs." becomes "versus", "No." becomes "number".
- You can keep titles, for example "Dr." and "Ms.". Vois Studio does not read them as the end of a sentence.
- Names, brands and words from other languages can also be incorrect. Make a list of them. Correct them with the pronunciation dictionary of Vois Studio, or write a different spelling in the script.

## Step 5. Change lists and tables into spoken sentences

A listener cannot see bullets. Change each list into sentences.

- Say the number of items first: "There are three steps."
- Give each item its own sentence: "First, open the file. Second, select the voice. Third, generate the audio."
- Use three or four items at a time. Divide a long list into groups, or give only the important items.
- Change each table row into a sentence. Give only the rows that the listener must have.
- Change a numbered procedure into a sequence: "First ... Then ... After that ... Last ...".

## Step 6. Write the Vois Studio script format

Use one script file. Use plain text.

- A speaker tag is the speaker name in square brackets, then a colon: `[Narrator]: Text`. Vois Studio does not read `Narrator: text` without brackets as a speaker tag. It reads all of it as text.
- Put a speaker tag at the start of the script, also for one narrator.
- Put a new speaker tag only when the speaker changes.
- A pause token is `[pause=NNN]`. NNN is the length in milliseconds, from 300 to 3000. Put it on its own line or in a line.
- Use 300 to 500 ms between two parts. Use about 800 ms after an important line. Use 2000 to 3000 ms for a change of scene.
- Use punctuation for the usual rhythm. A full stop ends a thought. A comma continues a thought. Use an ellipsis (...) only where the speaker stops to think.
- Do not use quotation marks to change the tone. They do not change the voice.

```text
[Narrator]: Most backups fail for one reason. Nobody tests them.
[pause=800]
Here is a simple fix. It takes five minutes a week.

[Host]: Five minutes? That's all?

[Narrator]: That's all. First, pick one file. Second, restore it to a new folder. Third, open it.
```

Speaker tags and pause tokens apply when Vois Studio generates a script, in the window or with `vois-cli script generate`. A direct `vois-cli tts generate` call is for one voice. It does not read speaker tags, and it removes pause tokens. Use the `--spoken` output of the check script for a direct call (step 8).

## Step 7. Check the script

Use the check script. It finds digits, symbols, Markdown marks, long sentences, and tags that the selected engine does not use.

```bash
node scripts/check-script.mjs episode-01.script.txt --engine fast
```

The script is at `scripts/check-script.mjs` in this skill folder. It gives exit code 0 if it finds no errors, and 1 if it finds errors. Correct each error. A warning is a decision, not always a change.

Then read the script aloud, or tell the user to read it. Correct each position where you stop or where you must read a sentence two times.

Also make sure of these items:

- [ ] Each sentence has one idea.
- [ ] Only `[pause=NNN]` tokens contain digits. No symbols stay.
- [ ] Each acronym has a decision: letters or a word.
- [ ] Speaker tags are only at the start and at each change of speaker.
- [ ] Reaction tags are only in a script for Expressive.
- [ ] Directions to the voice are not in the text. For Omni or Craft, they go in `--instruct`.

Plan the length: 150 words is about one minute of spoken English. This is only an estimate. The test file gives the correct length.

## Step 8. Make one test file

Make the spoken text for one voice. Then make one file with the selected engine. This example uses Fast and an English library voice:

```bash
node scripts/check-script.mjs episode-01.script.txt --engine fast --spoken > episode-01.spoken.txt
vois-cli tts generate --text - --engine fast --language English \
  --voice narrators_ai_voices/morgan_vale \
  --output /absolute/path/episode-01-test.wav --format json < episode-01.spoken.txt
```

- Always give `--engine` and `--language`. Without `--engine`, `tts generate` does not use the engine that the user selected in the app.
- Get voice IDs from `vois-cli voice list --engine fast --format json`. For Sonic, use a built-in voice, for example `sonic_cedar`.
- For a script with more than one speaker, make one test file for each speaker. Use some lines of that speaker.
- The JSON result gives `duration_secs` and `engine_used`. Compare the length with your estimate.

Listen to the test file. If a word is incorrect, change the script or add a pronunciation entry. Then make the test file again.

## If a command stops with an error

| Exit code | Cause | What to do |
|---|---|---|
| 2 | Vois Studio is not open. | Open Vois Studio, or start the service with `vois-cli service start`. Then do the command again. |
| 3 or 64 | A flag is not correct, or Vois Studio cannot identify the language. | Read `vois-cli tts generate --help`. Give `--language`. |
| 4 | The voice ID is not in the voice list. | Get the list with `vois-cli voice list --engine <engine> --format json`. Use an ID from it. |
| 5 | The generation did not complete. | Make the text shorter. Then do the command again one time. |
| 7 | The plan does not include this command or engine. | Tell the user which plan is necessary. Show the `purchase_url`. Do not buy. |
| 8 | The quota is empty. | Tell the user. Do not try again. |
| 11 | The computer does not have sufficient free memory for the engine. | Close other apps, or use a smaller engine, for example Fast. |
| 12 or 13 | The engine did not download, or it is not available at this time. | Download it with `vois-cli model download --model <engine>`. If the download stops again, tell the user. |

Vois Studio does not change to a different engine when a generation stops with an error. Do not change the engine without the approval of the user.

## Output

- The script file in the Vois Studio script format.
- The output of the check script, with 0 errors.
- One test file, with its length in seconds and the engine that made it.
- A list of the names and words that can have an incorrect pronunciation.
