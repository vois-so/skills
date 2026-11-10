---
name: podcast-episode
description: Makes a two-host podcast episode with Vois Studio, from the idea to a file that you can publish. It writes an outline and a script with speaker tags, gives each host a voice, and adds a spoken intro and outro. It generates the episode in Vois Studio, puts all lines in one file, and exports one MP3 at podcast loudness. It also writes show notes with section times. It writes an RSS item with the enclosure length in bytes, the type and the play time. Use when the user says "make a podcast episode", "two hosts talking about", "turn this article into a podcast", "write and record an episode" or "make the RSS item for my episode". The CLI is necessary, so the plan must be Pro, Subscriber, or AppSumo Lifetime Tier 2 or 3. For a show with sponsors or other commercial use, use Pro or AppSumo Lifetime Tier 3.
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, ffmpeg and ffprobe, and Node.js 18+.
metadata:
  author: vois-so
  version: "0.1.1"
---

# Podcast episode

This skill makes one episode with two hosts. At the end, the user has:

- `out/episode.mp3`: the episode, mastered with a podcast export profile.
- `out/show-notes.md`: a summary, section times and links.
- `out/rss-item.xml` and `out/episodes.json`: the RSS item for the host or the feed.

The scripts in `scripts/` use `vois-cli` for the voices and the export, and ffmpeg for the measurements and the optional music.

## Step 1: Make sure that the tools operate

Use the CLI at its install path. Do not change PATH. Do not make an alias.

- macOS: `/Applications/Vois.app/Contents/MacOS/vois-cli`
- Windows: `%LOCALAPPDATA%\Vois\vois-cli.exe`

The scripts find the CLI at these paths. If it is at a different path, set `VOIS_CLI` to the full path.

```bash
VOIS="/Applications/Vois.app/Contents/MacOS/vois-cli"
"$VOIS" status --format json
```

| `next_action` | What to do |
| --- | --- |
| `ready` | Continue with step 2. |
| `buy_credits_or_subscribe` or `upgrade_plan` | Show `purchase_url` to the user (if it is empty, show https://vois.so/pricing). Stop and wait. Do not buy anything. |
| `register` | Tell the user to do the registration in Vois Studio, or to use `vois-cli license activate`. Stop. |
| `connect_and_retry` | Tell the user to connect to the internet. Then do the status command again. |

Exit code 2 tells you that Vois Studio is not open. Tell the user to open it, or use `"$VOIS" service start`.

Plan facts:

- This skill uses `export compile-script`. This command operates only on a plan with the CLI: Pro, Subscriber, or AppSumo Lifetime Tier 2 or 3.
- Free with export credits cannot use `export compile-script`.
- Free is for non-commercial use only.

## Step 2: Write the outline

Get the topic, the audience, the two host names and the target length from the user. Then write `outline.md`:

1. A cold open: one question or one fact that makes the listener stay.
2. The intro: the show name, the host names and the topic of this episode.
3. Two to four sections. Each section has one primary point and one example.
4. The outro: a summary in one sentence, one next step for the listener, and the last line of the show.

Plan 150 spoken words for each minute. A 10-minute episode has about 1,500 words.

Show the outline to the user. Write the script only when the user gives approval.

## Step 3: Write the script

Write `script.txt`. Read [script format](references/script-format.md) for the rules and the intro and outro templates. Short rules:

- Each spoken line is `[Name]: text`, with one speaker on each line. A line without brackets is not a speaker line.
- `## Section title` starts a section for the show notes. Vois Studio does not speak it.
- `[pause=800]` on its own line adds a pause of 300 to 3000 ms.
- Write for the ear: short sentences, contractions, and questions that the other host answers.
- Do not use emotion tags, for example `[happy]`. Put the emotion in the words.

Do a check of the script:

```bash
node scripts/lint-script.mjs script.txt --hosts "Maya,Theo"
```

The check shows the words for each host and the estimated minutes. Correct each ERROR line. Then show the script to the user.

## Step 4: Select two voices

Show the podcast voices:

```bash
"$VOIS" voice list --source all --category podcasts_ai_voices --format json
"$VOIS" voice list --source all --category hosts_ai_voices --format json
```

Select two voices that are easy to tell apart, for example one low voice and one higher voice. Use the `id` values with no change. Generate the same two lines with each voice, and let the user listen:

```bash
"$VOIS" tts generate --format json --language English --voice podcasts_ai_voices/maya_brooks \
  --text "Welcome back to Small Workshop. Today we fix a squeaky door." --output "$PWD/audition-maya.wav"
```

Vois Studio generates the episode with the engine that the user selected in Vois Studio. Library voices operate with Fast, Expressive, Multilingual, Omni and Craft. Built-in Sonic voices (`sonic_cedar`, ...) operate only with Sonic.

## Step 5: Make the episode

Write `episode.json` in the same folder as `script.txt`:

```json
{
  "show": "Small Workshop",
  "title": "Fix a squeaky door",
  "language": "English",
  "hosts": { "Maya": "podcasts_ai_voices/maya_brooks", "Theo": "podcasts_ai_voices/kai_mercer" },
  "script": "script.txt",
  "profile": "spotify_podcasts",
  "intro_music": "",
  "outro_music": "",
  "out_dir": "out"
}
```

Then make the episode:

```bash
node scripts/make-episode.mjs episode.json
```

The script does these steps with `vois-cli`:

1. It finds the project with the show name, or makes it (`project create`).
2. It makes the script (`script create --content-file`). When you use it again, it updates the script (`script update`).
3. It makes one speaker for each host that has a speaker tag in the script text, with its voice (`speaker create --script --name --voice`). It does this after step 2, because Vois Studio 2.6.3 and after does not add a speaker if the script text does not have its speaker tag.
4. It generates all lines (`script generate --id --language`). The result shows `engine_used`.
5. It puts the lines together in one WAV (`export compile-script --script`). The WAV is 48 kHz stereo.
6. If `intro_music` or `outro_music` has a file, it adds the music before and after the voices with ffmpeg. Use only music that the user has the rights to.
7. It exports `out/episode.mp3` with the export profile (`export with-profile`). `spotify_podcasts` gives MP3, 192 kbps, 44.1 kHz, -16 LUFS. `apple_podcasts` gives AAC in `out/episode.m4a`, -16 LUFS.
8. It measures the loudness and the true peak. It shows PASS when the loudness is in 1 LU of the target and the true peak is -1 dBTP or lower.
9. It writes the section times to `out/chapters.json`, and the IDs to `out/receipt.json`.

The IDs in `out/receipt.json` let you correct the same episode. Do not remove this file.

## Step 6: Listen and correct

Tell the user to listen to all of the episode. The user listens for incorrect names, a change of speed, an incorrect speaker, and a hard change between sections.

To correct a line, change it in `script.txt` and make the episode again:

```bash
node scripts/make-episode.mjs episode.json
```

The script updates the same script in Vois Studio. It does not make a new one.

If the user wants a different engine for the episode, the user selects it in Vois Studio. You can also use `"$VOIS" model switch --engine expressive`. This command also changes the engine that the user selected in Vois Studio. Tell the user before you use it.

## Step 7: Write the show notes

Write `out/show-notes.md` from the outline and from `out/chapters.json`:

```markdown
# <Episode title> (<Show>, episode <N>)

<Two sentences: what the listener learns.>

## In this episode

- 00:00:00 Intro
- 00:03:12 <Section title>

## Links

- <Each link that the hosts speak about>

Voices made with Vois Studio.
```

Use only the times from `out/chapters.json`. Do not make an estimate.

## Step 8: Make the RSS item

The user uploads `out/episode.mp3` to a podcast host or a web server. Get the public URL of the file from the user. Then make the item from the same file:

```bash
node scripts/rss-item.mjs --audio out/episode.mp3 \
  --url https://example.com/small-workshop/ep1.mp3 \
  --title "Fix a squeaky door" --description "Maya and Theo fix a squeaky door." \
  --episode 1 --season 1 --pub-date 2026-11-10T09:00:00Z \
  --out out/rss-item.xml --episodes out/episodes.json
```

The item has the enclosure length (the number of bytes in the file), the type (`audio/mpeg`), the play time, a GUID and the date in RFC 2822 format. Most podcast hosts make the RSS file of the show. If the user keeps the RSS file on a personal server, make the full RSS file with Vois Studio:

```bash
"$VOIS" rss generate --format json --title "Small Workshop" --description "Simple repairs at home." \
  --link https://example.com/small-workshop --author "Maya and Theo" \
  --image-url https://example.com/cover.jpg --category "Education" \
  --output "$PWD/out/feed.xml" --episodes-file "$PWD/out/episodes.json"
```

Make sure that `episode_count` in the result is the number of episodes in `episodes.json`. The command ignores an entry that has no title, description, `audio_url` or `pub_date`.

## Step 9: Clean up Vois Studio

If the user does not want to keep the episode in Vois Studio, remove what the script made:

```bash
node scripts/cleanup-episode.mjs out/receipt.json
```

It removes the two speakers and the script. It removes the project only if the script made it and the project has no other scripts. It also removes the compiled WAV that `export compile-script` keeps in the Vois Studio data folder. The files in `out/` stay.

## When a step fails

| Problem | What to do |
| --- | --- |
| Exit 2 | Vois Studio is not open. Tell the user to open it, or use `"$VOIS" service start`. |
| Exit 3 on `script delete` or `project delete` | The command must have `--force`. |
| Exit 4 | A voice, script or project ID is not correct. Get the voice ID again from `voice list`. If `out/receipt.json` has the ID of a removed project, remove `project_id` from it. |
| Exit 5 | One line did not generate. Make the episode again. If the same line stops the script again, change its words or its voice. |
| Exit 7 | The plan does not include the CLI or this engine. Show `purchase_url` and stop. |
| Exit 64 with `audio_too_short` | The export must have 5 s of audio or more. Add lines. |
| Exit 64 with `language_uncertain` | Set `"language"` in `episode.json`. |
| Episode check FAIL | Read the loudness and peak values. Make the episode again. If the check gives FAIL again, tell the user the values. |
| Incorrect engine in `engine_used` | The user selects the engine in Vois Studio. Then make the episode again. |
