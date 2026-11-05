---
name: remotion-voiceover
description: Adds a scene-timed voiceover to a Remotion video with Vois Studio, on the user's computer. It writes the narration of each scene for the ear and renders one WAV for each scene into public/voiceover/ with vois-cli. Then it measures each take and writes a timing manifest (seconds, and frames at the composition fps). The composition reads the manifest to set each scene length and to put each clip in a Sequence with Audio and staticFile. Use when the user asks to "add a voiceover to my Remotion video", "narrate these scenes", "time the scenes to the narration", "make TTS for Remotion", or "use Vois instead of ElevenLabs in Remotion". A Vois Studio plan with CLI file output is necessary, for example Pro. For directions in plain words, use Omni or Craft on Pro.
license: MIT
compatibility: Vois Studio on an Apple Silicon Mac or Windows, vois-cli, Node.js 18+, and a Remotion 4 project.
metadata:
  author: vois-so
  version: "0.1.0"
---

# Remotion voiceover with Vois Studio

This skill gives a Remotion composition a narration that Vois Studio makes on the user's computer.
The result is one WAV file for each scene and a manifest.
The manifest sets the length of each scene from the length of its line.
Thus, the picture and the voice stay aligned when you change a line.

## Before you start

- Vois Studio is open. If no window is necessary, start the headless service: `vois-cli service start`.
- A plan with CLI file output. Use the table below. Do not buy a plan for the user.
- Node.js 18 or higher, and a Remotion 4 project.

| Plan | What this skill can do |
| --- | --- |
| Pro | All steps, all engines, Omni and Craft directions, commercial use |
| Subscriber, AppSumo Lifetime Tier 2 or 3 | All steps with Fast, Expressive, Multilingual or Sonic. No Omni or Craft. Commercial use: Subscriber and Tier 3 only |
| Free with export credits | Each WAV file uses one credit. Non-commercial use only |
| Free without credits | Not possible. `vois-cli speak` plays audio but does not save a file |

The CLI path:

- macOS: `/Applications/Vois.app/Contents/MacOS/vois-cli`
- Windows: `%LOCALAPPDATA%\Vois\vois-cli.exe`

Use the full path in each command. Do not change PATH, and do not make an alias or a link.

Examine the app and the plan first:

```bash
VOIS="/Applications/Vois.app/Contents/MacOS/vois-cli"
"$VOIS" status --format json
```

Read `cli_access_enabled` and `next_action`. If `cli_access_enabled` is `false`, show `purchase_url` to the user and stop. The fallback link is https://vois.so/pricing.

## Inputs

Get a scene list from the user, or write it from their script. Each scene has:

- `id`: a short name with letters, digits, `-` or `_`. It is also the file name.
- `text`: the narration. The caption estimates use this text too.
- `say` (optional): the words for the voice, when they are different from `text`. For example, `text` "Vois" and `say` "Voyce".
- `instruct` (optional): a direction in plain words, for example "warm and unhurried". Only Omni and Craft act on it.
- `minSeconds` (optional): the minimum scene length, for a scene that has more visuals than words.

Save the list as `scenes.json` in the project root:

```json
{
  "fps": 30,
  "voice": "explainers_ai_voices/clara_west",
  "engine": "expressive",
  "language": "English",
  "lead": 0.25,
  "tail": 0.5,
  "scenes": [
    { "id": "intro", "text": "Every video needs a voice. This one took about a minute." },
    { "id": "how", "text": "Write the scenes, run one script, and drop the clips on the timeline." }
  ]
}
```

`fps` must be the frame rate of the composition. `lead` is the silence before the line in each scene. `tail` is the silence after it.

## Step 1: Write each line for the ear

The listener hears each word one time. Write for that listener.

- Use one idea in each sentence. Keep most sentences below 20 words.
- Write numbers, symbols and abbreviations as the voice must say them: "twenty percent", not "20%".
- Use commas and full stops for pauses. The voice stops at them.
- Do not put notes about tone in brackets. Only Expressive acts on its own tags, for example `[sigh]`.
- Plan about 2.5 words for each second. A 6-second scene holds about 15 words.
- Read each line aloud one time. If you must breathe in the line, divide it.

More rules and examples are in [rules for the ear](references/writing-for-the-ear.md).

## Step 2: Select a voice and an engine

Get the voices with their engines:

```bash
"$VOIS" voice list --source all --engine expressive --format json
```

Use the `id` value with no change. Select an engine from this table:

| Engine | Use it for | Plan |
| --- | --- | --- |
| `expressive` | English narration. This is the default of the script | Paid plans |
| `omni` | 30 languages, and a direction in plain words with `instruct` | Pro |
| `craft` | 10 languages, cloned and designed voices, `instruct` | Pro |
| `multilingual` | 23 languages | Paid plans |
| `fast` | Fast drafts in English | Paid plans |
| `sonic` | Built-in voices, for example `sonic_cedar`, 31 languages | Paid plans |

Good voices for explainers: `explainers_ai_voices/clara_west`, `explainers_ai_voices/oscar_bell`, `narrators_ai_voices/david_sterling`.
More voices and the language lists are in [voices and engines](references/voices-and-engines.md).

Use a cloned voice only with the consent of the person who owns that voice.

## Step 3: Render and measure

Start the script from the Remotion project root. Replace `<skill>` with the folder of this skill.

```bash
node <skill>/scripts/voiceover.mjs --scenes scenes.json --dry-run
node <skill>/scripts/voiceover.mjs --scenes scenes.json
```

The dry run shows the plan and renders nothing. The second command:

1. Checks that Vois Studio answers and that the plan can write files.
2. Renders each scene to `public/voiceover/<id>.wav` (24 kHz, mono).
3. Measures each take. If a take is silent or its pace is not usual, it renders one more take with a new seed.
4. Writes `src/voiceover.json`, the timing manifest.

It prints a table, for example:

```text
scene            audio s   frames   scene frames   starts at
intro               3.49      105            128           0
how                 4.64      140            163         128
total: 291 frames = 9.7 s at 30 fps
```

When you start the script again, it renders only the scenes that changed. Use `--only intro --force` to make a new take of one scene.

On export credits, the script stops before it renders. It shows the number of credits. Tell the user, and add `--use-credits` only after the user agrees.

All flags and fields are in [the manifest and the script](references/manifest.md).

## Step 4: Check the takes

You cannot hear the audio. Thus, do these steps:

- Read the table. A scene that is much longer than its words is a problem. The script shows a WARNING for it.
- Tell the user to listen to each file in `public/voiceover/`. Get their approval before the last render.
- If a transcriber (for example Whisper) is on the computer, transcribe each WAV. Compare the words with `text`.

To change a take, edit the line, or add `"seed": 7` to the scene, and start the script again.

## Step 5: Put the clips in the composition

In Remotion 4.0.520, `Audio` from `remotion` is a deprecated name for `Html5Audio`. Use `Audio` from `@remotion/media`:

```bash
npx remotion add @remotion/media
```

Add a component that plays the line of one scene:

```tsx
// src/SceneVoice.tsx
import React from 'react';
import { Sequence, staticFile } from 'remotion';
import { Audio } from '@remotion/media';
import voiceover from './voiceover.json';

export type VoiceScene = (typeof voiceover.scenes)[number];

export const SceneVoice: React.FC<{ scene: VoiceScene }> = ({ scene }) => (
  <Sequence from={scene.leadFrames} durationInFrames={scene.durationFrames} name={`VO ${scene.id}`} layout="none">
    <Audio src={staticFile(scene.file)} />
  </Sequence>
);
```

Set the scene lengths from the manifest. `Series` puts the scenes one after the other:

```tsx
// src/Explainer.tsx
import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import { SceneVoice } from './SceneVoice';
import voiceover from './voiceover.json';
import { Intro, How } from './scenes';

const VISUALS: Record<string, React.FC> = { intro: Intro, how: How };

export const Explainer: React.FC = () => (
  <AbsoluteFill>
    <Series>
      {voiceover.scenes.map((scene) => {
        const Visual = VISUALS[scene.id];
        return (
          <Series.Sequence key={scene.id} durationInFrames={scene.sceneFrames} name={scene.id}>
            {Visual ? <Visual /> : null}
            <SceneVoice scene={scene} />
          </Series.Sequence>
        );
      })}
    </Series>
  </AbsoluteFill>
);
```

Set the composition length and frame rate from the manifest in `src/Root.tsx`:

```tsx
<Composition
  id="Explainer"
  component={Explainer}
  durationInFrames={voiceover.totalFrames}
  fps={voiceover.fps}
  width={1920}
  height={1080}
/>
```

For a JSON import, set `"resolveJsonModule": true` in `tsconfig.json`.
For scene changes with effects, music below the voice, captions and a version without imports, read [Remotion code](references/remotion-code.md).

## Step 6: Preview and render

```bash
npx remotion studio
npx remotion render Explainer out/explainer.mp4
```

Make sure that the video has an audio stream and the correct length:

```bash
ffprobe -v error -show_entries stream=codec_type:format=duration -of compact out/explainer.mp4
```

The length must be `totalSeconds` from the manifest.

## When something fails

| Exit | Cause | What to do |
| --- | --- | --- |
| 2 | Vois Studio is not open | Open it, or start `vois-cli service start`. Then start the script again |
| 3 or 64 | Bad value, or the language is not clear | Examine the voice ID and speed. Set `"language": "English"` |
| 4 | The CLI cannot find a file or a voice | Get the voice ID again with `voice list` |
| 5 | The render did not complete | Make the line longer, remove symbols, or select a different voice |
| 7 | The plan does not include this | Omni and Craft are on Pro. Show `purchase_url` and stop |
| 8 | Quota | Show `purchase_url` and stop |
| 9 or 10 | Busy | The script tries again. If it stops, wait and start it again |
| 11 | Not sufficient memory | Close other apps, or use `expressive` or `fast` |
| 12 or 13 | Model download | Do `vois-cli model download --model <engine>`, or select a different engine |

Other problems:

- The audio starts at an incorrect time in a scene: change `lead` and start the script again. The script does not render again for a timing change.
- The scene stops before the voice: you set `durationInFrames` by hand. Use `sceneFrames` from the manifest.
- `staticFile` finds no file: the WAVs must be in `public/`. Keep `--out` in `public/`.
- The voice says a name incorrectly: put a respelled name in `say`. Keep the correct name in `text`.

## Rules

- Do not buy a plan or credits, and do not fill a checkout. Show `purchase_url` and wait for the user.
- Use a cloned voice only with the consent of its owner.
- For commercial use, a paid plan is necessary: Pro, Subscriber or AppSumo Lifetime Tier 3. Free is for non-commercial use.
- Do not claim a view count or an income from the video.
