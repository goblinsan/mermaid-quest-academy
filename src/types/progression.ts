import type { LessonReward } from './lesson';

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
}

/** Data passed to the RewardScreen via React Router navigation state. */
export interface RewardNavigationState {
  /** The reward just earned from the completed lesson. */
  reward: LessonReward;
  /** True when completing this lesson unlocked a previously locked zone. */
  newZoneUnlocked: boolean;
}
