# Respelling guide

A pronunciation entry in Vois Studio replaces a word with other text before the voice speaks. The voice then reads the new text. Thus the pronunciation is a spelling that the voice reads correctly. It is not a phonetic alphabet.

## Rules for a good respelling

1. Use usual English spellings for each sound: "kwah-drant", "shiv-awn", "win".
2. Divide long names into parts with hyphens or spaces: "koo-ber-net-eez".
3. Use a known English word for a part if it has the correct sound: "Nguyen" becomes "win".
4. Do not use phonetic symbols, for example `ə` or `ʃ`. The voice does not read them as sounds.
5. Do not use a dollar sign. Do not use a comma or a quote in an entry for CSV import.
6. Keep the respelling as short as possible. A long respelling changes the rhythm of the sentence.
7. Make a test file for each respelling. If it is not correct, change one part at a time.

Some writers put the stressed part in capital letters, for example "ree-HUR-sul". This can help. But a voice can read a short part in capital letters as letters. Make a test file. If the voice says the letters, use lowercase letters.

## Examples

| Word | Category | First respelling for a test file |
|---|---|---|
| Siobhan | Name | "shiv-awn" |
| Nguyen | Name | "win" |
| Joaquin | Name | "wah-keen" |
| Saoirse | Name | "seer-sha" |
| Xiaoming | Name | "shyow-ming" |
| Zürich | City | "zoo-rick" (English), or keep it for German |
| Worcester | City | "wuss-ter" |
| Qdrant | Brand | "quadrant" |
| nginx | Brand | "engine x" |
| Kubernetes | Brand | "koo-ber-net-eez" |
| PostgreSQL | Brand | "post gress Q L" |
| gRPC | Brand | "G R P C" |
| SQL | Acronym | "S Q L", or "sequel" if your team says it so |
| GIF | Acronym | "gif" or "jif", as your audience says it |
| MP3 | Letters and digits | "M P three" |
| 5G | Letters and digits | "five G" |
| H2O | Letters and digits | "H two O" |
| quinoa | Word from a different language | "keen-wah" |
| gnocchi | Word from a different language | "nyoh-kee" |

These respellings are a start. The correct sound of a name is the sound that its owner uses. If you do not know it, tell the user.

## Acronyms

| The speaker says | Pronunciation |
|---|---|
| The letters | The letters with spaces: "A P I" |
| A word | The word in lowercase letters: "nasa" |

A pronunciation entry for an acronym is useful when the acronym is in many scripts. For one script, write the spoken text in the script.

## Words that an entry cannot correct

| Word | Problem | What to do |
|---|---|---|
| C++, C#, .NET, Node.js | The word starts or ends with a symbol, or has a symbol in it. An entry cannot replace it. | Write a respelling in the script: "C plus plus", "C sharp", "dot net", "Node J S". |
| `read`, `lead`, `live`, `record` | The word has two sounds. The meaning selects the sound. | Change the words of the sentence. An entry changes the word in all sentences. |
| 20ms, 5 GB, 2026 | A number. | Write the number as words in the script. |
| A word in a longer word | An entry replaces only full words. An entry for "Vois" does not change "Voisbox". | Add an entry for the full word. |

## Names with more than one word

Add one entry for the full name, for example "Siobhan Nguyen". Vois Studio applies the longer entry first. Thus it uses the entry for "Siobhan Nguyen", not the entry for "Nguyen".

## Languages

An entry can also change the word in a script in a different language. Make a test file in each language that you use. For a project in a different language, put the entry in the scope of that project.

## CSV format for import

Vois Studio reads the CSV with these rules:

- It skips the first line. Make the first line the header: `word,pronunciation,context,language`.
- It divides each row at each comma. It does not read quotes. Thus no field can contain a comma or a quote.
- The pronunciation must not be empty. An empty pronunciation removes the word from the audio.
- The language column is optional. The default is `en`.
- Import adds new entries. It does not update an entry that is there. Before import, find the words that have an entry.

```text
word,pronunciation,context,language
Qdrant,quadrant,vector database brand,en
Siobhan Nguyen,shiv-awn win,guest name,en
nginx,engine x,web server,en
```

Examine the file before import:

```bash
vois-cli pronunciation list --format json > dict.json
node scripts/find-risky-words.mjs --check-csv entries.csv --dictionary dict.json
```
