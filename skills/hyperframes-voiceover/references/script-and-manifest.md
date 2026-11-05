# The script, its inputs and the manifest

## Script flags

```text
node <skill>/scripts/voiceover.mjs (--script SCRIPT.md | --scenes scenes.json) [flags]
  --project DIR      HyperFrames project root (default: current folder)
  --out DIR          output folder in the project (default: assets/voiceover)
  --fps N            frame rate to snap the times to (default: 30)
  --voice ID         voice ID from: vois-cli voice list --source all --format json
  --engine ID        fast | expressive | multilingual | omni | sonic | craft (default: expressive)
  --language NAME    for example English (default: English)
  --speed N          0.5 to 2.0 (default: 1)
  --lead S           silence before each line in its scene (default: 0.25)
  --tail S           silence after each line in its scene (default: 0.5)
  --offset S         composition time of the first scene (default: 0)
  --track N          data-track-index of the voice clips (default: 3)
  --tries N          takes to try when a take looks wrong (default: 2)
  --only a,b         render only these line ids
  --force            render again even when nothing changed
  --dry-run          show the plan, render nothing
  --use-credits      allow a run that uses export credits (Free plan)
  --cli PATH         path to vois-cli (or set VOIS_CLI)
```

The script uses a flag first. If there is no flag, it uses the value from `SCRIPT.md` or from the top of `scenes.json`. If there is no value, it uses the default.

## How the script reads SCRIPT.md

| SCRIPT.md item | What the script does with it |
| --- | --- |
| `**Voice:**` in the header | Finds a Vois Studio voice ID (`category/voice`, `sonic_*`, `cloned_*` or `designed_*`) and an engine name |
| `**Voice direction:**` in the header | The direction for all lines. Omni and Craft only |
| `## Line N — <label> (Frame N)` | Starts a line. The id is `l<NN>-<label>` |
| `**Delivery:**` | The direction for this line. Omni and Craft only |
| `**Time:**` | The guide length. The table shows it as `guide s` |
| Indented block (four spaces or a tab) | The spoken text. More than one indented line becomes one line of text |

The script ignores all other text, for example `**Voice settings:**`. Sections with no indented block do not make a line.

## scenes.json

```json
{
  "voice": "explainers_ai_voices/clara_west",
  "engine": "expressive",
  "language": "English",
  "lead": 0.25,
  "tail": 0.5,
  "scenes": [
    { "id": "hook", "text": "Your video already has a story. Now it has a voice." },
    { "id": "how", "text": "Vois reads each line.", "say": "Voyce reads each line.", "minSeconds": 5 }
  ]
}
```

| Field | What it does |
| --- | --- |
| `id` | The name of the WAV, the clip id (`vo-<id>`) and the key in the manifest |
| `text` | The narration and the caption text |
| `say` | The words for the voice, when they are different from `text` |
| `instruct` | A direction in plain words. Omni and Craft only |
| `voice`, `engine`, `language`, `speed` | A value for this line only |
| `seed` | A fixed seed. Change it to get a different take |
| `lead`, `tail` | Seconds of silence before and after the line in its scene |
| `minSeconds` | The minimum length of the scene |

## When the script renders a line again

The script keeps a key for each line in the manifest. The key comes from the spoken words, the voice, the engine, the language, the speed, the direction and the seed. The direction is in the key only for Omni and Craft. The script renders a line again when the WAV is not there, when the key changed, or when you give `--force`.

A change to `lead`, `tail`, `minSeconds`, `offset` or `fps` changes only the timing. The script does not render again for it.

## Rules for the times

- Each scene starts on a full frame at `--fps`.
- The clip starts `lead` seconds after the scene start, on a full frame.
- The clip length is the WAV length, made longer to the next full frame.
- The scene length is `lead + clip + tail`, made longer to the next full frame, or `minSeconds` if that is longer.
- The next scene starts where the last scene stops. There is no overlap.

## voiceover.json

```json
{
  "generator": "vois-studio hyperframes-voiceover",
  "fps": 30,
  "offset": 0,
  "totalSeconds": 10.6,
  "narration": "assets/voiceover/narration.wav",
  "words": "assets/voiceover/narration.words.json",
  "captions": "assets/voiceover/narration.srt",
  "lines": [
    {
      "id": "l01-hook",
      "src": "assets/voiceover/l01-hook.wav",
      "text": "Your video already has a story. Now it has a voice.",
      "say": null,
      "frame": "1",
      "sceneStart": 0,
      "sceneDuration": 4.633,
      "start": 0.267,
      "duration": 3.867,
      "fileSeconds": 3.84,
      "speechStart": 0.09,
      "speechEnd": 3.56,
      "guideSeconds": 3,
      "voice": "explainers_ai_voices/oscar_bell",
      "engine": "expressive",
      "language": "English",
      "speed": 1,
      "instruct": null,
      "seed": null,
      "key": "<16 hex characters>"
    }
  ]
}
```

| Field | What it is |
| --- | --- |
| `sceneStart`, `sceneDuration` | `data-start` and `data-duration` for the frame or sub-composition of the line |
| `start`, `duration` | `data-start` and `data-duration` of the `<audio>` clip |
| `fileSeconds` | The length of the WAV file |
| `speechStart`, `speechEnd` | Where the voice starts and stops in the WAV file |
| `guideSeconds` | The `**Time:**` guide from SCRIPT.md |
| `totalSeconds` | The root `data-duration` |

## narration.wav, narration.words.json and narration.srt

`narration.wav` has all lines at composition time, with silence between them. It starts at composition time 0. With `--offset`, it starts with that much silence. Its length is `totalSeconds`. Use it for `npx hyperframes transcribe`. Do not put it in the composition with the line clips. If you do, the voice plays two times.

`narration.words.json` has the shape `[{ "id": "w0", "text": "Your", "start": 0.357, "end": 0.565 }]`, the same shape as a HyperFrames transcript. The text comes from the script, so names are always correct. The times are estimates. The script finds the pauses in each take and puts the phrase ends on them. Then it divides the time of a phrase by syllables.

`narration.srt` has cues with a maximum of two lines of 42 characters. A cue stops at a sentence end, and a full cue stops after a comma.
