# Audio Phrases Authoring Guide

This document describes how to add, update, and maintain entries in the
`audio-phrases.json` source-of-truth file.  It covers the schema, field-level
rules, type-specific contracts, lifecycle management, and the validation
workflow that every contributor must follow.

---

## What is `audio-phrases.json`?

`src/data/audio-phrases.json` is the **single source of truth** for every
renderable audio asset in Mermaid Quest Academy.  It is the contract between:

- **Content authors** — who decide what audio should exist and what it should say
- **TTS pipeline** — which reads the `text` field to synthesise clips
- **Runtime playback** — which looks up clips by stable `id`
- **QA** — which validates phonics safety, durations, and lifecycle state
- **Future tooling** — which can filter, diff, and migrate entries

Every audio clip that the game renders must have exactly one entry here.

---

## Schema overview

```
AudioPhraseEntry {
  id              string (AudioId)      — stable semantic identifier
  type            string (enum)         — asset type
  text            string                — canonical TTS text
  voiceProfile    string                — TTS voice profile
  locale          string                — BCP-47 locale
  renderStrategy  string (enum)         — how the clip is rendered
  sourceRefs      AudioSourceRef[]      — activities / files that use this clip
  tags            string[]              — categorisation tags
  status          string (enum)         — lifecycle state
  phonicsMetadata PhonicsAudioMetadata? — phonics constraints (required for phoneme type)
  replacedBy      string?               — successor AudioId (required when status=replaced)
  notes           string?               — author / QA notes
}
```

---

## Field reference

### `id` — AudioId

The stable, semantic identifier for this clip.  **Immutable once shipped.**

Rules:
- Must satisfy the AudioId grammar: `{category}.{subcategory}[.{qualifier}]`
- 2 or 3 dot-separated segments of `[a-z][a-z0-9-]*`
- First segment must be one of the reserved categories (see below)
- Never change an existing ID — revise `text` instead
- Never reuse a deprecated or replaced ID

See `src/docs/AUDIO_ID_AUTHORING.md` for the full grammar reference.

### `type` — asset type

Controls which fields are required.

| Value       | When to use                                                    |
|-------------|----------------------------------------------------------------|
| `phoneme`   | An isolated letter-sound or phoneme clip                       |
| `word`      | A complete spoken word (CVC blend, object name)                |
| `prompt`    | An activity instruction or direction                           |
| `feedback`  | Learner-response feedback (correct / incorrect reaction)       |
| `reward`    | Reward or celebration audio                                    |
| `ui`        | UI interaction sound                                           |
| `narration` | Narrative or story audio                                       |

### `text` — TTS text

The canonical text string to be synthesised.  This is the **only** field that
is safe to revise after shipping — the `id` stays fixed.

Guidelines:
- Write natural speech, not abbreviations
- For phoneme clips, match the guidance in `src/docs/AUDIO_ID_AUTHORING.md`
- Avoid punctuation that TTS engines render audibly (e.g. extra commas causing
  unnatural pauses) unless intentional

### `voiceProfile` — voice profile

Identifier for the TTS voice to use.  Use `"mermaid-default"` for all
standard game audio unless a specific voice is required.

### `locale` — BCP-47 locale

Language-region code for TTS synthesis.  Use `"en-US"` for all current
content.

### `renderStrategy` — how the clip is rendered

| Value         | Behaviour                                          |
|---------------|----------------------------------------------------|
| `tts`         | Synthesised at runtime via the TTS service         |
| `prerecorded` | Served as a static pre-recorded audio file         |

Default: `"tts"`.

### `sourceRefs` — source references

An array of objects that describe where this clip is used in the game:

```json
{ "type": "activity",  "id": "ra-s-seashell" }
{ "type": "data-file", "id": "phonicsVocabulary.json" }
{ "type": "component", "id": "FeedFriendlyFish" }
```

Valid `type` values: `"activity"`, `"data-file"`, `"component"`.

Rules:
- **Required and non-empty** for `type === "prompt"`
- Optional for all other types (but strongly encouraged)

### `tags` — categorisation tags

Free-form strings for filtering and tooling.  Recommended tags:

| Tag               | Meaning                                    |
|-------------------|--------------------------------------------|
| `satpin`          | Belongs to the SATPIN phonics curriculum   |
| `level-1` … `level-4` | Curriculum level where this clip is used |
| `phoneme`         | Audio is a phoneme sound                   |
| `cvc`             | Audio is a CVC blend                       |
| `object-name`     | Audio is a picture/object name             |
| `bin-label`       | Audio is a treasure-sort bin label         |
| `seashell-match`  | Used in the seashell-match activity        |
| `fish-feed`       | Used in the fish-feed activity             |
| `treasure-sort`   | Used in the treasure-sort activity         |
| `echo-song`       | Used in the echo-song activity             |
| `word-builder`    | Used in the word-builder activity          |
| `feedback`        | Learner-response feedback clip             |
| `distractor`      | Used as a wrong-answer option              |

### `status` — lifecycle state

| Value          | Rendering behaviour                                              |
|----------------|------------------------------------------------------------------|
| `active`       | Rendered and shipped to production                               |
| `deprecated`   | No longer emitted; preserved until all references cleared        |
| `experimental` | Development-only; excluded from production builds                |
| `blocked`      | Blocked from rendering until a review is complete                |
| `replaced`     | Superseded by another entry (`replacedBy` must be set)           |

### `phonicsMetadata` — phonics-safe constraints

Required when `type === "phoneme"`.  Optional (but encouraged) when the
entry is a CVC word.

| Field              | Type    | Purpose                                                  |
|--------------------|---------|----------------------------------------------------------|
| `phonemeSymbol`    | string  | IPA symbol or ASCII approximation (e.g. `"s"`, `"æ"`)   |
| `isolationRequired`| boolean | `true` = must render without surrounding context text    |
| `maxDurationMs`    | number  | Maximum clip length in milliseconds                      |
| `allowLetterName`  | boolean | Whether the letter name may appear in the TTS text       |
| `reviewRequired`   | boolean | `true` = clip needs human pronunciation review           |

Recommended `maxDurationMs` defaults:
- Isolated phoneme (`isolationRequired: true`): **1500 ms**
- Bin label with context (`isolationRequired: false`): **3000 ms**

### `replacedBy` — successor ID

Must be set to a valid AudioId when `status === "replaced"`.

### `notes` — author / QA notes

Free-text field for human-readable context.  Not used by any pipeline.
Good uses: explain distractor relationships, record review history, flag
pronunciation quirks.

---

## Type-specific contracts

### `phoneme`
- `phonicsMetadata` is **required**
- Recommended `id` pattern: `phonics.letter.{x}` (isolated) or `phonics.bin.{x}` (bin label)

### `word`
- `phonicsMetadata` is optional but strongly recommended for CVC blends
- Recommended `id` patterns: `word.cvc.{word}`, `object.name.{name}`

### `prompt`
- `sourceRefs` must be **non-empty**
- Recommended `id` pattern: `instruction.{activity}.{qualifier}`

### `feedback`
- No additional constraints
- Recommended `id` pattern: `feedback.{outcome}` (e.g. `feedback.correct`)

### `reward`
- No additional constraints
- Recommended `id` pattern: `reward.{event}` (e.g. `reward.level-complete`)

### `ui`
- No additional constraints
- Recommended `id` pattern: `ui.{action}` (e.g. `ui.tap`)

### `narration`
- No additional constraints
- Recommended `id` pattern: `narration.{scene}.{beat}`

---

## Lifecycle management

### Making a clip active

Set `"status": "active"`.  This is the default for all production-ready clips.

### Retiring a clip (deprecation)

When a clip should no longer be emitted in new code:

1. Change `"status"` to `"deprecated"`
2. Add a `"notes"` comment explaining why
3. Remove all call sites that use this `id`
4. Keep the entry in the file until call sites are fully cleared

**Do not delete deprecated entries immediately** — other branches may still
reference them and a deletion causes merge conflicts.

### Replacing a clip

When a clip is superseded by a better version:

1. Add a new entry with the new `id`
2. On the old entry: set `"status": "replaced"` and `"replacedBy": "<new-id>"`
3. Update all call sites to reference the new `id`

### Blocking a clip

When a clip needs pronunciation review before it can be used:

1. Set `"status": "blocked"`
2. Add a `"notes"` comment describing what review is needed
3. After review passes, change status to `"active"` and clear the notes

---

## How to add a new audio phrase

1. **Choose a category** from the reserved list:
   `phonics`, `word`, `object`, `instruction`, `feedback`, `reward`, `ui`, `narration`

2. **Pick a type** from the type table above.

3. **Construct the ID** following the pattern for that type.

4. **Add the entry** to `src/data/audio-phrases.json` in the `phrases` array.

5. **Fill all required fields** (`id`, `type`, `text`, `voiceProfile`, `locale`,
   `renderStrategy`, `sourceRefs`, `tags`, `status`).

6. **Add `phonicsMetadata`** if `type === "phoneme"` (or if type is `"word"`
   and the word is a CVC blend).

7. **Run validation** to confirm the entry is correct:

   ```bash
   npm run test
   ```

8. **Update `updatedAt`** in the JSON file to today's date (ISO 8601).

### Example: adding a new phoneme

```json
{
  "id": "phonics.letter.b",
  "type": "phoneme",
  "text": "B says buh",
  "voiceProfile": "mermaid-default",
  "locale": "en-US",
  "renderStrategy": "tts",
  "sourceRefs": [
    { "type": "activity", "id": "ra-b-seashell" }
  ],
  "tags": ["phoneme", "level-1", "seashell-match"],
  "status": "experimental",
  "phonicsMetadata": {
    "phonemeSymbol": "b",
    "isolationRequired": true,
    "maxDurationMs": 1500,
    "allowLetterName": true,
    "reviewRequired": true
  }
}
```

### Example: adding a new prompt

```json
{
  "id": "instruction.seashell-match.b",
  "type": "prompt",
  "text": "Tap the shell that makes the b sound, like in ball",
  "voiceProfile": "mermaid-default",
  "locale": "en-US",
  "renderStrategy": "tts",
  "sourceRefs": [
    { "type": "activity", "id": "ra-b-seashell" }
  ],
  "tags": ["prompt", "level-1", "seashell-match"],
  "status": "experimental"
}
```

---

## Validation

The validator lives in `src/utils/audioPhraseValidator.ts`.

### Single-entry validation

```ts
import { validateAudioPhraseEntry } from '../utils/audioPhraseValidator';

const result = validateAudioPhraseEntry(entry);
if (!result.valid) {
  console.error(result.errors.join('\n'));
}
```

### Full-inventory validation

```ts
import { validateAudioPhrasesInventory } from '../utils/audioPhraseValidator';
import inventory from '../data/audio-phrases.json';

const result = validateAudioPhrasesInventory(inventory);
if (!result.valid) {
  console.error('Top-level errors:', result.errors);
  for (const [id, errs] of Object.entries(result.entryErrors)) {
    console.error(`Entry "${id}":`, errs);
  }
}
```

Validation errors you will see, and how to fix them:

| Error message                                    | Fix                                           |
|--------------------------------------------------|-----------------------------------------------|
| `id: "" is not a valid AudioId`                  | Correct the ID grammar                        |
| `type: "xyz" is not valid`                       | Use a value from the type enum                |
| `phonicsMetadata: required when type is "phoneme"` | Add the `phonicsMetadata` object             |
| `sourceRefs: must be non-empty for type "prompt"` | Add at least one `sourceRef`                 |
| `replacedBy: must be set … when status is "replaced"` | Set `replacedBy` to the successor ID     |
| `Duplicate id "xyz" at indices 3 and 7`          | Remove the duplicate entry                    |

---

## Related files

| File                                    | Purpose                                                  |
|-----------------------------------------|----------------------------------------------------------|
| `src/data/audio-phrases.json`           | Source-of-truth phrase inventory                         |
| `src/types/audioPhrases.ts`             | TypeScript types for the schema                          |
| `src/utils/audioPhraseValidator.ts`     | Runtime validation utilities                             |
| `src/types/audioId.ts`                  | `AudioId` type, grammar constants, reserved categories   |
| `src/utils/audioIdValidator.ts`         | AudioId validation utilities                             |
| `src/data/phonicsAudioIds.ts`           | SATPIN AudioId → TTS text map (used by the runtime)      |
| `src/docs/AUDIO_ID_AUTHORING.md`        | AudioId grammar and stability rules                      |
