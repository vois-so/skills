# Casting guide

This guide helps you find voices for a role in the Vois Studio voice list.
The categories and the descriptions come from `voice list --source all --format json`.
The voice list of the user can be different. Always make the short list from the live list.

## Categories and words for each type of project

Give a part of the category slug to `--category`. Give the words to `--match`.

| Type of project | `--category` | Words for `--match` |
|---|---|---|
| Podcast, talk show | `podcast`, `host`, `broadcaster` | `host interviewer warm friendly energetic calm conversational` |
| Audiobook, story | `audiobook`, `narrator`, `storyteller` | `narrator warm deep calm clear gentle` |
| Explainer, course | `explainer`, `educator`, `corporate` | `clear friendly teacher professional calm` |
| Ad, promotion | `announcer`, `energetic`, `confident` | `bright upbeat confident energetic` |
| Game, animation | `villain`, `hero`, `npc`, `creature`, `character` | Words for the character, for example `brave sly old small` |
| App, assistant | `assistant`, `machine`, `interactive` | `helpful clear friendly calm` |
| Age of the character | `elderly`, `youth` | The age words of the role |

If the category gives less than three voices, remove `--category` and use only `--match`.

## Contrast between roles

Roles that speak in the same scene must have voices that are clearly different.

| Pair | A good contrast |
|---|---|
| Two podcast hosts | A different gender, or one "calm" voice and one "energetic" voice |
| Narrator and character | The narrator is calm and clear. The character has the energy of the scene. |
| Hero and villain | Different words in the description, for example "warm" and "dark", or "bright" and "deep" |
| Many game characters | Use different categories, and a different gender or age for each one |

Do not use the same voice for two roles.
Do not select two voices with the same first words in the description for roles that speak to each other.

## Languages of each engine

| Language | Fast | Expressive | Multilingual | Omni | Sonic | Craft |
|---|---|---|---|---|---|---|
| Arabic |  |  | Yes | Yes | Yes |  |
| Bulgarian |  |  |  |  | Yes |  |
| Burmese |  |  |  | Yes |  |  |
| Chinese |  |  | Yes | Yes |  | Yes |
| Croatian |  |  |  |  | Yes |  |
| Czech |  |  |  |  | Yes |  |
| Danish |  |  | Yes | Yes | Yes |  |
| Dutch |  |  | Yes | Yes | Yes |  |
| English | Yes | Yes | Yes | Yes | Yes | Yes |
| Estonian |  |  |  |  | Yes |  |
| Finnish |  |  | Yes | Yes | Yes |  |
| French |  |  | Yes | Yes | Yes | Yes |
| German | Download |  | Yes | Yes | Yes | Yes |
| Greek |  |  | Yes | Yes | Yes |  |
| Hebrew |  |  | Yes | Yes |  |  |
| Hindi |  |  | Yes | Yes | Yes |  |
| Hungarian |  |  |  |  | Yes |  |
| Indonesian |  |  |  | Yes | Yes |  |
| Italian | Download |  | Yes | Yes | Yes | Yes |
| Japanese |  |  | Yes | Yes | Yes | Yes |
| Khmer |  |  |  | Yes |  |  |
| Korean |  |  | Yes | Yes | Yes | Yes |
| Lao |  |  |  | Yes |  |  |
| Latvian |  |  |  |  | Yes |  |
| Lithuanian |  |  |  |  | Yes |  |
| Malay |  |  | Yes | Yes |  |  |
| Norwegian |  |  | Yes | Yes |  |  |
| Polish |  |  | Yes | Yes | Yes |  |
| Portuguese | Download |  | Yes | Yes | Yes | Yes |
| Romanian |  |  |  |  | Yes |  |
| Russian |  |  | Yes | Yes | Yes | Yes |
| Slovak |  |  |  |  | Yes |  |
| Slovenian |  |  |  |  | Yes |  |
| Spanish | Download |  | Yes | Yes | Yes | Yes |
| Swahili |  |  | Yes | Yes |  |  |
| Swedish |  |  | Yes | Yes | Yes |  |
| Tagalog |  |  |  | Yes |  |  |
| Thai |  |  |  | Yes |  |  |
| Turkish |  |  | Yes | Yes | Yes |  |
| Ukrainian |  |  |  |  | Yes |  |
| Vietnamese |  |  |  | Yes | Yes |  |

"Download" means that Fast speaks the language after `vois-cli model download --model fast --language <code>`. Get approval before a download.
Give the language name to `--language`, for example `--language Spanish`.
For a library voice, `available_languages` gives the language codes that Vois Studio has for that voice.
A cloned voice keeps the accent of its recording in a different language.

## The ten Sonic voices

Sonic voices have no description. Use the gender, then listen.

| Male | Female |
|---|---|
| `sonic_cedar` (default) | `sonic_coral` |
| `sonic_harbor` | `sonic_juniper` |
| `sonic_slate` | `sonic_meadow` |
| `sonic_ridge` | `sonic_sage` |
| `sonic_ember` | `sonic_willow` |

On Free with no credits, give one `speak` command for each candidate. The user listens and selects:

```bash
printf "Hi, I'm Sam. Welcome to the show.\n" | vois-cli speak --follow --play --language English --voice sonic_coral
printf "Hi, I'm Sam. Welcome to the show.\n" | vois-cli speak --follow --play --language English --voice sonic_meadow
```

## Lines for previews

Write one line for each role, in the language of the project. Use 6 to 12 words.
Use a line from the script if there is a script. Then the user hears the voice in the work that it must do.

| Type of project | Example line |
|---|---|
| Podcast | "Hi, I'm Sam. Welcome back to the show." |
| Audiobook | "The rain started just after midnight, and nobody saw her leave." |
| Explainer | "In this lesson, you learn how to export your first file." |
| Ad | "Make your first voiceover today. It takes two minutes." |
| Game character | "You came a long way for a small reward, traveler." |

## Example: a podcast with two hosts

Brief: a tech podcast with the name "Byte Size", in English, friendly and curious. Plan: Pro.
Sam is the lead host. Sam is warm and keeps the talk on its topic. Alex is the co-host. Alex has a lot of energy and starts each new topic with a question.

```bash
node scripts/shortlist.mjs --engine expressive --gender female --category podcast --match "warm friendly host guide" --limit 6
node scripts/shortlist.mjs --engine expressive --gender male --match "energetic curious tech host dynamic" \
  --exclude podcasts_ai_voices/maya_brooks --limit 6
```

```markdown
| Role | Voice ID | Voice name | Engine | Reason |
|---|---|---|---|---|
| Sam (lead host) | `podcasts_ai_voices/maya_brooks` | Maya Brooks | expressive | "Warm Solo Host, friendly creator voice": warm and friendly, for the host who leads the talk. Female, a contrast with Alex. |
| Alex (co-host) | `podcasts_ai_voices/kai_mercer` | Kai Mercer | expressive | "Tech Creator, bright startup and maker-show host": bright and on topic for a tech show. Male, a contrast with Sam. |

Second choices: Sam: `podcasts_ai_voices/priya_nair` ("Wellness Host, gentle podcast voice"). Alex: `hosts_ai_voices/alex_bright` ("Dynamic Content Creator, energetic digital host").
```

Each alternative voice keeps the contrast between the two hosts.
