/**
 * Tests for the Audio Manifest Validator  (issues #242, #243 / Audio V5 v2)
 *
 * Covers:
 *  - validateManifestCompleteness   — missing active entries detected
 *  - detectOrphanedEntries          — orphaned entries (no inventory match, deprecated, etc.)
 *  - detectStaleEntries             — entries pointing to missing files
 *  - validateManifest               — combined validator; errors vs warnings
 */

import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import {
  validateManifestCompleteness,
  detectOrphanedEntries,
  detectStaleEntries,
  validateManifest,
} from '../audioManifestValidator';
import type { AudioManifest, AudioManifestEntry } from '../../types/audioManifest';
import { AUDIO_MANIFEST_SCHEMA_VERSION } from '../../types/audioManifest';
import { audioId } from '../../types/audioId';
import type { AudioPhrasesInventory, AudioPhraseEntry } from '../../types/audioPhrases';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeManifestEntry(id: string, filePath?: string): AudioManifestEntry {
  return {
    id: audioId(id),
    filePath: filePath ?? `audio/${id.replace(/\./g, '_')}__abc12345.mp3`,
    hash: 'abc12345',
    durationMs: null,
    type: 'phoneme',
    voiceProfile: 'mermaid-default',
    locale: 'en-US',
    preloadPriority: 'critical',
    tags: [],
    generatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeManifest(ids: string[], overrideFilePath?: (id: string) => string): AudioManifest {
  const entries: Record<string, AudioManifestEntry> = {};
  for (const id of ids) {
    const filePath = overrideFilePath ? overrideFilePath(id) : undefined;
    entries[id] = makeManifestEntry(id, filePath);
  }
  return {
    manifestVersion: AUDIO_MANIFEST_SCHEMA_VERSION,
    pipelineVersion: '1.0.0',
    generatedAt: '2026-01-01T00:00:00.000Z',
    entries,
  };
}

function makeInventoryEntry(
  id: string,
  status: AudioPhraseEntry['status'] = 'active',
): AudioPhraseEntry {
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

function makeTempDir(name: string): string {
  const dir = join(tmpdir(), `mqa-validator-test-${name}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── validateManifestCompleteness ────────────────────────────────────────────

describe('validateManifestCompleteness', () => {
  it('returns empty array when all active entries are in manifest', () => {
    const manifest = makeManifest(['phoneme.letter.s', 'feedback.correct']);
    const inventory = makeInventory([
      makeInventoryEntry('phoneme.letter.s'),
      makeInventoryEntry('feedback.correct'),
    ]);
    expect(validateManifestCompleteness(manifest, inventory)).toEqual([]);
  });

  it('returns missing IDs for active entries absent from manifest', () => {
    const manifest = makeManifest(['phoneme.letter.s']);
    const inventory = makeInventory([
      makeInventoryEntry('phoneme.letter.s'),
      makeInventoryEntry('feedback.correct'), // active but not in manifest
    ]);
    const missing = validateManifestCompleteness(manifest, inventory);
    expect(missing).toContain('feedback.correct');
    expect(missing).not.toContain('phoneme.letter.s');
  });

  it('does not flag deprecated entries as missing', () => {
    const manifest = makeManifest([]);
    const inventory = makeInventory([
      makeInventoryEntry('phoneme.letter.s', 'deprecated'),
    ]);
    expect(validateManifestCompleteness(manifest, inventory)).toEqual([]);
  });

  it('does not flag replaced entries as missing', () => {
    const manifest = makeManifest([]);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s', 'replaced')]);
    expect(validateManifestCompleteness(manifest, inventory)).toEqual([]);
  });

  it('does not flag experimental entries as missing', () => {
    const manifest = makeManifest([]);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s', 'experimental')]);
    expect(validateManifestCompleteness(manifest, inventory)).toEqual([]);
  });

  it('does not flag blocked entries as missing', () => {
    const manifest = makeManifest([]);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s', 'blocked')]);
    expect(validateManifestCompleteness(manifest, inventory)).toEqual([]);
  });

  it('returns all missing IDs when manifest is empty', () => {
    const manifest = makeManifest([]);
    const inventory = makeInventory([
      makeInventoryEntry('phoneme.letter.s'),
      makeInventoryEntry('feedback.correct'),
    ]);
    const missing = validateManifestCompleteness(manifest, inventory);
    expect(missing).toHaveLength(2);
  });
});

// ─── detectOrphanedEntries ─────────────────────────────────────────────────────

describe('detectOrphanedEntries', () => {
  it('returns empty array when all manifest entries have active inventory matches', () => {
    const manifest = makeManifest(['phoneme.letter.s', 'feedback.correct']);
    const inventory = makeInventory([
      makeInventoryEntry('phoneme.letter.s'),
      makeInventoryEntry('feedback.correct'),
    ]);
    expect(detectOrphanedEntries(manifest, inventory)).toEqual([]);
  });

  it('detects entries not present in inventory at all', () => {
    const manifest = makeManifest(['phoneme.letter.s', 'unknown.id.here']);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
    const orphaned = detectOrphanedEntries(manifest, inventory);
    expect(orphaned).toContain('unknown.id.here');
    expect(orphaned).not.toContain('phoneme.letter.s');
  });

  it('detects entries with deprecated inventory status', () => {
    const manifest = makeManifest(['phoneme.letter.s']);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s', 'deprecated')]);
    expect(detectOrphanedEntries(manifest, inventory)).toContain('phoneme.letter.s');
  });

  it('detects entries with replaced inventory status', () => {
    const manifest = makeManifest(['phoneme.letter.s']);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s', 'replaced')]);
    expect(detectOrphanedEntries(manifest, inventory)).toContain('phoneme.letter.s');
  });

  it('detects entries with blocked inventory status', () => {
    const manifest = makeManifest(['phoneme.letter.s']);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s', 'blocked')]);
    expect(detectOrphanedEntries(manifest, inventory)).toContain('phoneme.letter.s');
  });

  it('does not flag entries with experimental inventory status as orphaned', () => {
    const manifest = makeManifest(['phoneme.letter.s']);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s', 'experimental')]);
    expect(detectOrphanedEntries(manifest, inventory)).not.toContain('phoneme.letter.s');
  });

  it('returns empty array when manifest is empty', () => {
    const manifest = makeManifest([]);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
    expect(detectOrphanedEntries(manifest, inventory)).toEqual([]);
  });
});

// ─── detectStaleEntries ────────────────────────────────────────────────────────

describe('detectStaleEntries', () => {
  it('returns empty array when all files exist', () => {
    const dir = makeTempDir('stale-exist');
    try {
      const filePath = 'phoneme_letter_s__abc12345.mp3';
      writeFileSync(join(dir, filePath), 'audio-data');

      const manifest = makeManifest(['phoneme.letter.s'], () => filePath);
      const stale = detectStaleEntries(manifest, dir);
      expect(stale).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('detects entries whose file does not exist', () => {
    const dir = makeTempDir('stale-missing');
    try {
      const manifest = makeManifest(
        ['phoneme.letter.s'],
        () => 'nonexistent_audio__abc12345.mp3',
      );
      const stale = detectStaleEntries(manifest, dir);
      expect(stale).toContain('phoneme.letter.s');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('reports each missing file exactly once', () => {
    const dir = makeTempDir('stale-once');
    try {
      const manifest = makeManifest(
        ['phoneme.letter.s', 'feedback.correct'],
        () => 'nonexistent__abc12345.mp3',
      );
      const stale = detectStaleEntries(manifest, dir);
      expect(stale).toHaveLength(2);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('handles absolute filePaths correctly', () => {
    const dir = makeTempDir('stale-absolute');
    try {
      const filePath = join(dir, 'absolute_audio__abc12345.mp3');
      writeFileSync(filePath, 'audio-data');

      const manifest = makeManifest(['phoneme.letter.s'], () => filePath);
      const stale = detectStaleEntries(manifest, '/any-root');
      expect(stale).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// ─── validateManifest ─────────────────────────────────────────────────────────

describe('validateManifest — valid manifest', () => {
  it('returns valid: true when manifest matches inventory', () => {
    const manifest = makeManifest(['phoneme.letter.s']);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
    const result = validateManifest(manifest, inventory);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('returns empty missing, orphaned, stale, errors, warnings for a clean manifest', () => {
    const manifest = makeManifest(['phoneme.letter.s']);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
    const result = validateManifest(manifest, inventory);
    expect(result.missing).toEqual([]);
    expect(result.orphaned).toEqual([]);
    expect(result.stale).toEqual([]);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});

describe('validateManifest — missing assets are errors (#242)', () => {
  it('returns valid: false when active inventory entry is absent from manifest', () => {
    const manifest = makeManifest([]);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
    const result = validateManifest(manifest, inventory);
    expect(result.valid).toBe(false);
  });

  it('includes error message for each missing asset', () => {
    const manifest = makeManifest([]);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
    const result = validateManifest(manifest, inventory);
    expect(result.errors.some((e) => e.includes('phoneme.letter.s'))).toBe(true);
  });

  it('populates missing array with the missing IDs', () => {
    const manifest = makeManifest([]);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
    const result = validateManifest(manifest, inventory);
    expect(result.missing).toContain('phoneme.letter.s');
  });
});

describe('validateManifest — orphaned entries are warnings (#243)', () => {
  it('does not return valid: false when only orphaned entries exist', () => {
    const manifest = makeManifest(['phoneme.letter.s']);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s', 'deprecated')]);
    const result = validateManifest(manifest, inventory);
    // No hard errors — only warnings
    expect(result.errors).toHaveLength(0);
    expect(result.valid).toBe(true);
  });

  it('includes warning message for each orphaned entry', () => {
    const manifest = makeManifest(['phoneme.letter.s']);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s', 'deprecated')]);
    const result = validateManifest(manifest, inventory);
    expect(result.warnings.some((w) => w.includes('phoneme.letter.s'))).toBe(true);
  });

  it('populates orphaned array with the orphaned IDs', () => {
    const manifest = makeManifest(['phoneme.letter.s']);
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s', 'deprecated')]);
    const result = validateManifest(manifest, inventory);
    expect(result.orphaned).toContain('phoneme.letter.s');
  });
});

describe('validateManifest — stale entries with checkFileExistence (#242)', () => {
  it('does not check file existence when checkFileExistence is false (default)', () => {
    const manifest = makeManifest(
      ['phoneme.letter.s'],
      () => '/nonexistent/path/audio.mp3',
    );
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
    const result = validateManifest(manifest, inventory);
    expect(result.stale).toEqual([]);
  });

  it('reports stale entries as errors when checkFileExistence is true', () => {
    const dir = makeTempDir('validate-stale');
    try {
      const manifest = makeManifest(
        ['phoneme.letter.s'],
        () => 'nonexistent_audio__abc12345.mp3',
      );
      const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
      const result = validateManifest(manifest, inventory, {
        checkFileExistence: true,
        projectRoot: dir,
      });
      expect(result.stale).toContain('phoneme.letter.s');
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('phoneme.letter.s'))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('does not flag existing files as stale', () => {
    const dir = makeTempDir('validate-not-stale');
    try {
      const filePath = 'phoneme_letter_s__abc12345.mp3';
      writeFileSync(join(dir, filePath), 'audio-data');

      const manifest = makeManifest(['phoneme.letter.s'], () => filePath);
      const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
      const result = validateManifest(manifest, inventory, {
        checkFileExistence: true,
        projectRoot: dir,
      });
      expect(result.stale).toEqual([]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('validateManifest — combined errors and warnings', () => {
  it('can have both errors (missing) and warnings (orphaned) at the same time', () => {
    const manifest = makeManifest(['phoneme.letter.s']); // orphaned — deprecated
    const inventory = makeInventory([
      makeInventoryEntry('phoneme.letter.s', 'deprecated'),
      makeInventoryEntry('feedback.correct', 'active'), // active but missing from manifest
    ]);
    const result = validateManifest(manifest, inventory);
    expect(result.missing).toContain('feedback.correct');
    expect(result.orphaned).toContain('phoneme.letter.s');
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.warnings.length).toBeGreaterThan(0);
  });
});
