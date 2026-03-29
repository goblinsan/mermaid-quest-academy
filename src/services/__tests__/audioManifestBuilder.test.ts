/**
 * Tests for the Audio Manifest Builder  (issues #240, #241 / Audio V5 v2)
 *
 * Covers:
 *  - buildManifestEntry   — per-asset entry construction
 *  - buildAudioManifest   — full manifest from render manifest + inventory
 *  - saveAudioManifest    — write manifest to disk
 *  - Exclusion rules      — failed/blocked/deprecated/replaced entries omitted
 *  - Duration handling    — durationMs from durationMap; null when absent
 *  - Preload priorities   — derived correctly from asset type
 *  - Versioning           — manifestVersion from AUDIO_MANIFEST_SCHEMA_VERSION
 */

import { describe, it, expect } from 'vitest';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdirSync, rmSync, readFileSync } from 'node:fs';
import {
  buildManifestEntry,
  buildAudioManifest,
  saveAudioManifest,
} from '../audioManifestBuilder';
import { AUDIO_MANIFEST_SCHEMA_VERSION, isManifestCompatible } from '../../types/audioManifest';
import { audioId } from '../../types/audioId';
import type { RenderManifest, ManifestEntry, RenderKey } from '../../types/batchRenderer';
import type { AudioPhrasesInventory, AudioPhraseEntry } from '../../types/audioPhrases';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRenderEntry(id: string, outputPath = `audio/${id.replace(/\./g, '_')}__abc123.mp3`): ManifestEntry {
  return {
    audioId: audioId(id),
    renderKey: 'abc12345' as RenderKey,
    renderedAt: '2026-01-01T00:00:00.000Z',
    outputPath,
  };
}

function makeRenderManifest(entries: Record<string, ManifestEntry>): RenderManifest {
  return {
    schemaVersion: '1.0.0',
    pipelineVersion: '1.0.0',
    updatedAt: '2026-01-01T00:00:00.000Z',
    entries,
  };
}

function makeInventoryEntry(
  id: string,
  type: AudioPhraseEntry['type'] = 'phoneme',
  status: AudioPhraseEntry['status'] = 'active',
): AudioPhraseEntry {
  return {
    id: audioId(id),
    type,
    text: 'test text',
    voiceProfile: 'mermaid-default',
    locale: 'en-US',
    renderStrategy: 'tts',
    sourceRefs: [],
    tags: ['satpin'],
    status,
  };
}

function makeInventory(entries: AudioPhraseEntry[]): AudioPhrasesInventory {
  return { schemaVersion: '1.0.0', updatedAt: '2026-01-01', phrases: entries };
}

function makeTempDir(name: string): string {
  const dir = join(tmpdir(), `mqa-manifest-test-${name}-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

// ─── buildManifestEntry ───────────────────────────────────────────────────────

describe('buildManifestEntry', () => {
  it('includes all required fields', () => {
    const id = audioId('phoneme.letter.s');
    const entry = buildManifestEntry(
      id,
      'audio/phoneme_letter_s__abc12345.mp3',
      'abc12345',
      '2026-01-01T00:00:00.000Z',
      { type: 'phoneme', voiceProfile: 'mermaid-default', locale: 'en-US', tags: ['satpin'] },
    );

    expect(entry.id).toBe('phoneme.letter.s');
    expect(entry.filePath).toBe('audio/phoneme_letter_s__abc12345.mp3');
    expect(entry.hash).toBe('abc12345');
    expect(entry.type).toBe('phoneme');
    expect(entry.voiceProfile).toBe('mermaid-default');
    expect(entry.locale).toBe('en-US');
    expect(entry.tags).toEqual(['satpin']);
    expect(entry.generatedAt).toBe('2026-01-01T00:00:00.000Z');
  });

  it('sets durationMs to null when not provided', () => {
    const entry = buildManifestEntry(
      audioId('feedback.correct'),
      'audio/feedback_correct__abc12345.mp3',
      'abc12345',
      '2026-01-01T00:00:00.000Z',
      { type: 'feedback', voiceProfile: 'mermaid-default', locale: 'en-US', tags: [] },
    );
    expect(entry.durationMs).toBeNull();
  });

  it('sets durationMs when provided', () => {
    const entry = buildManifestEntry(
      audioId('phoneme.letter.s'),
      'audio/phoneme_letter_s__abc12345.mp3',
      'abc12345',
      '2026-01-01T00:00:00.000Z',
      { type: 'phoneme', voiceProfile: 'mermaid-default', locale: 'en-US', tags: [] },
      1200,
    );
    expect(entry.durationMs).toBe(1200);
  });

  it('assigns critical preload priority to phoneme type', () => {
    const entry = buildManifestEntry(
      audioId('phoneme.letter.s'),
      'audio/phoneme_letter_s__abc12345.mp3',
      'abc12345',
      '2026-01-01T00:00:00.000Z',
      { type: 'phoneme', voiceProfile: 'mermaid-default', locale: 'en-US', tags: [] },
    );
    expect(entry.preloadPriority).toBe('critical');
  });

  it('assigns high preload priority to feedback type', () => {
    const entry = buildManifestEntry(
      audioId('feedback.correct'),
      'audio/feedback_correct__abc12345.mp3',
      'abc12345',
      '2026-01-01T00:00:00.000Z',
      { type: 'feedback', voiceProfile: 'mermaid-default', locale: 'en-US', tags: [] },
    );
    expect(entry.preloadPriority).toBe('high');
  });

  it('assigns high preload priority to prompt type', () => {
    const entry = buildManifestEntry(
      audioId('prompt.seashell_match.s'),
      'audio/prompt__abc12345.mp3',
      'abc12345',
      '2026-01-01T00:00:00.000Z',
      { type: 'prompt', voiceProfile: 'mermaid-default', locale: 'en-US', tags: [] },
    );
    expect(entry.preloadPriority).toBe('high');
  });

  it('assigns normal preload priority to word type', () => {
    const entry = buildManifestEntry(
      audioId('word.cvc.sat'),
      'audio/word_cvc_sat__abc12345.mp3',
      'abc12345',
      '2026-01-01T00:00:00.000Z',
      { type: 'word', voiceProfile: 'mermaid-default', locale: 'en-US', tags: [] },
    );
    expect(entry.preloadPriority).toBe('normal');
  });

  it('assigns low preload priority to reward type', () => {
    const entry = buildManifestEntry(
      audioId('reward.level_complete'),
      'audio/reward_level_complete__abc12345.mp3',
      'abc12345',
      '2026-01-01T00:00:00.000Z',
      { type: 'reward', voiceProfile: 'mermaid-default', locale: 'en-US', tags: [] },
    );
    expect(entry.preloadPriority).toBe('low');
  });

  it('does not mutate the source tags array', () => {
    const tags = ['satpin', 'level-1'];
    const entry = buildManifestEntry(
      audioId('phoneme.letter.s'),
      'audio/phoneme_letter_s__abc12345.mp3',
      'abc12345',
      '2026-01-01T00:00:00.000Z',
      { type: 'phoneme', voiceProfile: 'mermaid-default', locale: 'en-US', tags },
    );
    tags.push('mutated');
    expect(entry.tags).not.toContain('mutated');
  });
});

// ─── buildAudioManifest ───────────────────────────────────────────────────────

describe('buildAudioManifest — basic', () => {
  it('builds a manifest with all active rendered entries', () => {
    const renderManifest = makeRenderManifest({
      'phoneme.letter.s': makeRenderEntry('phoneme.letter.s'),
      'feedback.correct': makeRenderEntry('feedback.correct'),
    });
    const inventory = makeInventory([
      makeInventoryEntry('phoneme.letter.s', 'phoneme'),
      makeInventoryEntry('feedback.correct', 'feedback'),
    ]);

    const manifest = buildAudioManifest(renderManifest, inventory);

    expect(Object.keys(manifest.entries)).toHaveLength(2);
    expect(manifest.entries['phoneme.letter.s']).toBeDefined();
    expect(manifest.entries['feedback.correct']).toBeDefined();
  });

  it('sets manifestVersion from AUDIO_MANIFEST_SCHEMA_VERSION', () => {
    const manifest = buildAudioManifest(makeRenderManifest({}), makeInventory([]));
    expect(manifest.manifestVersion).toBe(AUDIO_MANIFEST_SCHEMA_VERSION);
  });

  it('sets pipelineVersion from render manifest when not overridden', () => {
    const renderManifest = makeRenderManifest({});
    renderManifest.pipelineVersion = '2.0.0';
    const manifest = buildAudioManifest(renderManifest, makeInventory([]));
    expect(manifest.pipelineVersion).toBe('2.0.0');
  });

  it('uses pipelineVersion override when provided', () => {
    const manifest = buildAudioManifest(makeRenderManifest({}), makeInventory([]), {
      pipelineVersion: '3.0.0',
    });
    expect(manifest.pipelineVersion).toBe('3.0.0');
  });

  it('uses generatedAt override when provided', () => {
    const ts = '2026-06-15T12:00:00.000Z';
    const manifest = buildAudioManifest(makeRenderManifest({}), makeInventory([]), {
      generatedAt: ts,
    });
    expect(manifest.generatedAt).toBe(ts);
  });

  it('includes durationMs from durationMap when provided', () => {
    const renderManifest = makeRenderManifest({
      'phoneme.letter.s': makeRenderEntry('phoneme.letter.s'),
    });
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
    const manifest = buildAudioManifest(renderManifest, inventory, {
      durationMap: { 'phoneme.letter.s': 1400 },
    });
    expect(manifest.entries['phoneme.letter.s'].durationMs).toBe(1400);
  });

  it('sets durationMs to null when not in durationMap', () => {
    const renderManifest = makeRenderManifest({
      'phoneme.letter.s': makeRenderEntry('phoneme.letter.s'),
    });
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
    const manifest = buildAudioManifest(renderManifest, inventory);
    expect(manifest.entries['phoneme.letter.s'].durationMs).toBeNull();
  });
});

describe('buildAudioManifest — exclusion rules', () => {
  it('excludes render entries with no matching inventory entry', () => {
    const renderManifest = makeRenderManifest({
      'phoneme.letter.s': makeRenderEntry('phoneme.letter.s'),
    });
    // Inventory is empty — no matching entry
    const manifest = buildAudioManifest(renderManifest, makeInventory([]));
    expect(Object.keys(manifest.entries)).toHaveLength(0);
  });

  it('excludes inventory entries with status deprecated', () => {
    const renderManifest = makeRenderManifest({
      'phoneme.letter.s': makeRenderEntry('phoneme.letter.s'),
    });
    const inventory = makeInventory([
      makeInventoryEntry('phoneme.letter.s', 'phoneme', 'deprecated'),
    ]);
    const manifest = buildAudioManifest(renderManifest, inventory);
    expect(manifest.entries['phoneme.letter.s']).toBeUndefined();
  });

  it('excludes inventory entries with status replaced', () => {
    const renderManifest = makeRenderManifest({
      'phoneme.letter.s': makeRenderEntry('phoneme.letter.s'),
    });
    const inventory = makeInventory([
      makeInventoryEntry('phoneme.letter.s', 'phoneme', 'replaced'),
    ]);
    const manifest = buildAudioManifest(renderManifest, inventory);
    expect(manifest.entries['phoneme.letter.s']).toBeUndefined();
  });

  it('excludes inventory entries with status blocked', () => {
    const renderManifest = makeRenderManifest({
      'phoneme.letter.s': makeRenderEntry('phoneme.letter.s'),
    });
    const inventory = makeInventory([
      makeInventoryEntry('phoneme.letter.s', 'phoneme', 'blocked'),
    ]);
    const manifest = buildAudioManifest(renderManifest, inventory);
    expect(manifest.entries['phoneme.letter.s']).toBeUndefined();
  });

  it('includes inventory entries with status experimental', () => {
    const renderManifest = makeRenderManifest({
      'phoneme.letter.s': makeRenderEntry('phoneme.letter.s'),
    });
    const inventory = makeInventory([
      makeInventoryEntry('phoneme.letter.s', 'phoneme', 'experimental'),
    ]);
    const manifest = buildAudioManifest(renderManifest, inventory);
    expect(manifest.entries['phoneme.letter.s']).toBeDefined();
  });

  it('produces an empty entries object when render manifest is empty', () => {
    const manifest = buildAudioManifest(makeRenderManifest({}), makeInventory([
      makeInventoryEntry('phoneme.letter.s'),
    ]));
    expect(Object.keys(manifest.entries)).toHaveLength(0);
  });
});

describe('buildAudioManifest — O(1) lookup structure (#245)', () => {
  it('entries is a plain Record keyed by AudioId string', () => {
    const renderManifest = makeRenderManifest({
      'phoneme.letter.s': makeRenderEntry('phoneme.letter.s'),
    });
    const inventory = makeInventory([makeInventoryEntry('phoneme.letter.s')]);
    const manifest = buildAudioManifest(renderManifest, inventory);

    // O(1) lookup
    expect(manifest.entries['phoneme.letter.s']).toBeDefined();
    expect(manifest.entries['phoneme.letter.s'].id).toBe('phoneme.letter.s');
  });
});

// ─── saveAudioManifest ────────────────────────────────────────────────────────

describe('saveAudioManifest', () => {
  it('writes the manifest as JSON to the specified path', () => {
    const dir = makeTempDir('save');
    try {
      const outputPath = join(dir, 'audio-manifest.json');
      const manifest = buildAudioManifest(makeRenderManifest({}), makeInventory([]));

      const err = saveAudioManifest(manifest, outputPath);
      expect(err).toBeNull();

      const raw = readFileSync(outputPath, 'utf-8');
      const parsed = JSON.parse(raw);
      expect(parsed.manifestVersion).toBe(AUDIO_MANIFEST_SCHEMA_VERSION);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('returns an error string when write fails (bad path)', () => {
    const err = saveAudioManifest(
      buildAudioManifest(makeRenderManifest({}), makeInventory([])),
      '/nonexistent-directory-xyz/audio-manifest.json',
    );
    expect(typeof err).toBe('string');
    expect(err).not.toBeNull();
  });
});

// ─── isManifestCompatible (versioning #244) ───────────────────────────────────

describe('isManifestCompatible', () => {
  it('returns true for exact version match', () => {
    expect(isManifestCompatible({ manifestVersion: '1.0.0' }, '1.0.0')).toBe(true);
  });

  it('returns true for same major, different minor', () => {
    expect(isManifestCompatible({ manifestVersion: '1.1.0' }, '1.0.0')).toBe(true);
  });

  it('returns true for same major, different patch', () => {
    expect(isManifestCompatible({ manifestVersion: '1.0.5' }, '1.0.0')).toBe(true);
  });

  it('returns false for different major version', () => {
    expect(isManifestCompatible({ manifestVersion: '2.0.0' }, '1.0.0')).toBe(false);
  });

  it('uses AUDIO_MANIFEST_SCHEMA_VERSION as default expected version', () => {
    const manifest = buildAudioManifest(makeRenderManifest({}), makeInventory([]));
    expect(isManifestCompatible(manifest)).toBe(true);
  });
});
