# Engine import

The `out` folder has one WAV for each line ID and a manifest. The audio is 24 kHz mono 16-bit PCM. Unity, Unreal Engine and Godot import this format with no conversion.

The game must find a line by its ID. It must not make a file name from the spoken text.

## manifest.json

```json
{
  "version": 1,
  "audio": { "container": "wav", "codec": "pcm_s16le", "sample_rate": 24000, "channels": 1 },
  "lines": [
    {
      "id": "guard_alert_01",
      "character": "guard",
      "type": "bark",
      "text": "Halt! Who goes there?",
      "file": "guard_alert_01.wav",
      "duration_ms": 2290,
      "engine_used": "expressive",
      "voice": "npcs_ai_voices/town_crier_herald",
      "language": "English",
      "sha256": "..."
    }
  ]
}
```

`manifest.csv` has the same lines. Its first column is `Name` (the line ID).

## Unity

Copy the WAV files to `Assets/Resources/VO/`. Copy `manifest.json` to `Assets/Resources/VO/manifest.json`.

```csharp
using UnityEngine;

[System.Serializable] public class VoLine { public string id; public string character; public string file; public int duration_ms; }
[System.Serializable] public class VoManifest { public VoLine[] lines; }

public static class VoiceLines {
    public static AudioClip Get(string id) => Resources.Load<AudioClip>("VO/" + id);

    public static VoManifest Manifest() =>
        JsonUtility.FromJson<VoManifest>(Resources.Load<TextAsset>("VO/manifest").text);
}

// Usage: audioSource.PlayOneShot(VoiceLines.Get("guard_alert_01"));
```

## Unreal Engine

1. Import the WAV files into a content folder, for example `/Game/VO/`. Each Sound Wave asset gets the line ID as its name.
2. Make a row structure with the fields `Character`, `Type`, `File`, `DurationMs`, `Engine`, `Voice`, `Language` and `Text`.
3. Import `manifest.csv` as a Data Table with that structure. The `Name` column becomes the row name, so the row name is the line ID.
4. To play a line, get the row by its ID, then load `/Game/VO/<ID>`.

## Godot 4

Copy the `out` folder to `res://vo/`.

```gdscript
var manifest = JSON.parse_string(FileAccess.get_file_as_string("res://vo/manifest.json"))

func play_line(player: AudioStreamPlayer, id: String) -> void:
    player.stream = load("res://vo/%s.wav" % id)
    player.play()
```

## Loudness in the game

Vois Studio voices come out at almost the same level. Set the level of each line type (barks, dialogue, system) in the audio mixer of the game. Do not change the files.

## When the text changes

Keep the ID, change the text in the spreadsheet, and start `render-barks.mjs` again. The script generates only the changed rows and writes a new `sha256` for them. Copy the new files and the new manifest into the game.
