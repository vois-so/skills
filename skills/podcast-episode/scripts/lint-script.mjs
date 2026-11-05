#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// Check a two-host podcast script before Vois Studio generates it.
//
// Usage:
//   node lint-script.mjs <script.txt> [--hosts "Maya,Theo"]
//
// Script lines:
//   ## Section title      a show-notes section (Vois Studio does not speak it)
//   [Name]: text          one speaker for each line
//   [pause=800]           a pause of 300-3000 ms on its own line
//
// Exit 0 when the script has no errors, 1 when it has errors.

import { readFileSync } from "node:fs";
import { parseScript, fail, parseArgs } from "./lib.mjs";

const args = parseArgs(process.argv.slice(2));
const file = args._[0];
if (!file) fail("Usage: node lint-script.mjs <script.txt> [--hosts \"Maya,Theo\"]", 3);
const s = parseScript(readFileSync(file, "utf8"));

if (args.hosts) {
  const hosts = String(args.hosts).split(",").map((h) => h.trim());
  for (const name of s.speakers.keys()) if (!hosts.includes(name)) s.errors.push(`speaker "${name}" is not one of the hosts: ${hosts.join(", ")}`);
  for (const h of hosts) if (!s.speakers.has(h)) s.errors.push(`host "${h}" has no line`);
}
if (s.speakers.size !== 2) s.warnings.push(`the script has ${s.speakers.size} speakers; this skill makes a two-host episode`);

console.log(`Words: ${s.words}, about ${(s.words / 150).toFixed(1)} minutes at 150 words a minute.`);
for (const [name, w] of s.speakers) console.log(`  ${name}: ${w} words (${Math.round((100 * w) / Math.max(1, s.words))}%)`);
console.log(`Sections: ${s.sections.map((x) => x.title).join(" | ") || "none"}`);
for (const w of s.warnings) console.log(`WARNING ${w}`);
for (const e of s.errors) console.log(`ERROR ${e}`);
console.log(s.errors.length ? `FAIL: ${s.errors.length} errors` : "PASS");
process.exit(s.errors.length ? 1 : 0);
