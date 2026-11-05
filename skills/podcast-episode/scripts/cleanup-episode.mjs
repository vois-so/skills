#!/usr/bin/env node
// SPDX-License-Identifier: MIT
// Copyright (c) 2026 vois-so
//
// Remove the speakers, script and (if this skill made it and it is now empty)
// the project that make-episode.mjs made in Vois Studio, and the compiled WAV
// that `export compile-script` left in the app data folder. Your exported
// episode in out_dir stays.
//
// Usage:
//   node cleanup-episode.mjs <out_dir>/receipt.json

import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { vois, fail } from "./lib.mjs";

const path = process.argv[2];
if (!path || !existsSync(path)) fail("Usage: node cleanup-episode.mjs <out_dir>/receipt.json", 3);
const r = JSON.parse(readFileSync(path, "utf8"));

function step(args, what) {
  const res = vois(args);
  console.log(`${res.code === 0 ? "OK  " : `EXIT ${res.code}`} ${what}`);
  return res;
}

for (const [name, id] of Object.entries(r.speakers || {})) step(["speaker", "delete", "--id", String(id)], `speaker ${name} (${id})`);
r.speakers = {};
if (r.script_id && step(["script", "delete", "--id", String(r.script_id), "--force"], `script ${r.script_id}`).code === 0) r.script_id = null;
if (r.project_created && r.project_id) {
  const left = vois(["script", "list", "--project", String(r.project_id)]);
  if (left.code === 0 && Array.isArray(left.json) && left.json.length === 0) {
    if (step(["project", "delete", "--id", String(r.project_id), "--force"], `project ${r.project_id}`).code === 0) r.project_id = null;
  } else console.log(`KEEP project ${r.project_id}: it has other scripts`);
}
if (r.compiled_app_path && existsSync(r.compiled_app_path)) {
  rmSync(r.compiled_app_path);
  console.log(`OK   removed ${r.compiled_app_path}`);
}
r.cleaned_up = new Date().toISOString();
writeFileSync(path, JSON.stringify(r, null, 2) + "\n");
