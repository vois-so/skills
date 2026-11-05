# Vois Studio skills

Skills that tell an AI agent how to do one audio task with Vois Studio, from the start to the end. Each skill gives the agent the steps, the correct vois-cli commands, the checks and the files to supply.

The skills operate with Claude Code, Codex, Cursor, Gemini CLI and other agents that read Agent Skills.

Vois Studio is closed source. These skills are open source with the MIT license.

## Skills

| Skill | Task |
| --- | --- |
| [vois-cli](skills/vois-cli/SKILL.md) | Use Vois Studio from an agent: status, plans, engines, voices, audio files and errors. |
| [remotion-voiceover](skills/remotion-voiceover/SKILL.md) | Give a voice to a Remotion video, with the time of each scene. |
| [hyperframes-voiceover](skills/hyperframes-voiceover/SKILL.md) | Give a voice to a HyperFrames video, with the time of each scene. |
| [explainer-voiceover](skills/explainer-voiceover/SKILL.md) | Make narration for each scene of a video, for all video editors, with captions. |
| [faceless-short](skills/faceless-short/SKILL.md) | Make the hook, the script, the voice and the captions for a vertical short video. |
| [ad-voiceover](skills/ad-voiceover/SKILL.md) | Make 15, 30 and 60-second ad reads, each in three directions. |
| [write-for-voice](skills/write-for-voice/SKILL.md) | Change a text into a script that is easy for a voice to speak. |
| [direct-a-voice](skills/direct-a-voice/SKILL.md) | Give plain-words directions to Omni and Craft, line by line. |
| [cast-voices](skills/cast-voices/SKILL.md) | Select library voices for each role in a project, and tell why. |
| [fix-pronunciation](skills/fix-pronunciation/SKILL.md) | Find names and terms that are not easy to speak, and add dictionary entries. |
| [audio-qa](skills/audio-qa/SKILL.md) | Examine the audio before you supply it: transcript, retakes, silence and loudness. |
| [audiobook-chapters](skills/audiobook-chapters/SKILL.md) | Change a manuscript into chapter MP3 files, an M4B file and a retail sample. |
| [podcast-episode](skills/podcast-episode/SKILL.md) | Make an episode with two hosts, an intro, an outro, show notes and an RSS item. |
| [game-barks](skills/game-barks/SKILL.md) | Make a WAV file for each NPC line in a spreadsheet. |
| [localize-audio](skills/localize-audio/SKILL.md) | Make dubbed tracks that fit the timing of the initial audio. |
| [clone-with-consent](skills/clone-with-consent/SKILL.md) | Get and keep the consent of the voice owner, then clone the voice. |

## Install

### Claude Code

```text
/plugin marketplace add vois-so/skills
/plugin install vois-skills@vois
```

The same marketplace also has [agent-voice](https://github.com/vois-so/agent-voice): `/plugin install agent-voice@vois`.

### Codex, Cursor, Gemini CLI and other agents

```sh
npx skills add vois-so/skills
```

To install one skill, add `--skill` and the name, for example `npx skills add vois-so/skills --skill remotion-voiceover`.

### By hand

Copy a folder from `skills/` into the skills folder of your agent, for example `~/.claude/skills/` or `.agents/skills/`.

## Before you start

- [Vois Studio](https://vois.so/download?utm_source=github&utm_medium=skills&utm_campaign=oss) on an Apple Silicon Mac or on Windows. Vois Studio must be open, or its service must be on (`vois-cli service start`).
- Each skill tells you the plan that is necessary. Audio files from vois-cli are on the paid plans, and on the Free plan with export credits. The Omni and Craft engines and Voice Design are on the Pro plan. The Free plan is for non-commercial use.
- Some skills also use ffmpeg or Node.js 18 or a newer version. The skill tells you.

An agent does not buy a plan or credits for you. When a plan is necessary, the agent shows you the link, and you make the decision.

## Problems and ideas

Open an [issue](https://github.com/vois-so/skills/issues). For a problem in Vois Studio, use [vois-so/vois-studio](https://github.com/vois-so/vois-studio/issues).

## License

MIT. See [LICENSE](LICENSE).
