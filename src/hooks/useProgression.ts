import { useCallback, useState } from 'react';
import type { Lesson } from '../types/lesson';
import type { EarnedItem, LessonAttempt, ProgressionState } from '../types/progression';
import { INITIAL_UNLOCKED_ACTIVITY_IDS } from '../data/zoneConfig';
import { loadProgression, saveProgression } from '../services/storageService';

export interface UseProgressionReturn {
  /** Total XP accumulated across all completed lessons. */
  xp: number;
  /** IDs of lessons the learner has finished. */
  completedLessonIds: string[];
  /** Ordered treasure items collected from completed lessons. */
  earnedItems: EarnedItem[];
  /** Activity IDs the learner is allowed to start. */
  unlockedActivityIds: string[];
  /** Ordered list of per-lesson attempt records for accuracy tracking. */
  lessonAttempts: LessonAttempt[];
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
        completedLessonIds: [...prev.completedLessonIds, lesson.id],
        earnedItems: [
          ...prev.earnedItems,
          { emoji: lesson.reward.emoji, item: lesson.reward.item },
        ],
        unlockedActivityIds: newUnlocked,
        lessonAttempts: [...prev.lessonAttempts, attempt],
      };

      saveProgression(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const empty: ProgressionState = {
      xp: 0,
      completedLessonIds: [],
      earnedItems: [],
      unlockedActivityIds: INITIAL_UNLOCKED_ACTIVITY_IDS,
      lessonAttempts: [],
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
    completedLessonIds: state.completedLessonIds,
    earnedItems: state.earnedItems,
    unlockedActivityIds: state.unlockedActivityIds,
    lessonAttempts: state.lessonAttempts,
    isLessonCompleted,
    isActivityUnlocked,
    completeLesson,
    reset,
  };
}

