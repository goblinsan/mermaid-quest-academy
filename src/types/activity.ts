import type { LessonReward } from './lesson';

/**
 * The pedagogical style of the phonics activity.
 *
 * | Value          | Description                                           |
 * |----------------|-------------------------------------------------------|
 * | `sound-match`  | Hear a sound, pick the matching letter or picture     |
 * | `letter-sound` | See a letter, choose the word that starts with it     |
 * | `word-blend`   | Listen to blended phonemes, identify the whole word   |
 * | `rhyme-match`  | Pick the word that rhymes with the target             |
 */
export type PhonicsActivityType = 'sound-match' | 'letter-sound' | 'word-blend' | 'rhyme-match';

/**
 * The four instructional stages of the phonics curriculum, ordered by
 * increasing complexity.
 *
 * | Stage          | Description                                              |
 * |----------------|----------------------------------------------------------|
 * | `letter-sound` | See a letter, identify the word that starts with it      |
 * | `sound-object` | Hear a phoneme, tap the matching picture / object        |
 * | `sorting`      | Discriminate sounds across 4+ choices (higher effort)    |
 * | `cvc-blend`    | Blend individual phonemes into a complete CVC word       |
 */
export type PhonicsProgressionStage = 'letter-sound' | 'sound-object' | 'sorting' | 'cvc-blend';

/** Curriculum metadata that positions an activity within the phonics progression. */
export interface PhonicsProgressionMetadata {
  /**
   * The target phoneme(s) practised in this activity.
   * Single consonants/vowels use their lowercase letter (e.g. `"s"`, `"a"`).
   * CVC blend targets use the full word (e.g. `"sat"`, `"pin"`).
   */
  targetSound: string;
  /**
   * Difficulty tier aligned to the four progression stages:
   * 1 = letter–sound, 2 = sound–object, 3 = sorting, 4 = CVC blending.
   */
  difficultyLevel: 1 | 2 | 3 | 4;
  /** Instructional stage used for curriculum sequencing and filtering. */
  progressionStage: PhonicsProgressionStage;
}

/** How the challenge prompt is surfaced to the learner. */
export type PhonicsPromptKind = 'text' | 'audio-only' | 'text-and-image';

/** The challenge shown at the top of the activity screen. */
export interface PhonicsPrompt {
  /** Controls which visual treatment is applied to the prompt area. */
  kind: PhonicsPromptKind;
  /** Display text for the prompt. */
  text: string;
  /** Text spoken aloud via TTS when the activity is presented. */
  ttsText: string;
  /**
   * Optional URL for an illustrative image.
   * Required when `kind` is `'text-and-image'`.
   */
  imageSrc?: string;
}

/** One selectable answer tile rendered in the activity. */
export interface PhonicsAnswerOption {
  /** Unique identifier within the activity. Used to match `correctOptionId`. */
  id: string;
  /** Label text shown on the tile. */
  text: string;
  /** Optional decorative emoji rendered alongside the label. */
  emoji?: string;
  /**
   * Optional TTS text spoken when the learner taps this option
   * (e.g. for audio-only prompts where hearing the option matters).
   */
  ttsText?: string;
}

/** Messages shown after the learner submits an answer. */
export interface PhonicsActivityFeedback {
  /** Shown on a correct submission. */
  correctMessage: string;
  /** Shown on an incorrect submission. */
  incorrectMessage: string;
}

/**
 * Defines when the activity is considered finished.
 *
 * - `single-correct` — one right answer completes the activity immediately.
 * - `streak`         — the learner must answer correctly `count` times in a row.
 */
export type PhonicsCompletionCondition =
  | { type: 'single-correct' }
  | { type: 'streak'; count: number };

/**
 * The UI rendering variant for an activity.
 *
 * | Value         | Description                                               |
 * |---------------|-----------------------------------------------------------|
 * | `default`     | Standard list of answer tiles via `ActivityShell`         |
 * | `seashell`    | Circular seashell tiles for letter-sound matching         |
 * | `bubble-pop`  | Animated floating letter bubbles the player pops          |
 * | `fish-feed`   | Large object-picture cards; tap the one that starts with  |
 * |               | the target phoneme to feed the friendly fish              |
 */
export type PhonicsActivityUIVariant = 'default' | 'seashell' | 'bubble-pop' | 'fish-feed';

/** Full configuration object for one reading/phonics activity. */
export interface PhonicsActivityConfig {
  /** Unique string identifier (e.g. `"ra-1"`). */
  id: string;
  /** Human-readable title displayed in the activity header. */
  title: string;
  /** The pedagogical pattern used by this activity. */
  type: PhonicsActivityType;
  /** The challenge prompt shown and spoken to the learner. */
  prompt: PhonicsPrompt;
  /** All selectable answer tiles. */
  options: PhonicsAnswerOption[];
  /** The `id` of the option that is the correct answer. */
  correctOptionId: string;
  /** Visual and textual feedback shown after the learner submits. */
  feedback: PhonicsActivityFeedback;
  /** XP and collectible item awarded upon activity completion. */
  reward: LessonReward;
  /** The condition that must be met for the activity to be considered done. */
  completionCondition: PhonicsCompletionCondition;
  /** Curriculum metadata linking this activity to the phonics progression. */
  progression: PhonicsProgressionMetadata;
  /**
   * Optional UI rendering variant.  Defaults to `'default'` (standard
   * `ActivityShell` tiles) when omitted.
   */
  uiVariant?: PhonicsActivityUIVariant;
}
