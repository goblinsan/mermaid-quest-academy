# Audio ID Authoring Rules

This document describes how to author, name, and maintain **AudioIds** in
Mermaid Quest Academy.  It covers the full ID grammar, the list of reserved
categories, examples from the SATPIN phonics curriculum, and the stability
contract that every contributor must honour.

---

## What is an AudioId?

An `AudioId` is a short, human-readable string that uniquely and permanently
identifies a single audio clip.  It is the **primary cache key** for the audio
pipeline: the cache looks up a clip by its ID rather than by hashing the TTS
text, so the same clip is always found even when the underlying text is revised
for clarity or pronunciation.

---

## Grammar

```
audio-id   ::= segment "." segment ["." segment]
segment    ::= [a-z] [a-z0-9-]*
```

Rules:
- Exactly **2 or 3** dot-separated segments.
- Every segment **starts with a lowercase letter** (a–z).
- Subsequent characters may be lowercase letters (a–z), digits (0–9), or
  **hyphens** (-).
- **No uppercase letters**, spaces, underscores, or other punctuation.
- The **first segment** must be one of the [reserved categories](#reserved-categories).

### Valid examples

| AudioId | What it identifies |
|---|---|
| `phonics.letter.s` | The /s/ phoneme sound |
| `word.cvc.sat` | The blended CVC word "sat" |
| `object.name.sun` | The object name "sun" |
| `instruction.echo-song.default` | Echo-song activity prompt |
| `instruction.seashell-match.a` | Seashell-match prompt for letter A |
| `feedback.correct` | Generic correct-answer audio |
| `ui.tap` | Tap interaction sound |

### Invalid examples

| String | Reason invalid |
|---|---|
| `Phonics.letter.s` | Uppercase letter in first segment |
| `phonics` | Only one segment (minimum is 2) |
| `phonics.letter.s.extra` | Four segments (maximum is 3) |
| `phonics.-letter` | Segment starts with a hyphen |
| `unknown.thing` | `unknown` is not a reserved category |

---

## Reserved categories

Every AudioId must begin with one of the following categories.  Using an
unlisted category is a validation error.

| Category | Semantic scope |
|---|---|
| `phonics` | Phoneme or letter-sound audio (e.g. tiles, bin labels) |
| `word` | Complete spoken words (e.g. CVC blends) |
| `object` | Picture / object names (e.g. "sun", "apple") |
| `instruction` | Activity prompt or direction audio |
| `feedback` | Learner-response feedback (correct / incorrect) |
| `ui` | General UI interaction audio |

---

## Stability rules

> **An AudioId is immutable once it has been authored and shipped.**

1. **Never change an existing ID** — not even for a typo fix.  The ID is the
   stable handle; the TTS text alongside it is what gets corrected.
2. **Semantic intent, not text content** — two clips that say the same words
   but represent different concepts (e.g. a letter on a tile vs. the same
   letter on a bin) **must have different IDs**.
3. **Deprecation over deletion** — when a clip is retired, mark its entry with
   a `// @deprecated` comment and stop emitting it in new code.  Remove it
   only after all call sites have been updated.
4. **Never reuse a deprecated ID** for a new, different concept.  Create a
   new ID instead.
5. **The ID is the cache key** — changing the ID invalidates the cache entry
   and forces a fresh TTS fetch.  Keeping the ID stable means warm-cache
   performance is maintained across text revisions.

---

## SATPIN phonics ID taxonomy

The full mapping lives in `src/data/phonicsAudioIds.ts`.  The table below
summarises the naming pattern for quick reference.

### `phonics.letter.{x}` — isolated phoneme sounds

Used in seashell tiles, bubble-pop bubbles, echo-song beats, and
word-builder letter tiles.

| AudioId | TTS text |
|---|---|
| `phonics.letter.s` | S says sss |
| `phonics.letter.a` | A says aah |
| `phonics.letter.t` | T says tuh |
| `phonics.letter.p` | P says puh |
| `phonics.letter.i` | I says ih |
| `phonics.letter.n` | N says nnn |

### `phonics.bin.{x}` — treasure-sort bin labels

| AudioId | TTS text |
|---|---|
| `phonics.bin.s` | S says s like in snake |
| `phonics.bin.a` | A says a like in apple |
| `phonics.bin.t` | T says t like in tiger |
| `phonics.bin.p` | P says p like in pig |
| `phonics.bin.i` | I says i like in insect |
| `phonics.bin.n` | N says n like in nest |

### `word.cvc.{word}` — blended CVC words

| AudioId | TTS text |
|---|---|
| `word.cvc.sat` | sat |
| `word.cvc.sit` | sit |
| `word.cvc.tap` | tap |
| `word.cvc.pin` | pin |
| `word.cvc.nap` | nap |
| `word.cvc.pan` | pan |

### `object.name.{object}` — picture / object names

| AudioId | TTS text |
|---|---|
| `object.name.sun` | Sun |
| `object.name.apple` | Apple |
| `object.name.tiger` | Tiger |
| `object.name.pig` | Pig |
| `object.name.insect` | Insect |
| `object.name.net` | Net |
| `object.name.ant` | Ant |
| `object.name.nest` | Nest |
| `object.name.ink` | Ink |

### `instruction.*` — activity prompts

| AudioId | Used in |
|---|---|
| `instruction.seashell-match.{x}` | Seashell-match prompt per letter |
| `instruction.fish-feed.{x}` | Fish-feed prompt per letter |
| `instruction.treasure-sort.letter` | Letter treasure-sort prompt |
| `instruction.treasure-sort.object` | Object treasure-sort prompt |
| `instruction.echo-song.default` | Echo-song prompt |
| `instruction.word-builder.{word}` | Word-builder prompt per CVC word |

---

## How to add a new AudioId

1. Choose the correct **category** from the reserved list above.
2. Pick a **subcategory** that clearly names the semantic group (e.g. `letter`,
   `bin`, `cvc`, `name`, `seashell-match`).
3. Add a **qualifier** (third segment) when the subcategory alone is not unique
   enough (e.g. `s`, `sat`).
4. Add the entry to `src/data/phonicsAudioIds.ts` (or the relevant mapping
   file for non-phonics audio).
5. Validate your ID at runtime using `isValidAudioId` from
   `src/utils/audioIdValidator.ts`.
6. Pass the ID as the second argument to `speak()` in `useAudio`:

```ts
import { audioId } from '../types/audioId';
import { PHONICS_AUDIO_ID_MAP } from '../data/phonicsAudioIds';

const id  = audioId('phonics.letter.s');
const tts = PHONICS_AUDIO_ID_MAP[id];
speak(tts, id);
```

---

## Validation utility

Use `isValidAudioId` for boolean checks and `validateAudioId` for detailed
error messages:

```ts
import { isValidAudioId, validateAudioId } from '../utils/audioIdValidator';

isValidAudioId('phonics.letter.s');   // true
isValidAudioId('Phonics.letter.s');   // false

const result = validateAudioId('unknown.thing');
// { valid: false, error: 'AudioId category "unknown" is not one of ...' }
```

---

## Related files

| File | Purpose |
|---|---|
| `src/types/audioId.ts` | `AudioId` type, grammar constants, reserved categories |
| `src/utils/audioIdValidator.ts` | Runtime validation utilities |
| `src/data/phonicsAudioIds.ts` | SATPIN phonics AudioId → TTS text mapping |
| `src/services/audioCache.ts` | ID-keyed cache (`getCachedAudioById`, `cacheAudioById`) |
| `src/hooks/useAudio.ts` | `speak(text, audioId?)` integration |
