/**
 * Tests for AudioResolver  (issues #248, #254 / Audio V5 v2)
 *
 * Covers:
 *  - loadManifest   — compatibility check, rejection of incompatible versions
 *  - isReady        — reflects loaded state
 *  - resolve        — O(1) lookup, missing returns null silently
 *  - resolveRequired— missing returns null and logs console.error
 *  - getFilePath    — constructs browser-ready URL path
 *  - getEntriesByPriority — filters by preloadPriority
 *  - getEntriesByTags     — filters by tag membership
 *  - reset          — clears loaded manifest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioResolver, audioResolver } from '../audioResolver';
import type { AudioManifest, AudioManifestEntry } from '../../types/audioManifest';
import { AUDIO_MANIFEST_SCHEMA_VERSION } from '../../types/audioManifest';
import { audioId } from '../../types/audioId';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeEntry(
  id: string,
  type: AudioManifestEntry['type'] = 'phoneme',
  preloadPriority: AudioManifestEntry['preloadPriority'] = 'critical',
  tags: string[] = [],
): AudioManifestEntry {
  return {
    id: audioId(id),
    filePath: `audio/${id.replace(/\./g, '_')}__abc123.mp3`,
    hash: 'abc12345',
    durationMs: 800,
    type,
    voiceProfile: 'mermaid-default',
    locale: 'en-US',
    preloadPriority,
    tags,
    generatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeManifest(
  entriesArray: AudioManifestEntry[] = [],
  version: string = AUDIO_MANIFEST_SCHEMA_VERSION,
): AudioManifest {
  const entries: Record<string, AudioManifestEntry> = {};
  for (const entry of entriesArray) {
    entries[entry.id] = entry;
  }
  return {
    manifestVersion: version,
    pipelineVersion: '1.0.0',
    generatedAt: '2026-01-01T00:00:00.000Z',
    entries,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('AudioResolver', () => {
  let resolver: AudioResolver;

  beforeEach(() => {
    resolver = new AudioResolver();
  });

  // ─── loadManifest ──────────────────────────────────────────────────────────

  describe('loadManifest', () => {
    it('loads a compatible manifest without throwing', () => {
      const manifest = makeManifest();
      expect(() => resolver.loadManifest(manifest)).not.toThrow();
    });

    it('throws when major version is incompatible', () => {
      const manifest = makeManifest([], '2.0.0');
      expect(() => resolver.loadManifest(manifest)).toThrow(/schema mismatch/i);
    });

    it('accepts a manifest with the same major but higher minor version', () => {
      const manifest = makeManifest([], '1.5.0');
      expect(() => resolver.loadManifest(manifest)).not.toThrow();
    });

    it('accepts a manifest with a higher patch version', () => {
      const manifest = makeManifest([], '1.0.9');
      expect(() => resolver.loadManifest(manifest)).not.toThrow();
    });

    it('replaces a previously loaded manifest', () => {
      const first = makeManifest([makeEntry('phoneme.letter.s')]);
      const second = makeManifest([makeEntry('phoneme.letter.a')]);

      resolver.loadManifest(first);
      expect(resolver.resolve(audioId('phoneme.letter.s'))).not.toBeNull();

      resolver.loadManifest(second);
      expect(resolver.resolve(audioId('phoneme.letter.s'))).toBeNull();
      expect(resolver.resolve(audioId('phoneme.letter.a'))).not.toBeNull();
    });
  });

  // ─── isReady ───────────────────────────────────────────────────────────────

  describe('isReady', () => {
    it('returns false before any manifest is loaded', () => {
      expect(resolver.isReady()).toBe(false);
    });

    it('returns true after a manifest is loaded', () => {
      resolver.loadManifest(makeManifest());
      expect(resolver.isReady()).toBe(true);
    });

    it('returns false after reset()', () => {
      resolver.loadManifest(makeManifest());
      resolver.reset();
      expect(resolver.isReady()).toBe(false);
    });
  });

  // ─── resolve ───────────────────────────────────────────────────────────────

  describe('resolve', () => {
    it('returns null when no manifest is loaded', () => {
      expect(resolver.resolve(audioId('phoneme.letter.s'))).toBeNull();
    });

    it('returns the entry for a known AudioId', () => {
      const entry = makeEntry('phoneme.letter.s');
      resolver.loadManifest(makeManifest([entry]));

      const result = resolver.resolve(audioId('phoneme.letter.s'));
      expect(result).not.toBeNull();
      expect(result?.id).toBe('phoneme.letter.s');
    });

    it('returns null for an unknown AudioId', () => {
      resolver.loadManifest(makeManifest([makeEntry('phoneme.letter.s')]));
      expect(resolver.resolve(audioId('phoneme.letter.a'))).toBeNull();
    });

    it('does not log any error on a silent miss', () => {
      const spy = vi.spyOn(console, 'error');
      resolver.loadManifest(makeManifest());
      resolver.resolve(audioId('phoneme.letter.s'));
      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ─── resolveRequired ───────────────────────────────────────────────────────

  describe('resolveRequired', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('returns the entry when it exists (no error logged)', () => {
      const spy = vi.spyOn(console, 'error');
      const entry = makeEntry('prompt.seashell_match.s');
      resolver.loadManifest(makeManifest([entry]));

      const result = resolver.resolveRequired(audioId('prompt.seashell_match.s'));
      expect(result).not.toBeNull();
      expect(spy).not.toHaveBeenCalled();
    });

    it('returns null and logs an error when the entry is missing from a loaded manifest', () => {
      const spy = vi.spyOn(console, 'error');
      resolver.loadManifest(makeManifest());

      const result = resolver.resolveRequired(audioId('prompt.seashell_match.s'));
      expect(result).toBeNull();
      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toMatch(/not found in manifest/i);
    });

    it('returns null and logs an error about unloaded manifest', () => {
      const spy = vi.spyOn(console, 'error');
      const result = resolver.resolveRequired(audioId('phoneme.letter.s'));
      expect(result).toBeNull();
      expect(spy).toHaveBeenCalledOnce();
      expect(spy.mock.calls[0][0]).toMatch(/before manifest was loaded/i);
    });
  });

  // ─── getFilePath ───────────────────────────────────────────────────────────

  describe('getFilePath', () => {
    it('returns a leading-slash URL path for a known entry', () => {
      const entry = makeEntry('phoneme.letter.s');
      resolver.loadManifest(makeManifest([entry]));

      const path = resolver.getFilePath(audioId('phoneme.letter.s'));
      expect(path).toBe('/audio/phoneme_letter_s__abc123.mp3');
    });

    it('returns null for an unknown entry', () => {
      resolver.loadManifest(makeManifest());
      expect(resolver.getFilePath(audioId('phoneme.letter.s'))).toBeNull();
    });

    it('returns null when no manifest is loaded', () => {
      expect(resolver.getFilePath(audioId('phoneme.letter.s'))).toBeNull();
    });
  });

  // ─── getEntriesByPriority ──────────────────────────────────────────────────

  describe('getEntriesByPriority', () => {
    it('returns an empty array when no manifest is loaded', () => {
      expect(resolver.getEntriesByPriority('critical')).toEqual([]);
    });

    it('returns only entries matching the given priority', () => {
      const critical = makeEntry('phoneme.letter.s', 'phoneme', 'critical');
      const high = makeEntry('prompt.seashell_match.s', 'prompt', 'high');
      const low = makeEntry('reward.level_complete', 'reward', 'low');

      resolver.loadManifest(makeManifest([critical, high, low]));

      const criticalEntries = resolver.getEntriesByPriority('critical');
      expect(criticalEntries).toHaveLength(1);
      expect(criticalEntries[0].id).toBe('phoneme.letter.s');
    });

    it('returns all entries at a given priority when there are multiple', () => {
      const entries = [
        makeEntry('phoneme.letter.s', 'phoneme', 'critical'),
        makeEntry('phoneme.letter.a', 'phoneme', 'critical'),
        makeEntry('prompt.seashell_match.s', 'prompt', 'high'),
      ];
      resolver.loadManifest(makeManifest(entries));

      expect(resolver.getEntriesByPriority('critical')).toHaveLength(2);
    });

    it('returns an empty array when no entries match', () => {
      resolver.loadManifest(makeManifest([makeEntry('phoneme.letter.s', 'phoneme', 'critical')]));
      expect(resolver.getEntriesByPriority('low')).toEqual([]);
    });
  });

  // ─── getEntriesByTags ─────────────────────────────────────────────────────

  describe('getEntriesByTags', () => {
    it('returns an empty array when no manifest is loaded', () => {
      expect(resolver.getEntriesByTags(['satpin'])).toEqual([]);
    });

    it('returns entries that have at least one matching tag', () => {
      const satpin = makeEntry('phoneme.letter.s', 'phoneme', 'critical', ['satpin', 'level-1']);
      const other = makeEntry('reward.level_complete', 'reward', 'low', ['milestone']);

      resolver.loadManifest(makeManifest([satpin, other]));

      const result = resolver.getEntriesByTags(['satpin']);
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('phoneme.letter.s');
    });

    it('matches on any tag in the provided list (OR semantics)', () => {
      const a = makeEntry('phoneme.letter.s', 'phoneme', 'critical', ['satpin']);
      const b = makeEntry('phoneme.letter.a', 'phoneme', 'critical', ['vowel']);
      const c = makeEntry('reward.level_complete', 'reward', 'low', ['other']);

      resolver.loadManifest(makeManifest([a, b, c]));

      const result = resolver.getEntriesByTags(['satpin', 'vowel']);
      expect(result).toHaveLength(2);
    });

    it('returns an empty array when no entries match', () => {
      resolver.loadManifest(makeManifest([makeEntry('phoneme.letter.s', 'phoneme', 'critical', ['satpin'])]));
      expect(resolver.getEntriesByTags(['level-4'])).toEqual([]);
    });
  });

  // ─── reset ────────────────────────────────────────────────────────────────

  describe('reset', () => {
    it('removes the loaded manifest', () => {
      resolver.loadManifest(makeManifest([makeEntry('phoneme.letter.s')]));
      resolver.reset();
      expect(resolver.isReady()).toBe(false);
      expect(resolver.resolve(audioId('phoneme.letter.s'))).toBeNull();
    });
  });
});

// ─── Module singleton ─────────────────────────────────────────────────────────

describe('audioResolver singleton', () => {
  beforeEach(() => {
    audioResolver.reset();
  });

  afterEach(() => {
    audioResolver.reset();
  });

  it('is an AudioResolver instance', () => {
    expect(audioResolver).toBeInstanceOf(AudioResolver);
  });

  it('starts unready', () => {
    expect(audioResolver.isReady()).toBe(false);
  });

  it('can be loaded and queried', () => {
    const entry = makeEntry('phoneme.letter.s');
    audioResolver.loadManifest(makeManifest([entry]));
    expect(audioResolver.isReady()).toBe(true);
    expect(audioResolver.resolve(audioId('phoneme.letter.s'))).not.toBeNull();
  });
});
