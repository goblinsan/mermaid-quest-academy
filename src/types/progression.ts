import type { LessonReward } from './lesson';

/**
 * Mastery state tracked for each individual phoneme/sound in the SATPIN
 * sequence.  Used by the session generator to prioritise unmastered sounds
 * and by the Parent Dashboard to surface accuracy data.
 *
 * A sound is considered "mastered" when `consecutiveCorrect >= 2`.
 */
export interface PhonicsLetterMastery {
  /** Total number of activities attempted for this sound. */
  attemptCount: number;
  /** Number of activities completed correctly for this sound. */
  correctCount: number;
  /**
   * Number of consecutive correct completions for this sound.
   * Resets to `0` after any incorrect completion.
   */
  consecutiveCorrect: number;
  /** ISO 8601 timestamp of the most recent activity completion for this sound. */
  lastCompletedAt: string;
}

/** A single treasure item earned by completing a lesson. */
export interface EarnedItem {
  /** Emoji representing the item. */
  emoji: string;
  /** Display name of the item. */
  item: string;
}

/** Performance record for a single lesson attempt. */
export interface LessonAttempt {
  /** ID of the lesson that was attempted. */
  lessonId: string;
  /** ISO 8601 timestamp of when the attempt was completed. */
  completedAt: string;
  /** Whether the learner answered correctly on their first try. */
  correct: boolean;
}

/** Persisted state for the learner's overall progression. */
export interface ProgressionState {
  /** Cumulative XP earned across all completed lessons. */
  xp: number;
  /** IDs of lessons that have been successfully completed. */
  completedLessonIds: string[];
  /** Ordered list of treasure items collected from completed lessons. */
  earnedItems: EarnedItem[];
  /** Activity IDs that are currently unlocked and playable. */
  unlockedActivityIds: string[];
  /** Ordered list of per-lesson attempt records for accuracy tracking. */
  lessonAttempts: LessonAttempt[];
  /**
   * Per-sound mastery state, keyed by lowercase SATPIN letter/sound
   * (e.g. `"s"`, `"a"`, `"sat"`).  Updated each time a reading activity is
   * completed via `completeReadingActivity`.
   */
  phonicsMastery: Record<string, PhonicsLetterMastery>;
}

/** Data passed to the RewardScreen via React Router navigation state. */
export interface RewardNavigationState {
  /** The reward just earned from the completed lesson. */
  reward: LessonReward;
  /** True when completing this lesson unlocked a previously locked zone. */
  newZoneUnlocked: boolean;
}
