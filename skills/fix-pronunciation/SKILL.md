---
name: fix-pronunciation
description: Finds the words in a script that a Vois Studio voice can say incorrectly (names, brands, acronyms, words from other languages, numbers with units) and corrects them. It gives a respelling or a pronunciation dictionary entry for each word. It adds, tests, updates, deletes, imports and exports the entries with vois-cli pronunciation, in the global scope or in the scope of one project. Use when the user says "it says the name wrong", "fix the pronunciation", "the voice mispronounces this", "how do I make it say X", "add this to the dictionary" or "check the script for hard words". The dictionary commands are available on Pro, Subscriber, AppSumo Lifetime Tier 2 or 3, and the Free plan with export credits. The word check and the respelling work on all plans.
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, and Node.js 18+ for the word check.
metadata:
  author: vois-so
  version: "0.1.0"
---

# Fix pronunciation

This skill does one task. It finds the words in a script that the voice can say incorrectly. Then it corrects them and makes sure that the correction works.

There are two methods:

- **A respelling in the script.** Write the word as it sounds: "Qdrant" becomes "quadrant". Use it for a word that is in one script only.
- **A pronunciation entry.** Vois Studio replaces the word before the voice speaks. Use it for a word that is in many scripts. Correct the name one time, not in each take.

## What you must have

- The script, as a text file.
- The engine, the language and the voice of the script.
- The correct sound of each name. If you do not know it, tell the user. The correct sound of a name is the sound that its owner uses.

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

| Plan | What this skill can do |
|---|---|
| Pro, Subscriber, AppSumo Lifetime Tier 2 or 3 | All steps. |
| Free with export credits | All steps. Each test file uses one credit. |
| Free without credits | Steps 1 and 2, and respellings in the script. The dictionary commands of vois-cli are not available. |

Do not buy a plan or credits for the user. Show the `purchase_url` from `vois-cli status --format json` (or https://vois.so/pricing). Then wait for the user.

## Step 1. Find the risky words

Get the dictionary. Then examine the script with the word check:

```bash
vois-cli pronunciation list --format json > dict.json
node scripts/find-risky-words.mjs episode.script.txt --dictionary dict.json --csv draft.csv
```

The script is at `scripts/find-risky-words.mjs` in this skill folder. It shows each candidate with its category, the number of times, the lines and a note. It gives exit code 1 if it finds candidates, and 0 if it finds none.

| Category | Examples | Usual correction |
|---|---|---|
| `name` | Siobhan Nguyen, Kubernetes | Entry |
| `brand` | PostgreSQL, gRPC | Entry |
| `acronym` | API, NASA | Entry, or letters with spaces in the script |
| `letters+digits` | MP3, 5G | Entry, or the spoken words in the script |
| `number+unit` | 20ms, 5 GB | Spoken words in the script |
| `number` | 2024, 99.9 | Spoken words in the script |
| `symbol` | C++, .NET, URLs | Respelling in the script. An entry cannot replace these. |
| `accented` | Zürich, São Paulo | Make a test file. Entry if it is incorrect. |
| `uncommon-spelling` | nginx, Qdrant | Make a test file. Entry if it is incorrect. |
| `heteronym` | read, live, record | Change the words of the sentence. Do not add an entry. |

The word check finds candidates. It cannot hear. Many candidates are correct. Step 3 finds which candidates are incorrect.

The note "In dictionary" shows a word that has an entry. Do not add a second entry for it.

## Step 2. Write the spoken words in the script

Correct these categories in the script text, not in the dictionary:

- Numbers and units: "20ms" becomes "twenty milliseconds".
- Words with symbols: "C++" becomes "C plus plus". An entry cannot replace a word that starts or ends with a symbol.
- Heteronyms: "We read the logs live" becomes "We watched the logs in real time". An entry changes the word in all sentences.
- A word that is in this script only.

## Step 3. Listen to the risky words

Make a short test file for each line with a candidate. Use the engine, the language and the voice of the script:

```bash
vois-cli tts generate --text "Siobhan runs the platform team at Qdrant." --engine fast \
  --language English --voice narrators_ai_voices/morgan_vale \
  --output /absolute/path/check-qdrant.wav --format json
```

Listen to each file, or tell the user to listen. If a transcription tool is installed, you can also compare its transcript with the line. A transcript can show a name that is incorrect, for example "Savon" for "Siobhan". It cannot show an incorrect stress.

Make a list of the words that are incorrect.

## Step 4. Write the pronunciation

For each incorrect word, write a respelling in usual English spellings. Divide long names into parts. Do not use phonetic symbols.

| Word | Pronunciation |
|---|---|
| Qdrant | "quadrant" |
| Siobhan | "shiv-awn" |
| nginx | "engine x" |
| API (as letters) | "A P I" |

Make a test file with the respelling before you add the entry. Put the respelling in the text:

```bash
vois-cli tts generate --text "Siobhan runs the platform team at quadrant." --engine fast \
  --language English --voice narrators_ai_voices/morgan_vale \
  --output /absolute/path/check-respelling.wav --format json
```

More rules and examples are in the [respelling guide](references/respelling.md).

## Step 5. Select the scope

| Scope | `--scope` | Where the entry applies |
|---|---|---|
| Global | `global` (the default) | All projects, and each `vois-cli tts generate` call. |
| One project | The project ID, for example `72` | Only the scripts of that project, in the window and with `vois-cli script generate`. |

- `vois-cli tts generate` uses only global entries.
- In a project, the voice uses the project entry, not the global entry, for the same word.
- An entry replaces only the full word, in capital and lowercase letters. It replaces "QDRANT" also. It does not replace "Qdrants".
- An entry can also change the word in a script in a different language. For a project in a different language, use the scope of that project.

Get the project IDs with `vois-cli project list --format json`.

## Step 6. Add, test, update and delete entries

Get the approval of the user before you change the dictionary. The dictionary applies to all future generations in its scope.

Find an entry that is there:

```bash
vois-cli pronunciation search --query qdrant --format json
```

Add an entry. Write the `id` from the result:

```bash
vois-cli pronunciation add --word Qdrant --pronunciation "quadrant" \
  --scope global --context "vector database brand" --format json
```

Make the test file again with the initial word in the text. The entry changes it before the voice speaks:

```bash
vois-cli tts generate --text "Siobhan runs the platform team at Qdrant." --engine fast \
  --language English --voice narrators_ai_voices/morgan_vale \
  --output /absolute/path/check-qdrant-fixed.wav --format json
```

If the sound is not correct, change the pronunciation. Then test again:

```bash
vois-cli pronunciation update --id 15 --pronunciation "kwah-drant" --format json
```

Delete an entry that you do not keep:

```bash
vois-cli pronunciation delete --id 15 --format json
```

`vois-cli pronunciation delete-scope --scope <scope> --force` deletes all entries in a scope. Do not use it without the clear approval of the user. Make a backup first (step 7).

## Step 7. Import and export many entries

Make a backup before a large change:

```bash
vois-cli pronunciation export --output pronunciations-backup.csv
```

The word check writes `draft.csv` with the header and one row for each candidate. The pronunciation column is empty. Fill in each row that has a correct test file. Remove the other rows. Then examine the file and import it:

```bash
node scripts/find-risky-words.mjs --check-csv draft.csv --dictionary dict.json
vois-cli pronunciation import --file draft.csv --scope global --format json
```

Obey these rules for the CSV:

- The first line is the header: `word,pronunciation,context,language`. Vois Studio skips it.
- No field can contain a comma or a quote.
- A row with an empty pronunciation removes the word from the audio. Remove the row, or fill it in.
- Import adds entries. It does not update an entry that is there. For a word that has an entry, use `pronunciation update`.

## If a command stops with an error

| Exit code | Cause | What to do |
|---|---|---|
| 2 | Vois Studio is not open. | Open Vois Studio, or start the service with `vois-cli service start`. |
| 3 or 64 | A flag is not correct. | Read `vois-cli pronunciation <command> --help`. |
| 4 | The entry ID or the project ID is not there. | Get the IDs with `vois-cli pronunciation list --format json` or `vois-cli project list --format json`. |
| 7 | The plan does not include the CLI. | Show the `purchase_url`. Do not buy. Use respellings in the script. |
| 5 | The test file did not generate. | Make the line shorter. Try again one time. |

## Output

- A list of the risky words, with the decision for each word: no change, a respelling in the script, or an entry.
- The ID, the word, the pronunciation and the scope of each entry that you added or changed.
- One test file for each corrected word.
- A backup CSV, if you changed many entries.
