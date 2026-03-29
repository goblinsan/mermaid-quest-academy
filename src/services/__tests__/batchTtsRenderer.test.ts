/**
 * Tests for the Batch TTS Renderer  (issues #234, #235 / Audio V5 v2)
 *
 * Covers:
 *  - runBatchRender  — full, changed-only, and validate modes
 *  - Skip logic      — unchanged assets are skipped; stale assets are flagged
 *  - Blocked assets  — status === 'blocked' inventory entries not rendered
 *  - formatBatchRenderResult — human-readable report output
 */

import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync } from 'node:fs';
import { runBatchRender, formatBatchRenderResult } from '../batchTtsRenderer';
import type { AudioRenderJob } from '../../types/extraction';
import type { AudioPhrasesInventory, AudioPhraseEntry } from '../../types/audioPhrases';
import { audioId } from '../../types/audioId';
import type { BatchRenderOptions } from '../../types/batchRenderer';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeJob(id: string, text = 'test text'): AudioRenderJob {
  return {
    id: audioId(id),
    text,
    voiceProfile: 'mermaid-default',
    locale: 'en-US',
    renderStrategy: 'tts',
    sources: [],
  };
}

function makeInventoryEntry(id: string, status: AudioPhraseEntry['status'] = 'active'): AudioPhraseEntry {
  return {
    id: audioId(id),
    type: 'phoneme',
    text: 'test text',
    voiceProfile: 'mermaid-default',
    locale: 'en-US',
    renderStrategy: 'tts',
    sourceRefs: [],
    tags: [],
    status,
  };
}

function makeInventory(entries: AudioPhraseEntry[]): AudioPhrasesInventory {
  return { schemaVersion: '1.0.0', updatedAt: '2026-01-01', phrases: entries };
}

/**
 * Creates a temporary output directory for a test, cleaned up by the caller.
 */
function makeTempDir(name: string): string {
  const dir = join(tmpdir(), `mqa-batch-test-${name}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

function makeOptions(outputDir: string, extra: Partial<BatchRenderOptions> = {}): Partial<BatchRenderOptions> {
  return {
    outputDir,
    manifestPath: join(outputDir, 'render-manifest.json'),
    pipelineVersion: '1.0.0',
    maxRetries: 1,
    ...extra,
  };
}

// ─── validate mode ────────────────────────────────────────────────────────────

describe('runBatchRender — validate mode', () => {
  it('returns success without writing any files', async () => {
    const dir = makeTempDir('validate');
    try {
      const jobs = [makeJob('phoneme.letter.s'), makeJob('feedback.correct')];
      const inventory = makeInventory([
        makeInventoryEntry('phoneme.letter.s'),
        makeInventoryEntry('feedback.correct'),
      ]);
      const result = await runBatchRender(jobs, inventory, makeOptions(dir, { mode: 'validate' }));
      expect(result.mode).toBe('validate');
      expect(result.success).toBe(true);
      // No files written means all should be stale (not yet generated)
      expect(result.stale).toBe(jobs.length);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not create any files in validate mode', async () => {
    const dir = makeTempDir('validate-no-files');
    try {
      const jobs = [makeJob('phoneme.letter.s')];
      const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
      await runBatchRender(jobs, inventory, makeOptions(dir, { mode: 'validate' }));
      const { readdirSync } = await import('node:fs');
      const files = readdirSync(dir);
      // Manifest should NOT be written in validate mode
      expect(files).toHaveLength(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── full mode ────────────────────────────────────────────────────────────────

describe('runBatchRender — full mode (dry-run)', () => {
  it('generates all assets in full mode', async () => {
    const dir = makeTempDir('full');
    try {
      const jobs = [makeJob('phoneme.letter.s'), makeJob('phoneme.letter.a')];
      const inventory = makeInventory([
        makeInventoryEntry('phoneme.letter.s'),
        makeInventoryEntry('phoneme.letter.a'),
      ]);
      const result = await runBatchRender(
        jobs,
        inventory,
        makeOptions(dir, { mode: 'full' }),
        { dryRun: true },
      );
      expect(result.mode).toBe('full');
      expect(result.generated).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.success).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── changed-only mode ────────────────────────────────────────────────────────

describe('runBatchRender — changed-only mode (dry-run)', () => {
  it('generates assets on first run', async () => {
    const dir = makeTempDir('changed-first');
    try {
      const jobs = [makeJob('phoneme.letter.s')];
      const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
      const result = await runBatchRender(
        jobs,
        inventory,
        makeOptions(dir, { mode: 'changed-only' }),
        { dryRun: true },
      );
      expect(result.generated).toBe(1);
      expect(result.skipped).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('skips unchanged assets on second run', async () => {
    const dir = makeTempDir('changed-skip');
    try {
      const jobs = [makeJob('phoneme.letter.s')];
      const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
      const opts = makeOptions(dir, { mode: 'changed-only' });
      // First run — generates
      await runBatchRender(jobs, inventory, opts, { dryRun: true });
      // Second run — should skip
      const result = await runBatchRender(jobs, inventory, opts, { dryRun: true });
      expect(result.generated).toBe(0);
      expect(result.skipped).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('re-renders when text changes (render key changes)', async () => {
    const dir = makeTempDir('changed-rerender');
    try {
      const opts = makeOptions(dir, { mode: 'changed-only' });
      const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);

      // First run with original text
      const jobs1 = [makeJob('phoneme.letter.s', 'S says sss')];
      await runBatchRender(jobs1, inventory, opts, { dryRun: true });

      // Second run with different text — render key changes
      const jobs2 = [makeJob('phoneme.letter.s', 'S says a different thing')];
      const result = await runBatchRender(jobs2, inventory, opts, { dryRun: true });
      expect(result.generated).toBe(1);
      expect(result.skipped).toBe(0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── Blocked assets ───────────────────────────────────────────────────────────

describe('runBatchRender — blocked assets', () => {
  it('reports blocked for inventory entries with status blocked', async () => {
    const dir = makeTempDir('blocked');
    try {
      const jobs = [makeJob('phoneme.letter.s')];
      // Inventory entry is blocked
      const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s', 'blocked')]);
      const result = await runBatchRender(
        jobs,
        inventory,
        makeOptions(dir, { mode: 'full' }),
        { dryRun: true },
      );
      expect(result.blocked).toBe(1);
      expect(result.generated).toBe(0);
      expect(result.success).toBe(true); // blocked is not a failure
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── formatBatchRenderResult ──────────────────────────────────────────────────

describe('formatBatchRenderResult', () => {
  it('includes mode, total, generated, skipped, failed, stale, blocked', async () => {
    const dir = makeTempDir('format');
    try {
      const jobs = [makeJob('phoneme.letter.s'), makeJob('phoneme.letter.a')];
      const inventory = makeInventory([
        makeInventoryEntry('phoneme.letter.s'),
        makeInventoryEntry('phoneme.letter.a'),
      ]);
      const result = await runBatchRender(
        jobs,
        inventory,
        makeOptions(dir, { mode: 'full' }),
        { dryRun: true },
      );
      const report = formatBatchRenderResult(result);
      expect(report).toContain('Mode');
      expect(report).toContain('Total');
      expect(report).toContain('Generated');
      expect(report).toContain('Skipped');
      expect(report).toContain('Failed');
      expect(report).toContain('Stale');
      expect(report).toContain('Blocked');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('shows ✓ success when no failures', async () => {
    const dir = makeTempDir('format-success');
    try {
      const jobs = [makeJob('phoneme.letter.s')];
      const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
      const result = await runBatchRender(
        jobs,
        inventory,
        makeOptions(dir, { mode: 'full' }),
        { dryRun: true },
      );
      expect(formatBatchRenderResult(result)).toContain('✓ success');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('lists stale assets when present', async () => {
    const dir = makeTempDir('format-stale');
    try {
      const jobs = [makeJob('phoneme.letter.s')];
      const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
      const result = await runBatchRender(
        jobs,
        inventory,
        makeOptions(dir, { mode: 'validate' }),
        { dryRun: true },
      );
      const report = formatBatchRenderResult(result);
      if (result.stale > 0) {
        expect(report).toContain('Stale assets');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
