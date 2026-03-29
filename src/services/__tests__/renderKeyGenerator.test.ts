/**
 * Tests for the Render Key Generator  (issue #231 / Audio V5 v2)
 *
 * Covers:
 *  - normaliseText        — whitespace normalisation for stable hashing
 *  - buildRenderKeyInputs — assembles inputs from a render job + inventory entry
 *  - computeRenderKey     — deterministic hex digest
 *  - getRenderKey         — convenience wrapper
 *
 * Key stability guarantees tested:
 *  - Same inputs → same key (across multiple calls)
 *  - Different text → different key
 *  - Different voiceProfile → different key
 *  - Different locale → different key
 *  - Different renderStrategy → different key
 *  - Different pipelineVersion → different key
 *  - Phonics metadata changes → different key
 *  - Whitespace normalisation does not affect key stability
 */

import { describe, it, expect } from 'vitest';
import {
  normaliseText,
  buildRenderKeyInputs,
  computeRenderKey,
  getRenderKey,
  PIPELINE_VERSION,
} from '../renderKeyGenerator';
import type { AudioRenderJob } from '../../types/extraction';
import type { AudioPhraseEntry } from '../../types/audioPhrases';
import { audioId } from '../../types/audioId';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeJob(overrides: Partial<AudioRenderJob> = {}): AudioRenderJob {
  return {
    id: audioId('phoneme.letter.s'),
    text: 'S says sss',
    voiceProfile: 'mermaid-default',
    locale: 'en-US',
    renderStrategy: 'tts',
    sources: [],
    ...overrides,
  };
}

function makeEntry(
  overrides: Partial<Pick<AudioPhraseEntry, 'phonicsMetadata'>> = {},
): Pick<AudioPhraseEntry, 'phonicsMetadata'> {
  return {
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

// ─── normaliseText ─────────────────────────────────────────────────────────────

describe('normaliseText', () => {
  it('trims leading and trailing whitespace', () => {
    expect(normaliseText('  hello  ')).toBe('hello');
  });

  it('collapses internal whitespace to a single space', () => {
    expect(normaliseText('S  says   sss')).toBe('s says sss');
  });

  it('converts to lowercase', () => {
    expect(normaliseText('S Says SSS')).toBe('s says sss');
  });

  it('returns an empty string for blank input', () => {
    expect(normaliseText('   ')).toBe('');
  });

  it('leaves already-normalised text unchanged', () => {
    expect(normaliseText('s says sss')).toBe('s says sss');
  });
});

// ─── buildRenderKeyInputs ──────────────────────────────────────────────────────

describe('buildRenderKeyInputs', () => {
  it('includes normalised text', () => {
    const job = makeJob({ text: '  S says sss  ' });
    const inputs = buildRenderKeyInputs(job, PIPELINE_VERSION);
    expect(inputs.text).toBe('s says sss');
  });

  it('includes voiceProfile, locale, renderStrategy, pipelineVersion', () => {
    const job = makeJob();
    const inputs = buildRenderKeyInputs(job, '2.0.0');
    expect(inputs.voiceProfile).toBe('mermaid-default');
    expect(inputs.locale).toBe('en-US');
    expect(inputs.renderStrategy).toBe('tts');
    expect(inputs.pipelineVersion).toBe('2.0.0');
  });

  it('includes phonemeSymbol and isolationRequired when phonicsMetadata present', () => {
    const job = makeJob();
    const entry = makeEntry();
    const inputs = buildRenderKeyInputs(job, PIPELINE_VERSION, entry);
    expect(inputs.phonemeSymbol).toBe('s');
    expect(inputs.isolationRequired).toBe(true);
  });

  it('omits phonemeSymbol and isolationRequired when no phonicsMetadata', () => {
    const job = makeJob();
    const inputs = buildRenderKeyInputs(job, PIPELINE_VERSION, { phonicsMetadata: undefined });
    expect(inputs.phonemeSymbol).toBeUndefined();
    expect(inputs.isolationRequired).toBeUndefined();
  });

  it('omits phonics fields when no inventory entry provided', () => {
    const job = makeJob();
    const inputs = buildRenderKeyInputs(job, PIPELINE_VERSION);
    expect(inputs.phonemeSymbol).toBeUndefined();
    expect(inputs.isolationRequired).toBeUndefined();
  });
});

// ─── computeRenderKey ─────────────────────────────────────────────────────────

describe('computeRenderKey', () => {
  it('returns an 8-character hex string', () => {
    const job = makeJob();
    const inputs = buildRenderKeyInputs(job, PIPELINE_VERSION);
    const key = computeRenderKey(inputs);
    expect(key).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is deterministic: same inputs → same key', () => {
    const job = makeJob();
    const inputs = buildRenderKeyInputs(job, PIPELINE_VERSION);
    expect(computeRenderKey(inputs)).toBe(computeRenderKey(inputs));
  });

  it('changes when text changes', () => {
    const job1 = makeJob({ text: 'S says sss' });
    const job2 = makeJob({ text: 'S says zzz' });
    const k1 = computeRenderKey(buildRenderKeyInputs(job1, PIPELINE_VERSION));
    const k2 = computeRenderKey(buildRenderKeyInputs(job2, PIPELINE_VERSION));
    expect(k1).not.toBe(k2);
  });

  it('changes when voiceProfile changes', () => {
    const job1 = makeJob({ voiceProfile: 'mermaid-default' });
    const job2 = makeJob({ voiceProfile: 'narrator' });
    const k1 = computeRenderKey(buildRenderKeyInputs(job1, PIPELINE_VERSION));
    const k2 = computeRenderKey(buildRenderKeyInputs(job2, PIPELINE_VERSION));
    expect(k1).not.toBe(k2);
  });

  it('changes when locale changes', () => {
    const job1 = makeJob({ locale: 'en-US' });
    const job2 = makeJob({ locale: 'en-GB' });
    const k1 = computeRenderKey(buildRenderKeyInputs(job1, PIPELINE_VERSION));
    const k2 = computeRenderKey(buildRenderKeyInputs(job2, PIPELINE_VERSION));
    expect(k1).not.toBe(k2);
  });

  it('changes when renderStrategy changes', () => {
    const job1 = makeJob({ renderStrategy: 'tts' });
    const job2 = makeJob({ renderStrategy: 'prerecorded' });
    const k1 = computeRenderKey(buildRenderKeyInputs(job1, PIPELINE_VERSION));
    const k2 = computeRenderKey(buildRenderKeyInputs(job2, PIPELINE_VERSION));
    expect(k1).not.toBe(k2);
  });

  it('changes when pipelineVersion changes', () => {
    const job = makeJob();
    const k1 = computeRenderKey(buildRenderKeyInputs(job, '1.0.0'));
    const k2 = computeRenderKey(buildRenderKeyInputs(job, '2.0.0'));
    expect(k1).not.toBe(k2);
  });

  it('changes when phonemeSymbol changes', () => {
    const job = makeJob();
    const entry1 = makeEntry({ phonicsMetadata: { phonemeSymbol: 's', isolationRequired: true, maxDurationMs: 1500, allowLetterName: true, reviewRequired: false } });
    const entry2 = makeEntry({ phonicsMetadata: { phonemeSymbol: 'a', isolationRequired: true, maxDurationMs: 1500, allowLetterName: true, reviewRequired: false } });
    const k1 = computeRenderKey(buildRenderKeyInputs(job, PIPELINE_VERSION, entry1));
    const k2 = computeRenderKey(buildRenderKeyInputs(job, PIPELINE_VERSION, entry2));
    expect(k1).not.toBe(k2);
  });

  it('changes when isolationRequired changes', () => {
    const job = makeJob();
    const entry1 = makeEntry({ phonicsMetadata: { phonemeSymbol: 's', isolationRequired: true, maxDurationMs: 1500, allowLetterName: true, reviewRequired: false } });
    const entry2 = makeEntry({ phonicsMetadata: { phonemeSymbol: 's', isolationRequired: false, maxDurationMs: 1500, allowLetterName: true, reviewRequired: false } });
    const k1 = computeRenderKey(buildRenderKeyInputs(job, PIPELINE_VERSION, entry1));
    const k2 = computeRenderKey(buildRenderKeyInputs(job, PIPELINE_VERSION, entry2));
    expect(k1).not.toBe(k2);
  });

  it('is stable across repeated calls with the same inputs object', () => {
    const job = makeJob();
    const inputs = buildRenderKeyInputs(job, PIPELINE_VERSION, makeEntry());
    const key = computeRenderKey(inputs);
    for (let i = 0; i < 5; i++) {
      expect(computeRenderKey(inputs)).toBe(key);
    }
  });

  it('normalised text does not produce different keys', () => {
    // "  S says sss  " normalises to "s says sss" — same as the trim version
    const job1 = makeJob({ text: '  S says sss  ' });
    const job2 = makeJob({ text: 's says sss' });
    const k1 = computeRenderKey(buildRenderKeyInputs(job1, PIPELINE_VERSION));
    const k2 = computeRenderKey(buildRenderKeyInputs(job2, PIPELINE_VERSION));
    expect(k1).toBe(k2);
  });
});

// ─── getRenderKey (convenience wrapper) ───────────────────────────────────────

describe('getRenderKey', () => {
  it('returns an 8-character hex string', () => {
    const key = getRenderKey(makeJob());
    expect(key).toMatch(/^[0-9a-f]{8}$/);
  });

  it('uses PIPELINE_VERSION as default', () => {
    const job = makeJob();
    const k1 = getRenderKey(job);
    const k2 = getRenderKey(job, PIPELINE_VERSION);
    expect(k1).toBe(k2);
  });

  it('respects an explicit pipelineVersion', () => {
    const job = makeJob();
    const k1 = getRenderKey(job, '1.0.0');
    const k2 = getRenderKey(job, '9.9.9');
    expect(k1).not.toBe(k2);
  });

  it('includes phonics metadata when an inventory entry is passed', () => {
    const job = makeJob();
    const withMeta = getRenderKey(job, PIPELINE_VERSION, makeEntry());
    const withoutMeta = getRenderKey(job, PIPELINE_VERSION);
    // Keys differ because phonicsMetadata contributes to the digest
    expect(withMeta).not.toBe(withoutMeta);
  });
});
