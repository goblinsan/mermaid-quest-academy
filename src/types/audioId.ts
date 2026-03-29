/**
 * Deterministic Audio ID System — Type Definitions  (issue #199 / Audio V5)
 *
 * ─── GRAMMAR ────────────────────────────────────────────────────────────────
 *
 * An AudioId is a dot-separated string with **2 or 3 segments**:
 *
 *   {category}.{subcategory}[.{qualifier}]
 *
 * Each segment must:
 *   • start with a lowercase letter (a–z)
 *   • contain only lowercase letters (a–z), digits (0–9), and hyphens (-)
 *
 * Regex:  /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){1,2}$/
 *
 * Valid examples:
 *   phonics.letter.s          → the /s/ phoneme sound
 *   word.cvc.sat              → the blended CVC word "sat"
 *   object.name.sun           → the object name "sun"
 *   instruction.echo-song.default → echo-song activity prompt
 *   feedback.correct          → generic correct-answer audio
 *   ui.tap                    → tap interaction sound
 *
 * ─── STABILITY RULES ────────────────────────────────────────────────────────
 *
 * 1. IDs are immutable once authored — the ID must never change, even if the
 *    underlying TTS text is revised for clarity or pronunciation.
 * 2. IDs identify semantic intent, not text content. Two IDs that produce
 *    identical audio still need separate IDs if they represent different
 *    concepts (e.g. a letter in a tile vs. the same letter in a bin label).
 * 3. When audio is retired, its ID is deprecated — never reused for a
 *    different concept. Deprecated IDs may be removed only after all
 *    references have been updated.
 * 4. IDs live in the source code and data files; TTS text lives alongside
 *    the ID in the mapping file. Changing TTS text without changing the ID
 *    is always safe.
 *
 * ─── RESERVED CATEGORIES ────────────────────────────────────────────────────
 * See AUDIO_ID_CATEGORIES below.
 */

/**
 * The ordered, exhaustive list of reserved top-level categories.
 * Every valid AudioId must begin with one of these values.
 *
 * | Category      | Semantic scope                                        |
 * |---------------|-------------------------------------------------------|
 * | `phonics`     | Phoneme or letter-sound audio (e.g. tiles, bin labels)|
 * | `word`        | Complete spoken words (e.g. CVC blends)               |
 * | `object`      | Picture / object names (e.g. "sun", "apple")          |
 * | `instruction` | Activity prompt or direction audio                    |
 * | `feedback`    | Learner response feedback (correct / incorrect)       |
 * | `ui`          | General UI interaction audio                          |
 */
export const AUDIO_ID_CATEGORIES = [
  'phonics',
  'word',
  'object',
  'instruction',
  'feedback',
  'ui',
] as const;

/** Union of all reserved top-level category strings. */
export type AudioIdCategory = (typeof AUDIO_ID_CATEGORIES)[number];

/**
 * Regex that validates a single AudioId segment.
 * A segment starts with a lowercase letter and is followed by zero or more
 * lowercase letters, digits, or hyphens.
 */
export const AUDIO_ID_SEGMENT_RE = /^[a-z][a-z0-9-]*$/;

/**
 * Regex that validates a complete AudioId string (2 or 3 dot-separated
 * segments, each conforming to AUDIO_ID_SEGMENT_RE).
 */
export const AUDIO_ID_RE = /^[a-z][a-z0-9-]*(\.[a-z][a-z0-9-]*){1,2}$/;

/**
 * A deterministic, semantic identifier for a single audio clip.
 *
 * AudioIds are stable: they do not change when the underlying TTS text is
 * revised.  The cache and audio pipeline use this ID as the primary key so
 * that clip identity is decoupled from text content.
 *
 * See the module-level JSDoc for the full grammar and stability rules.
 */
export type AudioId = string & { readonly __brand: 'AudioId' };

/**
 * Casts a raw string to `AudioId` **without** runtime validation.
 * Only use this when the string is known-good at compile time (e.g. for
 * string literals in mapping files).  For runtime input, prefer
 * `validateAudioId` from `audioIdValidator`.
 */
export function audioId(raw: string): AudioId {
  return raw as AudioId;
}
