/**
 * Deterministic Render Key Generator  (issue #231 / Audio V5 v2)
 *
 * Computes a stable, deterministic render key for each TTS render job.
 * The key is derived from the inputs that affect the rendered audio:
 * normalised text, voice profile, locale, render strategy, optional phonics
 * metadata, and the current pipeline version.
 *
 * ─── KEY STABILITY GUARANTEE ──────────────────────────────────────────────────
 *
 * - Unchanged inputs produce the same key across runs and machines.
 * - Any change to a relevant input produces a different key, invalidating the
 *   cached output and triggering a re-render in `changed-only` mode.
 * - The pipeline version can be bumped to force a global re-render even when
 *   no per-asset inputs have changed (e.g. after a TTS engine upgrade).
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   import { computeRenderKey, buildRenderKeyInputs } from './renderKeyGenerator';
 *   import type { AudioRenderJob } from '../types/extraction';
 *
 *   const inputs = buildRenderKeyInputs(job, pipelineVersion, phonicsMetadata);
 *   const key = computeRenderKey(inputs);
 */

import type { AudioRenderJob } from '../types/extraction';
import type { AudioPhraseEntry } from '../types/audioPhrases';
import type { RenderKey, RenderKeyInputs } from '../types/batchRenderer';

/** Current pipeline version.  Bump to force a global re-render. */
export const PIPELINE_VERSION = '1.0.0';

// ─── Text normalisation ───────────────────────────────────────────────────────

/**
 * Normalises TTS text for use in render key derivation.
 *
 * Normalisation rules:
 *  - Trim leading and trailing whitespace
 *  - Collapse internal whitespace runs to a single space
 *  - Convert to lowercase for case-insensitive comparison
 */
export function normaliseText(text: string): string {
  return text.trim().replace(/\s+/g, ' ').toLowerCase();
}

// ─── Render key inputs builder ────────────────────────────────────────────────

/**
 * Constructs a {@link RenderKeyInputs} object from a render job and its
 * optional inventory entry (for phonics metadata).
 *
 * @param job             The render job from the extraction engine.
 * @param pipelineVersion The current pipeline version string.
 * @param inventoryEntry  Optional inventory entry to extract phonicsMetadata.
 */
export function buildRenderKeyInputs(
  job: AudioRenderJob,
  pipelineVersion: string,
  inventoryEntry?: Pick<AudioPhraseEntry, 'phonicsMetadata'>,
): RenderKeyInputs {
  const inputs: RenderKeyInputs = {
    text: normaliseText(job.text),
    voiceProfile: job.voiceProfile,
    locale: job.locale,
    renderStrategy: job.renderStrategy,
    pipelineVersion,
  };

  const meta = inventoryEntry?.phonicsMetadata;
  if (meta !== undefined) {
    inputs.phonemeSymbol = meta.phonemeSymbol;
    inputs.isolationRequired = meta.isolationRequired;
  }

  return inputs;
}

// ─── Deterministic digest ─────────────────────────────────────────────────────

/**
 * Serialises {@link RenderKeyInputs} to a stable JSON string.
 *
 * Keys are sorted to ensure that insertion order does not affect the digest.
 */
function serialiseInputs(inputs: RenderKeyInputs): string {
  const sorted: Record<string, unknown> = {};
  for (const key of (Object.keys(inputs) as (keyof RenderKeyInputs)[]).sort()) {
    const value = inputs[key];
    if (value !== undefined) {
      sorted[key] = value;
    }
  }
  return JSON.stringify(sorted);
}

/**
 * Computes a simple deterministic hash of a string.
 *
 * Uses the djb2 algorithm, producing a 32-bit unsigned integer rendered as
 * an 8-character lowercase hex string.  This is not a cryptographic hash —
 * it is used only as a stable cache key to detect input changes.
 *
 * djb2: hash = hash * 33 ^ charCode  (initial value 5381)
 */
function djb2Hash(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
    hash = hash >>> 0; // keep as 32-bit unsigned
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Computes the deterministic render key for the given inputs.
 *
 * The key is an 8-character hex string derived from a stable serialisation
 * of all relevant inputs via the djb2 hash algorithm.
 *
 * @param inputs  The render key inputs.
 * @returns       A {@link RenderKey} hex string.
 */
export function computeRenderKey(inputs: RenderKeyInputs): RenderKey {
  const serialised = serialiseInputs(inputs);
  return djb2Hash(serialised) as RenderKey;
}

// ─── Convenience entry point ──────────────────────────────────────────────────

/**
 * Convenience function that builds inputs and computes a render key in one call.
 *
 * @param job             The render job from the extraction engine.
 * @param pipelineVersion Pipeline version string (defaults to {@link PIPELINE_VERSION}).
 * @param inventoryEntry  Optional inventory entry for phonics metadata.
 * @returns               A deterministic {@link RenderKey}.
 */
export function getRenderKey(
  job: AudioRenderJob,
  pipelineVersion: string = PIPELINE_VERSION,
  inventoryEntry?: Pick<AudioPhraseEntry, 'phonicsMetadata'>,
): RenderKey {
  const inputs = buildRenderKeyInputs(job, pipelineVersion, inventoryEntry);
  return computeRenderKey(inputs);
}
