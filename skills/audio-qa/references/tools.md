# Tools

The QA script uses tools on the computer of the user. It does not send audio to a server. Get the approval of the user before you install a tool. The transcript models are large downloads.

## Find the tools

macOS:

```bash
which node ffmpeg whisper whisper-cli whisper-cpp
```

Windows, in PowerShell or cmd:

```bat
where node ffmpeg whisper whisper-cli
```

The script finds the tools itself. It uses `whisper` first, then `whisper-cli` (or `whisper-cpp`). Use `--asr whisper`, `--asr whisper-cli` or `--asr none` to select one.

## Node.js

The script must have Node.js 18 or a newer version. It has no npm packages.

| System | Install |
|---|---|
| macOS | `brew install node`, or the installer from nodejs.org |
| Windows | `winget install OpenJS.NodeJS.LTS`, or the installer from nodejs.org |

## ffmpeg

ffmpeg measures the loudness and writes the normalized files. whisper also uses it.

| System | Install |
|---|---|
| macOS | `brew install ffmpeg` |
| Windows | `winget install Gyan.FFmpeg` |

## A transcript tool

Install one of these two tools.

### whisper.cpp (`whisper-cli`)

A fast tool without Python. It must have a model file.

macOS:

```bash
brew install whisper-cpp
mkdir -p ~/.cache/whisper
```

Windows: download a release of whisper.cpp from its GitHub page.

Then download one model file from the whisper.cpp model page, https://huggingface.co/ggerganov/whisper.cpp. Put it in `~/.cache/whisper`. Use the file with a name that ends in `base.en.bin` for English. For other languages, use a file with a name that ends in `base.bin` or `small.bin`.

The script finds a model file in `~/.cache/whisper` that has `base`, `small` or `tiny` in its name. For a different path, give `--whisper-cpp-model <path>` or set `WHISPER_CPP_MODEL`.

### OpenAI Whisper (`whisper`)

A Python tool. It downloads its model on the first use.

```bash
pipx install openai-whisper
```

If pipx is not installed, use `python3 -m pip install --user openai-whisper`. On Windows, use `py -m pip install openai-whisper`.

The script uses the `base.en` model for English and `base` for other languages. Give `--asr-model small` for a more accurate transcript. A larger model is slower.

## Language codes

The script changes the language name in the manifest into a code for the transcript tool, for example English into `en`. It knows the languages of all Vois Studio engines. You can also write the code, for example `"language": "de"`.

## Without a transcript tool

Without a transcript tool, the script examines these items:

- The length of each file against the estimate for the text.
- Near silence, and silent audio at the start and the end.
- Long pauses in the voice.
- Samples at full scale.
- Loudness, if ffmpeg is on the computer.

It cannot find an incorrect word, or a missing word in a file of the correct length. Tell the user to listen to each file.
