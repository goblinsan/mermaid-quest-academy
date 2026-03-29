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
audio-id   ::= segment "." segment ["." segment ["." segment]]
segment    ::= [a-z] [a-z0-9_]*
```

Rules:
- Exactly **2 to 4** dot-separated segments.
- Every segment **starts with a lowercase letter** (a–z).
- Subsequent characters may be lowercase letters (a–z), digits (0–9), or
  **underscores** (_).
- **No uppercase letters**, spaces, hyphens, or other punctuation.
- The **first segment** must be one of the [reserved categories](#reserved-categories).
- The optional **4th segment** is a variant marker (e.g. `v2`) used when a
  semantic change requires a new ID while the old must be kept.

### Segment definitions

| Segment    | Required | Description                                       |
|------------|----------|---------------------------------------------------|
| `category` | ✓        | Top-level reserved category (see table below)     |
| `subtype`  | ✓        | Semantic sub-group within the category            |
| `key`      |          | Specific item identifier (e.g. letter, word)      |
| `variant`  |          | Version marker for semantic changes (e.g. `v2`)   |

### Valid examples

| AudioId | What it identifies |
|---|---|
| `phoneme.letter.s` | The /s/ phoneme sound |
| `word.cvc.sat` | The blended CVC word "sat" |
| `word.name.sun` | The object name "sun" |
| `prompt.echo_song.default` | Echo-song activity prompt |
| `prompt.seashell_match.a` | Seashell-match prompt for letter A |
| `feedback.correct` | Generic correct-answer audio |
| `reward.level_complete` | Level-completion celebration audio |
| `ui.tap` | Tap interaction sound |
| `narration.intro.default` | Introductory narration clip |
| `prompt.seashell_match.s.v2` | Updated (v2) seashell prompt for S |

### Invalid examples

| String | Reason invalid |
|---|---|
| `Phoneme.letter.s` | Uppercase letter in first segment |
| `phoneme` | Only one segment (minimum is 2) |
| `phoneme.letter.s.extra.long` | Five segments (maximum is 4) |
| `phoneme.-letter` | Segment starts with a non-letter |
| `unknown.thing` | `unknown` is not a reserved category |
| `phoneme.letter-s.x` | Hyphens are not allowed — use underscores |
| `phonics.letter.s` | Old `phonics` category — use `phoneme` instead |
| `instruction.seashell_match.s` | Old `instruction` category — use `prompt` instead |

---

## Reserved categories

Every AudioId must begin with one of the following categories.  Using an
unlisted category is a validation error.

| Category | Semantic scope |
|---|---|
| `phoneme` | Isolated phoneme / letter-sound audio (tiles, bin labels) |
| `word` | Complete spoken words (CVC blends, object names) |
| `prompt` | Activity instruction or direction audio |
| `feedback` | Learner-response feedback (correct / incorrect) |
| `reward` | Reward or celebration audio |
| `ui` | General UI interaction audio |
| `narration` | Narrative or story audio |

---

## Stability rules

> **An AudioId is immutable once it has been authored and shipped.**

1. **Never change an existing ID** — not even for a typo fix.  The ID is the
   stable handle; the TTS text alongside it is what gets corrected.
2. **Semantic intent, not text content** — two clips that say the same words
   but represent different concepts (e.g. a letter on a tile vs. the same
   letter on a bin) **must have different IDs**.
3. **Deprecation over deletion** — when a clip is retired, mark its entry with
   `status: "deprecated"` and stop emitting it in new code.  Remove it only
   after all call sites have been updated.
4. **Never reuse a deprecated ID** for a new, different concept.  Create a
   new ID instead.
5. **The ID is the cache key** — changing the ID invalidates the cache entry
   and forces a fresh TTS fetch.  Keeping the ID stable means warm-cache
   performance is maintained across text revisions.
6. **Use variants for semantic changes** — if the meaning of an existing clip
   must change in a way that requires a new ID, append a `.v2` (or `.v3`, etc.)
   variant segment.  The original ID remains valid and in use until all
   references are migrated.

---

## SATPIN phonics ID taxonomy

The full mapping lives in `src/data/phonicsAudioIds.ts`.  The table below
summarises the naming pattern for quick reference.

### `phoneme.letter.{x}` — isolated phoneme sounds

Used in seashell tiles, bubble-pop bubbles, echo-song beats, and
word-builder letter tiles.

| AudioId | TTS text |
|---|---|
| `phoneme.letter.s` | S says sss |
| `phoneme.letter.a` | A says aah |
| `phoneme.letter.t` | T says tuh |
| `phoneme.letter.p` | P says puh |
| `phoneme.letter.i` | I says ih |
| `phoneme.letter.n` | N says nnn |

### `phoneme.bin.{x}` — treasure-sort bin labels

| AudioId | TTS text |
|---|---|
| `phoneme.bin.s` | S says s like in snake |
| `phoneme.bin.a` | A says a like in apple |
| `phoneme.bin.t` | T says t like in tiger |
| `phoneme.bin.p` | P says p like in pig |
| `phoneme.bin.i` | I says i like in insect |
| `phoneme.bin.n` | N says n like in nest |

### `word.cvc.{word}` — blended CVC words

| AudioId | TTS text |
|---|---|
| `word.cvc.sat` | sat |
| `word.cvc.sit` | sit |
| `word.cvc.tap` | tap |
| `word.cvc.pin` | pin |
| `word.cvc.nap` | nap |
| `word.cvc.pan` | pan |

### `word.name.{object}` — picture / object names

| AudioId | TTS text |
|---|---|
| `word.name.sun` | Sun |
| `word.name.apple` | Apple |
| `word.name.tiger` | Tiger |
| `word.name.pig` | Pig |
| `word.name.insect` | Insect |
| `word.name.net` | Net |
| `word.name.ant` | Ant |
| `word.name.nest` | Nest |
| `word.name.ink` | Ink |

### `prompt.*` — activity prompts

| AudioId | Used in |
|---|---|
| `prompt.seashell_match.{x}` | Seashell-match prompt per letter |
| `prompt.fish_feed.{x}` | Fish-feed prompt per letter |
| `prompt.treasure_sort.letter` | Letter treasure-sort prompt |
| `prompt.treasure_sort.object` | Object treasure-sort prompt |
| `prompt.echo_song.default` | Echo-song prompt |
| `prompt.word_builder.{word}` | Word-builder prompt per CVC word |

### `reward.*` — reward audio

| AudioId | TTS text |
|---|---|
| `reward.level_complete` | Amazing! You completed the level! Keep swimming! |
| `reward.badge_earned` | You earned a badge! Fantastic work! |
| `reward.pearls_collected` | You collected pearls! |

---

## How to add a new AudioId

1. Choose the correct **category** from the reserved list above.
2. Pick a **subtype** that clearly names the semantic group (e.g. `letter`,
   `bin`, `cvc`, `name`, `seashell_match`).  Use underscores, not hyphens.
3. Add a **key** (third segment) when the subtype alone is not unique enough
   (e.g. `s`, `sat`).
4. Add a **variant** (fourth segment, e.g. `v2`) only when you need a new ID
   for the same semantic slot because the original must remain stable.
5. Add the entry to `src/data/phonicsAudioIds.ts` (or the relevant mapping
   file for non-phonics audio) and to `src/data/audio-phrases.json`.
6. Validate your ID at runtime using `isValidAudioId` from
   `src/utils/audioIdValidator.ts`.
7. Pass the ID as the second argument to `speak()` in `useAudio`:

```ts
import { audioId } from '../types/audioId';
import { PHONICS_AUDIO_ID_MAP } from '../data/phonicsAudioIds';

const id  = audioId('phoneme.letter.s');
const tts = PHONICS_AUDIO_ID_MAP[id];
speak(tts, id);
```

### Common mistakes

| Mistake | Correct approach |
|---|---|
| Using hyphens in segments (`seashell-match`) | Use underscores: `seashell_match` |
| Using old category names (`phonics`, `instruction`, `object`) | Use new names: `phoneme`, `prompt`, `word` |
| Changing an ID to fix a typo | Keep the old ID; fix the TTS text instead |
| Adding a 5th segment | Maximum is 4 segments |
| Reusing a deprecated ID for a new concept | Always create a fresh ID |

---

## Validation utility

Use `isValidAudioId` for boolean checks and `validateAudioId` for detailed
error messages:

```ts
import { isValidAudioId, validateAudioId } from '../utils/audioIdValidator';

isValidAudioId('phoneme.letter.s');              // true
isValidAudioId('prompt.seashell_match.s');        // true
isValidAudioId('reward.level_complete');           // true
isValidAudioId('Phoneme.letter.s');              // false
isValidAudioId('phonics.letter.s');              // false – old category

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
| `src/data/audio-phrases.json` | Source-of-truth audio phrase inventory |
| `src/services/audioCache.ts` | ID-keyed cache (`getCachedAudioById`, `cacheAudioById`) |
| `src/hooks/useAudio.ts` | `speak(text, audioId?)` integration |
