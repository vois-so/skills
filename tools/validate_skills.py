#!/usr/bin/env python3
"""Checks each skills/<name>/SKILL.md against the Agent Skills rules.

- The file starts with YAML front matter that has `name` and `description`.
- `name` is 1-64 characters of a-z, 0-9 and single hyphens, and equals the folder name.
- `description` is 1-1024 characters.
- The body has 500 lines or fewer.
- Each relative link in the body points to a file that exists.

Exit code 0 = no error, 1 = errors.
"""
import re
import sys
from pathlib import Path

NAME = re.compile(r"^[a-z0-9]+(-[a-z0-9]+)*$")


def front_matter(text):
    if not text.startswith("---\n"):
        return None, text
    end = text.find("\n---", 4)
    if end < 0:
        return None, text
    raw = text[4:end]
    body = text[end + 4:].lstrip("\n")
    fields = {}
    key = None
    for line in raw.splitlines():
        m = re.match(r"^([A-Za-z_-]+):\s*(.*)$", line)
        if m:
            key = m.group(1)
            fields[key] = m.group(2).strip().strip('"').strip("'")
        elif key and line.startswith((" ", "\t")) and key == "description":
            fields[key] += " " + line.strip()
    return fields, body


def main():
    root = Path(__file__).resolve().parent.parent / "skills"
    errors = []
    count = 0
    for skill in sorted(p for p in root.iterdir() if p.is_dir()):
        count += 1
        f = skill / "SKILL.md"
        if not f.is_file():
            errors.append(f"{skill.name}: SKILL.md is missing")
            continue
        fields, body = front_matter(f.read_text(encoding="utf-8"))
        if fields is None:
            errors.append(f"{skill.name}: no front matter")
            continue
        name = fields.get("name", "")
        desc = fields.get("description", "")
        if not NAME.match(name) or len(name) > 64:
            errors.append(f"{skill.name}: bad name '{name}'")
        if name != skill.name:
            errors.append(f"{skill.name}: name '{name}' does not equal the folder name")
        raw_desc = next((l for l in f.read_text(encoding="utf-8").splitlines() if l.startswith("description:")), "")
        value = raw_desc[len("description:"):].strip()
        if value and value[0] not in "\"'|>" and (": " in value or " #" in value or value.endswith(":")):
            errors.append(f"{skill.name}: put the description in double quotes; it holds ': ' or ' #', which YAML cannot read")
        if not 1 <= len(desc) <= 1024:
            errors.append(f"{skill.name}: description has {len(desc)} characters (1-1024)")
        lines = body.count("\n") + 1
        if lines > 500:
            errors.append(f"{skill.name}: body has {lines} lines (500 or fewer)")
        for link in re.findall(r"\]\(([^)#:]+)(?:#[^)]*)?\)", body):
            if not (skill / link).exists():
                errors.append(f"{skill.name}: link to a missing file: {link}")
    for e in errors:
        print(e)
    print(f"validate_skills: {count} skills, {len(errors)} errors.")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
