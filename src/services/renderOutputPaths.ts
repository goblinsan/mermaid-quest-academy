/**
 * Deterministic Output Path Resolver  (issue #233 / Audio V5 v2)
 *
 * Derives deterministic output file paths for rendered audio assets.
 *
 * ─── PATH CONVENTION ──────────────────────────────────────────────────────────
 *
 * Every output file is placed under <outputDir> with a filename composed of:
 *
 *   {audioId}__{renderKey}.mp3
 *
 * where dots in audioId are replaced with underscores for filesystem safety.
 *
 * Examples:
 *   outputDir = public/audio
 *   audioId   = phoneme.letter.s
 *   renderKey = a3f2b1c4
 *   → public/audio/phoneme_letter_s__a3f2b1c4.mp3
 *
 * ─── GUARANTEES ───────────────────────────────────────────────────────────────
 *
 * - Same audioId + renderKey always produces the same path (no duplicates for
 *   unchanged assets).
 * - Different renderKeys for the same audioId produce different paths (old
 *   files are not overwritten automatically; clean-up is a separate concern).
 * - Paths are machine-resolvable from the project root.
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   import { resolveOutputPath } from './renderOutputPaths';
 *
 *   const resolved = resolveOutputPath(audioId, renderKey, outputDir, projectRoot);
 *   if (!resolved.exists) {
 *     // synthesise and write to resolved.absolutePath
 *   }
 */

import { existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { AudioId } from '../types/audioId';
import type { RenderKey, ResolvedOutputPath } from '../types/batchRenderer';

/** Audio file extension used for all rendered outputs. */
export const AUDIO_FILE_EXTENSION = '.mp3';

/** Separator used between the asset id stem and the render key. */
export const RENDER_KEY_SEPARATOR = '__';

// ─── Filename construction ─────────────────────────────────────────────────────

/**
 * Converts an AudioId to a filesystem-safe stem by replacing dots with
 * underscores.
 *
 * Example: `phoneme.letter.s` → `phoneme_letter_s`
 */
export function audioIdToFileStem(audioId: AudioId): string {
  return audioId.replace(/\./g, '_');
}

/**
 * Builds the filename for a rendered audio asset.
 *
 * Format: `{stem}__{renderKey}.mp3`
 *
 * @param audioId   The stable AudioId of the asset.
 * @param renderKey The deterministic render key for this render run.
 * @returns         Filename string, e.g. `phoneme_letter_s__a3f2b1c4.mp3`
 */
export function buildOutputFilename(audioId: AudioId, renderKey: RenderKey): string {
  const stem = audioIdToFileStem(audioId);
  return `${stem}${RENDER_KEY_SEPARATOR}${renderKey}${AUDIO_FILE_EXTENSION}`;
}

// ─── Path resolution ───────────────────────────────────────────────────────────

/**
 * Resolves the deterministic output path for a single render job.
 *
 * @param audioId     The AudioId of the asset.
 * @param renderKey   The computed render key for this job.
 * @param outputDir   Absolute path to the audio output directory.
 * @param projectRoot Absolute path to the project root (used for relative paths).
 * @returns           A {@link ResolvedOutputPath} with absolute/relative paths and
 *                    whether the file already exists.
 */
export function resolveOutputPath(
  audioId: AudioId,
  renderKey: RenderKey,
  outputDir: string,
  projectRoot: string,
): ResolvedOutputPath {
  const filename = buildOutputFilename(audioId, renderKey);
  const absolutePath = join(outputDir, filename);
  const relativePath = relative(projectRoot, absolutePath);
  const exists = existsSync(absolutePath);

  return { absolutePath, relativePath, exists };
}

// ─── Manifest path ────────────────────────────────────────────────────────────

/** Default filename for the render manifest. */
export const DEFAULT_MANIFEST_FILENAME = 'render-manifest.json';

/**
 * Returns the default path for the render manifest file.
 *
 * @param outputDir Absolute path to the audio output directory.
 * @returns         Absolute path to the manifest file.
 */
export function defaultManifestPath(outputDir: string): string {
  return join(outputDir, DEFAULT_MANIFEST_FILENAME);
}
