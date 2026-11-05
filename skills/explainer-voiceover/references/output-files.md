# Script and output files

## Script flags

```text
node <skill>/scripts/explainer.mjs --scenes scenes.json [flags]
  --out DIR          output folder (default: voiceover)
  --fps N            editor frame rate; scene starts snap to frames (default: 30)
  --voice ID         voice ID from: vois-cli voice list --source all --format json
  --engine ID        fast | expressive | multilingual | omni | sonic | craft (default: expressive)
  --language NAME    for example English (default: English)
  --speed N          0.5 to 2.0 (default: 1)
  --lead S           silence before each line in its scene (default: 0.3)
  --tail S           silence after each line in its scene (default: 0.7)
  --offset S         silence before the first scene (default: 0)
  --joiner MODE      auto (ffmpeg if installed), ffmpeg, or node (default: auto)
  --master PROFILE   also export narration.wav with a Vois Studio output profile
  --tries N          takes to try when a take looks wrong (default: 2)
  --only a,b         render only these scene ids
  --force            render again even when nothing changed
  --dry-run          show the plan, render nothing
  --use-credits      allow a run that uses export credits (Free plan)
  --cli PATH         path to vois-cli (or set VOIS_CLI)
  --ffmpeg PATH      path to ffmpeg
```

The script uses a flag first. If there is no flag, it uses the key at the top of `scenes.json`. If there is no key, it uses the default. A scene can also set `voice`, `engine`, `language`, `speed`, `lead`, `tail`, `seed`, `say`, `instruct` and `seconds`.

## The scene length

- Without `seconds`: `lead + take + tail`, made longer to the next frame at `--fps`.
- With `seconds`: the scene is `seconds` long. If the voice ends after `seconds`, the scene length becomes `lead + take`. The script writes a note. After it writes all files, it stops with exit 65.
- The next scene starts where the last scene stops.

## Output folder

```text
voiceover/
  scenes/01-problem.wav    one take for each scene, 24 kHz mono 16-bit
  scenes/02-fix.wav
  narration.wav            all scenes on one track, from time 0
  narration.srt            captions at narration time
  timing.csv               one row for each scene
  timing.json              the same data, with the take details and the key of each take
  narration-<profile>.m4a  only with --master
```

## narration.wav

- With ffmpeg: 48 kHz, mono, 16-bit. ffmpeg resamples each take and adds `lead` of silence before it. Then it pads the take to the scene length and connects the scenes.
- Without ffmpeg (or with `--joiner node`): 24 kHz, mono, 16-bit. The built-in joiner adds silence sample by sample. All Vois Studio takes have the same format, so the joiner does not resample.
- The script measures the result. If its length is not the timeline length, it stops with exit 6.

## narration.srt

- A cue has a maximum of two lines of 42 characters.
- A cue stops at a sentence end. A full cue stops after a comma, so a clause stays on one cue.
- The cue times are estimates. The script finds the pauses in each take and puts the phrase ends on them. In a phrase, it divides the time between the words by syllables. Each cue starts less than about 0.1 s from the voice.
- The text comes from `text`, not from `say`. Thus, the names in the captions are always correct.

## timing.csv

```text
scene,id,start,end,length,voice_start,voice_end,file,note
1,problem,00:00:00.000,00:00:04.640,4.640,00:00:00.440,00:00:03.720,scenes/01-problem.wav,
2,fix,00:00:04.640,00:00:10.640,6.000,00:00:05.080,00:00:08.610,scenes/02-fix.wav,
```

| Column | What it is |
| --- | --- |
| `start`, `end` | The scene in the narration track. Put a marker or a cut at `start` |
| `length` | The scene length in seconds |
| `voice_start`, `voice_end` | Where the voice starts and stops in the narration track |
| `file` | The take of this scene |
| `note` | Empty, or the cause when the scene is longer than its `seconds` |

The times use `hours:minutes:seconds.milliseconds`. To get a frame number, multiply the seconds by the frame rate.

## --master

`--master <profile>` sends `narration.wav` to `vois-cli export with-profile`. The export profiles:

| `--master` value | Loudness | Format |
| --- | --- | --- |
| `youtube_video` | -14 LUFS | AAC, 48 kHz, stereo |
| `apple_podcasts` | -16 LUFS | AAC, 48 kHz, stereo |
| `spotify_podcasts` | -16 LUFS | MP3, 44.1 kHz, stereo |
| `generic_hq` | -19 LUFS | WAV, 48 kHz, stereo |
| `acx_audiobook` | -20 LUFS | MP3, 44.1 kHz, stereo |

Get the current list with `vois-cli export profiles --format json`. An export must be 5 seconds or longer. A shorter one stops with exit 64.
