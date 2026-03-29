/**
 * Tests for the Phrase Extraction Engine  (issues #222–#228 / Audio V5)
 *
 * Covers:
 *  - scanAudioIdMap          (#222) — collects AudioId refs from the ID map
 *  - scanActivities          (#222, #227) — collects refs and detects raw-text violations
 *  - resolveReferences       (#224) — inventory resolution; missing IDs fail clearly
 *  - generateRenderJobs      (#225, #226) — deterministic list; deduplication
 *  - extractPhrases (integration) — full pipeline end-to-end
 *  - formatExtractionDiagnostics (#228) — readable report output
 *  - Required vs optional classification (#223)
 */

import { describe, it, expect } from 'vitest';
import {
  scanAudioIdMap,
  scanActivities,
  resolveReferences,
  generateRenderJobs,
  extractPhrases,
  formatExtractionDiagnostics,
} from '../phraseExtractionEngine';
import type { AudioPhrasesInventory, AudioPhraseEntry } from '../../types/audioPhrases';
import type { PhonicsActivityConfig } from '../../types/activity';
import type { ExtractionInput } from '../../types/extraction';
import { audioId } from '../../types/audioId';
import { PHONICS_AUDIO_ID_MAP } from '../../data/phonicsAudioIds';
import inventoryRaw from '../../data/audio-phrases.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal valid AudioPhrasesInventory for testing. */
function makeInventory(phrases: AudioPhraseEntry[]): AudioPhrasesInventory {
  return { schemaVersion: '1.0.0', updatedAt: '2026-01-01', phrases };
}

/** Minimal valid AudioPhraseEntry. */
function makeEntry(overrides: Partial<AudioPhraseEntry> = {}): AudioPhraseEntry {
  return {
    id: audioId('phoneme.letter.s'),
    type: 'phoneme',
    text: 'S says sss',
    voiceProfile: 'mermaid-default',
    locale: 'en-US',
    renderStrategy: 'tts',
    sourceRefs: [],
    tags: ['satpin'],
    status: 'active',
    phonicsMetadata: {
      phonemeSymbol: 's',
      isolationRequired: true,
      maxDurationMs: 1500,
      allowLetterName: true,
      reviewRequired: false,
    },
    ...overrides,
  };
}

/** Minimal valid activity with a raw ttsText prompt. */
function makeActivity(
  overrides: Partial<PhonicsActivityConfig> = {},
): PhonicsActivityConfig {
  return {
    id: 'ra-test',
    title: 'Test Activity',
    type: 'letter-sound',
    prompt: { kind: 'text', text: 'Test prompt', ttsText: 'Test prompt TTS' },
    options: [],
    correctOptionId: '',
    feedback: { correctMessage: 'Great!', incorrectMessage: 'Try again!' },
    reward: { xp: 10, item: 'Badge', emoji: '🏅' },
    completionCondition: { type: 'single-correct' },
    progression: { targetSound: 'a', difficultyLevel: 1, progressionStage: 'letter-sound' },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// scanAudioIdMap — issue #222
// ---------------------------------------------------------------------------

describe('scanAudioIdMap', () => {
  it('returns one reference per key in the ID map', () => {
    const idMap = {
      'phoneme.letter.s': 'S says sss',
      'phoneme.letter.a': 'A says aah',
      'feedback.correct': 'Well done!',
    };
    const refs = scanAudioIdMap(idMap);
    expect(refs).toHaveLength(3);
  });

  it('each reference has the correct audioId', () => {
    const idMap = { 'word.cvc.sat': 'sat' };
    const refs = scanAudioIdMap(idMap);
    expect(refs[0].audioId).toBe('word.cvc.sat');
  });

  it('all references are required', () => {
    const idMap = { 'phoneme.letter.s': 'S says sss', 'word.cvc.sat': 'sat' };
    const refs = scanAudioIdMap(idMap);
    for (const ref of refs) {
      expect(ref.required, `ref ${ref.audioId} should be required`).toBe(true);
    }
  });

  it('source file is data/phonicsAudioIds.ts', () => {
    const idMap = { 'phoneme.letter.s': 'S says sss' };
    const refs = scanAudioIdMap(idMap);
    expect(refs[0].sourceFile).toBe('data/phonicsAudioIds.ts');
  });

  it('source path matches the AudioId key', () => {
    const idMap = { 'prompt.echo_song.default': 'Echo!' };
    const refs = scanAudioIdMap(idMap);
    expect(refs[0].sourcePath).toBe('prompt.echo_song.default');
  });

  it('ignores malformed keys that are not valid AudioIds', () => {
    const idMap = { 'not-a-valid-id': 'text', 'phoneme.letter.s': 'S says sss' };
    const refs = scanAudioIdMap(idMap);
    expect(refs).toHaveLength(1);
    expect(refs[0].audioId).toBe('phoneme.letter.s');
  });

  it('returns refs sorted alphabetically by audioId', () => {
    const idMap = {
      'word.cvc.sat': 'sat',
      'phoneme.letter.s': 'S says sss',
      'feedback.correct': 'Well done!',
    };
    const refs = scanAudioIdMap(idMap);
    const ids = refs.map((r) => r.audioId);
    expect(ids).toEqual([...ids].sort());
  });

  it('returns an empty array for an empty ID map', () => {
    const refs = scanAudioIdMap({});
    expect(refs).toHaveLength(0);
  });

  it('processes every entry in PHONICS_AUDIO_ID_MAP', () => {
    const refs = scanAudioIdMap(PHONICS_AUDIO_ID_MAP);
    expect(refs.length).toBe(Object.keys(PHONICS_AUDIO_ID_MAP).length);
  });
});

// ---------------------------------------------------------------------------
// scanActivities — issue #222 + #227
// ---------------------------------------------------------------------------

describe('scanActivities — prompt audioId field', () => {
  it('collects a prompt audioId reference when present', () => {
    const activity = makeActivity({
      prompt: { kind: 'text', text: 'T', ttsText: 'T', audioId: 'prompt.seashell_match.s' } as never,
    });
    const { refs, violations } = scanActivities([activity]);
    expect(refs).toHaveLength(1);
    expect(refs[0].audioId).toBe('prompt.seashell_match.s');
    expect(violations).toHaveLength(0);
  });

  it('prompt audioId reference is always required', () => {
    const activity = makeActivity({
      prompt: { kind: 'text', text: 'T', ttsText: 'T', audioId: 'prompt.seashell_match.s' } as never,
    });
    const { refs } = scanActivities([activity]);
    expect(refs[0].required).toBe(true);
  });
});

describe('scanActivities — raw-text violations (#227)', () => {
  it('flags prompt.ttsText as a violation when no audioId is present', () => {
    const activity = makeActivity();
    const { violations } = scanActivities([activity]);
    const promptViolation = violations.find((v) => v.sourcePath.includes('prompt'));
    expect(promptViolation).toBeDefined();
    expect(promptViolation!.text).toBe('Test prompt TTS');
  });

  it('prompt ttsText violation is required for all variants', () => {
    for (const variant of [undefined, 'default', 'seashell', 'bubble-pop', 'fish-feed']) {
      const activity = makeActivity({ uiVariant: variant as never });
      const { violations } = scanActivities([activity]);
      const v = violations.find((v) => v.sourcePath.includes('prompt'));
      expect(v?.required, `prompt should be required for variant "${variant}"`).toBe(true);
    }
  });

  it('does NOT produce a violation when audioId is present on prompt', () => {
    const activity = makeActivity({
      prompt: { kind: 'text', text: 'T', ttsText: undefined as never, audioId: 'prompt.fish_feed.s' } as never,
    });
    const { violations } = scanActivities([activity]);
    const promptViolation = violations.find((v) => v.sourcePath.includes('prompt'));
    expect(promptViolation).toBeUndefined();
  });

  it('flags option ttsText as violation for seashell variant', () => {
    const activity = makeActivity({
      uiVariant: 'seashell',
      options: [{ id: 'o1', text: 'S', ttsText: 'S says sss' }],
    });
    const { violations } = scanActivities([activity]);
    const optViolation = violations.find((v) => v.sourcePath.includes('options'));
    expect(optViolation).toBeDefined();
    expect(optViolation!.required).toBe(true);
  });

  it('option ttsText violation is optional for default variant', () => {
    const activity = makeActivity({
      uiVariant: 'default',
      options: [{ id: 'o1', text: 'A', ttsText: 'A says aah' }],
    });
    const { violations } = scanActivities([activity]);
    const optViolation = violations.find((v) => v.sourcePath.includes('options'));
    expect(optViolation).toBeDefined();
    expect(optViolation!.required).toBe(false);
  });

  it('flags bin ttsText as required violation for treasure-sort', () => {
    const activity = makeActivity({
      uiVariant: 'treasure-sort',
      bins: [{ id: 'bin-s', label: 'S', sound: 's', ttsText: 'S says s like in snake' }],
    });
    const { violations } = scanActivities([activity]);
    const binViolation = violations.find((v) => v.sourcePath.includes('bins'));
    expect(binViolation).toBeDefined();
    expect(binViolation!.required).toBe(true);
  });

  it('flags rhythmBeat ttsText as required violation for echo-song', () => {
    const activity = makeActivity({
      uiVariant: 'echo-song',
      rhythmBeats: [{ sound: 's', ttsText: 'sss', displayText: 'S' }],
    });
    const { violations } = scanActivities([activity]);
    const beatViolation = violations.find((v) => v.sourcePath.includes('rhythmBeats'));
    expect(beatViolation).toBeDefined();
    expect(beatViolation!.required).toBe(true);
  });

  it('includes the correct sourceFile path', () => {
    const activity = makeActivity();
    const { violations } = scanActivities([activity]);
    for (const v of violations) {
      expect(v.sourceFile).toBe('data/readingActivities.json');
    }
  });

  it('sourcePath includes activity index', () => {
    const activities = [makeActivity({ id: 'ra-0' }), makeActivity({ id: 'ra-1' })];
    const { violations } = scanActivities(activities);
    const paths = violations.map((v) => v.sourcePath);
    expect(paths.some((p) => p.startsWith('activities[0]'))).toBe(true);
    expect(paths.some((p) => p.startsWith('activities[1]'))).toBe(true);
  });

  it('returns no refs when only ttsText is present', () => {
    const activity = makeActivity();
    const { refs } = scanActivities([activity]);
    expect(refs).toHaveLength(0);
  });

  it('handles activities with no options gracefully', () => {
    const activity = makeActivity({ options: [] });
    expect(() => scanActivities([activity])).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// resolveReferences — issue #224
// ---------------------------------------------------------------------------

describe('resolveReferences', () => {
  it('resolves IDs present in inventory', () => {
    const entry = makeEntry({ id: audioId('phoneme.letter.s') });
    const inventory = makeInventory([entry]);
    const refs = [
      { audioId: audioId('phoneme.letter.s'), sourceFile: 'f', sourcePath: 'p', required: true },
    ];
    const { resolved, missing } = resolveReferences(refs, inventory);
    expect(resolved.has(audioId('phoneme.letter.s'))).toBe(true);
    expect(missing).toHaveLength(0);
  });

  it('places IDs not in inventory in the missing list', () => {
    const inventory = makeInventory([]);
    const refs = [
      { audioId: audioId('word.cvc.sat'), sourceFile: 'f', sourcePath: 'p', required: true },
    ];
    const { resolved, missing } = resolveReferences(refs, inventory);
    expect(resolved.size).toBe(0);
    expect(missing).toContain('word.cvc.sat');
  });

  it('does NOT resolve entries with status=blocked', () => {
    const entry = makeEntry({ id: audioId('phoneme.letter.s'), status: 'blocked' });
    const inventory = makeInventory([entry]);
    const refs = [
      { audioId: audioId('phoneme.letter.s'), sourceFile: 'f', sourcePath: 'p', required: true },
    ];
    const { resolved, missing } = resolveReferences(refs, inventory);
    expect(resolved.size).toBe(0);
    expect(missing).toContain('phoneme.letter.s');
  });

  it('does NOT resolve entries with status=deprecated', () => {
    const entry = makeEntry({ id: audioId('phoneme.letter.s'), status: 'deprecated' });
    const inventory = makeInventory([entry]);
    const refs = [
      { audioId: audioId('phoneme.letter.s'), sourceFile: 'f', sourcePath: 'p', required: true },
    ];
    const { resolved, missing } = resolveReferences(refs, inventory);
    expect(resolved.size).toBe(0);
    expect(missing).toContain('phoneme.letter.s');
  });

  it('DOES resolve experimental entries', () => {
    const entry = makeEntry({ id: audioId('phoneme.letter.s'), status: 'experimental' });
    const inventory = makeInventory([entry]);
    const refs = [
      { audioId: audioId('phoneme.letter.s'), sourceFile: 'f', sourcePath: 'p', required: false },
    ];
    const { resolved } = resolveReferences(refs, inventory);
    expect(resolved.has(audioId('phoneme.letter.s'))).toBe(true);
  });

  it('handles duplicate references to the same ID', () => {
    const entry = makeEntry({ id: audioId('phoneme.letter.s') });
    const inventory = makeInventory([entry]);
    const refs = [
      { audioId: audioId('phoneme.letter.s'), sourceFile: 'f1', sourcePath: 'p1', required: true },
      { audioId: audioId('phoneme.letter.s'), sourceFile: 'f2', sourcePath: 'p2', required: true },
    ];
    const { resolved, missing } = resolveReferences(refs, inventory);
    expect(resolved.size).toBe(1);
    expect(missing).toHaveLength(0);
  });

  it('resolved map carries the full inventory entry', () => {
    const entry = makeEntry({
      id: audioId('word.cvc.sat'),
      text: 'sat',
      type: 'word',
      phonicsMetadata: undefined,
      sourceRefs: [],
    });
    const inventory = makeInventory([entry]);
    const refs = [
      { audioId: audioId('word.cvc.sat'), sourceFile: 'f', sourcePath: 'p', required: true },
    ];
    const { resolved } = resolveReferences(refs, inventory);
    expect(resolved.get(audioId('word.cvc.sat'))?.text).toBe('sat');
  });

  it('missing list is sorted alphabetically', () => {
    const inventory = makeInventory([]);
    const refs = [
      { audioId: audioId('word.cvc.sat'), sourceFile: 'f', sourcePath: 'p', required: true },
      { audioId: audioId('feedback.correct'), sourceFile: 'f', sourcePath: 'p', required: true },
      { audioId: audioId('phoneme.letter.s'), sourceFile: 'f', sourcePath: 'p', required: true },
    ];
    const { missing } = resolveReferences(refs, inventory);
    expect(missing).toEqual([...missing].sort());
  });
});

// ---------------------------------------------------------------------------
// generateRenderJobs — issues #225 (determinism) + #226 (deduplication)
// ---------------------------------------------------------------------------

describe('generateRenderJobs', () => {
  it('returns one job per resolved AudioId', () => {
    const entry = makeEntry({ id: audioId('phoneme.letter.s') });
    const resolved = new Map([[audioId('phoneme.letter.s'), entry]]);
    const refs = [
      { audioId: audioId('phoneme.letter.s'), sourceFile: 'f', sourcePath: 'p', required: true },
    ];
    const jobs = generateRenderJobs(refs, resolved);
    expect(jobs).toHaveLength(1);
  });

  it('job fields match the inventory entry', () => {
    const entry = makeEntry({
      id: audioId('word.cvc.sat'),
      text: 'sat',
      voiceProfile: 'narrator',
      locale: 'en-GB',
      renderStrategy: 'prerecorded',
      type: 'word',
      phonicsMetadata: undefined,
      sourceRefs: [],
    });
    const resolved = new Map([[audioId('word.cvc.sat'), entry]]);
    const refs = [
      { audioId: audioId('word.cvc.sat'), sourceFile: 'f', sourcePath: 'p', required: true },
    ];
    const jobs = generateRenderJobs(refs, resolved);
    expect(jobs[0]).toMatchObject({
      id: 'word.cvc.sat',
      text: 'sat',
      voiceProfile: 'narrator',
      locale: 'en-GB',
      renderStrategy: 'prerecorded',
    });
  });

  it('output is sorted alphabetically by id (issue #225)', () => {
    const entries: [AudioId, AudioPhraseEntry][] = [
      [audioId('word.cvc.sat'), makeEntry({ id: audioId('word.cvc.sat'), text: 'sat', type: 'word', phonicsMetadata: undefined, sourceRefs: [] })],
      [audioId('feedback.correct'), makeEntry({ id: audioId('feedback.correct'), type: 'feedback', text: 'Well done', phonicsMetadata: undefined, sourceRefs: [] })],
      [audioId('phoneme.letter.s'), makeEntry({ id: audioId('phoneme.letter.s') })],
    ];
    const resolved = new Map(entries);
    const refs = entries.map(([id]) => ({
      audioId: id,
      sourceFile: 'f',
      sourcePath: id,
      required: true,
    }));
    const jobs = generateRenderJobs(refs, resolved);
    const ids = jobs.map((j) => j.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('deduplicates: same AudioId from two sources → one job with two sources (issue #226)', () => {
    const entry = makeEntry({ id: audioId('phoneme.letter.s') });
    const resolved = new Map([[audioId('phoneme.letter.s'), entry]]);
    const refs = [
      { audioId: audioId('phoneme.letter.s'), sourceFile: 'f1', sourcePath: 'p1', required: true },
      { audioId: audioId('phoneme.letter.s'), sourceFile: 'f2', sourcePath: 'p2', required: true },
    ];
    const jobs = generateRenderJobs(refs, resolved);
    expect(jobs).toHaveLength(1);
    expect(jobs[0].sources).toHaveLength(2);
  });

  it('sources list contains file, path and required fields', () => {
    const entry = makeEntry({ id: audioId('phoneme.letter.s') });
    const resolved = new Map([[audioId('phoneme.letter.s'), entry]]);
    const refs = [
      { audioId: audioId('phoneme.letter.s'), sourceFile: 'data/phonicsAudioIds.ts', sourcePath: 'phoneme.letter.s', required: true },
    ];
    const jobs = generateRenderJobs(refs, resolved);
    expect(jobs[0].sources[0]).toMatchObject({
      file: 'data/phonicsAudioIds.ts',
      path: 'phoneme.letter.s',
      required: true,
    });
  });

  it('IDs not in resolved map produce no job', () => {
    const resolved = new Map<AudioId, AudioPhraseEntry>();
    const refs = [
      { audioId: audioId('word.cvc.sat'), sourceFile: 'f', sourcePath: 'p', required: true },
    ];
    const jobs = generateRenderJobs(refs, resolved);
    expect(jobs).toHaveLength(0);
  });

  it('output is stable across multiple calls with same input (issue #225)', () => {
    const entry = makeEntry({ id: audioId('phoneme.letter.s') });
    const resolved = new Map([[audioId('phoneme.letter.s'), entry]]);
    const refs = [
      { audioId: audioId('phoneme.letter.s'), sourceFile: 'f', sourcePath: 'p', required: true },
    ];
    const jobs1 = generateRenderJobs(refs, resolved);
    const jobs2 = generateRenderJobs(refs, resolved);
    expect(jobs1).toEqual(jobs2);
  });
});

// ---------------------------------------------------------------------------
// Required vs optional classification — issue #223
// ---------------------------------------------------------------------------

describe('Required vs optional per variant (#223)', () => {
  it('prompt is required for seashell variant', () => {
    const activity = makeActivity({ uiVariant: 'seashell' });
    const { violations } = scanActivities([activity]);
    const v = violations.find((x) => x.sourcePath.includes('prompt'));
    expect(v?.required).toBe(true);
  });

  it('option ttsText is required for bubble-pop variant', () => {
    const activity = makeActivity({
      uiVariant: 'bubble-pop',
      options: [{ id: 'o1', text: 'S', ttsText: 'S says sss' }],
    });
    const { violations } = scanActivities([activity]);
    const v = violations.find((x) => x.sourcePath.includes('options'));
    expect(v?.required).toBe(true);
  });

  it('option ttsText is required for fish-feed variant', () => {
    const activity = makeActivity({
      uiVariant: 'fish-feed',
      options: [{ id: 'o1', text: 'Sun', ttsText: 'Sun' }],
    });
    const { violations } = scanActivities([activity]);
    const v = violations.find((x) => x.sourcePath.includes('options'));
    expect(v?.required).toBe(true);
  });

  it('option ttsText is optional for word-builder variant', () => {
    const activity = makeActivity({
      uiVariant: 'word-builder',
      options: [{ id: 'o1', text: 'S', ttsText: 'S says sss' }],
    });
    const { violations } = scanActivities([activity]);
    const v = violations.find((x) => x.sourcePath.includes('options'));
    expect(v?.required).toBe(false);
  });

  it('bin ttsText is optional for non-treasure-sort variants', () => {
    // bins on a non-treasure-sort activity would be unusual but defensively handled
    const activity = makeActivity({
      uiVariant: 'default',
      bins: [{ id: 'bin-s', label: 'S', sound: 's', ttsText: 'S says sss' }],
    });
    const { violations } = scanActivities([activity]);
    const v = violations.find((x) => x.sourcePath.includes('bins'));
    expect(v?.required).toBe(false);
  });

  it('rhythmBeat ttsText is optional for non-echo-song variants', () => {
    const activity = makeActivity({
      uiVariant: 'default',
      rhythmBeats: [{ sound: 's', ttsText: 'sss', displayText: 'S' }],
    });
    const { violations } = scanActivities([activity]);
    const v = violations.find((x) => x.sourcePath.includes('rhythmBeats'));
    expect(v?.required).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// extractPhrases — integration (#222–#228)
// ---------------------------------------------------------------------------

describe('extractPhrases integration', () => {
  const minimalInventory = makeInventory([
    makeEntry({ id: audioId('phoneme.letter.s') }),
    makeEntry({ id: audioId('feedback.correct'), type: 'feedback', text: 'Well done', phonicsMetadata: undefined, sourceRefs: [] }),
  ]);

  it('returns render jobs for all resolved IDs', () => {
    const input: ExtractionInput = {
      inventory: minimalInventory,
      audioIdMap: {
        'phoneme.letter.s': 'S says sss',
        'feedback.correct': 'Well done',
      },
      activities: [],
    };
    const result = extractPhrases(input);
    expect(result.renderJobs).toHaveLength(2);
  });

  it('produces no errors when all required IDs resolve', () => {
    const input: ExtractionInput = {
      inventory: minimalInventory,
      audioIdMap: {
        'phoneme.letter.s': 'S says sss',
        'feedback.correct': 'Well done',
      },
      activities: [],
    };
    const result = extractPhrases(input);
    expect(result.errors).toHaveLength(0);
  });

  it('produces an error for a missing required ID (#224)', () => {
    const input: ExtractionInput = {
      inventory: makeInventory([]),
      audioIdMap: { 'phoneme.letter.s': 'S says sss' },
      activities: [],
    };
    const result = extractPhrases(input);
    expect(result.errors.some((e) => e.includes('phoneme.letter.s'))).toBe(true);
    expect(result.errors.some((e) => e.includes('missing-required'))).toBe(true);
  });

  it('produces an error for required raw-text violations (#227)', () => {
    const input: ExtractionInput = {
      inventory: minimalInventory,
      audioIdMap: {},
      activities: [makeActivity({ uiVariant: 'seashell' })],
    };
    const result = extractPhrases(input);
    expect(result.errors.some((e) => e.includes('raw-text'))).toBe(true);
  });

  it('produces a warning (not an error) for optional raw-text violations', () => {
    const input: ExtractionInput = {
      inventory: minimalInventory,
      audioIdMap: {},
      activities: [
        makeActivity({
          uiVariant: 'default',
          options: [{ id: 'o1', text: 'A', ttsText: 'A says aah' }],
        }),
      ],
    };
    const result = extractPhrases(input);
    // prompt violation is required → error
    // option violation is optional → warning only
    const optionErrors = result.errors.filter((e) => e.includes('options'));
    const optionWarnings = result.warnings.filter((w) => w.includes('options'));
    expect(optionErrors).toHaveLength(0);
    expect(optionWarnings.length).toBeGreaterThan(0);
  });

  it('deduplicates: same ID from idMap and activity produces one render job (#226)', () => {
    const activity = makeActivity({
      prompt: { kind: 'text', text: 'T', ttsText: undefined as never, audioId: 'phoneme.letter.s' } as never,
    });
    const input: ExtractionInput = {
      inventory: minimalInventory,
      audioIdMap: { 'phoneme.letter.s': 'S says sss' },
      activities: [activity],
    };
    const result = extractPhrases(input);
    const jobs = result.renderJobs.filter((j) => j.id === 'phoneme.letter.s');
    expect(jobs).toHaveLength(1);
    expect(jobs[0].sources.length).toBeGreaterThanOrEqual(2);
  });

  it('render jobs are sorted alphabetically by id (#225)', () => {
    const input: ExtractionInput = {
      inventory: minimalInventory,
      audioIdMap: {
        'phoneme.letter.s': 'S says sss',
        'feedback.correct': 'Well done',
      },
      activities: [],
    };
    const result = extractPhrases(input);
    const ids = result.renderJobs.map((j) => j.id);
    expect(ids).toEqual([...ids].sort());
  });

  it('unreferenced active entries appear in diagnostics.unreferenced', () => {
    const extraEntry = makeEntry({
      id: audioId('reward.level_complete'),
      type: 'reward',
      text: 'Amazing!',
      phonicsMetadata: undefined,
      sourceRefs: [],
    });
    const inventory = makeInventory([makeEntry(), extraEntry]);
    const input: ExtractionInput = {
      inventory,
      audioIdMap: { 'phoneme.letter.s': 'S says sss' },
      activities: [],
    };
    const result = extractPhrases(input);
    expect(result.diagnostics.unreferenced).toContain('reward.level_complete');
  });

  it('diagnostics.duplicates lists IDs referenced more than once', () => {
    const entry = makeEntry({ id: audioId('phoneme.letter.s') });
    const activity = makeActivity({
      prompt: { kind: 'text', text: 'T', ttsText: undefined as never, audioId: 'phoneme.letter.s' } as never,
    });
    const input: ExtractionInput = {
      inventory: makeInventory([entry]),
      audioIdMap: { 'phoneme.letter.s': 'S says sss' },
      activities: [activity],
    };
    const result = extractPhrases(input);
    expect(result.diagnostics.duplicates).toContain('phoneme.letter.s');
  });

  it('diagnostics.optional lists IDs with only optional references', () => {
    const entry = makeEntry({
      id: audioId('feedback.correct'),
      type: 'feedback',
      text: 'Well done',
      phonicsMetadata: undefined,
      sourceRefs: [],
    });
    const activity = makeActivity({
      options: [{ id: 'o1', text: 'A', audioId: 'feedback.correct' } as never],
    });
    const input: ExtractionInput = {
      inventory: makeInventory([entry]),
      audioIdMap: {},
      activities: [activity],
    };
    const result = extractPhrases(input);
    // option on default variant → optional
    expect(result.diagnostics.optional).toContain('feedback.correct');
  });
});

// ---------------------------------------------------------------------------
// formatExtractionDiagnostics — issue #228
// ---------------------------------------------------------------------------

describe('formatExtractionDiagnostics', () => {
  const baseDiagnostics = {
    resolved: [audioId('phoneme.letter.s'), audioId('feedback.correct')],
    missing: [],
    duplicates: [],
    optional: [],
    rawTextViolations: [],
    unreferenced: [],
  };

  it('includes resolved count', () => {
    const output = formatExtractionDiagnostics(baseDiagnostics);
    expect(output).toMatch(/Resolved\s*:\s*2/);
  });

  it('includes missing count', () => {
    const output = formatExtractionDiagnostics({ ...baseDiagnostics, missing: [audioId('word.cvc.sat')] });
    expect(output).toMatch(/Missing\s*:\s*1/);
  });

  it('lists missing IDs in the output', () => {
    const output = formatExtractionDiagnostics({ ...baseDiagnostics, missing: [audioId('word.cvc.sat')] });
    expect(output).toContain('word.cvc.sat');
  });

  it('lists duplicate IDs in the output', () => {
    const output = formatExtractionDiagnostics({ ...baseDiagnostics, duplicates: [audioId('phoneme.letter.s')] });
    expect(output).toContain('phoneme.letter.s');
  });

  it('lists raw-text violations with required flag', () => {
    const output = formatExtractionDiagnostics({
      ...baseDiagnostics,
      rawTextViolations: [
        { text: 'S says sss', sourceFile: 'data/readingActivities.json', sourcePath: 'activities[0].prompt.ttsText', required: true },
      ],
    });
    expect(output).toContain('[required]');
    expect(output).toContain('S says sss');
  });

  it('lists optional raw-text violations with optional flag', () => {
    const output = formatExtractionDiagnostics({
      ...baseDiagnostics,
      rawTextViolations: [
        { text: 'Opt text', sourceFile: 'data/readingActivities.json', sourcePath: 'activities[0].options[0].ttsText', required: false },
      ],
    });
    expect(output).toContain('[optional]');
  });

  it('lists unreferenced IDs in the output', () => {
    const output = formatExtractionDiagnostics({
      ...baseDiagnostics,
      unreferenced: [audioId('reward.badge_earned')],
    });
    expect(output).toContain('reward.badge_earned');
  });

  it('returns a non-empty string', () => {
    const output = formatExtractionDiagnostics(baseDiagnostics);
    expect(output.trim().length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// Integration with real data — PHONICS_AUDIO_ID_MAP + audio-phrases.json
// ---------------------------------------------------------------------------

describe('Integration with real data', () => {
  const inventory = inventoryRaw as AudioPhrasesInventory;

  it('every PHONICS_AUDIO_ID_MAP key resolves against the real inventory', () => {
    const input: ExtractionInput = {
      inventory,
      audioIdMap: PHONICS_AUDIO_ID_MAP,
      activities: [],
    };
    const result = extractPhrases(input);
    // Should have zero missing required IDs
    const missingRequired = result.errors.filter((e) => e.includes('missing-required'));
    expect(missingRequired).toHaveLength(0);
  });

  it('all resolved render jobs have non-empty text, voiceProfile, locale', () => {
    const input: ExtractionInput = {
      inventory,
      audioIdMap: PHONICS_AUDIO_ID_MAP,
      activities: [],
    };
    const result = extractPhrases(input);
    for (const job of result.renderJobs) {
      expect(job.text.trim(), `${job.id}.text`).not.toBe('');
      expect(job.voiceProfile.trim(), `${job.id}.voiceProfile`).not.toBe('');
      expect(job.locale.trim(), `${job.id}.locale`).not.toBe('');
    }
  });

  it('render job count matches number of active+experimental phrases referenced from map', () => {
    const input: ExtractionInput = {
      inventory,
      audioIdMap: PHONICS_AUDIO_ID_MAP,
      activities: [],
    };
    const result = extractPhrases(input);
    // All map keys should resolve (verified by previous test)
    expect(result.renderJobs.length).toBe(result.diagnostics.resolved.length);
  });

  it('render jobs are deterministic across two runs', () => {
    const input: ExtractionInput = {
      inventory,
      audioIdMap: PHONICS_AUDIO_ID_MAP,
      activities: [],
    };
    const r1 = extractPhrases(input);
    const r2 = extractPhrases(input);
    expect(r1.renderJobs).toEqual(r2.renderJobs);
  });

  it('no duplicate IDs in the render job list', () => {
    const input: ExtractionInput = {
      inventory,
      audioIdMap: PHONICS_AUDIO_ID_MAP,
      activities: [],
    };
    const result = extractPhrases(input);
    const ids = result.renderJobs.map((j) => j.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});
