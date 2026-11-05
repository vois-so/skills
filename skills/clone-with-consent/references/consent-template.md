# Consent template

`scripts/consent-record.mjs new` makes this record for you. Use this page to understand each field, or to make the record by hand if Node.js is not available.

This template is not legal advice. The laws for voice and personal data are different in each country. Read the Vois Studio voice cloning terms: https://vois.so/legal/voice-cloning-terms

## Fields

| Field in `consent.json` | Purpose |
| --- | --- |
| `owner.name`, `owner.contact` | The owner of the voice, and how to speak to the owner |
| `owner.adult` | `true` if the owner has 18 years of age or more. If `false`, a parent or guardian must sign also |
| `collector`, `collector_contact` | The person or company that makes and uses the clone. The owner sends a withdrawal to this contact |
| `voice_name` | The name of the clone in Vois Studio |
| `scope.uses` | The permitted uses, for example `audiobook narration` or `course videos` |
| `scope.commercial` | `true` if the clone can be in content that the collector sells or uses for money |
| `scope.languages` | The languages that the clone can speak |
| `scope.new_text` | `true` if the clone can speak text that the owner did not read. This is usually the purpose of a clone |
| `scope.disclosure` | When to tell listeners that an AI made the voice |
| `scope.payment` | Payment to the owner, if there is one |
| `scope.expires` | The expiry date (`YYYY-MM-DD`), or `none` |
| `scope.prohibited` | The uses that are not permitted. The default list is in the blank document below. Add to it with the owner |
| `scope.after_withdrawal` | What occurs to published audio after a withdrawal. The default text lets it stay published |
| `method` | `signed` (a signed document) or `recorded` (a recorded statement) |
| `evidence.file`, `evidence.sha256` | The proof: the signed document or the statement recording, and its SHA-256 |
| `reference.file`, `reference.sha256`, `reference.transcript` | The voice sample for the clone, its SHA-256 and its accurate transcript |
| `clone.slug`, `clone.voice_id` | The clone in Vois Studio, after `link` |
| `record_id`, `status`, `history` | The ID, the condition (`draft`, `ready`, `revoked`) and each change with its date |

## Blank document

```markdown
# Voice cloning consent record

Record ID: ______________

## 1. Voice owner
Full name: ______________
Contact (email or phone): ______________
18 years or older: yes / no (if no, a parent or guardian signs below)

## 2. Person or company that makes the clone
Name: ______________
Contact for questions and withdrawal: ______________
Name of the voice in Vois Studio: ______________

## 3. Scope of use
Permitted uses: ______________
Commercial use: yes / no
Languages: ______________
New text that the owner did not read: yes / no
Disclosure that the voice is AI-generated: ______________
Payment: ______________
End date: ______________ (or: until withdrawal)

Uses that are not permitted:
- speech that makes listeners think that the owner said it live, when the owner did not
- political or election content
- sexual content
- content that defames, harasses or threatens a person
- fraud, and access to accounts or systems that use voice checks

## 4. Withdrawal
The owner can withdraw this consent at any time with a message to the contact in section 2.
After a withdrawal, the collector removes the clone from Vois Studio and makes no new audio with it.
Audio that was published before the withdrawal: ______________

## 5. Reference recording
File: ______________   SHA-256: ______________
Exact transcript: ______________

## 6. Evidence
Method: signed form / recorded statement
Date of consent: ______________

Signature of the voice owner: ______________  Date: ________
Signature of the parent or guardian (if necessary): ______________
Signature of the collector: ______________  Date: ________
```

## Recorded statement

For the `recorded` method, the owner reads this text aloud in a different recording (not the voice sample). `statement.txt` has the text with the facts from the consent record:

```text
My name is [full name]. Today is [date].
I give [collector] permission to make a copy of my voice with Vois Studio.
They can use my voice for: [uses].
Commercial use is permitted. / Commercial use is not permitted.
Languages: [languages].
This permission ends on [date]. / This permission continues until I take it back.
I can take back this permission at any time. To do this, I contact [collector contact].
```

Keep the statement recording as the proof file. The consent check writes its SHA-256 into the record.
