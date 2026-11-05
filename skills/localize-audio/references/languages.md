# Languages for each engine

Use the language name as it is in this list (`--language Spanish`). An engine refuses a language that it does not speak. It does not send the text to a different engine.

## Fast

```text
English, German, Spanish, Italian, Portuguese.
```

Each language other than English is a different download. Tell the user before you download one:

```bash
"$VOIS" model download --model fast --language es
```

The codes are `en`, `de`, `es`, `it` and `pt`.

## Multilingual (23 languages)

```text
Arabic, Chinese, Danish, Dutch, English, Finnish, French, German, Greek, Hebrew, Hindi, Italian, Japanese, Korean, Malay, Norwegian, Polish, Portuguese, Russian, Spanish, Swahili, Swedish, Turkish.
```

It does not use `instruct`.

## Omni (30 languages, Pro)

```text
Arabic, Burmese, Chinese, Danish, Dutch, English, Finnish, French, German, Greek, Hebrew, Hindi, Indonesian, Italian, Japanese, Khmer, Korean, Lao, Malay, Norwegian, Polish, Portuguese, Russian, Spanish, Swahili, Swedish, Tagalog, Thai, Turkish, Vietnamese.
```

It uses `instruct` (direction in plain words).

## Sonic (31 languages, built-in voices only)

```text
Arabic, Bulgarian, Croatian, Czech, Danish, Dutch, English, Estonian, Finnish, French, German, Greek, Hindi, Hungarian, Indonesian, Italian, Japanese, Korean, Latvian, Lithuanian, Polish, Portuguese, Romanian, Russian, Slovak, Slovenian, Spanish, Swedish, Turkish, Ukrainian, Vietnamese.
```

Sonic speaks only its ten built-in voices: `sonic_cedar`, `sonic_harbor`, `sonic_slate`, `sonic_ridge`, `sonic_ember`, `sonic_coral`, `sonic_juniper`, `sonic_meadow`, `sonic_sage`, `sonic_willow`. It does not use `instruct`.

## Craft (10 languages, Pro)

```text
Chinese, English, French, German, Italian, Japanese, Korean, Portuguese, Russian, Spanish.
```

Craft speaks library voices, cloned voices and designed voices. It has no built-in voices. It uses `instruct`. A cloned voice keeps the accent of its recording in each language.

## The same voice in a different language

The library voices of Vois Studio keep the same speaker when you change the language with Multilingual or Omni. Keep the same voice ID for all languages of one project.

A language setting does not give native pronunciation of each dialect. Tell a speaker of the target language to listen to the first segments before you dub the full file.
