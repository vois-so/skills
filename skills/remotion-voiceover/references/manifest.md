# The script and the manifest

## Script flags

```text
node <skill>/scripts/voiceover.mjs --scenes scenes.json [flags]
  --project DIR      Remotion project root (default: current folder)
  --out DIR          WAV folder in public/ (default: public/voiceover)
  --manifest FILE    timing manifest (default: src/voiceover.json)
  --fps N            composition frame rate (default: 30)
  --voice ID         voice ID from: vois-cli voice list --source all --format json
  --engine ID        fast | expressive | multilingual | omni | sonic | craft (default: expressive)
  --language NAME    for example English (default: English)
  --speed N          0.5 to 2.0 (default: 1)
  --lead S           seconds of silence before each line (default: 0.25)
  --tail S           seconds of silence after each line (default: 0.5)
  --tries N          takes to try when a take looks wrong (default: 2)
  --only a,b         render only these scene ids
  --force            render again even when nothing changed
  --dry-run          show the plan, render nothing
  --use-credits      allow a run that uses export credits (Free plan)
  --cli PATH         path to vois-cli (or set VOIS_CLI)
```

The script uses a flag first. If there is no flag, it uses the same key at the top of `scenes.json`. If there is no key, it uses the default. The script also reads a plain array of scenes.

## Scene fields

| Field | Type | What it does |
| --- | --- | --- |
| `id` | text | The name of the WAV and the key in the manifest. Letters, digits, `-` and `_` |
| `text` | text | The narration and the caption text |
| `say` | text | The words for the voice, when they are different from `text` |
| `instruct` | text | A direction in plain words. Omni and Craft only |
| `voice`, `engine`, `language`, `speed` | | A value for this scene only |
| `seed` | number | A fixed seed. Change it to get a different take |
| `lead`, `tail` | seconds | The pause before and after the line in this scene |
| `minSeconds` | seconds | The minimum length of the scene |

## When the script renders a scene again

The script keeps a key for each scene in the manifest. The key comes from the spoken words, the voice, the engine, the language, the speed, the direction and the seed. The script renders a scene again when:

- the WAV file is not there,
- the key changed,
- you give `--force`. Add `--only` to select the scenes.

A change to `lead`, `tail`, `minSeconds` or `fps` changes only the timing. The script does not render again for it.

## Manifest fields

```json
{
  "generator": "vois-studio remotion-voiceover",
  "fps": 30,
  "totalFrames": 291,
  "totalSeconds": 9.7,
  "scenes": [
    {
      "id": "intro",
      "file": "voiceover/intro.wav",
      "text": "Every video needs a voice. This one took about a minute.",
      "say": null,
      "durationSeconds": 3.49,
      "durationFrames": 105,
      "speechStartSeconds": 0.1,
      "speechEndSeconds": 3.27,
      "leadFrames": 8,
      "sceneFrames": 128,
      "sceneSeconds": 4.267,
      "startFrame": 0,
      "startSeconds": 0,
      "voice": "explainers_ai_voices/clara_west",
      "engine": "expressive",
      "language": "English",
      "speed": 1,
      "instruct": null,
      "seed": null,
      "key": "438ad229981400d6",
      "captions": [{ "text": " Every", "startMs": 367, "endMs": 913, "timestampMs": null, "confidence": null }]
    }
  ]
}
```

| Field | What it is |
| --- | --- |
| `file` | The path from `public/`. Give it to `staticFile()` |
| `durationSeconds` | The length of the WAV file |
| `durationFrames` | `ceil(durationSeconds × fps)`. The audio `Sequence` length |
| `speechStartSeconds`, `speechEndSeconds` | Where the voice starts and stops in the file |
| `leadFrames` | Frames from the scene start to the audio start |
| `sceneFrames` | `leadFrames + durationFrames + tail frames`, or more for `minSeconds` |
| `startFrame` | Where the scene starts in the composition |
| `totalFrames` | The sum of all `sceneFrames`. The composition length |
| `captions` | Word times in milliseconds from the scene start, in the `Caption` shape of `@remotion/captions` |

The caption times are estimates. The script finds the pauses in each take and puts the phrase ends on them. In each phrase, it divides the time by syllables. For word-accurate captions, transcribe the WAV files with a transcriber.

## The output folder

```text
public/voiceover/intro.wav     24 kHz mono 16-bit WAV, one for each scene
public/voiceover/how.wav
src/voiceover.json             the manifest
```

Keep the WAV files in version control only if the project keeps other media there. The script can make them again from `scenes.json`, but a new take can be different if you do not set `seed`.
