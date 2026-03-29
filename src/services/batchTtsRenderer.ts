/**
 * Batch TTS Renderer  (issues #234, #235 / Audio V5 v2)
 *
 * Orchestrates the full batch rendering pipeline:
 *  1. Accept extracted render jobs
 *  2. Compute deterministic render keys
 *  3. Compare keys against the saved manifest (changed-only mode)
 *  4. Skip unchanged assets; flag stale / missing outputs
 *  5. Invoke the TTS engine adapter for new or invalidated jobs
 *  6. Write/update the render manifest after the run
 *  7. Emit a structured `BatchRenderResult` with per-asset reports
 *
 * ─── MODES ───────────────────────────────────────────────────────────────────
 *
 * | Mode           | Behaviour                                                |
 * |----------------|----------------------------------------------------------|
 * | full           | Re-render every asset; ignores the manifest              |
 * | changed-only   | Skip assets whose render key matches the manifest        |
 * | validate       | Key generation + diff only; no files written             |
 *
 * ─── SKIP LOGIC (issue #234) ─────────────────────────────────────────────────
 *
 *  An asset is SKIPPED when:
 *    - mode is `changed-only`, AND
 *    - a manifest entry exists with the same renderKey, AND
 *    - the output file exists on disk at the recorded path.
 *
 *  An asset is STALE when:
 *    - a manifest entry exists but the output file is missing or inaccessible, OR
 *    - the asset was never rendered (no manifest entry) but we are in `validate`
 *      mode (so we cannot generate it either).
 *
 *  All other assets are rendered (or reported as blocked/failed).
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   import { runBatchRender, formatBatchRenderResult } from './batchTtsRenderer';
 *   import { extractPhrases } from './phraseExtractionEngine';
 *
 *   const extraction = extractPhrases(input);
 *   if (extraction.errors.length > 0) process.exit(1);
 *
 *   const result = await runBatchRender(extraction.renderJobs, inventory, options);
 *   console.log(formatBatchRenderResult(result));
 *   if (!result.success) process.exit(1);
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { AudioRenderJob } from '../types/extraction';
import type { AudioPhrasesInventory } from '../types/audioPhrases';
import type {
  AssetRenderReport,
  AssetRenderStatus,
  BatchRenderOptions,
  BatchRenderResult,
  ManifestEntry,
  RenderManifest,
  RenderMode,
} from '../types/batchRenderer';
import { getRenderKey, PIPELINE_VERSION } from './renderKeyGenerator';
import { resolveOutputPath, defaultManifestPath } from './renderOutputPaths';
import { renderWithTts, isTtsRenderError } from './ttsEngineAdapter';
import type { TtsEngineAdapterOptions } from './ttsEngineAdapter';

// ─── Manifest helpers ─────────────────────────────────────────────────────────

/** Schema version for the render manifest file. */
const MANIFEST_SCHEMA_VERSION = '1.0.0';

/**
 * Loads the render manifest from disk.
 * Returns an empty manifest if the file does not exist or cannot be parsed.
 */
function loadManifest(manifestPath: string, pipelineVersion: string): RenderManifest {
  if (!existsSync(manifestPath)) {
    return emptyManifest(pipelineVersion);
  }
  try {
    const raw = readFileSync(manifestPath, 'utf-8');
    return JSON.parse(raw) as RenderManifest;
  } catch {
    return emptyManifest(pipelineVersion);
  }
}

/** Creates an empty render manifest. */
function emptyManifest(pipelineVersion: string): RenderManifest {
  return {
    schemaVersion: MANIFEST_SCHEMA_VERSION,
    pipelineVersion,
    updatedAt: new Date().toISOString(),
    entries: {},
  };
}

/**
 * Writes the render manifest to disk.
 * Returns `null` on success or an error message on failure.
 */
function saveManifest(manifest: RenderManifest, manifestPath: string): string | null {
  try {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return `Failed to write manifest to "${manifestPath}": ${msg}`;
  }
}

// ─── Skip / stale determination (issue #234) ──────────────────────────────────

/**
 * Determines the initial status of an asset before attempting to render.
 *
 * Returns:
 *  - `'skipped'` — render key matches and output file exists
 *  - `'stale'`   — manifest entry exists but output file is missing
 *  - `null`      — asset should be rendered (new or invalidated)
 *
 * @param projectRoot Absolute project root used to resolve relative outputPaths
 *                    stored in the manifest.
 */
function checkSkipOrStale(
  audioId: string,
  renderKey: string,
  manifest: RenderManifest,
  mode: RenderMode,
  projectRoot: string,
): 'skipped' | 'stale' | null {
  const entry = manifest.entries[audioId];

  if (!entry) return null; // never rendered before

  if (entry.renderKey === renderKey && mode === 'changed-only') {
    // Resolve the stored relative path to an absolute path before checking
    // existence, so the check is correct regardless of the current working
    // directory.
    const absoluteOutputPath = isAbsolute(entry.outputPath)
      ? entry.outputPath
      : resolve(projectRoot, entry.outputPath);

    if (existsSync(absoluteOutputPath)) {
      return 'skipped';
    }
    // Manifest says rendered but file is gone — stale
    return 'stale';
  }

  // render key changed (invalidated) — must re-render
  return null;
}

// ─── Default options ──────────────────────────────────────────────────────────

/** Default output directory relative to project root. */
const DEFAULT_OUTPUT_DIR = 'public/audio';

/** Default maximum retries per asset. */
const DEFAULT_MAX_RETRIES = 3;

// ─── Main batch render function ───────────────────────────────────────────────

/**
 * Runs the full batch TTS rendering pipeline.
 *
 * @param renderJobs   Ordered render jobs from the extraction engine.
 * @param inventory    The audio phrase inventory (for phonics metadata lookup).
 * @param options      Batch render options (mode, paths, pipeline version).
 * @param adapterOpts  Options forwarded to the TTS engine adapter.
 * @returns            A `BatchRenderResult` with per-asset reports and summary.
 */
export async function runBatchRender(
  renderJobs: AudioRenderJob[],
  inventory: AudioPhrasesInventory,
  options: Partial<BatchRenderOptions> = {},
  adapterOpts: TtsEngineAdapterOptions = {},
): Promise<BatchRenderResult> {
  const startedAt = new Date().toISOString();

  // ── Resolve options with defaults ────────────────────────────────────────────
  const mode: RenderMode = options.mode ?? 'changed-only';
  const outputDir = options.outputDir ?? DEFAULT_OUTPUT_DIR;
  const pipelineVersion = options.pipelineVersion ?? PIPELINE_VERSION;
  const maxRetries = options.maxRetries ?? DEFAULT_MAX_RETRIES;
  const manifestPath =
    options.manifestPath ?? defaultManifestPath(outputDir);

  // ── Build inventory index for phonics metadata lookup ────────────────────────
  const inventoryIndex = new Map(inventory.phrases.map((e) => [e.id, e]));

  // ── Project root (used for path resolution throughout the run) ───────────────
  const projectRoot = process.cwd();

  // ── Load manifest ─────────────────────────────────────────────────────────────
  const manifest = loadManifest(manifestPath, pipelineVersion);

  // ── Process each job ─────────────────────────────────────────────────────────
  const assets: AssetRenderReport[] = [];
  let consecutiveRetryableFailures = 0;

  for (const job of renderJobs) {
    const resolvedAt = new Date().toISOString();

    // Look up inventory entry for phonics metadata
    const inventoryEntry = inventoryIndex.get(job.id);

    // Check if this asset is blocked in the inventory
    if (inventoryEntry && inventoryEntry.status === 'blocked') {
      assets.push({
        audioId: job.id,
        status: 'blocked',
        resolvedAt,
      });
      continue;
    }

    // Compute render key
    const renderKey = getRenderKey(job, pipelineVersion, inventoryEntry);

    // Determine skip / stale status
    const preStatus = checkSkipOrStale(job.id, renderKey, manifest, mode, projectRoot);

    if (preStatus === 'skipped') {
      const existingEntry = manifest.entries[job.id];
      assets.push({
        audioId: job.id,
        status: 'skipped',
        outputPath: existingEntry.outputPath,
        resolvedAt,
      });
      continue;
    }

    if (preStatus === 'stale') {
      assets.push({
        audioId: job.id,
        status: 'stale',
        outputPath: manifest.entries[job.id]?.outputPath,
        resolvedAt,
      });
      continue;
    }

    // ── validate mode: report but do not render ───────────────────────────────
    if (mode === 'validate') {
      // In validate mode, report assets that would be generated as stale
      assets.push({
        audioId: job.id,
        status: 'stale',
        resolvedAt,
      });
      continue;
    }

    // ── Determine output path ─────────────────────────────────────────────────
    const resolved = resolveOutputPath(job.id, renderKey, outputDir, projectRoot);

    // ── Render with retry logic ───────────────────────────────────────────────
    let renderResult = await renderWithTts(job, resolved.absolutePath, adapterOpts);

    let retries = 0;
    while (isTtsRenderError(renderResult) && renderResult.retryable && retries < maxRetries) {
      retries++;
      renderResult = await renderWithTts(job, resolved.absolutePath, adapterOpts);
    }

    // ── Handle result ─────────────────────────────────────────────────────────
    if (isTtsRenderError(renderResult)) {
      assets.push({
        audioId: job.id,
        status: 'failed',
        error: renderResult,
        resolvedAt,
      });

      if (renderResult.retryable) {
        consecutiveRetryableFailures++;
        if (consecutiveRetryableFailures >= maxRetries) {
          // Abort: engine appears to be down
          break;
        }
      } else {
        consecutiveRetryableFailures = 0;
      }
    } else {
      consecutiveRetryableFailures = 0;

      // Update manifest
      const entry: ManifestEntry = {
        audioId: job.id,
        renderKey,
        renderedAt: resolvedAt,
        outputPath: resolved.relativePath,
      };
      manifest.entries[job.id] = entry;

      assets.push({
        audioId: job.id,
        status: 'generated',
        outputPath: resolved.absolutePath,
        resolvedAt,
      });
    }
  }

  // ── Save manifest (not in validate mode) ─────────────────────────────────────
  if (mode !== 'validate') {
    manifest.updatedAt = new Date().toISOString();
    saveManifest(manifest, manifestPath);
  }

  // ── Aggregate counts ──────────────────────────────────────────────────────────
  const counts = countStatuses(assets);
  const completedAt = new Date().toISOString();

  return {
    mode,
    assets,
    total: assets.length,
    ...counts,
    startedAt,
    completedAt,
    success: counts.failed === 0,
  };
}

// ─── Aggregation helper ────────────────────────────────────────────────────────

function countStatuses(
  assets: AssetRenderReport[],
): Pick<BatchRenderResult, 'generated' | 'skipped' | 'failed' | 'stale' | 'blocked'> {
  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let stale = 0;
  let blocked = 0;

  for (const asset of assets) {
    const s: AssetRenderStatus = asset.status;
    if (s === 'generated') generated++;
    else if (s === 'skipped') skipped++;
    else if (s === 'failed') failed++;
    else if (s === 'stale') stale++;
    else if (s === 'blocked') blocked++;
  }

  return { generated, skipped, failed, stale, blocked };
}

// ─── Result formatter (issue #235) ────────────────────────────────────────────

/**
 * Formats a `BatchRenderResult` as a human-readable string suitable for
 * CLI output or CI logs.
 *
 * Example output:
 *
 *   ── Batch TTS Render Report ──────────────────────────────────
 *   Mode       : changed-only
 *   Total      : 49
 *   Generated  : 3
 *   Skipped    : 44
 *   Failed     : 0
 *   Stale      : 0
 *   Blocked    : 2
 *   Status     : ✓ success
 */
export function formatBatchRenderResult(result: BatchRenderResult): string {
  const statusLine = result.success ? '✓ success' : '✗ failed';
  const lines: string[] = [
    '── Batch TTS Render Report ──────────────────────────────────',
    `Mode       : ${result.mode}`,
    `Total      : ${result.total}`,
    `Generated  : ${result.generated}`,
    `Skipped    : ${result.skipped}`,
    `Failed     : ${result.failed}`,
    `Stale      : ${result.stale}`,
    `Blocked    : ${result.blocked}`,
    `Status     : ${statusLine}`,
  ];

  if (result.failed > 0) {
    lines.push('');
    lines.push('Failed assets:');
    for (const asset of result.assets) {
      if (asset.status === 'failed' && asset.error) {
        const retryTag = asset.error.retryable ? '[retryable]' : '[terminal]';
        lines.push(`  ${retryTag} ${asset.audioId}: [${asset.error.failureClass}] ${asset.error.message}`);
      }
    }
  }

  if (result.stale > 0) {
    lines.push('');
    lines.push('Stale assets (output missing or not yet generated):');
    for (const asset of result.assets) {
      if (asset.status === 'stale') {
        const path = asset.outputPath ? ` (expected: ${asset.outputPath})` : '';
        lines.push(`  - ${asset.audioId}${path}`);
      }
    }
  }

  if (result.blocked > 0) {
    lines.push('');
    lines.push('Blocked assets (awaiting pronunciation review):');
    for (const asset of result.assets) {
      if (asset.status === 'blocked') {
        lines.push(`  - ${asset.audioId}`);
      }
    }
  }

  return lines.join('\n');
}
