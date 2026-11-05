# Captions and edit

## The frame

- Use a 1080 x 1920 timeline (9:16).
- Put `short.wav` (or the mastered copy) on an audio track at 0.
- Keep the text in the center area. The bottom 20 percent and the right edge have the platform buttons, the name and the description.
- Change the picture at each line start (`start` in `report.json`), or more frequently. A static picture for more than about 3 seconds is slow for a Short.
- If you add music, keep it 15 to 20 dB below the voice. The voice must be clear on a phone speaker.

## short.srt

The cues have 1 to 3 words and stop at each comma and full stop. Change the number of words with `--caption-words N`. Import the SRT, then set a large font in the center.

| Editor | Import |
| --- | --- |
| CapCut (desktop) | Captions panel, import of local captions. Or use the automatic captions of CapCut on `short.wav`, and correct the names |
| Premiere Pro | `File > Import`, then put the captions on the timeline at 0 |
| DaVinci Resolve | `File > Import > Subtitle`. Put it at the timeline start |
| Final Cut Pro | `File > Import > Captions` |

Menu names can be different in your version of the editor.

## short.words.json

```json
[
  { "id": "w0", "text": "Your", "start": 0.04, "end": 0.26 },
  { "id": "w1", "text": "phone", "start": 0.26, "end": 0.48 }
]
```

The times are in seconds from the start of `short.wav`. Use them for captions that show one word at a time, or that change the color of the current word.

The times are estimates. The script finds the pauses in each take and puts the phrase ends on them. In each phrase, it divides the time by syllables. Each phrase starts at its measured time. In a phrase, a word can be about 0.1 to 0.2 s before or after its time. For word-accurate times, transcribe `short.wav` with a transcriber (for example Whisper), and keep the script text for the words.

### Remotion

Make the `Caption` shape of `@remotion/captions` from the words:

```ts
import words from './short.words.json';
const captions = words.map((w) => ({ text: ` ${w.text}`, startMs: w.start * 1000, endMs: w.end * 1000, timestampMs: null, confidence: null }));
```

### HyperFrames

`short.words.json` has the shape of a HyperFrames transcript. Copy it to the project, or import it with `npx hyperframes transcribe short.words.json`.

## Check the edit

- The hook is on screen and in the voice in the first 2 seconds.
- Each caption shows while its words play.
- The video length is the length in `report.json`, plus the end card if there is one.
- The audio is at about -14 LUFS. Use `--master youtube_video`, or set the export loudness in the editor.
