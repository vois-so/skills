# Manuscript format

`split-manuscript.mjs` reads plain text or Markdown. Prepare the text before you make the plan. A correction in the text is faster than a retake of many chapters.

## Chapter headings

The script starts a new chapter at each of these lines (80 characters or shorter):

- A Markdown title line: `# Title` or `## Title`.
- A line that starts with Chapter, Part, Prologue, Epilogue, Introduction or Afterword.

A title line with no text after it (for example the book title at the top) is not a chapter. The script uses it as the book title.

To use a different rule, give a regular expression: `--heading "^CHAPTER [0-9]+"`.

The narrator reads each chapter title first. Then a long pause (1.6 s) follows. Use `--no-titles` to stop this.

## Credits

Retailers usually tell you to add credits at the start and at the end of the book. Add them as chapters:

```markdown
## Opening Credits

The Ninth Ship. Written by Ana Ruiz. Narrated by a digital voice.

## Closing Credits

This was The Ninth Ship, written by Ana Ruiz. The end.
```

Write the credits and the AI narration disclosure that your retailer tells you to write. Do a check of the current rules of your retailer.

## Paragraphs and blocks

- An empty line starts a new paragraph. Each paragraph is one block.
- The script divides a paragraph that is longer than 900 characters at the end of a sentence (`--max-chars` changes this number).
- A line with only `***`, `* * *`, `---` or `#` starts a new scene. The pause is 1.6 s.

## Character voices

Use one narrator for most of the book. Give a different voice only to the important characters that speak frequently. Too many voices make a book not easy to follow.

Put each character line on its own line with the speaker name in brackets:

```text
The keeper opened the door.

[Mara]: Do not open the letter.

She said it quietly, and then she left.
```

Keep "she said" and the description in the narrator text. After you make the plan, set a voice for each speaker in `"voices"` in `plan.json`.

## Text for the ear

The voice reads what you write. Make these changes before you make the plan:

| Write this | Not this | Why |
| --- | --- | --- |
| M.I.T. | MIT | The voice speaks the letters one at a time. |
| nineteen eighty-four | 1984 | You control how the voice speaks the number. |
| ten kilometers | 10 km | The voice speaks the full unit. |
| Doctor Okafor | Dr. Okafor | The voice can speak an abbreviation incorrectly. |
| Shi-vawn | Siobhan | Respell a name that the voice speaks incorrectly. |

Find each name that is not usual. Generate one test sentence with each name. If the voice speaks a name incorrectly, respell it in all chapters before you narrate.

Remove text that is only for the eye: page numbers, footnote marks, tables of contents, image captions and web links.

## Speed and pauses

- Commas and full stops control where the voice stops for a short time. They do not give an accurate pause length.
- Long sentences are not easy to hear. Divide a sentence that has more than 35 words.
- The pause between paragraphs is `"pause_ms"` in `plan.json` (600 ms). The pause at a new scene is `"break_ms"` (1600 ms).
- Keep `"speed"` the same for all chapters. Then chapter 9 has the same speed as chapter 1.
