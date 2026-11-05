# Script format

Vois Studio reads a script line by line. `make-episode.mjs` removes the section lines before it sends the script to Vois Studio.

## Line types

| Line | Purpose |
| --- | --- |
| `[Maya]: Welcome back.` | One spoken line for the speaker Maya |
| `[pause=800]` | A pause of 800 ms. Use 300 to 3000 ms. Put it on its own line |
| `## The fix` | A section for the show notes and `out/chapters.json`. Vois Studio does not speak it |

Rules:

- Use brackets. Vois Studio does not read `Maya: text` as a speaker line. It reads the full line as text.
- Put one speaker on each line. Then the section times stay correct.
- Use the same host names as `"hosts"` in `episode.json`, with the same capital letters.
- Do not use emotion tags, for example `[happy]`, `[sad]` or `[whisper]`. No engine reads them as direction. Put the emotion in the words.
- Only the Expressive engine makes the sounds for these tags: `[laugh]`, `[chuckle]`, `[sigh]`, `[gasp]`, `[groan]`, `[cough]`, `[clear throat]`, `[sniff]`, `[shush]`. Other engines remove them. Use them a small number of times.

## Write for the ear

- Use short sentences. One idea in each sentence.
- Let the hosts speak to each other: a question, an answer, a short reaction.
- Change the speaker after two to four sentences. A long turn is not easy to follow.
- Write numbers as the host must speak them: "twenty-five percent", not "25%".
- Respell names that the voice can speak incorrectly. Do a test of each name in an audition first.

## Intro template

Use the same intro in each episode. Listeners know the show from it.

```text
## Intro
[Maya]: This is Small Workshop, the show about simple repairs at home. I'm Maya.
[Theo]: And I'm Theo. Today: <the topic of the episode, in one sentence>.
[pause=700]
```

## Outro template

Use the same last line in each episode. Give one next step only.

```text
## Outro
[Maya]: So, today we <the summary in one sentence>.
[Theo]: <One next step: try it, send a question, or listen to the next episode.>
[Maya]: That's Small Workshop. See you next week.
```

## Example: a short episode

```text
## Intro
[Maya]: Welcome to Small Workshop, the show about simple repairs at home. I am Maya.
[Theo]: And I am Theo. Today we fix a squeaky door in five minutes.
[pause=700]
## The fix
[Maya]: First, lift the pin out of the hinge and wipe it clean with a cloth.
[Theo]: Then add one drop of oil, put the pin back, and swing the door ten times. That is all for today. See you next week.
```

## Music

Vois Studio does not add music to the episode in this skill. If the user gives an intro or outro music file, `make-episode.mjs` puts it before and after the voices. The user must have the rights to the music.
