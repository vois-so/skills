# Recording guide for the voice sample

Vois Studio makes the clone from one short voice sample and its accurate transcript. The clone cannot be better than this sample. Give these instructions to the voice owner.

## The room

- Use a small room with soft surfaces: curtains, a carpet, a sofa, clothes in a closet.
- Close the windows. Stop fans, air conditioners and other machines.
- Put the phone in silent mode.
- Do not record in a kitchen, a bathroom or an empty room. Hard walls give echo.

## The microphone

- A USB microphone or a headset microphone is sufficient. A phone is sufficient in a quiet room.
- Put the microphone 15 to 20 cm from the mouth, and move it to the side by a small distance. This stops the hard sounds of "p" and "b".
- Set the input level. Loud words must show peaks near -6 dBFS. Peaks must stay below -1 dBFS.
- Record WAV at 44.1 kHz or 48 kHz, 16-bit or 24-bit, if the app lets you select. The clone command also accepts MP3, FLAC, M4A and OGG.

## The spoken words

- Record 10 to 15 seconds of spoken words. The clone command accepts 5 to 60 seconds.
- Speak in the language, accent, speed and style that the clone must have. A calm narrator sample gives a calm narrator clone.
- Read two or three full sentences that sound natural. Do not read a list of words.
- Use only one voice. No music, no effects, no other person.
- Start to speak about 0.5 seconds after the recording starts. Stop the recording about 0.5 seconds after the last word.
- Record three takes. Select the take with the most clean sound.

## The transcript

- Write each word that the owner speaks, in the sequence of the recording.
- Include the small words and the words that the owner speaks two times ("um", "the the").
- Do not add words that are not in the recording.
- `vois-cli voice clone` refuses a transcript that does not agree with the length of the recording.

Example text for an English sample (the owner can use a different text):

```text
The morning was quiet, so I took the long road to the harbor. The boats were still there, and the water was calm and gray. I like this time of day, before the town wakes up.
```

## Measure the sample

```bash
node scripts/check-reference.mjs sample.wav --transcript "The accurate words."
```

| Item | PASS | WARN | FAIL |
| --- | --- | --- | --- |
| Length | 10 to 15 s | 5 to 10 s, or 15 to 60 s | less than 5 s, or more than 60 s |
| Peak | below -1 dBFS | -1 to -0.1 dBFS | -0.1 dBFS or higher (the sound is cut) |
| Voice level (RMS) | -35 dBFS or higher | below -35 dBFS | |
| Noise floor (quietest 0.5 s) | -50 dBFS or lower | -50 to -40 dBFS | above -40 dBFS |
| Length of the silence at the start and at the end | 1 s or less | more than 1 s | |
| Words for each second | 1.5 to 5 | other values | |

Record again after a FAIL. After a WARN, record again if possible.

## Keep the sample safe

The voice sample is personal data of the owner. Keep it in the consent folder, not in a public repository. `vois-cli voice clone-delete` removes the copy in Vois Studio. If the owner withdraws consent and tells you to, remove your own copies also.
