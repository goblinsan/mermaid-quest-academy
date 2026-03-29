/**
 * Audio Phrase Validator  (issue #209 / Audio V5)
 *
 * Runtime validation for entries in the audio-phrases source-of-truth file.
 *
 * ─── VALIDATION RULES ───────────────────────────────────────────────────────
 *
 * All entries:
 *  - `id` must be a valid AudioId (grammar + reserved category)
 *  - `type` must be one of AUDIO_PHRASE_TYPES
 *  - `text` must be a non-empty string
 *  - `voiceProfile` must be a non-empty string
 *  - `locale` must be a non-empty string
 *  - `renderStrategy` must be one of AUDIO_RENDER_STRATEGIES
 *  - `sourceRefs` must be an array (may be empty except for 'prompt' type)
 *  - `tags` must be an array of strings
 *  - `status` must be one of AUDIO_PHRASE_STATUSES
 *
 * Type-specific:
 *  - `phoneme` — `phonicsMetadata` is required
 *  - `prompt`  — `sourceRefs` must be non-empty
 *
 * PhonicsMetadata (when present):
 *  - `phonemeSymbol` must be a non-empty string
 *  - `isolationRequired` must be a boolean
 *  - `maxDurationMs` must be a positive integer
 *  - `allowLetterName` must be a boolean
 *  - `reviewRequired` must be a boolean
 *
 * Lifecycle:
 *  - `status === 'replaced'` requires `replacedBy` to be a valid AudioId
 *
 * Inventory-level:
 *  - No duplicate `id` values across all entries
 *  - `schemaVersion` must be a non-empty string
 *  - `updatedAt` must be a non-empty string
 *  - `phrases` must be a non-empty array
 */

import { isValidAudioId } from './audioIdValidator';
import {
  AUDIO_PHRASE_TYPES,
  AUDIO_PHRASE_STATUSES,
  AUDIO_RENDER_STRATEGIES,
  type AudioPhraseEntry,
  type AudioPhrasesInventory,
} from '../types/audioPhrases';

// ─── Result types ─────────────────────────────────────────────────────────────

/** Structured result for a single-entry validation. */
export interface AudioPhraseValidationResult {
  /** `true` when the entry passes all validation rules. */
  valid: boolean;
  /** List of human-readable error messages.  Empty when `valid` is `true`. */
  errors: string[];
}

/** Structured result for a full-inventory validation. */
export interface AudioPhrasesInventoryValidationResult {
  /** `true` when every entry in the inventory passes all validation rules. */
  valid: boolean;
  /** Top-level inventory errors (e.g. missing `schemaVersion`, duplicate IDs). */
  errors: string[];
  /**
   * Per-entry errors keyed by the entry's `id` (or by its array index when
   * the `id` field is missing or invalid).
   */
  entryErrors: Record<string, string[]>;
}

// ─── Pre-built sets for O(1) lookups ─────────────────────────────────────────

const VALID_TYPES = new Set<string>(AUDIO_PHRASE_TYPES);
const VALID_STATUSES = new Set<string>(AUDIO_PHRASE_STATUSES);
const VALID_STRATEGIES = new Set<string>(AUDIO_RENDER_STRATEGIES);
const VALID_SOURCE_REF_TYPES = new Set<string>(['activity', 'data-file', 'component']);

// ─── Single-entry validator ───────────────────────────────────────────────────

/**
 * Validates a single {@link AudioPhraseEntry} against the schema contract.
 *
 * Returns a structured result with all discovered errors so the caller can
 * surface the full set of problems in one pass rather than stopping at the
 * first failure.
 *
 * @example
 * const result = validateAudioPhraseEntry(entry);
 * if (!result.valid) {
 *   console.error(result.errors.join('\n'));
 * }
 */
export function validateAudioPhraseEntry(
  entry: unknown,
  entryLabel = 'entry',
): AudioPhraseValidationResult {
  const errors: string[] = [];

  if (entry === null || typeof entry !== 'object') {
    return { valid: false, errors: [`${entryLabel}: must be a non-null object`] };
  }

  const e = entry as Record<string, unknown>;

  // ── id ──────────────────────────────────────────────────────────────────────
  if (typeof e.id !== 'string' || !e.id) {
    errors.push(`${entryLabel}.id: must be a non-empty string`);
  } else if (!isValidAudioId(e.id)) {
    errors.push(
      `${entryLabel}.id: "${e.id}" is not a valid AudioId ` +
        `(must match pattern ^[a-z][a-z0-9-]*(\\.[a-z][a-z0-9-]*){1,2}$ with a reserved category)`,
    );
  }

  // ── type ─────────────────────────────────────────────────────────────────────
  if (typeof e.type !== 'string' || !VALID_TYPES.has(e.type)) {
    errors.push(
      `${entryLabel}.type: "${String(e.type)}" is not valid; ` +
        `must be one of: ${AUDIO_PHRASE_TYPES.join(', ')}`,
    );
  }

  // ── text ─────────────────────────────────────────────────────────────────────
  if (typeof e.text !== 'string' || !e.text.trim()) {
    errors.push(`${entryLabel}.text: must be a non-empty string`);
  }

  // ── voiceProfile ─────────────────────────────────────────────────────────────
  if (typeof e.voiceProfile !== 'string' || !e.voiceProfile.trim()) {
    errors.push(`${entryLabel}.voiceProfile: must be a non-empty string`);
  }

  // ── locale ───────────────────────────────────────────────────────────────────
  if (typeof e.locale !== 'string' || !e.locale.trim()) {
    errors.push(`${entryLabel}.locale: must be a non-empty string`);
  }

  // ── renderStrategy ───────────────────────────────────────────────────────────
  if (typeof e.renderStrategy !== 'string' || !VALID_STRATEGIES.has(e.renderStrategy)) {
    errors.push(
      `${entryLabel}.renderStrategy: "${String(e.renderStrategy)}" is not valid; ` +
        `must be one of: ${AUDIO_RENDER_STRATEGIES.join(', ')}`,
    );
  }

  // ── sourceRefs ───────────────────────────────────────────────────────────────
  if (!Array.isArray(e.sourceRefs)) {
    errors.push(`${entryLabel}.sourceRefs: must be an array`);
  } else {
    // type-specific: 'prompt' must have at least one sourceRef
    if (e.type === 'prompt' && e.sourceRefs.length === 0) {
      errors.push(
        `${entryLabel}.sourceRefs: must be non-empty for type "prompt"`,
      );
    }
    // Validate each sourceRef entry
    for (let i = 0; i < e.sourceRefs.length; i++) {
      const ref = e.sourceRefs[i] as Record<string, unknown>;
      if (ref === null || typeof ref !== 'object') {
        errors.push(`${entryLabel}.sourceRefs[${i}]: must be an object`);
        continue;
      }
      if (typeof ref.type !== 'string' || !VALID_SOURCE_REF_TYPES.has(ref.type)) {
        errors.push(
          `${entryLabel}.sourceRefs[${i}].type: "${String(ref.type)}" is not valid; ` +
            `must be one of: activity, data-file, component`,
        );
      }
      if (typeof ref.id !== 'string' || !ref.id.trim()) {
        errors.push(`${entryLabel}.sourceRefs[${i}].id: must be a non-empty string`);
      }
    }
  }

  // ── tags ──────────────────────────────────────────────────────────────────────
  if (!Array.isArray(e.tags)) {
    errors.push(`${entryLabel}.tags: must be an array`);
  } else {
    for (let i = 0; i < e.tags.length; i++) {
      if (typeof e.tags[i] !== 'string') {
        errors.push(`${entryLabel}.tags[${i}]: must be a string`);
      }
    }
  }

  // ── status ───────────────────────────────────────────────────────────────────
  if (typeof e.status !== 'string' || !VALID_STATUSES.has(e.status)) {
    errors.push(
      `${entryLabel}.status: "${String(e.status)}" is not valid; ` +
        `must be one of: ${AUDIO_PHRASE_STATUSES.join(', ')}`,
    );
  }

  // ── phonicsMetadata — required for 'phoneme' type ────────────────────────────
  if (e.type === 'phoneme') {
    if (e.phonicsMetadata === undefined || e.phonicsMetadata === null) {
      errors.push(
        `${entryLabel}.phonicsMetadata: required when type is "phoneme"`,
      );
    } else {
      errors.push(...validatePhonicsMetadata(e.phonicsMetadata, `${entryLabel}.phonicsMetadata`));
    }
  } else if (e.phonicsMetadata !== undefined && e.phonicsMetadata !== null) {
    // Optional for other types — still validate when present
    errors.push(...validatePhonicsMetadata(e.phonicsMetadata, `${entryLabel}.phonicsMetadata`));
  }

  // ── replacedBy — required when status === 'replaced' ─────────────────────────
  if (e.status === 'replaced') {
    if (typeof e.replacedBy !== 'string' || !e.replacedBy) {
      errors.push(
        `${entryLabel}.replacedBy: must be set to a valid AudioId when status is "replaced"`,
      );
    } else if (!isValidAudioId(e.replacedBy)) {
      errors.push(
        `${entryLabel}.replacedBy: "${e.replacedBy}" is not a valid AudioId`,
      );
    }
  }

  // ── notes — optional; must be string when present ────────────────────────────
  if (e.notes !== undefined && typeof e.notes !== 'string') {
    errors.push(`${entryLabel}.notes: must be a string when present`);
  }

  return { valid: errors.length === 0, errors };
}

// ─── PhonicsMetadata sub-validator ───────────────────────────────────────────

function validatePhonicsMetadata(meta: unknown, label: string): string[] {
  const errors: string[] = [];

  if (meta === null || typeof meta !== 'object') {
    return [`${label}: must be a non-null object`];
  }

  const m = meta as Record<string, unknown>;

  if (typeof m.phonemeSymbol !== 'string' || !m.phonemeSymbol.trim()) {
    errors.push(`${label}.phonemeSymbol: must be a non-empty string`);
  }

  if (typeof m.isolationRequired !== 'boolean') {
    errors.push(`${label}.isolationRequired: must be a boolean`);
  }

  if (typeof m.maxDurationMs !== 'number' || !Number.isInteger(m.maxDurationMs) || m.maxDurationMs <= 0) {
    errors.push(`${label}.maxDurationMs: must be a positive integer (milliseconds)`);
  }

  if (typeof m.allowLetterName !== 'boolean') {
    errors.push(`${label}.allowLetterName: must be a boolean`);
  }

  if (typeof m.reviewRequired !== 'boolean') {
    errors.push(`${label}.reviewRequired: must be a boolean`);
  }

  return errors;
}

// ─── Inventory-level validator ────────────────────────────────────────────────

/**
 * Validates a complete {@link AudioPhrasesInventory} object.
 *
 * Checks the root-level fields (`schemaVersion`, `updatedAt`, `phrases`),
 * validates every phrase entry individually, and reports duplicate IDs across
 * the full inventory.
 *
 * @example
 * import inventory from '../data/audio-phrases.json';
 * const result = validateAudioPhrasesInventory(inventory);
 * if (!result.valid) {
 *   console.error('Top-level errors:', result.errors);
 *   for (const [id, errs] of Object.entries(result.entryErrors)) {
 *     console.error(`Entry "${id}":`, errs);
 *   }
 * }
 */
export function validateAudioPhrasesInventory(
  inventory: unknown,
): AudioPhrasesInventoryValidationResult {
  const errors: string[] = [];
  const entryErrors: Record<string, string[]> = {};

  if (inventory === null || typeof inventory !== 'object') {
    return {
      valid: false,
      errors: ['inventory: must be a non-null object'],
      entryErrors,
    };
  }

  const inv = inventory as Record<string, unknown>;

  // ── schemaVersion ─────────────────────────────────────────────────────────────
  if (typeof inv.schemaVersion !== 'string' || !inv.schemaVersion.trim()) {
    errors.push('schemaVersion: must be a non-empty string');
  }

  // ── updatedAt ─────────────────────────────────────────────────────────────────
  if (typeof inv.updatedAt !== 'string' || !inv.updatedAt.trim()) {
    errors.push('updatedAt: must be a non-empty string');
  }

  // ── phrases ───────────────────────────────────────────────────────────────────
  if (!Array.isArray(inv.phrases)) {
    errors.push('phrases: must be an array');
    return { valid: false, errors, entryErrors };
  }

  if (inv.phrases.length === 0) {
    errors.push('phrases: must contain at least one entry');
  }

  // Validate each entry and collect duplicate IDs
  const seenIds = new Map<string, number>(); // id → first occurrence index

  for (let i = 0; i < inv.phrases.length; i++) {
    const phrase = inv.phrases[i] as Record<string, unknown>;
    const rawId = typeof phrase?.id === 'string' ? phrase.id : `[index ${i}]`;
    const label = `phrases[${i}] (id="${rawId}")`;

    const result = validateAudioPhraseEntry(phrase, label);
    if (!result.valid) {
      entryErrors[rawId] = result.errors;
    }

    // Duplicate ID detection
    if (typeof phrase?.id === 'string' && phrase.id) {
      if (seenIds.has(phrase.id)) {
        const firstIdx = seenIds.get(phrase.id)!;
        errors.push(
          `Duplicate id "${phrase.id}" at indices ${firstIdx} and ${i}`,
        );
      } else {
        seenIds.set(phrase.id, i);
      }
    }
  }

  const valid = errors.length === 0 && Object.keys(entryErrors).length === 0;
  return { valid, errors, entryErrors };
}
