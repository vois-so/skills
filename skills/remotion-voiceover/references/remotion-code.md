# Remotion code for the voiceover manifest

These examples use Remotion 4.0.520. They read `src/voiceover.json` from the script.

## Audio import

`Audio` from `@remotion/media` is the current component. In `remotion`, `Audio` is a deprecated name for `Html5Audio`.

```bash
npx remotion add @remotion/media
```

If you cannot add a package, use `Html5Audio` from `remotion`. The props in these examples are the same.

```tsx
import { Html5Audio as Audio } from 'remotion';
```

## One component for each scene line

```tsx
// src/SceneVoice.tsx
import React from 'react';
import { Sequence, staticFile } from 'remotion';
import { Audio } from '@remotion/media';
import voiceover from './voiceover.json';

export type VoiceScene = (typeof voiceover.scenes)[number];

export const SceneVoice: React.FC<{ scene: VoiceScene; volume?: number }> = ({ scene, volume = 1 }) => (
  <Sequence from={scene.leadFrames} durationInFrames={scene.durationFrames} name={`VO ${scene.id}`} layout="none">
    <Audio src={staticFile(scene.file)} volume={volume} />
  </Sequence>
);
```

`layout="none"` keeps the audio `Sequence` out of the layout. The `Sequence` starts `leadFrames` after the scene starts.

## Scenes one after the other

```tsx
// src/Explainer.tsx
import React from 'react';
import { AbsoluteFill, Series } from 'remotion';
import { SceneVoice } from './SceneVoice';
import voiceover from './voiceover.json';
import { Intro, How } from './scenes';

const VISUALS: Record<string, React.FC> = { intro: Intro, how: How };

export const Explainer: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: 'white' }}>
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

In a scene component, `useCurrentFrame()` starts at 0 at the scene start. The voice starts at frame `scene.leadFrames`.

## The composition

```tsx
// src/Root.tsx
import React from 'react';
import { Composition } from 'remotion';
import { Explainer } from './Explainer';
import voiceover from './voiceover.json';

export const RemotionRoot: React.FC = () => (
  <Composition
    id="Explainer"
    component={Explainer}
    durationInFrames={voiceover.totalFrames}
    fps={voiceover.fps}
    width={1920}
    height={1080}
  />
);
```

Set `"resolveJsonModule": true` in `tsconfig.json` for the JSON import. Remotion Studio loads the manifest again when the script writes it.

## Without a JSON import: calculateMetadata

Use this when the manifest must stay in `public/`, for example when a different tool writes it. Start the script with `--manifest public/voiceover/voiceover.json`.

```tsx
import { CalculateMetadataFunction, Composition, staticFile } from 'remotion';

type Manifest = { fps: number; totalFrames: number; scenes: { id: string; file: string; leadFrames: number; durationFrames: number; sceneFrames: number }[] };
type Props = { manifest: Manifest | null };

const calculateMetadata: CalculateMetadataFunction<Props> = async ({ abortSignal }) => {
  const manifest: Manifest = await fetch(staticFile('voiceover/voiceover.json'), { signal: abortSignal }).then((r) => r.json());
  return { durationInFrames: manifest.totalFrames, fps: manifest.fps, props: { manifest } };
};

<Composition id="Explainer" component={Explainer} width={1920} height={1080} defaultProps={{ manifest: null }} calculateMetadata={calculateMetadata} />;
```

The component then reads `props.manifest.scenes`.

## Scene changes with an overlap

A scene change in `@remotion/transitions` (`TransitionSeries`) makes two scenes overlap. The composition becomes shorter than `totalFrames`. Keep the voice on its own layer with absolute frames. Then a scene change cannot move or cut a line:

```tsx
import { Sequence, staticFile } from 'remotion';
import { Audio } from '@remotion/media';

const OVERLAP = 15; // frames of each transition

export const VoiceTrack: React.FC = () => (
  <>
    {voiceover.scenes.map((scene, i) => (
      <Sequence key={scene.id} from={scene.startFrame - i * OVERLAP + scene.leadFrames} durationInFrames={scene.durationFrames} layout="none">
        <Audio src={staticFile(scene.file)} />
      </Sequence>
    ))}
  </>
);
```

Use `durationInFrames={voiceover.totalFrames - (voiceover.scenes.length - 1) * OVERLAP}` for the composition. Make `lead` and `tail` longer than half of the overlap. This prevents two lines at the same time.

## Music below the voice

Put the music on its own layer. Lower it while the voice speaks:

```tsx
import { interpolate, Sequence, staticFile } from 'remotion';
import { Audio } from '@remotion/media';

const spans = voiceover.scenes.map((s) => [s.startFrame + s.leadFrames, s.startFrame + s.leadFrames + s.durationFrames]);
const musicVolume = (f: number) => {
  const inVoice = spans.some(([a, b]) => f >= a - 8 && f <= b + 8);
  return inVoice ? 0.12 : 0.35;
};

<Audio src={staticFile('music/bed.mp3')} volume={(f) => musicVolume(f)} />;
```

For a smooth change, use `interpolate()` in the 8 frames at each end of a span.

## Captions

Each scene has `captions` in the `Caption` shape of `@remotion/captions`. The times are in milliseconds from the scene start, and they are estimates.

```tsx
import { createTikTokStyleCaptions } from '@remotion/captions';
import { useCurrentFrame, useVideoConfig } from 'remotion';

export const SceneCaptions: React.FC<{ scene: VoiceScene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { pages } = createTikTokStyleCaptions({ captions: scene.captions, combineTokensWithinMilliseconds: 800 });
  const ms = (frame / fps) * 1000;
  const page = pages.find((p) => ms >= p.startMs && ms < p.startMs + p.durationMs);
  return page ? <div style={{ position: 'absolute', bottom: 80, width: '100%', textAlign: 'center', fontSize: 48 }}>{page.text}</div> : null;
};
```

Put `<SceneCaptions scene={scene} />` in each `Series.Sequence`. Install the package with `npx remotion add @remotion/captions`.

## Check the render

```bash
npx remotion render Explainer out/explainer.mp4
ffprobe -v error -show_entries stream=codec_type:format=duration -of compact out/explainer.mp4
ffmpeg -i out/explainer.mp4 -af silencedetect=n=-40dB:d=0.3 -f null - 2>&1 | grep silence_
```

The length in `format` must be `totalSeconds`. The silence list shows the pauses between lines. Each pause must be near `tail + lead` of the two scenes.
