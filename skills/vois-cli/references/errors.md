# Errors and recovery

With `--format json`, an error is a JSON object on stderr:

```json
{"error": {"code": -32603, "data": {"reason": "incompatible_voice"}, "message": "TTS generation failed: This voice is available only with Sonic."}}
```

Read `data.reason` first. It sets the exit code before `code` does.

## Values of `data.reason`

| `data.reason` | Exit code | What to do |
|---|---|---|
| `language_uncertain` | 64 | Add `--language` with the language of the text. |
| `audio_too_short` | 64 | The export has less than 5 seconds of audio. Put more lines together. Do not add silence to hide an empty file. |
| `cancelled` | 130 | Someone canceled the task. Do not start it again if the user does not tell you to. |
| `package_unavailable` | 13 | `data.package` gives the engine package. It is not available at this time. Use a different engine. |
| `near_silent` | 5 | The audio of the line is almost silent, so Vois Studio did not keep it. Make the line longer, or select a different voice. |
| `take_superseded`, `take_not_recorded` | 5 | The line does not have the new take. Generate the line again. If the error text has a storage code (below), correct the disk first. |
| `voice_not_found` | 4 | 2.6.3+. The voice ID does not identify a voice. This occurs on all engines, and in `speaker create` and `speaker update`. Use `voice list --source all --format json`, then use a correct ID. Do not try the same ID again. |
| `incompatible_voice` | 1 | The engine cannot speak this voice, for example a Sonic voice with `--engine fast`. Select a voice that has the engine in `supported_engines`. |
| `package_not_installed` | 1 | 2.6.3+. The engine (or a Fast language) is not downloaded on this computer, for example `--engine omni` without Omni. Get approval, then use `model download --model <engine>`. Then try again. |
| `speaker_not_in_script` | 1 | 2.6.3+. `speaker create` stops and does not add the speaker, because the script text does not have the speaker tag of that speaker. First, write the speaker tag in the script with `script update`, for example `[Host]: Hello.`. Then do the command again. The names must be the same, with the same capital letters. |
| `plan_unconfirmed` | 7 | Vois Studio cannot examine the paid plan online. Tell the user to connect to the internet. Then try again. |

## JSON-RPC codes

If there is no `data.reason` in this list, the `code` sets the exit code.

| `code` | Exit code | Meaning |
|---|---|---|
| -32002 | 4 | Not found. `data.resource` gives the item. In 2.6.3 and after, a project or script ID that is not in the database in `project get`, `project update` or `script get` also gives this code. |
| -32003 | 5 | The generation fails. |
| -32004 | 6 | The export fails. |
| -32005 | 7 | A license is necessary. `data.feature` gives the function, for example `cli`, `cli_subscription` or `voice_design`. |
| -32006 | 8 | The quota is full. |
| -32007 | 10 | The Sonic queue is full. |
| -32008 | 11 | Not sufficient memory. |
| -32009 | 7 | A `speak` session tried to get a file. `speak` only plays the voice. |
| -32602 | 1 | A parameter is not correct, for example a library voice with `--engine sonic`. Read the message. |
| Other | 1 | General error. Read the message. |

## Storage codes

If the disk does not accept a write during a generation, the error message has a storage code before the cause. The code is `storage_failure(<type>)`, or `storage_failure(<type>,<SQLite code>)` for a database write. The type is `storage_full`, `permission_denied`, `read_only` or `io_error`. An example is `TTS generation failed: storage_failure(storage_full): take_not_recorded: ...`. The storage code does not change the exit code. Tell the user to make free space on the disk or to correct the permissions. Then try again.

## Timeouts

| Limit | Value | Exit code |
|---|---|---|
| Connect to Vois Studio | 3 seconds | 9 |
| Answer from Vois Studio | 900 seconds | 9 |

Exit code 9 shows that Vois Studio is open but did not answer.
Exit code 2 shows that Vois Studio is not open.

## Export credits on Free

Only Free with export credits uses these steps. A paid plan has no credits, and its exports have no limit.

1. If an export result has `credit_accounting_pending: true` and `retry_safe: false`, the file is complete. Do not do the export again.
2. Use `vois-cli credits sync --format json` one time.
3. Use `vois-cli status --format json`. Look at `credit_reconciliation_required` and `next_action`.
4. If `credit_reconciliation_required` is `true` or `next_action` is `contact_support`, stop. Tell the user to send an email to `support@vois.so` with the reconciliation ID, the time and the file name.
5. Do not use `credits reconcile` unless `support@vois.so` gives the ID and tells the user to accept the charge.

After an export fails, read the error and then use `status` before you try again.
If the error or `status` has `retry_safe: false`, do not try again.

With `--output -`, the export can be complete when the pipe closes before the end.
If the error data has `stdout_delivery_failed: true`, use the full file at `recovery_path`. Do not do the export again.

## Destructive commands

These commands stop with exit code 3 and delete nothing if you do not add `--force`.

| Command | What it deletes |
|---|---|
| `project delete` | The project and all its content |
| `script delete` | The script and all its audio |
| `voice clone-delete` | The cloned voice and its recording |
| `voice design-delete` | The designed voice |

Add `--force` only after the user gives approval.
With `--format json`, `license deactivate` does not operate without `--yes`. Get approval before you add `--yes`.

## Generation stops and the cause is not clear

1. Use `status --format json`. Make sure that `next_action` is `ready`.
2. Use `model list --format json`. Make sure that the engine has `installed: true` and `available: true`.
3. Use `voice get --id <voice-id> --format json`. Make sure that the engine is in `supported_engines`.
4. Give `--language` and `--engine`.
5. Try a short test line to a new file. If the test line gives an error again, tell the user. Give the command, the exit code and the message.
