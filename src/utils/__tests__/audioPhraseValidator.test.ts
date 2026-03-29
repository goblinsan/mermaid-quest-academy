/**
 * Tests for the audio phrase schema validator  (issue #209 / Audio V5)
 *
 * Covers:
 *  - validateAudioPhraseEntry: all required fields, type-specific contracts,
 *    phonicsMetadata rules, lifecycle constraints, edge cases
 *  - validateAudioPhrasesInventory: root fields, duplicate IDs,
 *    empty phrase list, per-entry errors
 *  - audio-phrases.json: the starter inventory passes full validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateAudioPhraseEntry,
  validateAudioPhrasesInventory,
} from '../audioPhraseValidator';
import type { AudioPhrasesInventory } from '../../types/audioPhrases';
import inventoryRaw from '../../data/audio-phrases.json';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns a valid 'phoneme' entry that can be tweaked per test. */
function makePhoneme(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'phoneme.letter.s',
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

/** Returns a valid 'prompt' entry that can be tweaked per test. */
function makePrompt(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'prompt.seashell_match.s',
    type: 'prompt',
    text: 'Tap the shell that makes the s sound',
    voiceProfile: 'mermaid-default',
    locale: 'en-US',
    renderStrategy: 'tts',
    sourceRefs: [{ type: 'activity', id: 'ra-s-seashell' }],
    tags: ['level-1'],
    status: 'active',
    ...overrides,
  };
}

/** Returns a valid 'word' entry. */
function makeWord(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    id: 'word.cvc.sat',
    type: 'word',
    text: 'sat',
    voiceProfile: 'mermaid-default',
    locale: 'en-US',
    renderStrategy: 'tts',
    sourceRefs: [],
    tags: ['cvc'],
    status: 'active',
    ...overrides,
  };
}

/** Returns a minimal valid inventory. */
function makeInventory(
  overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
  return {
    schemaVersion: '1.0.0',
    updatedAt: '2026-01-01',
    phrases: [makePhoneme()],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// validateAudioPhraseEntry — valid entries
// ---------------------------------------------------------------------------

describe('validateAudioPhraseEntry — valid entries', () => {
  it('accepts a well-formed phoneme entry', () => {
    const result = validateAudioPhraseEntry(makePhoneme());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a well-formed prompt entry', () => {
    const result = validateAudioPhraseEntry(makePrompt());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a well-formed word entry (no phonicsMetadata)', () => {
    const result = validateAudioPhraseEntry(makeWord());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('accepts a feedback entry with no sourceRefs', () => {
    const result = validateAudioPhraseEntry({
      id: 'feedback.correct',
      type: 'feedback',
      text: 'Great job!',
      voiceProfile: 'mermaid-default',
      locale: 'en-US',
      renderStrategy: 'tts',
      sourceRefs: [],
      tags: [],
      status: 'active',
    });
    expect(result.valid).toBe(true);
  });

  it('accepts a ui entry', () => {
    const result = validateAudioPhraseEntry({
      id: 'ui.tap',
      type: 'ui',
      text: 'tap',
      voiceProfile: 'mermaid-default',
      locale: 'en-US',
      renderStrategy: 'tts',
      sourceRefs: [],
      tags: [],
      status: 'active',
    });
    expect(result.valid).toBe(true);
  });

  it('accepts a replaced entry with replacedBy set', () => {
    const result = validateAudioPhraseEntry(
      makeWord({ status: 'replaced', replacedBy: 'word.cvc.sat' }),
    );
    expect(result.valid).toBe(true);
  });

  it('accepts an entry with optional notes field', () => {
    const result = validateAudioPhraseEntry(makeWord({ notes: 'Reviewed 2026-01-01' }));
    expect(result.valid).toBe(true);
  });

  it('accepts a word entry with optional phonicsMetadata', () => {
    const result = validateAudioPhraseEntry(
      makeWord({
        phonicsMetadata: {
          phonemeSymbol: 's',
          isolationRequired: false,
          maxDurationMs: 2000,
          allowLetterName: false,
          reviewRequired: false,
        },
      }),
    );
    expect(result.valid).toBe(true);
  });

  it('accepts all valid status values', () => {
    for (const status of ['active', 'deprecated', 'experimental', 'blocked', 'replaced'] as const) {
      const overrides: Record<string, unknown> = { status };
      if (status === 'replaced') overrides.replacedBy = 'word.cvc.sat';
      const result = validateAudioPhraseEntry(makeWord(overrides));
      expect(result.valid, `status "${status}" should be accepted`).toBe(true);
    }
  });

  it('accepts all valid renderStrategy values', () => {
    for (const strategy of ['tts', 'prerecorded'] as const) {
      const result = validateAudioPhraseEntry(makeWord({ renderStrategy: strategy }));
      expect(result.valid, `renderStrategy "${strategy}" should be accepted`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// validateAudioPhraseEntry — invalid id
// ---------------------------------------------------------------------------

describe('validateAudioPhraseEntry — invalid id', () => {
  it('rejects a missing id', () => {
    const { id: _, ...noId } = makePhoneme();
    const result = validateAudioPhraseEntry(noId);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.id'))).toBe(true);
  });

  it('rejects an empty id', () => {
    const result = validateAudioPhraseEntry(makePhoneme({ id: '' }));
    expect(result.valid).toBe(false);
  });

  it('rejects an id with an unregistered category', () => {
    const result = validateAudioPhraseEntry(makePhoneme({ id: 'audio.letter.s' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('AudioId'))).toBe(true);
  });

  it('rejects an id with uppercase letters', () => {
    const result = validateAudioPhraseEntry(makePhoneme({ id: 'Phoneme.letter.s' }));
    expect(result.valid).toBe(false);
  });

  it('rejects an id with only one segment', () => {
    const result = validateAudioPhraseEntry(makePhoneme({ id: 'phoneme' }));
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateAudioPhraseEntry — invalid type
// ---------------------------------------------------------------------------

describe('validateAudioPhraseEntry — invalid type', () => {
  it('rejects an unknown type', () => {
    const result = validateAudioPhraseEntry(makePhoneme({ type: 'sound' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.type'))).toBe(true);
  });

  it('rejects a missing type', () => {
    const { type: _, ...noType } = makePhoneme();
    const result = validateAudioPhraseEntry(noType);
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// validateAudioPhraseEntry — text / voiceProfile / locale / renderStrategy
// ---------------------------------------------------------------------------

describe('validateAudioPhraseEntry — required string fields', () => {
  it('rejects empty text', () => {
    const result = validateAudioPhraseEntry(makePhoneme({ text: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.text'))).toBe(true);
  });

  it('rejects whitespace-only text', () => {
    const result = validateAudioPhraseEntry(makePhoneme({ text: '   ' }));
    expect(result.valid).toBe(false);
  });

  it('rejects empty voiceProfile', () => {
    const result = validateAudioPhraseEntry(makePhoneme({ voiceProfile: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.voiceProfile'))).toBe(true);
  });

  it('rejects empty locale', () => {
    const result = validateAudioPhraseEntry(makePhoneme({ locale: '' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.locale'))).toBe(true);
  });

  it('rejects an invalid renderStrategy', () => {
    const result = validateAudioPhraseEntry(makePhoneme({ renderStrategy: 'stream' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.renderStrategy'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateAudioPhraseEntry — sourceRefs
// ---------------------------------------------------------------------------

describe('validateAudioPhraseEntry — sourceRefs', () => {
  it('rejects sourceRefs that is not an array', () => {
    const result = validateAudioPhraseEntry(makePrompt({ sourceRefs: null }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.sourceRefs'))).toBe(true);
  });

  it('rejects a prompt with empty sourceRefs', () => {
    const result = validateAudioPhraseEntry(makePrompt({ sourceRefs: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.sourceRefs'))).toBe(true);
  });

  it('accepts a non-prompt entry with empty sourceRefs', () => {
    const result = validateAudioPhraseEntry(makeWord({ sourceRefs: [] }));
    expect(result.valid).toBe(true);
  });

  it('rejects a sourceRef with an invalid type', () => {
    const result = validateAudioPhraseEntry(
      makePrompt({ sourceRefs: [{ type: 'lesson', id: 'ra-s-seashell' }] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('sourceRefs[0].type'))).toBe(true);
  });

  it('rejects a sourceRef with an empty id', () => {
    const result = validateAudioPhraseEntry(
      makePrompt({ sourceRefs: [{ type: 'activity', id: '' }] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('sourceRefs[0].id'))).toBe(true);
  });

  it('accepts all valid sourceRef types', () => {
    for (const refType of ['activity', 'data-file', 'component'] as const) {
      const result = validateAudioPhraseEntry(
        makePrompt({ sourceRefs: [{ type: refType, id: 'some-id' }] }),
      );
      expect(result.valid, `sourceRef type "${refType}" should be accepted`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// validateAudioPhraseEntry — status
// ---------------------------------------------------------------------------

describe('validateAudioPhraseEntry — status', () => {
  it('rejects an invalid status string', () => {
    const result = validateAudioPhraseEntry(makeWord({ status: 'active-soon' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.status'))).toBe(true);
  });

  it('rejects status "replaced" without replacedBy', () => {
    const result = validateAudioPhraseEntry(makeWord({ status: 'replaced' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.replacedBy'))).toBe(true);
  });

  it('rejects status "replaced" with an invalid replacedBy AudioId', () => {
    const result = validateAudioPhraseEntry(
      makeWord({ status: 'replaced', replacedBy: 'Invalid.Id' }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.replacedBy'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateAudioPhraseEntry — phonicsMetadata
// ---------------------------------------------------------------------------

describe('validateAudioPhraseEntry — phonicsMetadata contract for phoneme type', () => {
  it('rejects a phoneme entry with missing phonicsMetadata', () => {
    const { phonicsMetadata: _, ...noMeta } = makePhoneme();
    const result = validateAudioPhraseEntry(noMeta);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.phonicsMetadata'))).toBe(true);
  });

  it('rejects a phoneme entry with null phonicsMetadata', () => {
    const result = validateAudioPhraseEntry(makePhoneme({ phonicsMetadata: null }));
    expect(result.valid).toBe(false);
  });

  it('rejects phonicsMetadata with empty phonemeSymbol', () => {
    const result = validateAudioPhraseEntry(
      makePhoneme({
        phonicsMetadata: {
          phonemeSymbol: '',
          isolationRequired: true,
          maxDurationMs: 1500,
          allowLetterName: true,
          reviewRequired: false,
        },
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('phonemeSymbol'))).toBe(true);
  });

  it('rejects phonicsMetadata with non-boolean isolationRequired', () => {
    const result = validateAudioPhraseEntry(
      makePhoneme({
        phonicsMetadata: {
          phonemeSymbol: 's',
          isolationRequired: 'yes',
          maxDurationMs: 1500,
          allowLetterName: true,
          reviewRequired: false,
        },
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('isolationRequired'))).toBe(true);
  });

  it('rejects phonicsMetadata with zero maxDurationMs', () => {
    const result = validateAudioPhraseEntry(
      makePhoneme({
        phonicsMetadata: {
          phonemeSymbol: 's',
          isolationRequired: true,
          maxDurationMs: 0,
          allowLetterName: true,
          reviewRequired: false,
        },
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('maxDurationMs'))).toBe(true);
  });

  it('rejects phonicsMetadata with negative maxDurationMs', () => {
    const result = validateAudioPhraseEntry(
      makePhoneme({
        phonicsMetadata: {
          phonemeSymbol: 's',
          isolationRequired: true,
          maxDurationMs: -100,
          allowLetterName: true,
          reviewRequired: false,
        },
      }),
    );
    expect(result.valid).toBe(false);
  });

  it('rejects phonicsMetadata with non-boolean allowLetterName', () => {
    const result = validateAudioPhraseEntry(
      makePhoneme({
        phonicsMetadata: {
          phonemeSymbol: 's',
          isolationRequired: true,
          maxDurationMs: 1500,
          allowLetterName: 1,
          reviewRequired: false,
        },
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('allowLetterName'))).toBe(true);
  });

  it('rejects phonicsMetadata with non-boolean reviewRequired', () => {
    const result = validateAudioPhraseEntry(
      makePhoneme({
        phonicsMetadata: {
          phonemeSymbol: 's',
          isolationRequired: true,
          maxDurationMs: 1500,
          allowLetterName: true,
          reviewRequired: 'no',
        },
      }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('reviewRequired'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateAudioPhraseEntry — misc edge cases
// ---------------------------------------------------------------------------

describe('validateAudioPhraseEntry — edge cases', () => {
  it('rejects null input', () => {
    const result = validateAudioPhraseEntry(null);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-object primitive', () => {
    const result = validateAudioPhraseEntry('not an object');
    expect(result.valid).toBe(false);
  });

  it('rejects an entry with non-string tags', () => {
    const result = validateAudioPhraseEntry(makeWord({ tags: [1, 2] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.tags'))).toBe(true);
  });

  it('rejects an entry with non-string notes', () => {
    const result = validateAudioPhraseEntry(makeWord({ notes: 42 }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('.notes'))).toBe(true);
  });

  it('collects multiple errors in a single pass', () => {
    const result = validateAudioPhraseEntry({ id: '', type: 'bad', text: '', voiceProfile: '', locale: '', renderStrategy: 'bad', sourceRefs: null, tags: null, status: 'bad' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(3);
  });
});

// ---------------------------------------------------------------------------
// validateAudioPhrasesInventory — valid inventory
// ---------------------------------------------------------------------------

describe('validateAudioPhrasesInventory — valid inventory', () => {
  it('accepts a minimal valid inventory', () => {
    const result = validateAudioPhrasesInventory(makeInventory());
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(Object.keys(result.entryErrors)).toHaveLength(0);
  });

  it('accepts an inventory with multiple valid entries', () => {
    const inv = makeInventory({
      phrases: [makePhoneme(), makeWord({ id: 'word.cvc.sat' }), makePrompt()],
    });
    const result = validateAudioPhrasesInventory(inv);
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateAudioPhrasesInventory — root field errors
// ---------------------------------------------------------------------------

describe('validateAudioPhrasesInventory — root field errors', () => {
  it('rejects null input', () => {
    const result = validateAudioPhrasesInventory(null);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('inventory'))).toBe(true);
  });

  it('rejects missing schemaVersion', () => {
    const { schemaVersion: _, ...inv } = makeInventory();
    const result = validateAudioPhrasesInventory(inv);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('schemaVersion'))).toBe(true);
  });

  it('rejects missing updatedAt', () => {
    const { updatedAt: _, ...inv } = makeInventory();
    const result = validateAudioPhrasesInventory(inv);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('updatedAt'))).toBe(true);
  });

  it('rejects phrases that is not an array', () => {
    const result = validateAudioPhrasesInventory(makeInventory({ phrases: 'not an array' }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('phrases'))).toBe(true);
  });

  it('rejects an empty phrases array', () => {
    const result = validateAudioPhrasesInventory(makeInventory({ phrases: [] }));
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('phrases'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateAudioPhrasesInventory — duplicate ID detection
// ---------------------------------------------------------------------------

describe('validateAudioPhrasesInventory — duplicate IDs', () => {
  it('rejects an inventory with duplicate IDs', () => {
    const result = validateAudioPhrasesInventory(
      makeInventory({ phrases: [makePhoneme(), makePhoneme()] }),
    );
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Duplicate id'))).toBe(true);
  });

  it('accepts an inventory where all IDs are unique', () => {
    const result = validateAudioPhrasesInventory(
      makeInventory({
        phrases: [
          makePhoneme({ id: 'phoneme.letter.s' }),
          makePhoneme({ id: 'phoneme.letter.a' }),
        ],
      }),
    );
    expect(result.valid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// validateAudioPhrasesInventory — per-entry error reporting
// ---------------------------------------------------------------------------

describe('validateAudioPhrasesInventory — per-entry error reporting', () => {
  it('reports entry errors by id', () => {
    const invalidEntry = makeWord({ text: '' }); // invalid text
    const result = validateAudioPhrasesInventory(
      makeInventory({ phrases: [invalidEntry] }),
    );
    expect(result.valid).toBe(false);
    expect(result.entryErrors['word.cvc.sat']).toBeDefined();
  });

  it('accumulates errors from multiple invalid entries', () => {
    const inv = makeInventory({
      phrases: [
        makeWord({ text: '' }),                    // bad text
        makePhoneme({ id: 'phoneme.letter.a', phonicsMetadata: null }), // missing phonicsMetadata
      ],
    });
    const result = validateAudioPhrasesInventory(inv);
    expect(result.valid).toBe(false);
    expect(Object.keys(result.entryErrors).length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// audio-phrases.json — starter inventory validation
// ---------------------------------------------------------------------------

describe('audio-phrases.json — starter inventory', () => {
  const inventory = inventoryRaw as AudioPhrasesInventory;

  it('has a schemaVersion', () => {
    expect(typeof inventory.schemaVersion).toBe('string');
    expect(inventory.schemaVersion.trim()).toBeTruthy();
  });

  it('has an updatedAt date', () => {
    expect(typeof inventory.updatedAt).toBe('string');
    expect(inventory.updatedAt.trim()).toBeTruthy();
  });

  it('has at least one phrase', () => {
    expect(inventory.phrases.length).toBeGreaterThan(0);
  });

  it('passes full inventory validation', () => {
    const result = validateAudioPhrasesInventory(inventory);
    if (!result.valid) {
      // Surface detailed errors to help debug
      const allErrors = [
        ...result.errors,
        ...Object.entries(result.entryErrors).flatMap(([id, errs]) =>
          errs.map((e) => `  [${id}] ${e}`),
        ),
      ];
      throw new Error(`Inventory validation failed:\n${allErrors.join('\n')}`);
    }
    expect(result.valid).toBe(true);
  });

  it('has no duplicate IDs', () => {
    const ids = inventory.phrases.map((p) => p.id as string);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('covers all 6 SATPIN letter phoneme IDs', () => {
    const ids = new Set(inventory.phrases.map((p) => p.id as string));
    for (const letter of ['s', 'a', 't', 'p', 'i', 'n']) {
      expect(ids.has(`phoneme.letter.${letter}`), `missing phoneme.letter.${letter}`).toBe(true);
    }
  });

  it('covers all 6 SATPIN bin label IDs', () => {
    const ids = new Set(inventory.phrases.map((p) => p.id as string));
    for (const letter of ['s', 'a', 't', 'p', 'i', 'n']) {
      expect(ids.has(`phoneme.bin.${letter}`), `missing phoneme.bin.${letter}`).toBe(true);
    }
  });

  it('covers all 6 CVC word IDs', () => {
    const ids = new Set(inventory.phrases.map((p) => p.id as string));
    for (const word of ['sat', 'sit', 'tap', 'pin', 'nap', 'pan']) {
      expect(ids.has(`word.cvc.${word}`), `missing word.cvc.${word}`).toBe(true);
    }
  });

  it('includes feedback.correct and feedback.incorrect', () => {
    const ids = new Set(inventory.phrases.map((p) => p.id as string));
    expect(ids.has('feedback.correct')).toBe(true);
    expect(ids.has('feedback.incorrect')).toBe(true);
  });

  it('includes all 3 reward entries', () => {
    const ids = new Set(inventory.phrases.map((p) => p.id as string));
    expect(ids.has('reward.level_complete')).toBe(true);
    expect(ids.has('reward.badge_earned')).toBe(true);
    expect(ids.has('reward.pearls_collected')).toBe(true);
  });

  it('every phoneme entry has phonicsMetadata', () => {
    const phonemes = inventory.phrases.filter((p) => p.type === 'phoneme');
    expect(phonemes.length).toBeGreaterThan(0);
    for (const p of phonemes) {
      expect(
        p.phonicsMetadata,
        `phoneme entry "${p.id as string}" must have phonicsMetadata`,
      ).toBeDefined();
    }
  });

  it('every prompt entry has at least one sourceRef', () => {
    const prompts = inventory.phrases.filter((p) => p.type === 'prompt');
    expect(prompts.length).toBeGreaterThan(0);
    for (const p of prompts) {
      expect(
        p.sourceRefs.length,
        `prompt entry "${p.id as string}" must have at least one sourceRef`,
      ).toBeGreaterThan(0);
    }
  });

  it('every phrase has a non-empty text field', () => {
    for (const p of inventory.phrases) {
      expect(
        typeof p.text === 'string' && p.text.trim().length > 0,
        `entry "${p.id as string}".text must be non-empty`,
      ).toBe(true);
    }
  });

  it('every phrase has status "active"', () => {
    for (const p of inventory.phrases) {
      expect(p.status, `entry "${p.id as string}".status`).toBe('active');
    }
  });
});
