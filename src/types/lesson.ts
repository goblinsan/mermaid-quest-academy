/** The style of question presented to the learner. */
export type LessonType = 'multiple-choice' | 'true-false' | 'fill-blank';

/** Reward granted upon completing a lesson. */
export interface LessonReward {
  /** Experience points awarded. */
  xp: number;
  /** Collectible item name. */
  item: string;
  /** Emoji representing the reward item. */
  emoji: string;
}

/** A single lesson entry loaded from the JSON data file. */
export interface Lesson {
  /** Unique identifier matching the activity route param (e.g. "1", "2"). */
  id: string;
  /** Question format. */
  type: LessonType;
  /** The question or challenge shown to the learner. */
  prompt: string;
  /** Text spoken aloud via TTS when the lesson is presented. */
  ttsText: string;
  /**
   * Selectable answer choices.
   * Required for `multiple-choice` and `true-false`; omitted for `fill-blank`.
   */
  options?: string[];
  /** The correct answer (must match one of `options`, or a free-text value for `fill-blank`). */
  answer: string;
  /** Reward earned upon a correct submission. */
  reward: LessonReward;
}
