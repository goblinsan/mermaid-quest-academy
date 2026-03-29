/**
 * Audio Regeneration CLI  (issue #230 / Audio V5 v2)
 *
 * Entry point for the batch TTS rendering pipeline.
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   node --loader ts-node/esm src/scripts/renderAudio.ts [options]
 *
 *   Or via npm script:
 *
 *   npm run audio:render               # changed-only (default)
 *   npm run audio:render -- --full     # full re-render
 *   npm run audio:render -- --validate # validate only; no files written
 *
 * ─── FLAGS ────────────────────────────────────────────────────────────────────
 *
 *   --full           Force re-render of every asset (ignores manifest).
 *   --changed-only   (default) Skip assets whose render key is unchanged.
 *   --validate       Run extraction + key generation only; write nothing.
 *   --dry-run        Invoke the pipeline but write placeholder files only.
 *   --output-dir     Directory for audio output files (default: public/audio).
 *   --manifest       Path to the render manifest JSON (default: <outputDir>/render-manifest.json).
 *   --pipeline-ver   Pipeline version string (default: from renderKeyGenerator.ts).
 *   --max-retries    Maximum retryable failures per asset (default: 3).
 *   --help           Show this help message and exit 0.
 *
 * ─── EXIT CODES ───────────────────────────────────────────────────────────────
 *
 *   0  All assets rendered or skipped successfully; no hard failures.
 *   1  One or more assets failed to render (see failure report).
 *   2  Extraction failed — content integrity error must be fixed first.
 *   3  Invalid CLI flags or configuration error.
 */

import { extractPhrases } from '../services/phraseExtractionEngine';
import { runBatchRender, formatBatchRenderResult } from '../services/batchTtsRenderer';
import { formatExtractionDiagnostics } from '../services/phraseExtractionEngine';
import { PIPELINE_VERSION } from '../services/renderKeyGenerator';
import { defaultManifestPath } from '../services/renderOutputPaths';
import type { RenderMode } from '../types/batchRenderer';

// These imports are resolved at runtime — the CLI runs in Node, not the browser.
import inventoryRaw from '../data/audio-phrases.json' assert { type: 'json' };
import activitiesRaw from '../data/readingActivities.json' assert { type: 'json' };
import { PHONICS_AUDIO_ID_MAP } from '../data/phonicsAudioIds';

import type { AudioPhrasesInventory } from '../types/audioPhrases';
import type { PhonicsActivityConfig } from '../types/activity';

// ─── Help text ────────────────────────────────────────────────────────────────

const HELP_TEXT = `
Audio Regeneration CLI — Mermaid Quest Academy  (Audio V5 v2)

USAGE
  node --loader ts-node/esm src/scripts/renderAudio.ts [options]

OPTIONS
  --full             Re-render every asset regardless of existing outputs
  --changed-only     (default) Skip assets whose render key is unchanged
  --validate         Run extraction + key generation only; write nothing
  --dry-run          Invoke the pipeline but write placeholder files only
  --output-dir DIR   Output directory for audio files (default: public/audio)
  --manifest PATH    Path to the render manifest JSON
                     (default: <output-dir>/render-manifest.json)
  --pipeline-ver V   Pipeline version string (default: ${PIPELINE_VERSION})
  --max-retries N    Max retryable failures per asset (default: 3)
  --help             Show this help message and exit 0

EXIT CODES
  0  Success — all assets rendered or skipped; no failures
  1  One or more assets failed to render
  2  Extraction failed — content integrity error must be fixed first
  3  Invalid CLI flags or configuration error

EXAMPLES
  # Validate content integrity without writing any files
  npm run audio:render -- --validate

  # Render only changed or new assets (fastest for day-to-day use)
  npm run audio:render -- --changed-only

  # Force a full re-render of all assets (after a TTS engine upgrade)
  npm run audio:render -- --full

  # Dry-run: exercise the full pipeline without real TTS calls
  npm run audio:render -- --dry-run

  # Custom output directory
  npm run audio:render -- --output-dir /tmp/audio-test
`.trimStart();

// ─── Argument parsing ─────────────────────────────────────────────────────────

interface ParsedArgs {
  mode: RenderMode;
  dryRun: boolean;
  outputDir: string;
  manifestPath: string | undefined;
  pipelineVersion: string;
  maxRetries: number;
  help: boolean;
}

function parseArgs(argv: string[]): ParsedArgs | { error: string } {
  let mode: RenderMode = 'changed-only';
  let dryRun = false;
  let outputDir = 'public/audio';
  let manifestPath: string | undefined;
  let pipelineVersion = PIPELINE_VERSION;
  let maxRetries = 3;
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      help = true;
    } else if (arg === '--full') {
      mode = 'full';
    } else if (arg === '--changed-only') {
      mode = 'changed-only';
    } else if (arg === '--validate') {
      mode = 'validate';
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--output-dir') {
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) {
        return { error: `--output-dir requires a directory argument` };
      }
      outputDir = next;
    } else if (arg === '--manifest') {
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) {
        return { error: `--manifest requires a path argument` };
      }
      manifestPath = next;
    } else if (arg === '--pipeline-ver') {
      const next = argv[++i];
      if (next === undefined || next.startsWith('--')) {
        return { error: `--pipeline-ver requires a version string argument` };
      }
      pipelineVersion = next;
    } else if (arg === '--max-retries') {
      const next = argv[++i];
      const n = parseInt(next ?? '', 10);
      if (isNaN(n) || n < 0) {
        return { error: `--max-retries requires a non-negative integer` };
      }
      maxRetries = n;
    } else if (arg.startsWith('--')) {
      return { error: `Unknown flag: ${arg}` };
    }
  }

  return { mode, dryRun, outputDir, manifestPath, pipelineVersion, maxRetries, help };
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);

  if ('error' in parsed) {
    console.error(`Error: ${parsed.error}`);
    console.error('Run with --help for usage information.');
    process.exit(3);
  }

  if (parsed.help) {
    console.log(HELP_TEXT);
    process.exit(0);
  }

  const { mode, dryRun, outputDir, pipelineVersion, maxRetries } = parsed;
  const manifestPath = parsed.manifestPath ?? defaultManifestPath(outputDir);

  // ── Step 1: Extract render jobs ───────────────────────────────────────────────
  const inventory = inventoryRaw as unknown as AudioPhrasesInventory;
  const activities = activitiesRaw as unknown as PhonicsActivityConfig[];

  const extraction = extractPhrases({
    inventory,
    audioIdMap: PHONICS_AUDIO_ID_MAP,
    activities,
  });

  console.log(formatExtractionDiagnostics(extraction.diagnostics));
  console.log('');

  if (extraction.errors.length > 0) {
    console.error('Extraction errors (must be fixed before rendering):');
    for (const err of extraction.errors) {
      console.error(`  ${err}`);
    }
    process.exit(2);
  }

  if (extraction.warnings.length > 0) {
    console.warn('Extraction warnings:');
    for (const w of extraction.warnings) {
      console.warn(`  ${w}`);
    }
    console.warn('');
  }

  // ── Step 2: Run the batch renderer ────────────────────────────────────────────
  // Always run the batch renderer — in validate mode it performs key generation
  // and diff against the manifest without writing any files, providing a complete
  // render-readiness picture (stale assets, blocked entries, etc.).
  const result = await runBatchRender(
    extraction.renderJobs,
    inventory,
    { mode, outputDir, manifestPath, pipelineVersion, maxRetries },
    { dryRun },
  );

  console.log(formatBatchRenderResult(result));

  if (mode === 'validate') {
    // Validate mode never writes files; exit 0 unless extraction itself failed
    // (already handled above).
    process.exit(0);
  }

  process.exit(result.success ? 0 : 1);
}

main().catch((err: unknown) => {
  console.error('Unexpected error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
