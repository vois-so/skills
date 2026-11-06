---
name: clone-with-consent
description: "Clones the voice of a person in Vois Studio only after that person gives consent. First it makes a consent record. The record has the name of the voice owner, the date, the scope of use, the expiry date, and a signature or a recorded statement. It makes sure that the plan can clone voices, gives instructions to record the voice sample, and measures the sample. Only then does it clone the voice with vois-cli, do a test, and connect the clone to the consent record. It also removes the clone when the owner withdraws consent. Use when the user says \"clone my voice\", \"clone the voice of my narrator\", \"make a voice from this recording\", \"use my co-host's voice\" or \"the owner wants the voice removed\". Only a paid plan can clone voices: Pro or Subscriber. For commercial use of the clone, use Pro or AppSumo Lifetime Tier 3."
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, Node.js 18+, and ffmpeg and ffprobe for the sample check.
metadata:
  author: vois-so
  version: "0.1.0"
---

# Clone with consent

This skill makes a voice clone in Vois Studio in this sequence:

1. The consent of the voice owner, with proof, in a record.
2. A check of the plan.
3. A good voice sample with its accurate transcript.
4. The clone, a test, and a link from the clone to the consent record.

Do not change this sequence. Do not clone a voice before the consent check shows READY.

## The consent rule

Clone a voice only with the consent of the owner of the voice.

- If the user wants to clone the voice of a different person, that person must give consent. The user cannot give consent for a different person.
- Clone a voice from a movie, a song or an online video only with the written consent of its owner.
- Clone the voice of a public person or of a person who died only with written consent. The consent must come from the owner, or from the persons who control the rights.
- If the user cannot get consent, stop. Tell the user why. Offer a library voice, or a designed voice (Voice Design, Pro), as an alternative.
- If the voice is the voice of the user, make the consent record also. The user is then the owner and the collector.

Tell the user to read the Vois Studio voice cloning terms before you start: https://vois.so/legal/voice-cloning-terms

## Step 1: Make sure that the plan can clone

Use the CLI at its install path. Do not change PATH. Do not make an alias.

- macOS: `/Applications/Vois.app/Contents/MacOS/vois-cli`
- Windows: `%LOCALAPPDATA%\Vois\vois-cli.exe`

```bash
VOIS="/Applications/Vois.app/Contents/MacOS/vois-cli"
"$VOIS" status --format json
```

Read `plan_code` and `next_action`:

- Only a paid plan can clone voices: Pro, or Subscriber. Free cannot clone voices.
- On AppSumo Lifetime, the clone command tells you if your tier can clone voices. Exit code 7 tells you that it cannot.
- If `next_action` is not `ready`, show `purchase_url` to the user (if it is empty, show https://vois.so/pricing) and stop. Do not buy anything.
- For commercial use of the cloned voice, the user must have Pro or AppSumo Lifetime Tier 3. Free is for non-commercial use only.

## Step 2: Make the consent record

Get these facts from the user. Do not make them up:

| Fact | Example |
| --- | --- |
| Full name and contact of the voice owner | Ana Ruiz, ana@example.com |
| The owner has 18 years of age or more (if not, a parent or guardian signs) | yes |
| Name and contact of the person or company that makes the clone | Example Studio, studio@example.com |
| Name of the voice in Vois Studio | Ana Ruiz narrator |
| Permitted uses | audiobook narration, course videos |
| Commercial use | yes or no |
| Languages | English, Spanish |
| Expiry date | 2027-12-31, or `none` (until the owner withdraws consent) |
| Method | `signed` (a signed document) or `recorded` (the owner reads a statement aloud) |

Make the record:

```bash
node scripts/consent-record.mjs new consent/ana-ruiz \
  --owner "Ana Ruiz" --contact ana@example.com --adult \
  --collector "Example Studio" --collector-contact studio@example.com \
  --voice-name "Ana Ruiz narrator" --uses "audiobook narration; course videos" \
  --commercial yes --languages "English, Spanish" --expires 2027-12-31 --method recorded
```

The script writes three files in `consent/ana-ruiz/`:

- `consent.json`: the record.
- `consent.md`: the document with all fields and the signature lines.
- `statement.txt`: the statement that the owner reads aloud.

Send `consent.md` to the owner. The owner reads it and gives the proof of consent:

- `signed`: the owner signs `consent.md` (on paper or with an e-signature) and sends the signed file.
- `recorded`: the owner reads `statement.txt` aloud in a different recording, and sends the file.

The fields and the blank document are in [consent template](references/consent-template.md).

## Step 3: Do a check of the consent record

```bash
node scripts/consent-record.mjs check consent/ana-ruiz --evidence consent/ana-ruiz/signed-consent.pdf
```

The check shows READY only when all fields are complete, the proof file is there, and the expiry date is after today. It keeps the SHA-256 of the proof file and gives the record an ID (for example `CR-20261106-f9a5f7d2`). If it shows `missing:` lines, get those facts from the user. Then do the check again.

Do not continue until the check shows READY.

## Step 4: Record the voice sample

Give the owner the instructions in [recording guide](references/recording-guide.md). The short version:

- Record 10 to 15 seconds of clear spoken words. The clone command accepts 5 to 60 seconds.
- Use a quiet room with soft surfaces. Use no music, no effects and no other voices.
- Speak in the language, accent and style that the clone must have.
- Keep peaks below -1 dBFS.
- Write down each word that the owner speaks, accurately.

Measure the sample:

```bash
node scripts/check-reference.mjs ana-sample.wav --transcript "The accurate words of the recording."
```

The check measures the length, the peak, the level and the noise floor. It also measures the silence at the two ends and the number of words for each second. A FAIL stops the clone: record again. A WARN gives a clone of lower quality: tell the user, and record again if possible.

Then add the sample and its transcript to the consent record:

```bash
node scripts/consent-record.mjs check consent/ana-ruiz \
  --reference ana-sample.wav --transcript "The accurate words of the recording."
```

## Step 5: Clone the voice

Use an absolute path for the audio. `--consent-confirmed` and `--transcript` are necessary. Put the record ID in `--notes`. The consent check shows the text for the notes:

```bash
"$VOIS" voice clone --format json \
  --audio "$PWD/ana-sample.wav" \
  --name "Ana Ruiz narrator" \
  --transcript "The accurate words of the recording." \
  --consent-confirmed \
  --notes "Consent CR-20261106-f9a5f7d2; commercial; ends 2027-12-31"
```

The result gives a `slug`. The slug is not the voice ID. Get the voice ID:

```bash
"$VOIS" voice list --source cloned --format json
```

Find the entry with the same `slug`. Its `id` is `cloned_<slug>`. Its `supported_engines` shows the engines that can speak it.

## Step 6: Do a test of the clone

Generate one test line with the clone:

```bash
"$VOIS" tts generate --format json --voice cloned_ana_ruiz_narrator \
  --engine expressive --language English \
  --text "This is a test of my cloned voice." --output "$PWD/clone-test.wav"
```

- Use `expressive` for English.
- Use `craft` (Pro) for 10 languages and a direction in plain words. A cloned voice keeps the accent of its sample.
- Use `multilingual` or `omni` (Pro) for other languages.

Tell the user to listen. Send the test to the owner if the owner wants to hear it. If the voice is not correct, record a better sample (step 4), remove the clone (step 8), and clone again.

Then connect the clone to the consent record:

```bash
node scripts/consent-record.mjs link consent/ana-ruiz --slug ana_ruiz_narrator --voice-id cloned_ana_ruiz_narrator
```

Keep the `consent/ana-ruiz/` folder while the clone is in Vois Studio. Do not put it in a public repository, because it has personal data.

## Step 7: Use the clone only in its scope

Before each new project with the clone, read the consent record. Make sure that:

- The project is one of the uses in `scope.uses`.
- Commercial use agrees with `scope.commercial`.
- The language is in `scope.languages`.
- The expiry date is after today, and `status` is not `revoked`.

If the project is not in the scope, get a new consent from the owner first.

## Step 8: Remove the clone when the owner withdraws consent

```bash
node scripts/consent-record.mjs revoke consent/ana-ruiz
"$VOIS" voice clone-delete --slug ana_ruiz_narrator --force
"$VOIS" voice clone-list --format json
```

The `revoke` command marks the record and shows the remove command with the slug. `voice clone-delete` removes the cloned voice and its sample from Vois Studio. It must have `--force`. Make sure that the slug is not in the `clone-list` result. Tell the user to stop new audio with the voice.

Do not remove a clone for a different cause without the approval of the user. You cannot get a removed clone back.

## When a step fails

| Problem | What to do |
| --- | --- |
| The consent check shows `missing:` | Get the missing facts or the proof from the user. Do not clone. |
| The sample check shows FAIL | Record the sample again. Do not clone with it. |
| Exit 2 | Vois Studio is not open. Tell the user to open it, or use `"$VOIS" service start`. |
| Exit 7 | The plan cannot clone voices, or cannot use this engine. Show `purchase_url` and stop. |
| Exit 64 on `voice clone` | The command does not have a necessary flag (`--transcript`). Add it. |
| `voice clone` refuses the transcript (`reference_text`) | The transcript does not agree with the length of the recording. Write the accurate words of the recording. |
| Exit 4 on `tts generate` | Use the `id` from `voice list --source cloned`, not the slug. |
| Exit 3 on `voice clone-delete` | Add `--force`. |
