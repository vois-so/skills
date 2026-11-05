# Composition example

This example is the composition that the skill test rendered. It has two scenes and two voice clips. The times come from `assets/voiceover/voiceover.json`.

## index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=1920, height=1080" />
    <title>Voiceover</title>
    <script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
    <style>
      body { margin: 0; background: #0b0f14; color: white; font-family: Inter, system-ui, sans-serif; }
      #root { position: relative; width: 100%; height: 100%; overflow: hidden; }
      .clip { position: absolute; inset: 0; display: grid; place-items: center; }
    </style>
  </head>
  <body>
    <!-- root data-duration = totalSeconds -->
    <div id="root" data-composition-id="main" data-start="0" data-width="1920" data-height="1080" data-duration="10.6">

      <!-- frames: data-start = sceneStart, data-duration = sceneDuration -->
      <div id="scene-hook" data-composition-id="hook" data-composition-src="compositions/hook.html"
           data-start="0" data-duration="4.633" data-track-index="0" data-width="1920" data-height="1080"></div>
      <div id="scene-how" data-composition-id="how" data-composition-src="compositions/how.html"
           data-start="4.633" data-duration="5.967" data-track-index="0" data-width="1920" data-height="1080"></div>

      <!-- voice: pasted from assets/voiceover/voiceover.html -->
      <audio id="vo-l01-hook" src="assets/voiceover/l01-hook.wav" data-start="0.267" data-duration="3.867"
             data-track-index="3" data-volume="1" data-audio-group="voiceover"></audio>
      <audio id="vo-l02-how-it-works" src="assets/voiceover/l02-how-it-works.wav" data-start="4.9" data-duration="5.2"
             data-track-index="3" data-volume="1" data-audio-group="voiceover"></audio>
    </div>
    <script>
      const tl = gsap.timeline({ paused: true });
      window.__timelines["main"] = tl;
    </script>
  </body>
</html>
```

`npx hyperframes timeline` for this project shows:

```text
audio (2)
  | ███████████████                        | #vo-l01-hook 0.267-4.134s src=assets/voiceover/l01-hook.wav vol=1 group=voiceover
  |                  █████████████████████ | #vo-l02-how-it-works 4.9-10.1s src=assets/voiceover/l02-how-it-works.wav vol=1 group=voiceover
```

## Rules for the voice clips

- Give each `<audio>` an `id`. The mixer ignores a clip with no `id`, and the render has no voice.
- Keep the voice clips at the root, with composition times from the manifest. Then a change to a scene file cannot move the voice.
- If you put a clip in a sub-composition, its `data-start` is local to that scene. Use `start - sceneStart` from the manifest.
- Do not put `crossorigin` on an `<audio>`. `lint` refuses it.
- Do not use `play()` or `pause()` in composition code. HyperFrames controls playback.
- Do not put a `volume` tween and a `data-automation` volume lane on the same clip. Use one of them.

## After you change a line

1. Edit `SCRIPT.md`.
2. Start the script again. It renders only the changed line.
3. Copy the new `data-start` and `data-duration` values from the table, or from `voiceover.html` and `voiceover.json`.
4. Update the scene frames and the root `data-duration` from the manifest.
5. Do `npx hyperframes check`.

A change in one line moves all scenes after it. Update all `data-start` values after that line.

## Narration that starts after an intro

If the first scene starts at 2 seconds (for example after a logo), start the script with `--offset 2`. All `start` and `sceneStart` values then include the 2 seconds. `narration.wav` starts with 2 seconds of silence, so its transcript times are composition times.

## Captions from the transcript

`npx hyperframes transcribe assets/voiceover/narration.wav --model small.en` writes `assets/voiceover/transcript.json`. Its times are composition times, because `narration.wav` starts at composition time 0. Correct the names to the script text. Then make the caption layer from the transcript, as the HyperFrames caption guide tells you.

To make a sidecar file:

```bash
npx hyperframes transcribe assets/voiceover/transcript.json --to srt --output captions.srt
```

`assets/voiceover/narration.srt` from the script is an approximate sidecar file. You can use it with no change.
