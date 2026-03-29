/**
 * Audio Manifest Builder  (issues #240, #241 / Audio V5 v2)
 *
 * Converts the output of a successful batch TTS render run into a
 * runtime-facing `AudioManifest` that the frontend can consume.
 *
 * ─── PIPELINE POSITION ────────────────────────────────────────────────────────
 *
 *  batchTtsRenderer  →  renderManifest (RenderManifest)
 *                    →  audioManifestBuilder  →  AudioManifest  (this module)
 *                    →  saved to public/audio/audio-manifest.json
 *
 * ─── WHAT GETS INCLUDED (issue #240) ─────────────────────────────────────────
 *
 *  Only assets with a valid `ManifestEntry` in the render manifest are
 *  included in the audio manifest.  Assets with the following statuses in the
 *  batch render result are excluded:
 *
 *  | Excluded status | Reason                                                 |
 *  |-----------------|--------------------------------------------------------|
 *  | `failed`        | No audio file was written; nothing to serve            |
 *  | `blocked`       | Intentionally withheld from rendering                  |
 *  | `stale`         | Output file missing; consumer would get a 404          |
 *
 *  Assets with status `generated` or `skipped` are included when a
 *  corresponding entry exists in the render manifest with a valid outputPath.
 *
 * ─── DURATION (issue #241) ────────────────────────────────────────────────────
 *
 *  Duration is included in every entry when available.  Callers may supply a
 *  `durationMap` (Record<string, number>) to map AudioIds to measured durations
 *  (e.g. from post-render file analysis).  When no duration is available the
 *  field is `null` — this is valid and the frontend must handle it gracefully.
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   import { buildAudioManifest, saveAudioManifest } from './audioManifestBuilder';
 *
 *   const audioManifest = buildAudioManifest(renderManifest, inventory, {
 *     pipelineVersion: PIPELINE_VERSION,
 *     durationMap: measuredDurations,
 *   });
 *   saveAudioManifest(audioManifest, 'public/audio/audio-manifest.json');
 */

import { writeFileSync } from 'node:fs';
import type { AudioManifest, AudioManifestEntry, PreloadPriority } from '../types/audioManifest';
import {
  AUDIO_MANIFEST_SCHEMA_VERSION,
  PRELOAD_PRIORITY_BY_TYPE,
} from '../types/audioManifest';
import type { AudioPhraseType, AudioPhrasesInventory } from '../types/audioPhrases';
import type { AudioId } from '../types/audioId';
import type { RenderManifest } from '../types/batchRenderer';

// ─── Build options ────────────────────────────────────────────────────────────

/**
 * Options for `buildAudioManifest`.
 */
export interface AudioManifestBuildOptions {
  /**
   * Pipeline version to embed in the manifest.
   * Defaults to the `pipelineVersion` stored in the render manifest.
   */
  pipelineVersion?: string;

  /**
   * Map of AudioId → measured duration in milliseconds.
   *
   * Provide this when post-render duration analysis is available (e.g. from
   * probing the output files with an audio decoder).  AudioIds absent from
   * the map will have `durationMs: null` in the manifest entry.
   */
  durationMap?: Record<string, number>;

  /**
   * ISO-8601 timestamp to use as `generatedAt` on the manifest root.
   * Defaults to `new Date().toISOString()`.
   */
  generatedAt?: string;
}

// ─── Single-entry builder ─────────────────────────────────────────────────────

/**
 * Builds a single `AudioManifestEntry` from render manifest data and the
 * corresponding inventory entry.
 *
 * @param audioId        The AudioId for this asset.
 * @param filePath       Relative file path to the audio file (from render manifest).
 * @param renderKey      Render key hash for this asset (from render manifest).
 * @param renderedAt     ISO-8601 timestamp of the last successful render.
 * @param inventoryEntry The matching inventory entry for type/voice/locale/tags.
 * @param durationMs     Optional measured duration in milliseconds.
 * @returns              A fully-populated `AudioManifestEntry`.
 */
export function buildManifestEntry(
  audioId: AudioId,
  filePath: string,
  renderKey: string,
  renderedAt: string,
  inventoryEntry: {
    type: AudioPhraseType;
    voiceProfile: string;
    locale: string;
    tags: string[];
  },
  durationMs?: number,
): AudioManifestEntry {
  const preloadPriority: PreloadPriority = PRELOAD_PRIORITY_BY_TYPE[inventoryEntry.type];

  return {
    id: audioId,
    filePath,
    hash: renderKey,
    durationMs: durationMs !== undefined ? durationMs : null,
    type: inventoryEntry.type,
    voiceProfile: inventoryEntry.voiceProfile,
    locale: inventoryEntry.locale,
    preloadPriority,
    tags: [...inventoryEntry.tags],
    generatedAt: renderedAt,
  };
}

// ─── Manifest builder ─────────────────────────────────────────────────────────

/**
 * Builds a complete `AudioManifest` from the render pipeline outputs.
 *
 * Combines the `RenderManifest` (which tracks rendered file paths and render
 * keys) with the `AudioPhrasesInventory` (which carries type, voice profile,
 * locale, and tags) to produce the runtime-facing manifest.
 *
 * Only assets present in `renderManifest.entries` are included — this
 * automatically excludes failed, blocked, and stale assets since those do not
 * have entries written to the render manifest (issue #240).
 *
 * @param renderManifest The render manifest written by `batchTtsRenderer`.
 * @param inventory      The audio phrase inventory (`audio-phrases.json`).
 * @param options        Optional overrides (pipelineVersion, durationMap, generatedAt).
 * @returns              A fully-populated `AudioManifest`.
 */
export function buildAudioManifest(
  renderManifest: RenderManifest,
  inventory: AudioPhrasesInventory,
  options: AudioManifestBuildOptions = {},
): AudioManifest {
  const {
    pipelineVersion = renderManifest.pipelineVersion,
    durationMap = {},
    generatedAt = new Date().toISOString(),
  } = options;

  // Build a fast lookup from inventory
  const inventoryIndex = new Map(inventory.phrases.map((e) => [e.id, e]));

  const entries: Record<string, AudioManifestEntry> = {};

  for (const [id, renderEntry] of Object.entries(renderManifest.entries)) {
    const inventoryEntry = inventoryIndex.get(id);

    // Skip assets not present in inventory (orphaned render entries)
    if (!inventoryEntry) {
      continue;
    }

    // Skip assets whose inventory entry is not in an active/renderable state
    // (deprecated, replaced, experimental entries are excluded from runtime manifest)
    if (
      inventoryEntry.status === 'deprecated' ||
      inventoryEntry.status === 'replaced' ||
      inventoryEntry.status === 'blocked'
    ) {
      continue;
    }

    const durationMs = durationMap[id];

    entries[id] = buildManifestEntry(
      renderEntry.audioId,
      renderEntry.outputPath,
      renderEntry.renderKey,
      renderEntry.renderedAt,
      inventoryEntry,
      durationMs,
    );
  }

  return {
    manifestVersion: AUDIO_MANIFEST_SCHEMA_VERSION,
    pipelineVersion,
    generatedAt,
    entries,
  };
}

// ─── Manifest persistence ─────────────────────────────────────────────────────

/**
 * Serialises and writes an `AudioManifest` to disk.
 *
 * The manifest is written as pretty-printed JSON so that it is human-readable
 * and can be diffed in version control.
 *
 * @param manifest      The manifest to save.
 * @param outputPath    Absolute path to the output JSON file.
 * @returns             `null` on success, or an error message string on failure.
 */
export function saveAudioManifest(manifest: AudioManifest, outputPath: string): string | null {
  try {
    writeFileSync(outputPath, JSON.stringify(manifest, null, 2), 'utf-8');
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Failed to write audio manifest to "${outputPath}": ${msg}`;
  }
}
