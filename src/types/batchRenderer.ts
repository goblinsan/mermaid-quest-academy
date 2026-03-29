/**
 * Batch TTS Rendering Pipeline — Type Definitions  (issue #229 / Audio V5 v2)
 *
 * Defines the data shapes used by the deterministic batch renderer that
 * converts extracted render jobs into audio files using the local TTS engine.
 *
 * ─── PIPELINE OVERVIEW ────────────────────────────────────────────────────────
 *
 *  1. Extract  — phraseExtractionEngine produces AudioRenderJob[]
 *  2. Key      — renderKeyGenerator derives a deterministic key per job
 *  3. Diff     — batchTtsRenderer compares keys against the render manifest
 *  4. Render   — ttsEngineAdapter synthesises audio for new/invalidated jobs
 *  5. Write    — renderOutputPaths determines the output file location
 *  6. Report   — BatchRenderResult captures generated/skipped/failed/stale
 */

import type { AudioId } from './audioId';
import type { AudioRenderJob } from './extraction';

// ─── Render mode (issue #230) ─────────────────────────────────────────────────

/**
 * The execution mode for a batch render run.
 *
 * | Mode            | Behaviour                                                |
 * |-----------------|----------------------------------------------------------|
 * | `full`          | Re-render every asset regardless of existing outputs     |
 * | `changed-only`  | Skip assets whose render key matches the saved manifest  |
 * | `validate`      | Run extraction and key generation; no files written      |
 */
export type RenderMode = 'full' | 'changed-only' | 'validate';

// ─── Render key (issue #231) ──────────────────────────────────────────────────

/**
 * The inputs that together determine the canonical render key for one job.
 *
 * When any of these inputs change the render key changes, invalidating the
 * cached output and triggering a re-render in `changed-only` mode.
 */
export interface RenderKeyInputs {
  /** Normalised TTS text (trimmed, whitespace-collapsed). */
  text: string;
  /** Voice profile identifier. */
  voiceProfile: string;
  /** BCP-47 locale string. */
  locale: string;
  /** Render strategy. */
  renderStrategy: string;
  /**
   * Optional IPA phoneme symbol from phonicsMetadata.
   * Included when present so that phonics-specific metadata changes
   * invalidate the render key.
   */
  phonemeSymbol?: string;
  /**
   * Whether isolation is required (from phonicsMetadata).
   * Included when phonicsMetadata is present.
   */
  isolationRequired?: boolean;
  /** Pipeline version string — bump this to force a global re-render. */
  pipelineVersion: string;
}

/**
 * A deterministic hex digest computed from {@link RenderKeyInputs}.
 *
 * Unchanged inputs always produce the same key.  Any change to a relevant
 * input produces a different key, invalidating the cached output.
 */
export type RenderKey = string & { readonly __brand: 'RenderKey' };

// ─── TTS engine adapter (issue #232) ──────────────────────────────────────────

/**
 * Classification of failures returned by the TTS engine adapter.
 *
 * Used to decide whether a failed job should be retried or abandoned.
 *
 * | Class            | Retryable | Description                               |
 * |------------------|-----------|-------------------------------------------|
 * | `engine-unavailable` | yes   | Engine process is not running             |
 * | `timeout`        | yes       | Engine did not respond within deadline    |
 * | `invalid-input`  | no        | Text or parameters rejected by engine     |
 * | `unsupported-voice` | no     | Voice profile not available in engine     |
 * | `write-failure`  | yes       | Output file could not be written to disk  |
 * | `validation-failure` | no    | Generated file failed post-render QA      |
 */
export type TtsFailureClass =
  | 'engine-unavailable'
  | 'timeout'
  | 'invalid-input'
  | 'unsupported-voice'
  | 'write-failure'
  | 'validation-failure';

/**
 * Structured error returned when the TTS engine adapter cannot produce output.
 */
export interface TtsRenderError {
  /** The AudioId of the job that failed. */
  audioId: AudioId;
  /** Failure classification — determines retry eligibility. */
  failureClass: TtsFailureClass;
  /** Human-readable description of what went wrong. */
  message: string;
  /**
   * Whether this failure class is retryable.
   * Derived automatically from `failureClass`; provided here for convenience.
   */
  retryable: boolean;
}

/**
 * Successful output from a single TTS render call.
 */
export interface TtsRenderOutput {
  /** The AudioId that was rendered. */
  audioId: AudioId;
  /** Absolute path to the audio file written to disk. */
  outputPath: string;
  /** Duration of the rendered clip in milliseconds (if measurable). */
  durationMs?: number;
}

// ─── Output path (issue #233) ─────────────────────────────────────────────────

/**
 * Resolved output path information for a single render job.
 *
 * Paths are deterministic: for the same `audioId` and `renderKey` the path
 * is always the same, ensuring no duplicate files for unchanged assets.
 */
export interface ResolvedOutputPath {
  /** Absolute path to the output audio file. */
  absolutePath: string;
  /**
   * Path relative to the project root, for human-readable reporting.
   * Example: `public/audio/phoneme.letter.s__a3f2b1c4.mp3`
   */
  relativePath: string;
  /**
   * Whether the file already exists on disk with the expected render key.
   * Used by the skip-logic in `changed-only` mode.
   */
  exists: boolean;
}

// ─── Render manifest (issue #234) ─────────────────────────────────────────────

/**
 * Persisted record for a single successfully-rendered asset.
 *
 * Stored in the render manifest file so that `changed-only` mode can skip
 * assets whose render key has not changed since the last run.
 */
export interface ManifestEntry {
  /** The AudioId of the rendered asset. */
  audioId: AudioId;
  /** The render key used to produce the current output file. */
  renderKey: RenderKey;
  /** ISO-8601 timestamp of the last successful render. */
  renderedAt: string;
  /** Path to the output audio file, relative to the project root. */
  outputPath: string;
}

/**
 * The full render manifest — a flat map of AudioId → ManifestEntry.
 *
 * Written to disk after every successful batch run so that the next run
 * can skip unchanged assets.
 */
export interface RenderManifest {
  /** Schema version for forward-compatibility. */
  schemaVersion: string;
  /** Pipeline version that produced this manifest. */
  pipelineVersion: string;
  /** ISO-8601 timestamp of the last manifest write. */
  updatedAt: string;
  /** Map of AudioId → last-known ManifestEntry. */
  entries: Record<string, ManifestEntry>;
}

// ─── Per-asset render outcome (issue #235) ────────────────────────────────────

/**
 * The outcome for a single asset after a batch render run.
 *
 * | Status      | Meaning                                                    |
 * |-------------|------------------------------------------------------------|
 * | `generated` | New audio file written to disk                             |
 * | `skipped`   | Asset unchanged; existing file reused (`changed-only` mode)|
 * | `failed`    | Render attempt failed; see `error`                         |
 * | `stale`     | Output file missing or corrupt; re-render recommended      |
 * | `blocked`   | Asset has status `blocked` in the inventory; not rendered  |
 */
export type AssetRenderStatus = 'generated' | 'skipped' | 'failed' | 'stale' | 'blocked';

/**
 * Report for a single asset after a batch render run.
 */
export interface AssetRenderReport {
  /** The AudioId of this asset. */
  audioId: AudioId;
  /** Outcome of the render attempt. */
  status: AssetRenderStatus;
  /**
   * Absolute path to the output file.
   * Present for `generated`, `skipped`, and `stale` statuses.
   */
  outputPath?: string;
  /**
   * Structured error, present when `status === 'failed'`.
   */
  error?: TtsRenderError;
  /** ISO-8601 timestamp of this outcome. */
  resolvedAt: string;
}

// ─── Batch render result (issue #235) ────────────────────────────────────────

/**
 * The full output of a single batch render run.
 *
 * Designed for human-readable CLI output and CI tooling.
 * Print with `formatBatchRenderResult()` in batchTtsRenderer.
 */
export interface BatchRenderResult {
  /** Render mode used for this run. */
  mode: RenderMode;
  /** Per-asset reports. */
  assets: AssetRenderReport[];
  /** Total number of assets processed. */
  total: number;
  /** Number of assets newly generated. */
  generated: number;
  /** Number of assets skipped (unchanged in changed-only mode). */
  skipped: number;
  /** Number of assets that failed to render. */
  failed: number;
  /** Number of assets that were stale (missing/corrupt output). */
  stale: number;
  /** Number of assets blocked in the inventory. */
  blocked: number;
  /** ISO-8601 timestamp of the run start. */
  startedAt: string;
  /** ISO-8601 timestamp of the run end. */
  completedAt: string;
  /** Whether the run as a whole succeeded (no hard failures). */
  success: boolean;
}

// ─── Batch render options ─────────────────────────────────────────────────────

/**
 * Options controlling a batch render run.
 */
export interface BatchRenderOptions {
  /** Execution mode. Defaults to `'changed-only'`. */
  mode: RenderMode;
  /** Root directory for audio output files. */
  outputDir: string;
  /** Path to the render manifest JSON file. */
  manifestPath: string;
  /** Pipeline version string used in render key derivation. */
  pipelineVersion: string;
  /**
   * Maximum number of consecutive retryable failures before the run aborts.
   * Defaults to 3.
   */
  maxRetries: number;
}

// ─── Render job with key (internal) ──────────────────────────────────────────

/**
 * An {@link AudioRenderJob} augmented with its computed render key.
 * Used internally by the batch renderer.
 */
export interface KeyedRenderJob {
  job: AudioRenderJob;
  renderKey: RenderKey;
}
