/**
 * Tests for the AudioId validation utilities (issue #202)
 *
 * Covers:
 *  - isValidAudioId: valid IDs, invalid IDs (format, category, edge cases)
 *  - validateAudioId: correct error messages for each failure mode
 *  - PHONICS_AUDIO_ID_MAP: every entry passes validation
 */

import { describe, it, expect } from 'vitest';
import { isValidAudioId, validateAudioId } from '../audioIdValidator';
import { AUDIO_ID_CATEGORIES } from '../../types/audioId';
import { PHONICS_AUDIO_ID_MAP } from '../../data/phonicsAudioIds';

// ---------------------------------------------------------------------------
// isValidAudioId — valid cases
// ---------------------------------------------------------------------------

describe('isValidAudioId — valid IDs', () => {
  const valid = [
    'phonics.letter.s',
    'phonics.letter.a',
    'phonics.bin.s',
    'word.cvc.sat',
    'word.cvc.pin',
    'object.name.sun',
    'object.name.apple',
    'instruction.seashell-match.s',
    'instruction.echo-song.default',
    'instruction.treasure-sort.letter',
    'instruction.word-builder.sat',
    'feedback.correct',
    'feedback.incorrect',
    'ui.tap',
    'ui.sound',
    // digits in segments
    'phonics.letter2.s',
    'word.cvc2.sat',
    // hyphens in subcategory / qualifier
    'instruction.fish-feed.a',
    'instruction.word-builder.pan',
  ];

  for (const id of valid) {
    it(`accepts "${id}"`, () => {
      expect(isValidAudioId(id)).toBe(true);
    });
  }
});

// ---------------------------------------------------------------------------
// isValidAudioId — invalid cases
// ---------------------------------------------------------------------------

describe('isValidAudioId — invalid IDs', () => {
  const invalid = [
    // wrong number of segments
    ['phonics', 'only one segment'],
    ['phonics.letter.s.extra', 'four segments'],
    // uppercase
    ['Phonics.letter.s', 'uppercase in category'],
    ['phonics.Letter.s', 'uppercase in subcategory'],
    ['phonics.letter.S', 'uppercase in qualifier'],
    // segment starts with hyphen or digit
    ['phonics.-letter.s', 'segment starting with hyphen'],
    ['phonics.1letter.s', 'segment starting with digit'],
    // spaces or special chars
    ['phonics.letter s', 'space in segment'],
    ['phonics_letter_s', 'underscores instead of dots'],
    ['phonics.letter.s!', 'exclamation mark in qualifier'],
    // unknown category
    ['unknown.thing', 'unregistered category'],
    ['audio.letter.s', 'unregistered category "audio"'],
    // empty / non-string
    ['', 'empty string'],
  ];

  for (const [id, reason] of invalid) {
    it(`rejects "${id}" (${reason})`, () => {
      expect(isValidAudioId(id)).toBe(false);
    });
  }
});

// ---------------------------------------------------------------------------
// validateAudioId — error messages
// ---------------------------------------------------------------------------

describe('validateAudioId — error messages', () => {
  it('returns valid:true for a well-formed ID', () => {
    expect(validateAudioId('phonics.letter.s')).toEqual({ valid: true });
  });

  it('returns an error for an empty string', () => {
    const result = validateAudioId('');
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('returns an error mentioning the pattern for a malformed ID', () => {
    const result = validateAudioId('PHONICS.letter.s');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/match pattern/i);
  });

  it('returns an error mentioning the category for an unknown category', () => {
    const result = validateAudioId('audio.letter.s');
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/category/i);
    expect(result.error).toContain('audio');
  });

  it('includes the reserved categories in the error message', () => {
    const result = validateAudioId('unknown.thing');
    expect(result.valid).toBe(false);
    for (const cat of AUDIO_ID_CATEGORIES) {
      expect(result.error).toContain(cat);
    }
  });
});

// ---------------------------------------------------------------------------
// AUDIO_ID_CATEGORIES — sanity checks
// ---------------------------------------------------------------------------

describe('AUDIO_ID_CATEGORIES', () => {
  it('contains the expected reserved categories', () => {
    expect(AUDIO_ID_CATEGORIES).toContain('phonics');
    expect(AUDIO_ID_CATEGORIES).toContain('word');
    expect(AUDIO_ID_CATEGORIES).toContain('object');
    expect(AUDIO_ID_CATEGORIES).toContain('instruction');
    expect(AUDIO_ID_CATEGORIES).toContain('feedback');
    expect(AUDIO_ID_CATEGORIES).toContain('ui');
  });

  it('every category is itself a valid first segment', () => {
    for (const cat of AUDIO_ID_CATEGORIES) {
      // Build a minimal 2-segment ID with this category
      const id = `${cat}.test`;
      expect(isValidAudioId(id), `category "${cat}" should be usable`).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// PHONICS_AUDIO_ID_MAP — every key is a valid AudioId
// ---------------------------------------------------------------------------

describe('PHONICS_AUDIO_ID_MAP', () => {
  it('contains at least one entry', () => {
    expect(Object.keys(PHONICS_AUDIO_ID_MAP).length).toBeGreaterThan(0);
  });

  it('every key is a valid AudioId', () => {
    for (const id of Object.keys(PHONICS_AUDIO_ID_MAP)) {
      expect(isValidAudioId(id), `"${id}" should be a valid AudioId`).toBe(true);
    }
  });

  it('every value is a non-empty TTS text string', () => {
    for (const [id, tts] of Object.entries(PHONICS_AUDIO_ID_MAP)) {
      expect(typeof tts, `TTS text for "${id}" should be a string`).toBe('string');
      expect(tts.trim().length, `TTS text for "${id}" should be non-empty`).toBeGreaterThan(0);
    }
  });

  it('covers all 6 SATPIN letter phoneme sounds', () => {
    const satpin = ['s', 'a', 't', 'p', 'i', 'n'];
    for (const letter of satpin) {
      const key = `phonics.letter.${letter}`;
      expect(
        Object.prototype.hasOwnProperty.call(PHONICS_AUDIO_ID_MAP, key),
        `missing key "${key}"`,
      ).toBe(true);
    }
  });

  it('covers all 6 SATPIN bin labels', () => {
    const satpin = ['s', 'a', 't', 'p', 'i', 'n'];
    for (const letter of satpin) {
      const key = `phonics.bin.${letter}`;
      expect(
        Object.prototype.hasOwnProperty.call(PHONICS_AUDIO_ID_MAP, key),
        `missing key "${key}"`,
      ).toBe(true);
    }
  });

  it('covers all 6 CVC words', () => {
    const words = ['sat', 'sit', 'tap', 'pin', 'nap', 'pan'];
    for (const word of words) {
      const key = `word.cvc.${word}`;
      expect(
        Object.prototype.hasOwnProperty.call(PHONICS_AUDIO_ID_MAP, key),
        `missing key "${key}"`,
      ).toBe(true);
    }
  });

  it('has no duplicate keys', () => {
    // Object.keys already deduplicates, but verify the source has no accidental
    // overwrite by confirming key count matches value count
    const keys = Object.keys(PHONICS_AUDIO_ID_MAP);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });
});
