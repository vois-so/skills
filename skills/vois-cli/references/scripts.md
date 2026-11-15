# Scripts and speakers

Use a script when two or more voices speak in one file, for example a podcast with two hosts.
A script is in a project. Each speaker in the script has one voice.
These commands change data in Vois Studio. Get approval from the user first.

## Script format

```text
[Host]: Welcome to the show.
[pause=800]
[Guest]: Thanks for having me.
[Host]: Before we start [pause=500] here is the plan for today.
```

- Start each speaker line with `[Speaker Name]:`. The brackets are necessary.
- Vois Studio does not read `Host: text` (no brackets) as a speaker line. It reads all of the line as text.
- Write the tag only when the speaker changes. A tag is not necessary on the next lines of the same speaker.
- `[pause=NNN]` adds NNN milliseconds of silence. The editor in Vois Studio accepts 300 to 3000.
- Only Expressive plays reaction tags, for example `[laugh]`. The other engines remove them.
- A line with only a reaction tag gives no audio on other engines. `script generate` puts its ID in `skipped_unspoken`.

## Steps

1. Make the project. Keep the `id` from the result.

   ```bash
   vois-cli project create --name "Episode 1" --format json
   ```

2. Write the script to a text file. Make the script. Keep the `id`.

   ```bash
   vois-cli script create --project <project-id> --title "Episode 1" \
     --content-file "/Users/me/ep1.txt" --format json
   ```

3. Add one speaker for each name in the brackets. The `--name` must be the same as the name in the brackets, with the same capital letters. Do this step after step 2. In Vois Studio 2.6.3 and after, `speaker create` adds a speaker only if the script text has the speaker tag of that speaker. If not, the command stops with exit code 1 and `data.reason: "speaker_not_in_script"`.

   ```bash
   vois-cli speaker create --script <script-id> --name Host --voice podcasts_ai_voices/maya_brooks --format json
   vois-cli speaker create --script <script-id> --name Guest --voice podcasts_ai_voices/ellis_grant --format json
   vois-cli speaker list --script <script-id> --format json
   ```

4. Generate all lines. Give the language.

   ```bash
   vois-cli script generate --id <script-id> --language English --format json
   ```

   The result gives `engine_used` and `duration_ms` for each line, and `total_duration_secs`.
   `script generate` uses the engine that the user selected in Vois Studio.
   If that engine cannot speak a voice, select a different voice, or get approval for `model switch`.

5. Put the lines together into one WAV file.

   ```bash
   vois-cli export compile-script --script <script-id>
   ```

   The file is `audio/script_<script-id>.wav` in the data folder of Vois Studio.
   On macOS, this folder is `~/Library/Application Support/so.vois.app/`.
   The human output shows the full path. The JSON output gives `audio_path_rel` and `path_root: "app_data"`.
   The file is a 48 kHz stereo WAV.

6. Make the file for the user with an export profile.

   ```bash
   vois-cli export with-profile --input "<full path of script_<script-id>.wav>" \
     --output "/Users/me/audio/episode-1.mp3" --profile spotify_podcasts --format json
   ```

## Lines with no speaker

- A line with no speaker tag uses the voice of the speaker with the name `Narrator`.
- If there is no `Narrator` speaker, the line uses the `--voice` of `script generate`. Its default is `alba`, a voice for Fast only.
- To prevent an error, give a tag to each line. You can also give `--voice` with a voice that the selected engine can speak.

## Free with export credits

`export compile-script` and `export compile-project` do not operate on Free with export credits.
On Free, generate each line with `tts generate --output`. Each file uses one credit.

## Read the result

```bash
vois-cli script segments --id <script-id> --format json
```

`script segments` gives one item for each line of text. Pause lines are not in the list.
`has_audio` is `true` when the line has a take and the audio file of that take is there.

## Remove a test project

Delete a project only when the user gives approval. The delete removes the scripts and the speakers of the project.

```bash
vois-cli project delete --id <project-id> --force --format json
```

Without `--force`, the command stops with exit code 3 and deletes nothing.
The compiled WAV file stays in the `audio` folder of Vois Studio after the delete.
