import { useCallback, useState } from 'react';
import type { Lesson, LessonReward } from '../types/lesson';
import type { EarnedItem, LessonAttempt, PhonicsLetterMastery, ProgressionState } from '../types/progression';
import { INITIAL_UNLOCKED_ACTIVITY_IDS } from '../data/zoneConfig';
import { loadProgression, saveProgression } from '../services/storageService';
import { getAllReadingActivities } from '../services/activityLoader';
import { computeActivityPearls, computeEarnedBadgeIds } from '../services/rewardService';
import { MILESTONE_BADGES } from '../data/rewardsConfig';

export interface UseProgressionReturn {
  /** Total XP accumulated across all completed lessons. */
  xp: number;
  /** Total magic pearls earned through reading activities and milestones. */
  pearls: number;
  /** IDs of lessons the learner has finished. */
  completedLessonIds: string[];
  /** Ordered treasure items collected from completed lessons. */
  earnedItems: EarnedItem[];
  /** Activity IDs the learner is allowed to start. */
  unlockedActivityIds: string[];
  /** Ordered list of per-lesson attempt records for accuracy tracking. */
  lessonAttempts: LessonAttempt[];
  /**
   * Per-sound mastery state, keyed by lowercase SATPIN letter/sound.
   * Updated each time `completeReadingActivity` is called.
   */
  phonicsMastery: Record<string, PhonicsLetterMastery>;
  /**
   * IDs of milestone badges permanently earned by the learner.
   * Append-only — badges are never removed once earned.
   */
  earnedBadgeIds: string[];
  /** Returns true if the given lesson id has been completed. */
  isLessonCompleted: (id: string) => boolean;
  /** Returns true if the given activity id is unlocked for play. */
  isActivityUnlocked: (activityId: string) => boolean;
  /**
   * Records a lesson as completed: awards XP, adds the earned item,
   * and unlocks the next sequential zone. No-op if already completed.
   * @param lesson - The lesson that was completed.
   * @param isCorrect - Whether the learner answered correctly on their first try.
   */
  completeLesson: (lesson: Lesson, isCorrect: boolean) => void;
  /**
   * Records a reading/phonics activity as completed: awards XP, pearls, and
   * any newly-earned milestone badges.
   * No-op if the activity id has already been completed.
   * @param activityId - The reading activity id (e.g. `"ra-1"`).
   * @param reward     - The reward to award on completion.
   * @param isCorrect  - Whether the learner completed correctly (first-try accuracy).
   */
  completeReadingActivity: (activityId: string, reward: LessonReward, isCorrect: boolean) => void;
  /** Resets all progression back to the initial state. */
  reset: () => void;
}

/**
 * Manages the learner's persistent progression: XP, earned treasures,
 * zone unlock state, and per-lesson accuracy. State is persisted to
 * localStorage so it survives page refreshes.
 */
export function useProgression(): UseProgressionReturn {
  const [state, setState] = useState<ProgressionState>(loadProgression);

  const completeLesson = useCallback((lesson: Lesson, isCorrect: boolean) => {
    setState((prev) => {
      // Guard: do not award the same lesson twice
      if (prev.completedLessonIds.includes(lesson.id)) return prev;

      // Unlock the zone whose activityId immediately follows this lesson
      const nextId = String(Number(lesson.id) + 1);
      const newUnlocked = prev.unlockedActivityIds.includes(nextId)
        ? prev.unlockedActivityIds
        : [...prev.unlockedActivityIds, nextId];

      const attempt: LessonAttempt = {
        lessonId: lesson.id,
        completedAt: new Date().toISOString(),
        correct: isCorrect,
      };

      const next: ProgressionState = {
        xp: prev.xp + lesson.reward.xp,
        pearls: prev.pearls ?? 0,
        completedLessonIds: [...prev.completedLessonIds, lesson.id],
        earnedItems: [
          ...prev.earnedItems,
          { emoji: lesson.reward.emoji, item: lesson.reward.item },
        ],
        unlockedActivityIds: newUnlocked,
        lessonAttempts: [...prev.lessonAttempts, attempt],
        phonicsMastery: prev.phonicsMastery ?? {},
        earnedBadgeIds: prev.earnedBadgeIds ?? [],
      };

      saveProgression(next);
      return next;
    });
  }, []);

  const completeReadingActivity = useCallback(
    (activityId: string, reward: LessonReward, isCorrect: boolean) => {
      setState((prev) => {
        // Guard: do not award the same activity twice
        if (prev.completedLessonIds.includes(activityId)) return prev;

        const attempt: LessonAttempt = {
          lessonId: activityId,
          completedAt: new Date().toISOString(),
          correct: isCorrect,
        };

        // Update per-sound mastery (issue #98)
        const allActivities = getAllReadingActivities();
        const activityConfig = allActivities.find((a) => a.id === activityId);
        let updatedMastery = { ...(prev.phonicsMastery ?? {}) };
        if (activityConfig) {
          const sound = activityConfig.progression.targetSound;
          const existing = updatedMastery[sound] ?? {
            attemptCount: 0,
            correctCount: 0,
            consecutiveCorrect: 0,
            lastCompletedAt: '',
          };
          updatedMastery = {
            ...updatedMastery,
            [sound]: {
              attemptCount: existing.attemptCount + 1,
              correctCount: existing.correctCount + (isCorrect ? 1 : 0),
              consecutiveCorrect: isCorrect ? existing.consecutiveCorrect + 1 : 0,
              lastCompletedAt: attempt.completedAt,
            },
          };
        }

        // Compute pearl reward for this activity (issue #102)
        const difficultyLevel = activityConfig?.progression.difficultyLevel ?? 1;
        const activityPearls = computeActivityPearls(difficultyLevel, isCorrect);

        // Detect newly earned milestone badges (issues #104, #105)
        const updatedCompletedIds = [...prev.completedLessonIds, activityId];
        const currentlyEarnedBadgeIds = computeEarnedBadgeIds(updatedCompletedIds, updatedMastery);
        const prevEarnedBadgeIds = prev.earnedBadgeIds ?? [];
        const newBadgeIds = currentlyEarnedBadgeIds.filter(
          (id) => !prevEarnedBadgeIds.includes(id),
        );
        // Award pearl bonuses from any newly-earned milestone badges
        const milestonePearlBonus = newBadgeIds.reduce((sum, id) => {
          const badge = MILESTONE_BADGES.find((b) => b.id === id);
          return sum + (badge?.pearlBonus ?? 0);
        }, 0);

        const next: ProgressionState = {
          ...prev,
          xp: prev.xp + reward.xp,
          pearls: (prev.pearls ?? 0) + activityPearls + milestonePearlBonus,
          completedLessonIds: updatedCompletedIds,
          earnedItems: [...prev.earnedItems, { emoji: reward.emoji, item: reward.item }],
          lessonAttempts: [...prev.lessonAttempts, attempt],
          phonicsMastery: updatedMastery,
          earnedBadgeIds: [...prevEarnedBadgeIds, ...newBadgeIds],
        };

        saveProgression(next);
        return next;
      });
    },
    [],
  );

  const reset = useCallback(() => {
    const empty: ProgressionState = {
      xp: 0,
      pearls: 0,
      completedLessonIds: [],
      earnedItems: [],
      unlockedActivityIds: INITIAL_UNLOCKED_ACTIVITY_IDS,
      lessonAttempts: [],
      phonicsMastery: {},
      earnedBadgeIds: [],
    };
    saveProgression(empty);
    setState(empty);
  }, []);

  const isLessonCompleted = useCallback(
    (id: string) => state.completedLessonIds.includes(id),
    [state.completedLessonIds],
  );

  const isActivityUnlocked = useCallback(
    (activityId: string) => state.unlockedActivityIds.includes(activityId),
    [state.unlockedActivityIds],
  );

  return {
    xp: state.xp,
    pearls: state.pearls ?? 0,
    completedLessonIds: state.completedLessonIds,
    earnedItems: state.earnedItems,
    unlockedActivityIds: state.unlockedActivityIds,
    lessonAttempts: state.lessonAttempts,
    phonicsMastery: state.phonicsMastery ?? {},
    earnedBadgeIds: state.earnedBadgeIds ?? [],
    isLessonCompleted,
    isActivityUnlocked,
    completeLesson,
    completeReadingActivity,
    reset,
  };
}

