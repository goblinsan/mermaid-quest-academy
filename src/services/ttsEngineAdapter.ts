/**
 * Local TTS Engine Adapter  (issues #232, #236 / Audio V5 v2)
 *
 * Single entry point for submitting render jobs to the local TTS engine
 * and capturing structured outputs and failures.
 *
 * ─── ADAPTER DESIGN ───────────────────────────────────────────────────────────
 *
 * The adapter exposes one function — `renderWithTts` — that accepts a render
 * job and an output path, drives the local TTS engine, and returns either a
 * `TtsRenderOutput` (success) or a `TtsRenderError` (failure).
 *
 * This abstraction keeps the batch renderer decoupled from the concrete TTS
 * engine implementation so that the engine can be swapped or mocked in tests.
 *
 * ─── FAILURE CLASSIFICATION (issue #236) ──────────────────────────────────────
 *
 * Every failure is classified into one of six categories:
 *
 * | Class               | Retryable | Cause                                    |
 * |---------------------|-----------|------------------------------------------|
 * | engine-unavailable  | yes       | Engine process not running / not found   |
 * | timeout             | yes       | Engine did not respond within deadline   |
 * | invalid-input       | no        | Text or parameters rejected by engine    |
 * | unsupported-voice   | no        | Voice profile not installed in engine    |
 * | write-failure       | yes       | Cannot write output file to disk         |
 * | validation-failure  | no        | Generated file failed post-render QA     |
 *
 * Retryable failures are transient; the batch runner may retry them up to
 * `maxRetries` times.  Terminal failures abort immediately for that asset.
 *
 * ─── RETRY POLICY ─────────────────────────────────────────────────────────────
 *
 * The adapter itself does not retry — retries are orchestrated by the batch
 * renderer so that the retry budget is shared across all assets in a run.
 * Callers check `TtsRenderError.retryable` to decide whether to retry.
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   import { renderWithTts, isTtsRenderError } from './ttsEngineAdapter';
 *
 *   const result = await renderWithTts(job, '/absolute/path/to/output.mp3', options);
 *   if (isTtsRenderError(result)) {
 *     console.error(`[${result.failureClass}] ${result.message}`);
 *     if (result.retryable) { / schedule retry / }
 *   } else {
 *     console.log(`Rendered ${result.audioId} → ${result.outputPath}`);
 *   }
 */

import { execFile } from 'node:child_process';
import { existsSync, statSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { promisify } from 'node:util';
import type { AudioRenderJob } from '../types/extraction';
import type { TtsFailureClass, TtsRenderError, TtsRenderOutput } from '../types/batchRenderer';

const execFileAsync = promisify(execFile);

// ─── Failure classification helpers ───────────────────────────────────────────

/** Maps a failure class to its retryability. */
const RETRYABLE_CLASSES: Record<TtsFailureClass, boolean> = {
  'engine-unavailable': true,
  timeout: true,
  'invalid-input': false,
  'unsupported-voice': false,
  'write-failure': true,
  'validation-failure': false,
};

/**
 * Creates a structured {@link TtsRenderError} from its components.
 */
function makeTtsError(
  audioId: string,
  failureClass: TtsFailureClass,
  message: string,
): TtsRenderError {
  return {
    audioId: audioId as TtsRenderError['audioId'],
    failureClass,
    message,
    retryable: RETRYABLE_CLASSES[failureClass],
  };
}

/**
 * Type guard: returns `true` when the value is a {@link TtsRenderError}.
 */
export function isTtsRenderError(
  value: TtsRenderOutput | TtsRenderError,
): value is TtsRenderError {
  return 'failureClass' in value;
}

// ─── Adapter options ───────────────────────────────────────────────────────────

/**
 * Configuration for the local TTS engine adapter.
 */
export interface TtsEngineAdapterOptions {
  /**
   * Absolute path to the TTS engine executable.
   * Defaults to `'say'` (macOS built-in) so the adapter works out-of-the-box
   * on developer machines for local testing.
   */
  enginePath?: string;
  /**
   * Maximum time in milliseconds to wait for the engine to respond.
   * Defaults to 30 000 ms (30 seconds).
   */
  timeoutMs?: number;
  /**
   * When `true`, the adapter writes a zero-byte placeholder file instead of
   * invoking the real TTS engine.  Useful for dry-run and CI smoke tests.
   */
  dryRun?: boolean;
}

// ─── Output validation ─────────────────────────────────────────────────────────

/**
 * Minimum expected file size in bytes for a valid audio output.
 * Files smaller than this threshold are considered corrupt.
 */
const MIN_VALID_FILE_BYTES = 100;

/**
 * Validates a rendered output file.
 *
 * Returns `null` on success, or a failure message on error.
 */
function validateOutputFile(outputPath: string): string | null {
  if (!existsSync(outputPath)) {
    return `Output file not found after render: ${outputPath}`;
  }
  const stats = statSync(outputPath);
  if (stats.size < MIN_VALID_FILE_BYTES) {
    return `Output file is too small (${stats.size} bytes < ${MIN_VALID_FILE_BYTES}): ${outputPath}`;
  }
  return null;
}

// ─── Directory creation ────────────────────────────────────────────────────────

/**
 * Ensures the parent directory of `filePath` exists, creating it recursively
 * if necessary.  Returns `null` on success or an error message on failure.
 */
function ensureOutputDirectory(filePath: string): string | null {
  const dir = dirname(filePath);
  try {
    mkdirSync(dir, { recursive: true });
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Could not create output directory "${dir}": ${msg}`;
  }
}

// ─── Main adapter function ─────────────────────────────────────────────────────

/**
 * Renders a single TTS job to an audio file using the local TTS engine.
 *
 * @param job        The render job (text, voice profile, locale, …).
 * @param outputPath Absolute path where the audio file should be written.
 * @param options    Adapter configuration.
 * @returns          A `TtsRenderOutput` on success or a `TtsRenderError` on failure.
 */
export async function renderWithTts(
  job: AudioRenderJob,
  outputPath: string,
  options: TtsEngineAdapterOptions = {},
): Promise<TtsRenderOutput | TtsRenderError> {
  const { enginePath = 'say', timeoutMs = 30_000, dryRun = false } = options;

  // ── Ensure output directory exists ──────────────────────────────────────────
  const dirError = ensureOutputDirectory(outputPath);
  if (dirError !== null) {
    return makeTtsError(job.id, 'write-failure', dirError);
  }

  // ── Dry-run mode (no real TTS invocation) ────────────────────────────────────
  if (dryRun) {
    const { writeFileSync } = await import('node:fs');
    try {
      writeFileSync(outputPath, Buffer.alloc(MIN_VALID_FILE_BYTES + 1));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return makeTtsError(job.id, 'write-failure', `Dry-run write failed: ${msg}`);
    }
    return { audioId: job.id, outputPath };
  }

  // ── Build engine arguments ────────────────────────────────────────────────────
  // The adapter uses the macOS `say` command as the default local TTS engine.
  // The interface is intentionally thin: text → audio file.
  // Real deployments should replace `enginePath` with their TTS engine binary
  // and adjust the argument list accordingly.
  const args: string[] = [
    '--output-file',
    outputPath,
    '--voice',
    job.voiceProfile,
    '--',
    job.text,
  ];

  // ── Invoke TTS engine ────────────────────────────────────────────────────────
  try {
    await execFileAsync(enginePath, args, { timeout: timeoutMs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Classify the error
    let failureClass: TtsFailureClass;
    if (msg.includes('ETIMEDOUT') || msg.includes('killed') || msg.includes('signal')) {
      failureClass = 'timeout';
    } else if (msg.includes('ENOENT') || msg.includes('not found')) {
      failureClass = 'engine-unavailable';
    } else if (
      msg.includes('invalid') ||
      msg.includes('unsupported') ||
      msg.includes('bad input')
    ) {
      failureClass = 'invalid-input';
    } else if (msg.includes('voice') || msg.includes('Voice')) {
      failureClass = 'unsupported-voice';
    } else {
      // Default: treat unknown errors as transient engine unavailability
      failureClass = 'engine-unavailable';
    }

    return makeTtsError(job.id, failureClass, msg);
  }

  // ── Validate output file ─────────────────────────────────────────────────────
  const validationError = validateOutputFile(outputPath);
  if (validationError !== null) {
    return makeTtsError(job.id, 'validation-failure', validationError);
  }

  return { audioId: job.id, outputPath };
}

// ─── Failure classification export ────────────────────────────────────────────

/**
 * Returns `true` for failure classes that are safe to retry.
 *
 * Terminal failures (invalid-input, unsupported-voice, validation-failure)
 * will not succeed on retry and should be reported immediately.
 */
export function isRetryableFailure(failureClass: TtsFailureClass): boolean {
  return RETRYABLE_CLASSES[failureClass];
}
