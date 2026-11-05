#!/usr/bin/env node
// find-risky-words.mjs - finds words in a script that a voice can say incorrectly.
// MIT License. Copyright (c) 2026 Vois Studio. https://github.com/vois-so/skills
//
// Usage:
//   node find-risky-words.mjs <script.txt|-> [--dictionary dict.json] [--csv draft.csv] [--json]
//   node find-risky-words.mjs --check-csv entries.csv [--dictionary dict.json]
//
//   --dictionary  the output of `vois-cli pronunciation list --format json`. Words that already
//                 have an entry are marked "in dictionary".
//   --csv         writes a draft CSV (word,pronunciation,context) for `vois-cli pronunciation import`.
//                 The pronunciation column is empty: fill it in and test each entry before import.
//   --check-csv   examines a CSV before import: header, empty fields, commas, quotes, symbols,
//                 duplicates, and words that already have an entry (import adds, it does not update).
//
// Categories: name, brand, acronym, letters+digits, number+unit, number, symbol, accented,
// uncommon-spelling, heteronym. It is a heuristic: it finds candidates, a person decides.
// Exit codes: 0 no candidates, 1 candidates found, 2 usage error. No npm dependencies.

import { readFileSync, writeFileSync } from 'node:fs';

const UNITS = 'ms|s|sec|secs|min|mins|h|hr|hrs|kb|mb|gb|tb|kib|mib|gib|kbps|mbps|gbps|hz|khz|mhz|ghz|db|dbfs|lufs|dbtp|fps|px|pt|em|rem|mm|cm|m|km|km\\/h|mph|kph|in|ft|mi|g|kg|mg|lb|lbs|oz|ml|l|°c|°f|c|f|v|mv|kv|w|kw|mw|kwh|mah|a|ma|k|x|%|p';
// Words with two sounds where the vowel or the stress changes with the meaning.
const HETERONYMS = new Set(['read', 'lead', 'leads', 'live', 'lives', 'wind', 'winds', 'tear', 'tears', 'bass', 'close', 'minute', 'wound', 'row', 'rows', 'bow', 'bows', 'polish', 'refuse', 'desert', 'resume', 'separate', 'estimate', 'moderate', 'alternate', 'graduate', 'deliberate', 'associate', 'advocate', 'appropriate', 'duplicate', 'elaborate', 'intimate', 'dove', 'sow', 'does', 'axes', 'bases', 'learned', 'aged', 'blessed', 'invalid', 'content', 'object', 'present', 'record', 'project', 'produce', 'permit', 'subject', 'conduct', 'contract', 'putting', 'agape', 'unionized'])
// Common capitalised words that are not names when they start a clause or stand alone.
const COMMON = new Set(['I', 'A', 'An', 'The', 'And', 'But', 'Or', 'So', 'If', 'Then', 'When', 'While', 'This', 'That', 'These', 'Those', 'It', 'We', 'You', 'He', 'She', 'They', 'Our', 'Your', 'My', 'His', 'Her', 'Their', 'Its', 'In', 'On', 'At', 'For', 'With', 'From', 'To', 'Of', 'By', 'As', 'Is', 'Are', 'Was', 'Were', 'Be', 'Do', 'Does', 'Did', 'Not', 'No', 'Yes', 'Okay', 'OK', 'Hello', 'Hi', 'Welcome', 'Thanks', 'Thank', 'First', 'Second', 'Third', 'Last', 'Next', 'Now', 'Here', 'There', 'What', 'Why', 'How', 'Who', 'Where', 'Which', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December', 'English', 'Mr', 'Mrs', 'Ms', 'Dr']);

function usage(msg) {
  if (msg) console.error(`find-risky-words: ${msg}`);
  console.error('Usage: node find-risky-words.mjs <script.txt|-> [--dictionary dict.json] [--csv draft.csv] [--json]');
  console.error('       node find-risky-words.mjs --check-csv entries.csv [--dictionary dict.json]');
  process.exit(2);
}

const args = process.argv.slice(2);
let file = null;
let dictFile = null;
let csvFile = null;
let json = false;
let checkCsv = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--dictionary') dictFile = args[++i];
  else if (a === '--csv') csvFile = args[++i];
  else if (a === '--json') json = true;
  else if (a === '--check-csv') checkCsv = args[++i];
  else if (a === '-h' || a === '--help') usage();
  else if (a.startsWith('-') && a !== '-') usage(`unknown option ${a}`);
  else file = a;
}
if (!file && !checkCsv) usage('give a script file, or - for stdin');


const known = new Map();
if (dictFile) {
  try {
    const entries = JSON.parse(readFileSync(dictFile, 'utf8'));
    for (const e of Array.isArray(entries) ? entries : entries.entries || []) {
      const key = String(e.word).toLowerCase();
      const prev = known.get(key);
      // Keep the global entry if a word has more than one: `tts generate` uses only global entries.
      if (!prev || e.scope === 'global') known.set(key, { id: e.id, scope: e.scope, pronunciation: e.pronunciation });
    }
  } catch (err) { usage(`cannot read ${dictFile}: ${err.message}`); }
}

if (checkCsv) {
  // Examine a CSV before `vois-cli pronunciation import`.
  let csv;
  try { csv = readFileSync(checkCsv, 'utf8'); } catch (err) { usage(`cannot read ${checkCsv}: ${err.message}`); }
  const rows = csv.replace(/\r\n?/g, '\n').split('\n');
  const errors = [];
  if (!/^word\s*,\s*pronunciation/i.test(rows[0] || '')) errors.push('line 1: Vois Studio skips the first line. Make it the header: word,pronunciation,context,language');
  const seen = new Set();
  let good = 0;
  rows.slice(1).forEach((row, i) => {
    const n = i + 2;
    if (!row.trim()) return;
    if (/"/.test(row)) errors.push(`line ${n}: a quote. Vois Studio does not read quotes. Remove it.`);
    const f = row.split(',').map((v) => v.trim());
    if (f.length < 2) { errors.push(`line ${n}: less than two fields. Vois Studio skips this row.`); return; }
    if (f.length > 4) errors.push(`line ${n}: more than four fields. A field has a comma. Remove it.`);
    const [word, say, , lang] = f;
    if (!word) errors.push(`line ${n}: the word is empty.`);
    if (!say) errors.push(`line ${n}: the pronunciation of "${word}" is empty. The voice will say nothing for this word. Fill it in, or remove the row.`);
    if (/\$/.test(say || '')) errors.push(`line ${n}: a dollar sign in the pronunciation. Remove it.`);
    if (word && !/^[\p{L}\p{N}].*[\p{L}\p{N}]$|^[\p{L}\p{N}]$/u.test(word)) errors.push(`line ${n}: "${word}" starts or ends with a symbol. An entry cannot match it. Write a respelling in the script.`);
    if (lang && !/^[a-z]{2,3}(-[A-Za-z]{2,4})?$/.test(lang)) errors.push(`line ${n}: "${lang}" is not a language code, for example en.`);
    const key = (word || '').toLowerCase();
    if (seen.has(key)) errors.push(`line ${n}: "${word}" is in the file two times.`);
    seen.add(key);
    if (known.has(key)) errors.push(`line ${n}: "${word}" already has an entry (id ${known.get(key).id}). Import adds a second entry. Use \`vois-cli pronunciation update --id ${known.get(key).id}\` in its place.`);
    good++;
  });
  for (const e of errors) console.log(`CSV ERROR ${e}`);
  console.log(`${good} row(s), ${errors.length} error(s).`);
  process.exit(errors.length ? 1 : 0);
}

let text;
try { text = readFileSync(file === '-' ? 0 : file, 'utf8'); } catch (err) { usage(`cannot read ${file}: ${err.message}`); }

const found = new Map();
function note(word, category, line, hint) {
  const key = `${word.toLowerCase()}|${category}`;
  const item = found.get(key) || { word, category, count: 0, lines: [], hint };
  item.count++;
  if (!item.lines.includes(line)) item.lines.push(line);
  found.set(key, item);
}

const lines = text.replace(/\r\n?/g, '\n').split('\n');
lines.forEach((raw, idx) => {
  const n = idx + 1;
  // Remove speaker tags, pause tokens, reaction tags, URLs and email addresses.
  const line = raw
    .replace(/\[[^\]]*\]:?/g, ' ')
    .replace(/https?:\/\/\S+|www\.\S+/gi, (m) => { note(m, 'symbol', n, 'Say what the listener needs, not the URL.'); return ' '; })
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.]+\b/g, (m) => { note(m, 'symbol', n, 'Write it in parts: "name at example dot com".'); return ' '; });

  // Numbers with units, then other numbers.
  const unitRe = new RegExp(`(?<![\\w.])([$€£¥]?\\d[\\d,]*(?:\\.\\d+)?)\\s?(${UNITS})(?![\\w])`, 'giu');
  let rest = line.replace(unitRe, (m) => { note(m.trim(), 'number+unit', n, 'Write the number and the unit as words: "five gigabytes".'); return ' '; });
  rest = rest.replace(/[$€£¥]?\d[\d,.:/-]*\d%?|[$€£¥]?\d%?/g, (m) => { note(m, 'number', n, 'Write it as words. Years, times, money and versions each have their own spoken words.'); return ' '; });

  // Words with symbols inside or at the edges: C++, C#, .NET, Node.js, @handle, #tag, AT&T.
  rest = rest.replace(/(?:^|\s)([.#@]?[A-Za-z][\w]*(?:[+#&][\w+#&]*|\.[A-Za-z]+)+|[.#@][A-Za-z]\w*)/g, (m, w) => {
    if (/^[A-Za-z]+\.$/.test(w)) return m;
    note(w, 'symbol', n, 'Write a respelling in the script ("C plus plus", "dot net"). A dictionary entry must start and end with a letter or a digit.');
    return ' ';
  });

  const tokens = [...rest.matchAll(/[\p{L}\p{M}][\p{L}\p{M}\p{N}'’-]*/gu)];
  let sentenceStart = true;
  let prevEnd = 0;
  // A run of capitalised words is one name: "Siobhan O'Neill", "Ghost Rehearsal".
  let run = { words: [], atStart: false };
  const flushRun = () => {
    if (run.words.length > 1) note(run.words.join(' '), 'name', n, 'A name with more than one word. Add one entry for the full name.');
    else if (run.words.length === 1 && !run.atStart) note(run.words[0], 'name', n, 'A name. Test it. If it is incorrect, add an entry.');
    run = { words: [], atStart: false };
  };
  for (const m of tokens) {
    const w = m[0].replace(/['’]s$/, '').replace(/-+$/, '');
    const between = rest.slice(prevEnd, m.index);
    if (/[.!?:;]/.test(between)) { flushRun(); sentenceStart = true; }
    else if (/[,()"]/.test(between)) flushRun();
    prevEnd = m.index + m[0].length;
    const lower = w.toLowerCase();

    if (/^[A-Z]{2,}s?$/.test(w) || /^[A-Z]{2,}[a-z]?$/.test(w)) {
      flushRun();
      note(w, 'acronym', n, 'Select: letters with spaces ("A P I") or a word ("NASA"). Expand it at the first use.');
      sentenceStart = false; continue;
    }
    if (/\p{L}/u.test(w) && /\d/.test(w)) {
      flushRun();
      note(w, 'letters+digits', n, 'Write it as the speaker says it: "M P three", "five G".');
      sentenceStart = false; continue;
    }
    if (/^[a-z]+[A-Z]/.test(w) || /^[A-Z][a-z]+[A-Z]/.test(w)) {
      flushRun();
      note(w, 'brand', n, 'A brand with mixed case. Test it. If it is incorrect, add an entry.');
      sentenceStart = false; continue;
    }
    if (/[^\x00-\x7F]/.test(w)) {
      note(w, 'accented', n, 'A word with accents or from a different language. Test it with the selected engine and language.');
    }
    const core = lower.replace(/[^a-z]/g, '');
    if (core.length > 2 && (/[bcdfghjklmnpqrstvwxz]{4,}/.test(core.replace(/(tch|ght|ngth|nch|rst|mpt|ngs|nds|rld|rth|lth|xt)/g, '')) || /^(ng|tl|pf|ts|zh|dz|sz|cz|mb|nd|dh|bh|kh|xh|q(?!u)|x[aeiou])/.test(core) || /(aa|ii|uu|ij|cz|sz|zs|eau|oeu|ae$)/.test(core))) {
      note(w, 'uncommon-spelling', n, 'An uncommon spelling. Test it. A name from a different language is often incorrect.');
    }
    if (HETERONYMS.has(lower)) {
      note(w, 'heteronym', n, 'Two possible sounds. Change the words of the sentence if the take is incorrect. Do not add a dictionary entry: it changes the word in all sentences.');
    }
    if (/^\p{Lu}/u.test(w) && !COMMON.has(w)) {
      if (!run.words.length) run.atStart = sentenceStart;
      run.words.push(w);
    } else {
      flushRun();
    }
    sentenceStart = false;
  }
  flushRun();
});

const items = [...found.values()].map((it) => {
  const k = known.get(it.word.toLowerCase());
  if (k) return { ...it, in_dictionary: `id ${k.id}, scope ${k.scope}: "${k.pronunciation}"` };
  // A part of a name can have its own entry: "Vois" in "Vois Studio".
  const parts = it.word.split(/\s+/).filter((w) => known.has(w.toLowerCase()));
  const partial = parts.map((w) => { const e = known.get(w.toLowerCase()); return `"${w}" (id ${e.id}, scope ${e.scope}: "${e.pronunciation}")`; });
  return { ...it, in_dictionary: partial.length ? `part only: ${partial.join(', ')}` : null };
});
const order = ['name', 'brand', 'acronym', 'letters+digits', 'number+unit', 'number', 'symbol', 'accented', 'uncommon-spelling', 'heteronym'];
items.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || b.count - a.count || a.word.localeCompare(b.word));

if (csvFile) {
  // One row for each word: a word can be in more than one category.
  const byWord = new Map();
  for (const it of items) {
    if (it.in_dictionary || !['name', 'brand', 'acronym', 'letters+digits', 'accented', 'uncommon-spelling'].includes(it.category)) continue;
    const key = it.word.toLowerCase();
    const row = byWord.get(key) || { word: it.word, categories: [], lines: new Set() };
    row.categories.push(it.category);
    it.lines.forEach((l) => row.lines.add(l));
    byWord.set(key, row);
  }
  // Vois Studio skips the first line (the header) and splits each row at each comma.
  // It does not read quotes. Thus no field can contain a comma or a quote.
  const clean = (v) => String(v).replace(/[",]/g, ' ').replace(/\s+/g, ' ').trim();
  const rows = [...byWord.values()].map((r) => [clean(r.word), '', clean(`${r.categories.join(' and ')} - line ${[...r.lines].join(' ')}`), 'en'].join(','));
  writeFileSync(csvFile, ['word,pronunciation,context,language', ...rows].join('\n') + '\n');
}

if (json) {
  console.log(JSON.stringify({ file, candidates: items.length, items }, null, 2));
} else if (!items.length) {
  console.log('No risky words found.');
} else {
  const pad = (s, w) => String(s).padEnd(w);
  console.log(`${pad('WORD', 24)} ${pad('CATEGORY', 18)} ${pad('COUNT', 5)} ${pad('LINES', 10)} NOTE`);
  for (const it of items) {
    const note2 = it.in_dictionary ? `In dictionary: ${it.in_dictionary}` : it.hint;
    console.log(`${pad(it.word, 24)} ${pad(it.category, 18)} ${pad(it.count, 5)} ${pad(it.lines.slice(0, 4).join(','), 10)} ${note2}`);
  }
  console.log(`\n${items.length} candidate(s).${csvFile ? ` Draft CSV: ${csvFile}` : ''}`);
}
process.exit(items.length ? 1 : 0);
