# Editor import

The narration track and the captions start at time 0 of the narration. Put the two at the start of the timeline. Menu names can be different in your version of the editor. If a menu is not there, use the search of the editor.

## Premiere Pro

1. `File > Import`. Select `narration.wav` and `narration.srt`.
2. Put `narration.wav` on the A1 audio track at 00:00:00:00.
3. Put `narration.srt` on the timeline at 00:00:00:00. Premiere makes a caption track.
4. For each row of `timing.csv`, put a marker at `start` (press M at that time). Cut the video at the markers.

## DaVinci Resolve

1. Import `narration.wav` into the Media Pool.
2. A Resolve timeline starts at 01:00:00:00. Put `narration.wav` at the timeline start.
3. `File > Import > Subtitle`, and select `narration.srt`. Put it on the timeline at the timeline start.
4. If the captions do not align with the voice, set the start timecode of the timeline to 00:00:00:00. Then import the subtitles again.
5. Put markers at the `start` times of `timing.csv`. Add 01:00:00:00 if the timeline starts there.

## Final Cut Pro

1. `File > Import > Media`, and select `narration.wav`. Put it at the start of the project, below the primary storyline.
2. `File > Import > Captions`, and select `narration.srt`.
3. If your version does not import SRT, transcribe the narration in Final Cut Pro. Or change the SRT to iTT with a caption tool.

## CapCut (desktop)

1. Import `narration.wav`. Put it on an audio track at 0.
2. In the Captions panel, select the import of local captions and select `narration.srt`.
3. If your version has no caption import, use its automatic captions on `narration.wav`. Then correct the names to the script text.

## Scene by scene

To move a scene without the others, use the takes in `scenes/`:

1. Import all WAV files in `scenes/`.
2. Put each take at `start + lead` of its row in `timing.csv` (the default `lead` is 0.3 s). The `voice_start` column shows where the voice starts.
3. Do not use `narration.wav` at the same time, or the voice plays two times.

## Music below the voice

Put the music on its own track. Lower it by about 12 to 18 dB while the voice speaks. Use the `voice_start` and `voice_end` columns of `timing.csv` to put the volume keyframes. Most editors can also lower music automatically when a voice plays, for example the **Auto Ducking** function of Premiere Pro and Resolve.

## Check the edit

- The voice of each scene starts with its picture.
- The captions change when the voice changes sentence.
- The project export has the narration at the platform loudness. For YouTube, use `--master youtube_video`, or set the export loudness in the editor to -14 LUFS.
