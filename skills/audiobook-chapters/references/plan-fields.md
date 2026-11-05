# Plan fields

`split-manuscript.mjs` writes `<workdir>/plan.json`. You can change each field before you start `render-chapters.mjs`. If you change a field that controls the voice (text, voice, engine, language, speed, instruct), the script generates that block again. It keeps the blocks that did not change.

| Field | Default | Purpose |
| --- | --- | --- |
| `title`, `author` | from the manuscript and the flags | The M4B title and artist tags |
| `language` | `English` | The language for each block (`--language` of `tts generate`) |
| `engine` | `expressive` | `fast`, `expressive`, `multilingual`, `omni`, `sonic` or `craft` |
| `speed` | `1.0` | Voice speed, 0.5 to 2.0. Keep it the same for the full book |
| `instruct` | empty | Direction in plain words for `craft` and `omni` (Pro). Other engines do not use it. Do not use brackets or parentheses. Use less than 2,000 characters |
| `voices` | `Narrator` and each `[Name]` speaker | The voice ID for each speaker, from `vois-cli voice list --format json` |
| `pause_ms` | `600` | The pause between two blocks |
| `break_ms` | `1600` | The pause at a new scene and after the chapter title |
| `head_ms` | `500` | Room tone at the start. The voice adds about 0.1 s, so the file starts with about 0.6 s |
| `tail_ms` | `2000` | Room tone at the end. The voice adds a short silence, so the file ends with about 2.2 to 2.5 s |
| `target_lufs` | `-20` | The first loudness target for the export. The script changes it if the peak or RMS is not in the limits |
| `crest_db` | `15` | The maximum peak above the RMS of the voice, before the export. A lower number limits more peaks |

Each chapter has:

| Field | Purpose |
| --- | --- |
| `id` | `01`, `02`, ... The file names start with it |
| `title` | The chapter title. The narrator reads it, and the M4B chapter mark uses it |
| `words`, `est_minutes` | The estimate at 150 words a minute |
| `status` | `draft`, `rendered`, `qc_pass`, `qc_fail`. Set `approved` when the user listens to the chapter and gives approval |
| `blocks` | `{ "type": "speech", "speaker": "Narrator", "text": "..." }` or `{ "type": "break" }`. A block with spoken text can also have its own `"instruct"` |

## Files that the scripts write

| Path | Contents |
| --- | --- |
| `blocks/<id>/<nnn>.wav` and `.json` | One take for each block, and the settings that made it |
| `wav/<id>.wav` | The chapter with pauses, room tone and peak control, 24 kHz mono |
| `mp3/<id> - <title>.mp3` | The retail chapter file |
| `qc.json` | The measured values and PASS or FAIL for each chapter |
| `<title>.m4b` | The full book with chapter marks |

Keep the `blocks` folder until the book is complete. It makes retakes fast.
