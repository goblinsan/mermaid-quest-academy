/**
 * Phrase Extraction Engine  (issues #222–#228 / Audio V5)
 *
 * Scans content sources, resolves AudioIds against the audio-phrases.json
 * inventory, and produces a deterministic list of TTS render jobs.
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   import { extractPhrases } from './phraseExtractionEngine';
 *   import inventory from '../data/audio-phrases.json';
 *   import { PHONICS_AUDIO_ID_MAP } from '../data/phonicsAudioIds';
 *   import activities from '../data/readingActivities.json';
 *
 *   const result = extractPhrases({ inventory, audioIdMap: PHONICS_AUDIO_ID_MAP, activities });
 *   if (result.errors.length > 0) {
 *     console.error('Extraction failed:\n' + result.errors.join('\n'));
 *     process.exit(1);
 *   }
 *   console.log(formatExtractionDiagnostics(result.diagnostics));
 *
 * ─── PIPELINE STEPS ──────────────────────────────────────────────────────────
 *
 *  1. scanAudioIdMap      — collect AudioIds from the phonicsAudioIds mapping
 *  2. scanActivities      — collect AudioIds and detect raw-text violations
 *  3. resolveReferences   — look up each AudioId in the inventory
 *  4. generateRenderJobs  — build one render job per resolved AudioId
 *  5. deduplicateJobs     — merge sources for repeated references
 *  6. buildDiagnostics    — assemble the diagnostic summary
 */

import { isValidAudioId } from '../utils/audioIdValidator';
import type { AudioId } from '../types/audioId';
import type { AudioPhraseEntry, AudioPhrasesInventory } from '../types/audioPhrases';
import type { PhonicsActivityConfig } from '../types/activity';
import type {
  AudioReference,
  AudioRenderJob,
  ExtractionDiagnostics,
  ExtractionInput,
  ExtractionResult,
  RawTextViolation,
} from '../types/extraction';

// ─── Required vs optional rules (issue #223) ────────────────────────────────

/**
 * Determines whether an audio reference at a given path in an activity is
 * required or optional, based on the activity's uiVariant.
 *
 * Rules:
 *  - prompt audio   → required for ALL variants
 *  - option audio   → required for seashell, bubble-pop, fish-feed variants
 *  - bin audio      → required for treasure-sort variant
 *  - rhythmBeats    → required for echo-song variant
 *  - option audio   → optional for default variant
 *  - everything else → optional
 */
function isReferenceRequired(pathSegment: string, variant: string | undefined): boolean {
  const v = variant ?? 'default';

  if (pathSegment === 'prompt') return true;

  if (pathSegment === 'option') {
    return v === 'seashell' || v === 'bubble-pop' || v === 'fish-feed';
  }

  if (pathSegment === 'bin') {
    return v === 'treasure-sort';
  }

  if (pathSegment === 'rhythmBeats') {
    return v === 'echo-song';
  }

  return false;
}

// ─── Step 1: Scan the phonics audio ID map (issue #222) ─────────────────────

/**
 * Collects every AudioId from the `PHONICS_AUDIO_ID_MAP`.
 *
 * All entries in the ID map are treated as required references: the mapping
 * is the authoritative list of IDs that the runtime will request, so every
 * key must resolve to an inventory entry.
 */
export function scanAudioIdMap(audioIdMap: Record<string, string>): AudioReference[] {
  const refs: AudioReference[] = [];

  for (const key of Object.keys(audioIdMap).sort()) {
    if (!isValidAudioId(key)) continue; // skip any malformed keys (defensive)
    refs.push({
      audioId: key as AudioId,
      sourceFile: 'data/phonicsAudioIds.ts',
      sourcePath: key,
      required: true,
    });
  }

  return refs;
}

// ─── Step 2: Scan activities (issue #222 + #227) ─────────────────────────────

/**
 * Scans reading/phonics activity configs for:
 *  - Explicit `audioId` fields (collected as references)
 *  - `ttsText` fields without a corresponding `audioId` (raw-text violations)
 *
 * The required/optional classification follows the rules in `isReferenceRequired`.
 */
export function scanActivities(
  activities: PhonicsActivityConfig[],
): { refs: AudioReference[]; violations: RawTextViolation[] } {
  const refs: AudioReference[] = [];
  const violations: RawTextViolation[] = [];
  const sourceFile = 'data/readingActivities.json';

  for (let i = 0; i < activities.length; i++) {
    const activity = activities[i];
    const variant = activity.uiVariant;
    const base = `activities[${i}]`;

    // ── Prompt ────────────────────────────────────────────────────────────────
    const promptBase = `${base}.prompt`;
    const promptAudioId = (activity.prompt as Record<string, unknown>).audioId as
      | string
      | undefined;
    const promptRequired = isReferenceRequired('prompt', variant);

    if (promptAudioId !== undefined) {
      if (isValidAudioId(promptAudioId)) {
        refs.push({
          audioId: promptAudioId as AudioId,
          sourceFile,
          sourcePath: `${promptBase}.audioId`,
          required: promptRequired,
        });
      }
    } else if (activity.prompt.ttsText) {
      violations.push({
        text: activity.prompt.ttsText,
        sourceFile,
        sourcePath: `${promptBase}.ttsText`,
        required: promptRequired,
      });
    }

    // ── Options ───────────────────────────────────────────────────────────────
    if (activity.options) {
      for (let j = 0; j < activity.options.length; j++) {
        const opt = activity.options[j];
        const optBase = `${base}.options[${j}]`;
        const optAudioId = (opt as Record<string, unknown>).audioId as string | undefined;
        const optRequired = isReferenceRequired('option', variant);

        if (optAudioId !== undefined) {
          if (isValidAudioId(optAudioId)) {
            refs.push({
              audioId: optAudioId as AudioId,
              sourceFile,
              sourcePath: `${optBase}.audioId`,
              required: optRequired,
            });
          }
        } else if (opt.ttsText) {
          violations.push({
            text: opt.ttsText,
            sourceFile,
            sourcePath: `${optBase}.ttsText`,
            required: optRequired,
          });
        }
      }
    }

    // ── Bins (treasure-sort) ──────────────────────────────────────────────────
    if (activity.bins) {
      for (let k = 0; k < activity.bins.length; k++) {
        const bin = activity.bins[k];
        const binBase = `${base}.bins[${k}]`;
        const binAudioId = (bin as Record<string, unknown>).audioId as string | undefined;
        const binRequired = isReferenceRequired('bin', variant);

        if (binAudioId !== undefined) {
          if (isValidAudioId(binAudioId)) {
            refs.push({
              audioId: binAudioId as AudioId,
              sourceFile,
              sourcePath: `${binBase}.audioId`,
              required: binRequired,
            });
          }
        } else if (bin.ttsText) {
          violations.push({
            text: bin.ttsText,
            sourceFile,
            sourcePath: `${binBase}.ttsText`,
            required: binRequired,
          });
        }
      }
    }

    // ── Rhythm beats (echo-song) ──────────────────────────────────────────────
    if (activity.rhythmBeats) {
      for (let m = 0; m < activity.rhythmBeats.length; m++) {
        const beat = activity.rhythmBeats[m];
        const beatBase = `${base}.rhythmBeats[${m}]`;
        const beatAudioId = (beat as Record<string, unknown>).audioId as string | undefined;
        const beatRequired = isReferenceRequired('rhythmBeats', variant);

        if (beatAudioId !== undefined) {
          if (isValidAudioId(beatAudioId)) {
            refs.push({
              audioId: beatAudioId as AudioId,
              sourceFile,
              sourcePath: `${beatBase}.audioId`,
              required: beatRequired,
            });
          }
        } else if (beat.ttsText) {
          violations.push({
            text: beat.ttsText,
            sourceFile,
            sourcePath: `${beatBase}.ttsText`,
            required: beatRequired,
          });
        }
      }
    }
  }

  return { refs, violations };
}

// ─── Step 3: Resolve references (issue #224) ─────────────────────────────────

/**
 * Matches each collected AudioId against the inventory.
 *
 * Returns:
 *  - `resolved`: Map of AudioId → AudioPhraseEntry for IDs found in inventory
 *  - `missing`:  AudioId references that have no inventory entry
 *
 * Only `active` and `experimental` entries are considered renderable.
 * `blocked`, `deprecated`, and `replaced` entries are noted but not rendered.
 */
export function resolveReferences(
  refs: AudioReference[],
  inventory: AudioPhrasesInventory,
): { resolved: Map<AudioId, AudioPhraseEntry>; missing: AudioId[] } {
  const inventoryMap = new Map<string, AudioPhraseEntry>();
  for (const entry of inventory.phrases) {
    inventoryMap.set(entry.id, entry);
  }

  const resolved = new Map<AudioId, AudioPhraseEntry>();
  const missingSet = new Set<AudioId>();

  for (const ref of refs) {
    if (resolved.has(ref.audioId) || missingSet.has(ref.audioId)) continue;

    const entry = inventoryMap.get(ref.audioId);
    if (entry && (entry.status === 'active' || entry.status === 'experimental')) {
      resolved.set(ref.audioId, entry);
    } else {
      missingSet.add(ref.audioId);
    }
  }

  return { resolved, missing: Array.from(missingSet).sort() };
}

// ─── Step 4 + 5: Generate and deduplicate render jobs (issues #225, #226) ────

/**
 * Builds one `AudioRenderJob` per resolved AudioId.
 *
 * The job list is sorted alphabetically by `id` for determinism (#225).
 * When the same AudioId is referenced from multiple content locations, all
 * sources are merged into the single job entry (#226).
 */
export function generateRenderJobs(
  refs: AudioReference[],
  resolved: Map<AudioId, AudioPhraseEntry>,
): AudioRenderJob[] {
  // Group all references by audioId to collect sources
  const sourcesByAudioId = new Map<
    AudioId,
    Array<{ file: string; path: string; required: boolean }>
  >();

  for (const ref of refs) {
    if (!resolved.has(ref.audioId)) continue;
    if (!sourcesByAudioId.has(ref.audioId)) {
      sourcesByAudioId.set(ref.audioId, []);
    }
    sourcesByAudioId.get(ref.audioId)!.push({
      file: ref.sourceFile,
      path: ref.sourcePath,
      required: ref.required,
    });
  }

  // Build one job per resolved entry
  const jobs: AudioRenderJob[] = [];
  for (const [audioId, entry] of resolved) {
    const sources = sourcesByAudioId.get(audioId) ?? [];
    jobs.push({
      id: audioId,
      text: entry.text,
      voiceProfile: entry.voiceProfile,
      locale: entry.locale,
      renderStrategy: entry.renderStrategy,
      sources,
    });
  }

  // Sort by id for determinism (issue #225)
  jobs.sort((a, b) => a.id.localeCompare(b.id));

  return jobs;
}

// ─── Step 6: Build diagnostics (issue #228) ──────────────────────────────────

/**
 * Assembles the full diagnostics report from the intermediate results.
 */
function buildDiagnostics(
  allRefs: AudioReference[],
  violations: RawTextViolation[],
  resolved: Map<AudioId, AudioPhraseEntry>,
  missing: AudioId[],
  inventory: AudioPhrasesInventory,
): ExtractionDiagnostics {
  // Duplicates: AudioIds referenced more than once (before dedup)
  const refCounts = new Map<AudioId, number>();
  for (const ref of allRefs) {
    refCounts.set(ref.audioId, (refCounts.get(ref.audioId) ?? 0) + 1);
  }
  const duplicates: AudioId[] = Array.from(refCounts.entries())
    .filter(([, count]) => count > 1)
    .map(([id]) => id)
    .sort();

  // Optional: AudioIds where ALL references are optional
  const requiredIds = new Set<AudioId>();
  for (const ref of allRefs) {
    if (ref.required) requiredIds.add(ref.audioId);
  }
  const referencedIds = new Set<AudioId>(allRefs.map((r) => r.audioId));
  const optional: AudioId[] = Array.from(resolved.keys())
    .filter((id) => referencedIds.has(id) && !requiredIds.has(id))
    .sort();

  // Unreferenced: inventory active entries not referenced from any content
  const unreferenced: AudioId[] = inventory.phrases
    .filter((e) => e.status === 'active' && !referencedIds.has(e.id))
    .map((e) => e.id)
    .sort();

  return {
    resolved: Array.from(resolved.keys()).sort(),
    missing,
    duplicates,
    optional,
    rawTextViolations: violations,
    unreferenced,
  };
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Runs the full phrase extraction pipeline and returns a result object.
 *
 * The caller should check `result.errors.length === 0` before consuming the
 * render jobs — errors indicate a content integrity problem that must be fixed
 * before the TTS pipeline can proceed.
 */
export function extractPhrases(input: ExtractionInput): ExtractionResult {
  const { inventory, audioIdMap, activities } = input;

  // Step 1 — scan the AudioId map
  const idMapRefs = scanAudioIdMap(audioIdMap);

  // Step 2 — scan activities
  const { refs: activityRefs, violations } = scanActivities(activities);

  // Merge all references
  const allRefs: AudioReference[] = [...idMapRefs, ...activityRefs];

  // Step 3 — resolve against inventory
  const { resolved, missing } = resolveReferences(allRefs, inventory);

  // Step 4+5 — generate and deduplicate render jobs
  const renderJobs = generateRenderJobs(allRefs, resolved);

  // Step 6 — diagnostics
  const diagnostics = buildDiagnostics(allRefs, violations, resolved, missing, inventory);

  // ── Errors (hard failures) ────────────────────────────────────────────────
  const errors: string[] = [];

  // Missing required references (#224)
  for (const id of missing) {
    const isRequired = allRefs.some((r) => r.audioId === id && r.required);
    if (isRequired) {
      errors.push(
        `[missing-required] AudioId "${id}" is referenced but has no active inventory entry.`,
      );
    }
  }

  // Required raw-text violations (#227)
  for (const v of violations) {
    if (v.required) {
      errors.push(
        `[raw-text] ${v.sourceFile} at ${v.sourcePath}: ` +
          `raw ttsText "${v.text}" must be replaced with an audioId reference.`,
      );
    }
  }

  // ── Warnings (non-blocking) ────────────────────────────────────────────────
  const warnings: string[] = [];

  // Missing optional references
  for (const id of missing) {
    const isRequired = allRefs.some((r) => r.audioId === id && r.required);
    if (!isRequired) {
      warnings.push(
        `[missing-optional] AudioId "${id}" is referenced but has no active inventory entry.`,
      );
    }
  }

  // Optional raw-text violations
  for (const v of violations) {
    if (!v.required) {
      warnings.push(
        `[raw-text-optional] ${v.sourceFile} at ${v.sourcePath}: ` +
          `ttsText "${v.text}" should be replaced with an audioId reference.`,
      );
    }
  }

  // Unreferenced inventory entries
  for (const id of diagnostics.unreferenced) {
    warnings.push(
      `[unreferenced] AudioId "${id}" is active in the inventory but not referenced from any content.`,
    );
  }

  return { renderJobs, diagnostics, errors, warnings };
}

// ─── Diagnostics formatter (issue #228) ──────────────────────────────────────

/**
 * Formats an `ExtractionDiagnostics` object as a human-readable string
 * suitable for CLI output or CI logs.
 *
 * Example output:
 *
 *   ── Phrase Extraction Diagnostics ──────────────────────────
 *   Resolved   : 49
 *   Missing    : 0
 *   Duplicates : 3
 *   Optional   : 0
 *   Unreferenced: 0
 *   Raw-text violations: 0
 */
export function formatExtractionDiagnostics(diagnostics: ExtractionDiagnostics): string {
  const lines: string[] = [
    '── Phrase Extraction Diagnostics ──────────────────────────',
    `Resolved        : ${diagnostics.resolved.length}`,
    `Missing         : ${diagnostics.missing.length}`,
    `Duplicates      : ${diagnostics.duplicates.length}`,
    `Optional        : ${diagnostics.optional.length}`,
    `Unreferenced    : ${diagnostics.unreferenced.length}`,
    `Raw-text violations: ${diagnostics.rawTextViolations.length}`,
  ];

  if (diagnostics.missing.length > 0) {
    lines.push('');
    lines.push('Missing IDs:');
    for (const id of diagnostics.missing) {
      lines.push(`  - ${id}`);
    }
  }

  if (diagnostics.duplicates.length > 0) {
    lines.push('');
    lines.push('Duplicate references (merged into one render job):');
    for (const id of diagnostics.duplicates) {
      lines.push(`  - ${id}`);
    }
  }

  if (diagnostics.rawTextViolations.length > 0) {
    lines.push('');
    lines.push('Raw-text violations (must use audioId):');
    for (const v of diagnostics.rawTextViolations) {
      const tag = v.required ? '[required]' : '[optional]';
      lines.push(`  ${tag} ${v.sourceFile} @ ${v.sourcePath}: "${v.text}"`);
    }
  }

  if (diagnostics.unreferenced.length > 0) {
    lines.push('');
    lines.push('Unreferenced inventory entries (consider removing):');
    for (const id of diagnostics.unreferenced) {
      lines.push(`  - ${id}`);
    }
  }

  return lines.join('\n');
}
