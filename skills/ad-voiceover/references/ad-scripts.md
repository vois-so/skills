# Ad scripts

## Word budget

| Slot | Usual pace (2.5 words a second) | Energetic read | Calm read |
| --- | --- | --- | --- |
| 15 s | 30 to 38 words | 36 to 45 words | 28 to 34 words |
| 30 s | 62 to 75 words | 75 to 90 words | 58 to 68 words |
| 60 s | 130 to 150 words | 150 to 175 words | 120 to 135 words |

Each direction has its own pace. The first render tells you the measured pace. The script then gives the number of words to add or cut.

## Structure

### 15 seconds

```text
Hook (1 sentence)           Fresh bread, every single morning.
Benefit and brand           Northside Bakery bakes it at five, so it is still warm when you arrive.
CTA                         Two streets from your door. Northside Bakery.
```

### 30 seconds

```text
Hook                        You know that smell when you walk past a bakery?
Problem                     Most bread in the store was baked days ago, far away.
Brand and product           At Northside Bakery, we bake every loaf at five in the morning, right here.
Benefit                     Real sourdough, warm rolls, and cakes for the weekend.
CTA                         Find us two streets from your door, or order at northside bakery dot com.
Brand again                 Northside Bakery. Bread the way it should be.
```

### 60 seconds

- A strong first line: one sentence.
- A short story or a problem: two or three sentences.
- The brand and what it sells.
- Three benefits, one sentence each.
- The offer, if there is one, with its end date.
- The CTA (the step that the listener must do next). Then the brand and the CTA again.
- The legal text, if necessary.

## Rules for ad copy

- Say the brand in the first 5 seconds and in the last sentence.
- Give one message. An ad with three messages gives none.
- Write as the voice must say it: "fifty percent", "northside bakery dot com", "five five five, zero one nine nine".
- Put a pause before the CTA: put a full stop, then write a short sentence.
- Read the legal text at the same pace as the remaining text. The script measures the full read.
- Do not write "the best", "number one", "guaranteed" or a price or a result that the user did not give you.
- Do not use the name or the voice of a known person without their permission.

## Directions for the same script

The same words can be very different in each direction. Keep the words the same for the three directions when you can. Then the user compares only the voice. When one direction is much faster or slower, give it its own words in `byDirection`.

| Direction | Good for | Usual change in pace |
| --- | --- | --- |
| Warm | Local shops, food, family, health | About the usual pace |
| Energetic | Sales, concerts, apps, sports | About 10 to 25 percent faster |
| Calm | Finance, health, luxury goods | About the usual pace, or slower |
| Confident | Business services, tools | About the usual pace |
| Playful | Snacks, games, young viewers | Faster, with more pitch change |

## Files for the ad

The `fit` file of each read has:

- 0.05 s of silence, then the voice.
- No sound after the voice, until the full slot length.
- 24 kHz, mono, 16-bit WAV.

A station or a platform can tell you to use a different format. Export the selected file with `vois-cli export audio --input <file> --output <file>.mp3 --audio-format mp3 --bitrate 192`, or with an export profile (`vois-cli export profiles`). An export must be 5 seconds or longer.
