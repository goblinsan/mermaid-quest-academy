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
}
