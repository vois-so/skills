# Loudness

Loudness in LUFS is the level that a listener hears, measured for all of the file. The true peak in dBTP is the highest level of the signal between the samples. A platform makes a file louder or quieter to its own target. If the file is at the target, the platform does not change it.

## Targets

| Platform | Integrated loudness | Limit for the true peak | Remarks |
|---|---|---|---|
| Podcast, stereo | -16 LUFS | -1 dBTP | The usual target for podcast apps. |
| Podcast, mono | -19 LUFS | -1 dBTP | A mono file at -19 LUFS sounds as loud as a stereo file at -16 LUFS. |
| Audiobook (ACX) | about -20 LUFS | -3 dB peak | ACX measures RMS from -23 to -18 dB, and a noise floor of -60 dB or less. |
| Radio and TV (EBU R 128) | -23 LUFS | -1 dBTP | |
| Video platforms | -14 LUFS | -1 dBTP | Many video platforms make louder files quieter to about this level. |

Voice audio from Vois Studio is mono at 24 kHz.

## Measure a file

```bash
ffmpeg -hide_banner -nostats -i final.wav -af loudnorm=I=-16:TP=-1:LRA=11:print_format=json -f null -
```

Read `input_i` (LUFS) and `input_tp` (dBTP) in the output.

## Normalize a file in two passes

The first pass measures. The second pass applies the measured values. Two passes give a linear change of level when it is possible. A linear change does not change the dynamics of the voice.

```bash
# Pass 1: measure. Write down input_i, input_tp, input_lra, input_thresh and target_offset.
ffmpeg -hide_banner -nostats -i final.wav \
  -af loudnorm=I=-19:TP=-1:LRA=11:print_format=json -f null -

# Pass 2: apply. Put the values from pass 1 in place of the numbers here.
ffmpeg -hide_banner -y -i final.wav \
  -af loudnorm=I=-19:TP=-1:LRA=11:measured_I=-23.2:measured_TP=-8.2:measured_LRA=2.1:measured_thresh=-33.5:offset=0.3:linear=true:print_format=json \
  -ar 24000 -ac 1 -c:a pcm_s16le final-normalized.wav
```

The QA script does these two passes for each file with `--normalize-dir`.

- `-ar 24000` keeps the sample rate. The filter changes the sample rate. Thus give the output rate.
- `-ac 1` keeps a mono file mono. Use `-ac 2` only if the platform must have stereo.
- `normalization_type` in the pass 2 output is `linear` or `dynamic`. `dynamic` means that one change of level could not make the target and the true peak limit correct at the same time. Listen to the file. If it is not good, use a lower target or a lower ceiling.

## Join lines, then normalize

Normalize the full file, not only each line:

```bash
printf "file '%s'\n" intro.wav numbers.wav close.wav > list.txt
ffmpeg -hide_banner -y -f concat -safe 0 -i list.txt -c copy joined.wav
node scripts/audio-qa.mjs joined.wav --target-lufs -19 --normalize-dir normalized
```

All files in a `concat` list must have the same sample rate and the same channels. Files from Vois Studio have the same format.

Normalize each line only when each line is an isolated file for the user, for example lines for a game.

## Export with Vois Studio

Vois Studio can export and normalize in one step. It uses its own mastering. The export must have 5 s of audio or more.

```bash
vois-cli export audio --input joined.wav --output final.mp3 --audio-format mp3 --normalize --target-lufs -19
```

An export profile has its own loudness that does not change: `apple_podcasts` and `spotify_podcasts` -16, `acx_audiobook` -17 (-20 before Vois Studio 2.6.3), `youtube_video` -14, `generic_hq` -19 LUFS.

```bash
vois-cli export with-profile --input joined.wav --output final.m4a --profile apple_podcasts
```

On the Free plan, each export uses one export credit.
