/**
 * QA Checklist — Reading Activity Content Validation (issue #120)
 *
 * These tests validate that every entry in readingActivities.json is correctly
 * structured for its activity variant.  They serve as an automated QA gate so
 * that structural or content mistakes are caught before they reach learners.
 *
 * Coverage:
 *  - Universal checks: required fields, no duplicate IDs, valid rewards/TTS
 *  - `default`      : correctOptionId references a real option
 *  - `seashell`     : level 1, 3–5 options (graduated), per-option ttsText
 *  - `bubble-pop`   : level 1, 3–5 options (graduated), per-option ttsText
 *  - `fish-feed`    : level 2, exactly 3 options, per-option ttsText
 *  - `treasure-sort`: bins present, all options have valid correctBinId
 *  - `echo-song`    : rhythmBeats present, requiredSounds gating
 *  - `word-builder` : cvcTarget, requiredSounds, 6 letter-tile options
 */

import { describe, it, expect } from 'vitest';
import activitiesRaw from '../../data/readingActivities.json';
import type { PhonicsActivityConfig } from '../../types/activity';

const SATPIN = ['s', 'a', 't', 'p', 'i', 'n'] as const;

const VALID_TYPES = ['sound-match', 'letter-sound', 'word-blend', 'rhyme-match'] as const;
const VALID_STAGES = ['letter-sound', 'sound-object', 'sorting', 'cvc-blend'] as const;
const VALID_PROMPT_KINDS = ['text', 'audio-only', 'text-and-image'] as const;
const VALID_COMPLETION_TYPES = [
  'single-correct',
  'streak',
  'all-sorted',
  'rhythm-complete',
  'word-built',
] as const;

const activities = activitiesRaw as PhonicsActivityConfig[];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function byVariant(variant: string) {
  return activities.filter((a) => (a.uiVariant ?? 'default') === variant);
}

// ---------------------------------------------------------------------------
// Universal checks
// ---------------------------------------------------------------------------

describe('Universal activity checks', () => {
  it('has at least one activity', () => {
    expect(activities.length).toBeGreaterThan(0);
  });

  it('every activity has a non-empty id', () => {
    for (const a of activities) {
      expect(a.id, `activity id`).toBeTruthy();
    }
  });

  it('all activity IDs are unique', () => {
    const ids = activities.map((a) => a.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('every activity has a non-empty title', () => {
    for (const a of activities) {
      expect(a.title, `${a.id}.title`).toBeTruthy();
    }
  });

  it('every activity has a valid type', () => {
    const valid = new Set<string>(VALID_TYPES);
    for (const a of activities) {
      expect(valid.has(a.type), `${a.id}.type="${a.type}"`).toBe(true);
    }
  });

  it('every activity prompt has non-empty text and ttsText', () => {
    for (const a of activities) {
      expect(a.prompt.text, `${a.id}.prompt.text`).toBeTruthy();
      expect(a.prompt.ttsText, `${a.id}.prompt.ttsText`).toBeTruthy();
    }
  });

  it('every activity prompt has a valid kind', () => {
    const valid = new Set<string>(VALID_PROMPT_KINDS);
    for (const a of activities) {
      expect(valid.has(a.prompt.kind), `${a.id}.prompt.kind="${a.prompt.kind}"`).toBe(true);
    }
  });

  it('every activity feedback has non-empty correctMessage and incorrectMessage', () => {
    for (const a of activities) {
      expect(a.feedback.correctMessage, `${a.id}.feedback.correctMessage`).toBeTruthy();
      expect(a.feedback.incorrectMessage, `${a.id}.feedback.incorrectMessage`).toBeTruthy();
    }
  });

  it('every activity reward has xp > 0', () => {
    for (const a of activities) {
      expect(a.reward.xp, `${a.id}.reward.xp`).toBeGreaterThan(0);
    }
  });

  it('every activity reward has a non-empty item name', () => {
    for (const a of activities) {
      expect(a.reward.item, `${a.id}.reward.item`).toBeTruthy();
    }
  });

  it('every activity has a valid completionCondition type', () => {
    const valid = new Set<string>(VALID_COMPLETION_TYPES);
    for (const a of activities) {
      expect(
        valid.has(a.completionCondition.type),
        `${a.id}.completionCondition.type="${a.completionCondition.type}"`,
      ).toBe(true);
    }
  });

  it('every activity progression has a non-empty targetSound', () => {
    for (const a of activities) {
      expect(a.progression.targetSound, `${a.id}.progression.targetSound`).toBeTruthy();
    }
  });

  it('every activity progression has difficultyLevel in 1–4', () => {
    for (const a of activities) {
      const lvl = a.progression.difficultyLevel;
      expect(lvl >= 1 && lvl <= 4, `${a.id}.progression.difficultyLevel=${lvl}`).toBe(true);
    }
  });

  it('every activity progression has a valid progressionStage', () => {
    const valid = new Set<string>(VALID_STAGES);
    for (const a of activities) {
      expect(
        valid.has(a.progression.progressionStage),
        `${a.id}.progression.progressionStage="${a.progression.progressionStage}"`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// default variant
// ---------------------------------------------------------------------------

describe('"default" variant', () => {
  const defaultActivities = byVariant('default');

  it('has at least one default activity', () => {
    expect(defaultActivities.length).toBeGreaterThan(0);
  });

  it('every activity has at least 2 answer options', () => {
    for (const a of defaultActivities) {
      expect(a.options.length, `${a.id} options count`).toBeGreaterThanOrEqual(2);
    }
  });

  it('correctOptionId references an existing option', () => {
    for (const a of defaultActivities) {
      const ids = new Set(a.options.map((o) => o.id));
      expect(ids.has(a.correctOptionId), `${a.id}.correctOptionId="${a.correctOptionId}"`).toBe(
        true,
      );
    }
  });

  it('all options have non-empty id and text', () => {
    for (const a of defaultActivities) {
      for (const o of a.options) {
        expect(o.id, `${a.id} option id`).toBeTruthy();
        expect(o.text, `${a.id} option "${o.id}" text`).toBeTruthy();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// seashell variant
// ---------------------------------------------------------------------------

describe('"seashell" variant', () => {
  const seashellActivities = byVariant('seashell');

  it('has exactly 6 seashell activities (one per SATPIN letter)', () => {
    expect(seashellActivities.length).toBe(6);
  });

  it('every seashell activity is at difficulty level 1', () => {
    for (const a of seashellActivities) {
      expect(a.progression.difficultyLevel, `${a.id} difficultyLevel`).toBe(1);
    }
  });

  it('every seashell activity uses single-correct completion', () => {
    for (const a of seashellActivities) {
      expect(a.completionCondition.type, `${a.id} completionCondition`).toBe('single-correct');
    }
  });

  it('every seashell activity has 3–5 options (graduated difficulty)', () => {
    for (const a of seashellActivities) {
      expect(a.options.length, `${a.id} options count`).toBeGreaterThanOrEqual(3);
      expect(a.options.length, `${a.id} options count`).toBeLessThanOrEqual(5);
    }
  });

  it('all seashell options have ttsText for phoneme audio', () => {
    for (const a of seashellActivities) {
      for (const o of a.options) {
        expect(o.ttsText, `${a.id} option "${o.id}" ttsText`).toBeTruthy();
      }
    }
  });

  it('correctOptionId references an existing option', () => {
    for (const a of seashellActivities) {
      const ids = new Set(a.options.map((o) => o.id));
      expect(ids.has(a.correctOptionId), `${a.id}.correctOptionId="${a.correctOptionId}"`).toBe(
        true,
      );
    }
  });

  it('every seashell activity covers a SATPIN target sound', () => {
    const satpinSet = new Set<string>(SATPIN);
    for (const a of seashellActivities) {
      expect(
        satpinSet.has(a.progression.targetSound),
        `${a.id}.targetSound="${a.progression.targetSound}"`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// bubble-pop variant
// ---------------------------------------------------------------------------

describe('"bubble-pop" variant', () => {
  const bubbleActivities = byVariant('bubble-pop');

  it('has exactly 6 bubble-pop activities (one per SATPIN letter)', () => {
    expect(bubbleActivities.length).toBe(6);
  });

  it('every bubble-pop activity is at difficulty level 1', () => {
    for (const a of bubbleActivities) {
      expect(a.progression.difficultyLevel, `${a.id} difficultyLevel`).toBe(1);
    }
  });

  it('every bubble-pop activity uses single-correct completion', () => {
    for (const a of bubbleActivities) {
      expect(a.completionCondition.type, `${a.id} completionCondition`).toBe('single-correct');
    }
  });

  it('every bubble-pop activity has 3–5 options (graduated difficulty)', () => {
    for (const a of bubbleActivities) {
      expect(a.options.length, `${a.id} options count`).toBeGreaterThanOrEqual(3);
      expect(a.options.length, `${a.id} options count`).toBeLessThanOrEqual(5);
    }
  });

  it('all bubble-pop options have ttsText for phoneme audio', () => {
    for (const a of bubbleActivities) {
      for (const o of a.options) {
        expect(o.ttsText, `${a.id} option "${o.id}" ttsText`).toBeTruthy();
      }
    }
  });

  it('correctOptionId references an existing option', () => {
    for (const a of bubbleActivities) {
      const ids = new Set(a.options.map((o) => o.id));
      expect(ids.has(a.correctOptionId), `${a.id}.correctOptionId="${a.correctOptionId}"`).toBe(
        true,
      );
    }
  });

  it('every bubble-pop activity covers a SATPIN target sound', () => {
    const satpinSet = new Set<string>(SATPIN);
    for (const a of bubbleActivities) {
      expect(
        satpinSet.has(a.progression.targetSound),
        `${a.id}.targetSound="${a.progression.targetSound}"`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// fish-feed variant
// ---------------------------------------------------------------------------

describe('"fish-feed" variant', () => {
  const fishActivities = byVariant('fish-feed');

  it('has exactly 6 fish-feed activities (one per SATPIN letter)', () => {
    expect(fishActivities.length).toBe(6);
  });

  it('every fish-feed activity is at difficulty level 2', () => {
    for (const a of fishActivities) {
      expect(a.progression.difficultyLevel, `${a.id} difficultyLevel`).toBe(2);
    }
  });

  it('every fish-feed activity has progressionStage "sound-object"', () => {
    for (const a of fishActivities) {
      expect(a.progression.progressionStage, `${a.id} progressionStage`).toBe('sound-object');
    }
  });

  it('every fish-feed activity uses single-correct completion', () => {
    for (const a of fishActivities) {
      expect(a.completionCondition.type, `${a.id} completionCondition`).toBe('single-correct');
    }
  });

  it('every fish-feed activity has exactly 3 options (1 correct + 2 distractors)', () => {
    for (const a of fishActivities) {
      expect(a.options.length, `${a.id} options count`).toBe(3);
    }
  });

  it('all fish-feed options have ttsText for object-name audio', () => {
    for (const a of fishActivities) {
      for (const o of a.options) {
        expect(o.ttsText, `${a.id} option "${o.id}" ttsText`).toBeTruthy();
      }
    }
  });

  it('correctOptionId references an existing option', () => {
    for (const a of fishActivities) {
      const ids = new Set(a.options.map((o) => o.id));
      expect(ids.has(a.correctOptionId), `${a.id}.correctOptionId="${a.correctOptionId}"`).toBe(
        true,
      );
    }
  });

  it('distractors use different phonemes from the target sound', () => {
    for (const a of fishActivities) {
      const target = a.progression.targetSound;
      const distractors = a.options.filter((o) => o.id !== a.correctOptionId);
      for (const d of distractors) {
        expect(
          d.text.toLowerCase()[0] !== target,
          `${a.id} distractor "${d.text}" should not start with target sound "${target}"`,
        ).toBe(true);
      }
    }
  });

  it('every fish-feed activity covers a SATPIN target sound', () => {
    const satpinSet = new Set<string>(SATPIN);
    for (const a of fishActivities) {
      expect(
        satpinSet.has(a.progression.targetSound),
        `${a.id}.targetSound="${a.progression.targetSound}"`,
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// treasure-sort variant
// ---------------------------------------------------------------------------

describe('"treasure-sort" variant', () => {
  const sortActivities = byVariant('treasure-sort');

  it('has at least one treasure-sort activity', () => {
    expect(sortActivities.length).toBeGreaterThan(0);
  });

  it('every treasure-sort activity is at difficulty level 3', () => {
    for (const a of sortActivities) {
      expect(a.progression.difficultyLevel, `${a.id} difficultyLevel`).toBe(3);
    }
  });

  it('every treasure-sort activity has progressionStage "sorting"', () => {
    for (const a of sortActivities) {
      expect(a.progression.progressionStage, `${a.id} progressionStage`).toBe('sorting');
    }
  });

  it('every treasure-sort activity uses all-sorted completion', () => {
    for (const a of sortActivities) {
      expect(a.completionCondition.type, `${a.id} completionCondition`).toBe('all-sorted');
    }
  });

  it('every treasure-sort activity has exactly 2 bins', () => {
    for (const a of sortActivities) {
      expect(a.bins, `${a.id} bins`).toBeDefined();
      expect(a.bins!.length, `${a.id} bins count`).toBe(2);
    }
  });

  it('every bin has required fields: id, label, sound, ttsText', () => {
    for (const a of sortActivities) {
      for (const bin of a.bins!) {
        expect(bin.id, `${a.id} bin id`).toBeTruthy();
        expect(bin.label, `${a.id} bin "${bin.id}" label`).toBeTruthy();
        expect(bin.sound, `${a.id} bin "${bin.id}" sound`).toBeTruthy();
        expect(bin.ttsText, `${a.id} bin "${bin.id}" ttsText`).toBeTruthy();
      }
    }
  });

  it('every treasure-sort activity has at least 2 sort items', () => {
    for (const a of sortActivities) {
      expect(a.options.length, `${a.id} options count`).toBeGreaterThanOrEqual(2);
    }
  });

  it('all sort items have a correctBinId', () => {
    for (const a of sortActivities) {
      for (const o of a.options) {
        expect(o.correctBinId, `${a.id} option "${o.id}" correctBinId`).toBeTruthy();
      }
    }
  });

  it('all correctBinIds reference existing bins in the same activity', () => {
    for (const a of sortActivities) {
      const binIds = new Set((a.bins ?? []).map((b) => b.id));
      for (const o of a.options) {
        expect(
          binIds.has(o.correctBinId!),
          `${a.id} option "${o.id}" correctBinId="${o.correctBinId}" not found in bins`,
        ).toBe(true);
      }
    }
  });

  it('every bin has at least one item mapped to it', () => {
    for (const a of sortActivities) {
      const binIds = (a.bins ?? []).map((b) => b.id);
      for (const binId of binIds) {
        const count = a.options.filter((o) => o.correctBinId === binId).length;
        expect(count, `${a.id} bin "${binId}" has no items`).toBeGreaterThan(0);
      }
    }
  });

  it('all sort items have ttsText for audio feedback', () => {
    for (const a of sortActivities) {
      for (const o of a.options) {
        expect(o.ttsText, `${a.id} option "${o.id}" ttsText`).toBeTruthy();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// echo-song variant
// ---------------------------------------------------------------------------

describe('"echo-song" variant', () => {
  const echoActivities = byVariant('echo-song');

  it('has exactly 6 echo-song activities (one per SATPIN CVC)', () => {
    expect(echoActivities.length).toBe(6);
  });

  it('every echo-song activity is at difficulty level 4', () => {
    for (const a of echoActivities) {
      expect(a.progression.difficultyLevel, `${a.id} difficultyLevel`).toBe(4);
    }
  });

  it('every echo-song activity has progressionStage "cvc-blend"', () => {
    for (const a of echoActivities) {
      expect(a.progression.progressionStage, `${a.id} progressionStage`).toBe('cvc-blend');
    }
  });

  it('every echo-song activity uses rhythm-complete completion', () => {
    for (const a of echoActivities) {
      expect(a.completionCondition.type, `${a.id} completionCondition`).toBe('rhythm-complete');
    }
  });

  it('every echo-song activity has rhythmBeats with at least 1 beat', () => {
    for (const a of echoActivities) {
      expect(a.rhythmBeats, `${a.id} rhythmBeats`).toBeDefined();
      expect(a.rhythmBeats!.length, `${a.id} rhythmBeats count`).toBeGreaterThan(0);
    }
  });

  it('every rhythm beat has sound, ttsText, and displayText', () => {
    for (const a of echoActivities) {
      for (const beat of a.rhythmBeats!) {
        expect(beat.sound, `${a.id} beat sound`).toBeTruthy();
        expect(beat.ttsText, `${a.id} beat ttsText`).toBeTruthy();
        expect(beat.displayText, `${a.id} beat displayText`).toBeTruthy();
      }
    }
  });

  it('every echo-song activity has no options array items (tap-along only)', () => {
    for (const a of echoActivities) {
      expect(a.options.length, `${a.id} options should be empty`).toBe(0);
    }
  });

  it('every echo-song activity has requiredSounds for gating', () => {
    for (const a of echoActivities) {
      expect(a.requiredSounds, `${a.id} requiredSounds`).toBeDefined();
      expect(a.requiredSounds!.length, `${a.id} requiredSounds count`).toBeGreaterThan(0);
    }
  });

  it('all requiredSounds are valid SATPIN letters', () => {
    const satpinSet = new Set<string>(SATPIN);
    for (const a of echoActivities) {
      for (const sound of a.requiredSounds ?? []) {
        expect(satpinSet.has(sound), `${a.id} requiredSound="${sound}" not in SATPIN`).toBe(true);
      }
    }
  });

  it('rhythm beats match the requiredSounds for the CVC word', () => {
    for (const a of echoActivities) {
      const beatSounds = (a.rhythmBeats ?? []).map((b) => b.sound);
      const required = new Set(a.requiredSounds ?? []);
      for (const s of beatSounds) {
        expect(required.has(s), `${a.id} beat sound "${s}" not in requiredSounds`).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// word-builder variant
// ---------------------------------------------------------------------------

describe('"word-builder" variant', () => {
  const wbActivities = byVariant('word-builder');

  it('has exactly 6 word-builder activities (one per SATPIN CVC)', () => {
    expect(wbActivities.length).toBe(6);
  });

  it('every word-builder activity is at difficulty level 4', () => {
    for (const a of wbActivities) {
      expect(a.progression.difficultyLevel, `${a.id} difficultyLevel`).toBe(4);
    }
  });

  it('every word-builder activity has progressionStage "cvc-blend"', () => {
    for (const a of wbActivities) {
      expect(a.progression.progressionStage, `${a.id} progressionStage`).toBe('cvc-blend');
    }
  });

  it('every word-builder activity uses word-built completion', () => {
    for (const a of wbActivities) {
      expect(a.completionCondition.type, `${a.id} completionCondition`).toBe('word-built');
    }
  });

  it('every word-builder activity has a cvcTarget', () => {
    for (const a of wbActivities) {
      expect(a.cvcTarget, `${a.id} cvcTarget`).toBeDefined();
    }
  });

  it('cvcTarget has word, phonemes (3 elements), and emoji', () => {
    for (const a of wbActivities) {
      const cvc = a.cvcTarget!;
      expect(cvc.word, `${a.id} cvcTarget.word`).toBeTruthy();
      expect(cvc.phonemes, `${a.id} cvcTarget.phonemes`).toBeDefined();
      expect(cvc.phonemes.length, `${a.id} cvcTarget.phonemes count`).toBe(3);
      expect(cvc.emoji, `${a.id} cvcTarget.emoji`).toBeTruthy();
    }
  });

  it('cvcTarget phonemes are all valid SATPIN letters', () => {
    const satpinSet = new Set<string>(SATPIN);
    for (const a of wbActivities) {
      for (const phoneme of a.cvcTarget!.phonemes) {
        expect(
          satpinSet.has(phoneme),
          `${a.id} phoneme "${phoneme}" not in SATPIN`,
        ).toBe(true);
      }
    }
  });

  it('every word-builder activity has exactly 6 letter-tile options (all SATPIN letters)', () => {
    for (const a of wbActivities) {
      expect(a.options.length, `${a.id} options count`).toBe(6);
    }
  });

  it('word-builder tile options cover all 6 SATPIN letters', () => {
    const satpinSet = new Set<string>(SATPIN);
    for (const a of wbActivities) {
      const tileLetters = new Set(a.options.map((o) => o.text.toLowerCase()));
      for (const letter of satpinSet) {
        expect(tileLetters.has(letter), `${a.id} missing tile for letter "${letter}"`).toBe(true);
      }
    }
  });

  it('all word-builder options have ttsText for phoneme audio', () => {
    for (const a of wbActivities) {
      for (const o of a.options) {
        expect(o.ttsText, `${a.id} option "${o.id}" ttsText`).toBeTruthy();
      }
    }
  });

  it('every word-builder activity has requiredSounds for gating', () => {
    for (const a of wbActivities) {
      expect(a.requiredSounds, `${a.id} requiredSounds`).toBeDefined();
      expect(a.requiredSounds!.length, `${a.id} requiredSounds count`).toBeGreaterThan(0);
    }
  });

  it('all requiredSounds are valid SATPIN letters', () => {
    const satpinSet = new Set<string>(SATPIN);
    for (const a of wbActivities) {
      for (const sound of a.requiredSounds ?? []) {
        expect(satpinSet.has(sound), `${a.id} requiredSound="${sound}" not in SATPIN`).toBe(true);
      }
    }
  });

  it('cvcTarget phonemes match requiredSounds', () => {
    for (const a of wbActivities) {
      const required = new Set(a.requiredSounds ?? []);
      for (const phoneme of a.cvcTarget!.phonemes) {
        expect(
          required.has(phoneme),
          `${a.id} phoneme "${phoneme}" not in requiredSounds`,
        ).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Cross-variant coverage checks
// ---------------------------------------------------------------------------

describe('Cross-variant coverage', () => {
  it('all 7 UI variants are represented in the data', () => {
    const variants = new Set(activities.map((a) => a.uiVariant ?? 'default'));
    const expected = [
      'default',
      'seashell',
      'bubble-pop',
      'fish-feed',
      'treasure-sort',
      'echo-song',
      'word-builder',
    ];
    for (const v of expected) {
      expect(variants.has(v), `variant "${v}" has no activities`).toBe(true);
    }
  });

  it('all 4 difficulty levels are represented in the data', () => {
    const levels = new Set(activities.map((a) => a.progression.difficultyLevel));
    for (const lvl of [1, 2, 3, 4]) {
      expect(levels.has(lvl as 1 | 2 | 3 | 4), `level ${lvl} has no activities`).toBe(true);
    }
  });

  it('all 6 SATPIN sounds appear as target sounds in at least one activity', () => {
    const sounds = new Set(activities.map((a) => a.progression.targetSound));
    for (const letter of SATPIN) {
      const covered = [...sounds].some((s) => s === letter || s.includes(letter));
      expect(covered, `SATPIN letter "${letter}" not covered by any activity`).toBe(true);
    }
  });
});
