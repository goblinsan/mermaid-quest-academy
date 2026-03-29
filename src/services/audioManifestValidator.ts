/**
 * Audio Manifest Validator  (issues #242, #243 / Audio V5 v2)
 *
 * Validates an `AudioManifest` for completeness, correctness, and freshness
 * against the `AudioPhrasesInventory`.
 *
 * ─── VALIDATION CHECKS ────────────────────────────────────────────────────────
 *
 * 1. Completeness (#242)
 *    Every `active` inventory entry must have a corresponding manifest entry.
 *    Missing required assets are hard errors that should fail the build.
 *
 * 2. Stale entries (#242)
 *    No manifest entry should point to a file path that does not exist on disk.
 *    Stale entries are reported so the pipeline can re-render the missing file.
 *
 * 3. Orphaned entries (#243)
 *    Manifest entries whose AudioId is not present in the inventory, or whose
 *    inventory entry has a lifecycle status of `deprecated`, `replaced`, or
 *    `blocked`, are considered orphaned and should be removed.
 *
 * ─── SEVERITY LEVELS ─────────────────────────────────────────────────────────
 *
 *  Errors   — Block the build / release. Missing required assets.
 *  Warnings — Should be reviewed, but do not block. Orphaned / stale entries.
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   import { validateManifest } from './audioManifestValidator';
 *
 *   const result = validateManifest(audioManifest, inventory, {
 *     checkFileExistence: true,
 *     projectRoot: process.cwd(),
 *   });
 *
 *   if (!result.valid) {
 *     console.error(result.errors.join('\n'));
 *     process.exit(1);
 *   }
 *   if (result.warnings.length > 0) {
 *     console.warn(result.warnings.join('\n'));
 *   }
 */

import { existsSync } from 'node:fs';
import { join, isAbsolute } from 'node:path';
import type { AudioManifest } from '../types/audioManifest';
import type { AudioPhrasesInventory } from '../types/audioPhrases';

// ─── Result type ──────────────────────────────────────────────────────────────

/**
 * The structured result of a manifest validation run.
 */
export interface ManifestValidationResult {
  /**
   * Whether the manifest passed all validation checks.
   *
   * `false` when any hard errors exist (missing required assets or missing
   * manifest file paths when `checkFileExistence` is enabled).
   */
  valid: boolean;

  /**
   * AudioIds present in the inventory with `status: 'active'` but absent
   * from the manifest.  Each missing ID means the TTS pipeline has not yet
   * rendered the asset (or the render failed).
   *
   * These are hard errors — the build should fail when this array is non-empty.
   */
  missing: string[];

  /**
   * AudioIds present in the manifest but considered orphaned:
   *  - No matching entry in the inventory, OR
   *  - Inventory entry has status `deprecated`, `replaced`, or `blocked`.
   *
   * Orphaned entries waste storage and can confuse the frontend cache.
   * They are reported as warnings (not errors) to support gradual cleanup.
   */
  orphaned: string[];

  /**
   * AudioIds whose manifest `filePath` does not exist on disk.
   *
   * Only populated when `checkFileExistence` is `true` in the options.
   * Stale entries indicate that audio files were deleted or moved without
   * updating the manifest.  The pipeline should re-render these assets.
   *
   * These are hard errors when `checkFileExistence` is enabled.
   */
  stale: string[];

  /**
   * Human-readable error messages that should block the build / release.
   */
  errors: string[];

  /**
   * Human-readable warning messages that should be reviewed but do not block.
   */
  warnings: string[];
}

// ─── Validator options ─────────────────────────────────────────────────────────

/**
 * Options for `validateManifest`.
 */
export interface ManifestValidationOptions {
  /**
   * When `true`, the validator checks that every `filePath` in the manifest
   * actually exists on disk under `projectRoot`.
   *
   * Defaults to `false` so that the validator can be run in environments
   * without access to the audio file tree (e.g. CI unit tests).
   */
  checkFileExistence?: boolean;

  /**
   * Absolute path to the project root.
   *
   * Required when `checkFileExistence` is `true`.  Manifest `filePath`
   * values are resolved relative to this directory.
   */
  projectRoot?: string;
}

// ─── Completeness check (issue #242) ──────────────────────────────────────────

/**
 * Checks that every `active` inventory entry has a corresponding manifest entry.
 *
 * Returns the list of AudioIds that are active in the inventory but absent
 * from the manifest.
 *
 * @param manifest   The audio manifest to validate.
 * @param inventory  The source-of-truth inventory.
 * @returns          Array of missing AudioId strings (empty = all present).
 */
export function validateManifestCompleteness(
  manifest: AudioManifest,
  inventory: AudioPhrasesInventory,
): string[] {
  const missing: string[] = [];

  for (const phrase of inventory.phrases) {
    if (phrase.status === 'active' && !(phrase.id in manifest.entries)) {
      missing.push(phrase.id);
    }
  }

  return missing;
}

// ─── Orphan detection (issue #243) ────────────────────────────────────────────

/**
 * Detects manifest entries that are orphaned — i.e. no longer backed by a
 * valid, active inventory entry.
 *
 * An entry is orphaned when:
 *  - Its AudioId is not present in the inventory at all, OR
 *  - The matching inventory entry has status `deprecated`, `replaced`, or
 *    `blocked` (none of which should appear in the runtime manifest).
 *
 * @param manifest   The audio manifest to inspect.
 * @param inventory  The source-of-truth inventory.
 * @returns          Array of orphaned AudioId strings (empty = none).
 */
export function detectOrphanedEntries(
  manifest: AudioManifest,
  inventory: AudioPhrasesInventory,
): string[] {
  const inventoryIndex = new Map(inventory.phrases.map((e) => [e.id, e]));
  const orphaned: string[] = [];

  for (const id of Object.keys(manifest.entries)) {
    const inventoryEntry = inventoryIndex.get(id);

    if (!inventoryEntry) {
      // Not in inventory at all
      orphaned.push(id);
      continue;
    }

    if (
      inventoryEntry.status === 'deprecated' ||
      inventoryEntry.status === 'replaced' ||
      inventoryEntry.status === 'blocked'
    ) {
      // Inventory entry is no longer active
      orphaned.push(id);
    }
  }

  return orphaned;
}

// ─── Stale entry detection (issue #243) ───────────────────────────────────────

/**
 * Detects manifest entries whose `filePath` does not exist on disk.
 *
 * Stale entries occur when audio files are deleted or moved without
 * regenerating the manifest.  The pipeline should re-render these assets.
 *
 * @param manifest     The audio manifest to inspect.
 * @param projectRoot  Absolute path to the project root used to resolve
 *                     relative `filePath` values.
 * @returns            Array of stale AudioId strings (empty = all files present).
 */
export function detectStaleEntries(manifest: AudioManifest, projectRoot: string): string[] {
  const stale: string[] = [];

  for (const [id, entry] of Object.entries(manifest.entries)) {
    const absolutePath = isAbsolute(entry.filePath)
      ? entry.filePath
      : join(projectRoot, entry.filePath);

    if (!existsSync(absolutePath)) {
      stale.push(id);
    }
  }

  return stale;
}

// ─── Combined validator ────────────────────────────────────────────────────────

/**
 * Runs the full manifest validation suite and returns a structured result.
 *
 * Checks performed:
 *  1. Completeness — all `active` inventory entries have manifest entries
 *  2. Orphaned entries — manifest entries not backed by active inventory entries
 *  3. Stale entries — manifest file paths that do not exist on disk
 *     (only when `options.checkFileExistence` is `true`)
 *
 * @param manifest   The audio manifest to validate.
 * @param inventory  The source-of-truth inventory.
 * @param options    Validation options (file existence check, project root).
 * @returns          A structured `ManifestValidationResult`.
 */
export function validateManifest(
  manifest: AudioManifest,
  inventory: AudioPhrasesInventory,
  options: ManifestValidationOptions = {},
): ManifestValidationResult {
  const { checkFileExistence = false, projectRoot = process.cwd() } = options;

  const missing = validateManifestCompleteness(manifest, inventory);
  const orphaned = detectOrphanedEntries(manifest, inventory);
  const stale = checkFileExistence ? detectStaleEntries(manifest, projectRoot) : [];

  const errors: string[] = [];
  const warnings: string[] = [];

  // Missing assets are hard errors (#242: build fails on missing required assets)
  for (const id of missing) {
    errors.push(`Missing manifest entry for active inventory asset: ${id}`);
  }

  // Stale file paths are hard errors when file existence checking is enabled
  for (const id of stale) {
    errors.push(
      `Manifest entry for "${id}" points to a missing file: ${manifest.entries[id].filePath}`,
    );
  }

  // Orphaned entries are warnings — safe to clean up but not blocking
  for (const id of orphaned) {
    warnings.push(`Orphaned manifest entry (not in active inventory): ${id}`);
  }

  const valid = errors.length === 0;

  return { valid, missing, orphaned, stale, errors, warnings };
}
