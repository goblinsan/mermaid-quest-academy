/**
 * Phrase Extraction Engine — Type Definitions  (issue #221 / Audio V5)
 *
 * Defines the data shapes used by the extraction engine that scans content,
 * resolves audio IDs against the inventory, and produces deterministic render
 * jobs for the TTS pipeline.
 *
 * ─── PIPELINE OVERVIEW ───────────────────────────────────────────────────────
 *
 *  1. Scan   — collect every AudioId reference from content, tagging each
 *              with its source file, JSON path, and required/optional status.
 *  2. Detect — flag any ttsText field that embeds raw text without a
 *              corresponding AudioId (raw-text violation).
 *  3. Resolve — look up every collected AudioId in the audio-phrases.json
 *               inventory.  Unresolved IDs produce hard errors.
 *  4. Generate — convert resolved inventory entries to render jobs, one job
 *                per unique AudioId.
 *  5. Deduplicate — merge source metadata across repeated references so that
 *                   each ID produces exactly one render job.
 *  6. Report — emit the ExtractionDiagnostics summary.
 */

import type { AudioId } from './audioId';
import type { AudioRenderStrategy } from './audioPhrases';

// ─── Audio reference (scan output) ───────────────────────────────────────────

/**
 * A single AudioId reference found in a content file.
 *
 * Produced by the content scanner for every AudioId it discovers.  Multiple
 * references to the same AudioId from different sources are merged into one
 * render job by the deduplication step.
 */
export interface AudioReference {
  /** The AudioId that was found. */
  audioId: AudioId;

  /**
   * Path to the source file relative to `src/`, e.g. `'data/phonicsAudioIds.ts'`.
   */
  sourceFile: string;

  /**
   * Dot-notation path within the file that locates the reference,
   * e.g. `'phoneme.letter.s'` or `'activities[3].prompt.audioId'`.
   */
  sourcePath: string;

  /**
   * Whether this reference is required for the application to function.
   *
   * - `true`  — missing or unrenderable audio causes a hard error.
   * - `false` — missing audio is tolerated; a warning is emitted instead.
   *
   * See `AUDIO_REFERENCE_RULES` in phraseExtractionEngine for the per-variant
   * classification rules.
   */
  required: boolean;
}

// ─── Raw-text violation ───────────────────────────────────────────────────────

/**
 * Represents a content location where raw TTS text is embedded instead of
 * being referenced through a stable AudioId.
 *
 * The extraction engine fails the pipeline when violations are detected
 * (issue #227), because all audio must flow through the inventory to maintain
 * a deterministic render history.
 */
export interface RawTextViolation {
  /**
   * The raw TTS text found in the content field.
   * Shown in error messages so authors know what to convert to an AudioId.
   */
  text: string;

  /**
   * Path to the source file, e.g. `'data/readingActivities.json'`.
   */
  sourceFile: string;

  /**
   * Dot-notation path within the file, e.g. `'activities[0].prompt.ttsText'`.
   */
  sourcePath: string;

  /**
   * Whether this field is required to have a proper AudioId reference.
   * Required violations are hard errors; optional violations are warnings.
   */
  required: boolean;
}

// ─── Render job ──────────────────────────────────────────────────────────────

/**
 * A single, deterministic render instruction for the TTS pipeline.
 *
 * One render job is emitted per unique AudioId.  The output list is sorted
 * alphabetically by `id` so that it is stable across extraction runs
 * (issue #225).
 *
 * Fields are derived from the corresponding `AudioPhraseEntry` in the
 * inventory, not from the content that referenced the ID — this ensures that
 * TTS text, voice profile, and locale are always canonical.
 */
export interface AudioRenderJob {
  /** The stable semantic AudioId for this clip. */
  id: AudioId;

  /** The canonical TTS text to synthesise (from the inventory entry). */
  text: string;

  /** Voice profile identifier (from the inventory entry). */
  voiceProfile: string;

  /** BCP-47 locale string (from the inventory entry). */
  locale: string;

  /** How this asset should be rendered (from the inventory entry). */
  renderStrategy: AudioRenderStrategy;

  /**
   * All content locations that reference this AudioId.
   *
   * Preserved after deduplication so that the pipeline can trace which
   * activities and components depend on each render (issue #226).
   */
  sources: Array<{
    /** Source file path relative to `src/`. */
    file: string;
    /** Dot-notation path within the file. */
    path: string;
    /** Whether this particular reference is required. */
    required: boolean;
  }>;
}

// ─── Diagnostics ─────────────────────────────────────────────────────────────

/**
 * Summary report produced at the end of an extraction run (issue #228).
 *
 * Designed for human-readable output and CI tooling.  Print with
 * `formatExtractionDiagnostics()` in phraseExtractionEngine.
 */
export interface ExtractionDiagnostics {
  /**
   * AudioIds that were found in content and successfully resolved against the
   * inventory with status `'active'` or `'experimental'`.
   */
  resolved: AudioId[];

  /**
   * AudioIds found in content that have no matching entry in the inventory.
   * Each missing required ID produces a hard error in `ExtractionResult.errors`.
   */
  missing: AudioId[];

  /**
   * AudioIds that were referenced from more than one content location before
   * deduplication.  Informational only — duplicates produce a single render job.
   */
  duplicates: AudioId[];

  /**
   * AudioIds classified as optional (i.e. all their references are optional).
   * These are a subset of `resolved`.
   */
  optional: AudioId[];

  /**
   * Content locations where raw TTS text was found instead of an AudioId.
   * Required violations are surfaced in `ExtractionResult.errors`.
   */
  rawTextViolations: RawTextViolation[];

  /**
   * AudioIds found in the inventory (status `'active'`) but not referenced
   * from any scanned content.  These are candidates for removal.
   */
  unreferenced: AudioId[];
}

// ─── Extraction result ────────────────────────────────────────────────────────

/**
 * The full output of a single extraction run.
 *
 * `errors` must be empty for a successful pipeline run.  When non-empty,
 * the TTS pipeline should refuse to proceed.
 */
export interface ExtractionResult {
  /**
   * The deduplicated, deterministically-ordered list of TTS render jobs.
   * Empty when there are hard errors (to prevent partial renders).
   */
  renderJobs: AudioRenderJob[];

  /** Full diagnostic breakdown of the extraction run. */
  diagnostics: ExtractionDiagnostics;

  /**
   * Human-readable error messages that prevent the pipeline from proceeding.
   *
   * Populated by:
   *  - Unresolved required AudioId references (#224)
   *  - Required raw-text violations (#227)
   */
  errors: string[];

  /**
   * Human-readable warnings that do not block the pipeline but should be
   * reviewed by content authors.
   *
   * Populated by:
   *  - Unresolved optional AudioId references
   *  - Optional raw-text violations
   *  - Unreferenced inventory entries
   */
  warnings: string[];
}

// ─── Engine input ─────────────────────────────────────────────────────────────

/**
 * All content sources that the extraction engine scans in one run.
 *
 * Keeping inputs explicit (rather than reading from the filesystem) allows
 * the engine to be tested deterministically with controlled fixtures.
 */
export interface ExtractionInput {
  /**
   * The full audio-phrases.json inventory.
   * Must conform to the `AudioPhrasesInventory` schema.
   */
  inventory: import('./audioPhrases').AudioPhrasesInventory;

  /**
   * The `PHONICS_AUDIO_ID_MAP` record from phonicsAudioIds.ts.
   * Each key is a required AudioId reference; the value is the expected TTS text.
   */
  audioIdMap: Record<string, string>;

  /**
   * The reading/phonics activities from readingActivities.json.
   * Scanned for inline AudioId fields and raw-text violations.
   */
  activities: import('./activity').PhonicsActivityConfig[];
}
