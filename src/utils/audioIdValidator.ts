import {
  AUDIO_ID_CATEGORIES,
  AUDIO_ID_RE,
  AUDIO_ID_SEGMENT_RE,
  type AudioId,
  type AudioIdCategory,
} from '../types/audioId';

/** Structured result returned by {@link validateAudioId}. */
export interface AudioIdValidationResult {
  /** `true` when the ID conforms to the canonical grammar. */
  valid: boolean;
  /**
   * Human-readable explanation of why the ID is invalid.
   * `undefined` when `valid` is `true`.
   */
  error?: string;
}

/** Pre-built Set for O(1) category membership checks. */
const CATEGORY_SET = new Set<string>(AUDIO_ID_CATEGORIES);

/**
 * Returns `true` when `id` is a syntactically valid AudioId.
 *
 * A valid AudioId:
 *  - is a non-empty string
 *  - has exactly 2 or 3 dot-separated segments
 *  - each segment starts with a lowercase letter and contains only
 *    lowercase letters (a–z), digits (0–9), and hyphens (-)
 *  - the first segment is one of the reserved {@link AUDIO_ID_CATEGORIES}
 *
 * This function is optimised for hot paths: it performs only two regex tests
 * and a single Set lookup with no intermediate allocations.
 *
 * @example
 * isValidAudioId('phonics.letter.s')   // true
 * isValidAudioId('word.cvc.sat')        // true
 * isValidAudioId('feedback.correct')    // true
 * isValidAudioId('')                    // false
 * isValidAudioId('Phonics.letter.s')   // false – uppercase
 * isValidAudioId('unknown.thing')       // false – reserved category
 * isValidAudioId('phonics.letter.s.x') // false – too many segments
 */
export function isValidAudioId(id: string): id is AudioId {
  if (!id || typeof id !== 'string') return false;
  if (!AUDIO_ID_RE.test(id)) return false;
  // Extract the category (first segment) without a full split
  const dotIndex = id.indexOf('.');
  const category = dotIndex === -1 ? id : id.slice(0, dotIndex);
  return CATEGORY_SET.has(category);
}

/**
 * Validates `id` against the canonical AudioId grammar and returns a
 * structured result describing any violation.
 *
 * Prefer {@link isValidAudioId} when only a boolean result is needed.
 *
 * @example
 * validateAudioId('phonics.letter.s')
 * // → { valid: true }
 *
 * validateAudioId('Phonics.letter.s')
 * // → { valid: false, error: 'AudioId must match pattern ...' }
 *
 * validateAudioId('unknown.thing')
 * // → { valid: false, error: 'AudioId category "unknown" is not one of ...' }
 */
export function validateAudioId(id: string): AudioIdValidationResult {
  if (!id || typeof id !== 'string') {
    return { valid: false, error: 'AudioId must be a non-empty string.' };
  }

  if (!AUDIO_ID_RE.test(id)) {
    return {
      valid: false,
      error:
        `AudioId must match pattern ${AUDIO_ID_RE.toString()} ` +
        `(2–3 dot-separated segments of [a-z][a-z0-9-]*). ` +
        `Received: "${id}"`,
    };
  }

  const segments = id.split('.');

  // Double-check each segment individually to produce more targeted messages.
  for (const segment of segments) {
    if (!AUDIO_ID_SEGMENT_RE.test(segment)) {
      return {
        valid: false,
        error:
          `Each segment must match ${AUDIO_ID_SEGMENT_RE.toString()} ` +
          `(start with [a-z], contain only [a-z0-9-]). ` +
          `Segment "${segment}" in "${id}" is invalid.`,
      };
    }
  }

  const category = segments[0] as AudioIdCategory;
  if (!CATEGORY_SET.has(category)) {
    return {
      valid: false,
      error:
        `AudioId category "${category}" is not one of the reserved categories: ` +
        `${AUDIO_ID_CATEGORIES.join(', ')}. Received: "${id}"`,
    };
  }

  return { valid: true };
}
