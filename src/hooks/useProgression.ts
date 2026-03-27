import { useCallback, useState } from 'react';
import type { Lesson } from '../types/lesson';
import type { EarnedItem, ProgressionState } from '../types/progression';
import { INITIAL_UNLOCKED_ACTIVITY_IDS } from '../data/zoneConfig';

const STORAGE_KEY = 'mqa_progression';

const defaultState: ProgressionState = {
  xp: 0,
  completedLessonIds: [],
  earnedItems: [],
  unlockedActivityIds: INITIAL_UNLOCKED_ACTIVITY_IDS,
};

function loadState(): ProgressionState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as Partial<ProgressionState>;
      return { ...defaultState, ...parsed };
    }
  } catch {
    /* ignore malformed data */
  }
  return defaultState;
}

function saveState(state: ProgressionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore storage errors */
  }
}

export interface UseProgressionReturn {
  /** Total XP accumulated across all completed lessons. */
  xp: number;
  /** IDs of lessons the learner has finished. */
  completedLessonIds: string[];
  /** Ordered treasure items collected from completed lessons. */
  earnedItems: EarnedItem[];
  /** Activity IDs the learner is allowed to start. */
  unlockedActivityIds: string[];
  /** Returns true if the given lesson id has been completed. */
  isLessonCompleted: (id: string) => boolean;
  /** Returns true if the given activity id is unlocked for play. */
  isActivityUnlocked: (activityId: string) => boolean;
  /**
   * Records a lesson as completed: awards XP, adds the earned item,
   * and unlocks the next sequential zone. No-op if already completed.
   */
  completeLesson: (lesson: Lesson) => void;
  /** Resets all progression back to the initial state. */
  reset: () => void;
}

/**
 * Manages the learner's persistent progression: XP, earned treasures,
 * and zone unlock state. State is persisted to localStorage so it
 * survives page refreshes.
 */
export function useProgression(): UseProgressionReturn {
  const [state, setState] = useState<ProgressionState>(loadState);

  const completeLesson = useCallback((lesson: Lesson) => {
    setState((prev) => {
      // Guard: do not award the same lesson twice
      if (prev.completedLessonIds.includes(lesson.id)) return prev;

      // Unlock the zone whose activityId immediately follows this lesson
      const nextId = String(Number(lesson.id) + 1);
      const newUnlocked = prev.unlockedActivityIds.includes(nextId)
        ? prev.unlockedActivityIds
        : [...prev.unlockedActivityIds, nextId];

      const next: ProgressionState = {
        xp: prev.xp + lesson.reward.xp,
        completedLessonIds: [...prev.completedLessonIds, lesson.id],
        earnedItems: [
          ...prev.earnedItems,
          { emoji: lesson.reward.emoji, item: lesson.reward.item },
        ],
        unlockedActivityIds: newUnlocked,
      };

      saveState(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    saveState(defaultState);
    setState(defaultState);
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
    isLessonCompleted,
    isActivityUnlocked,
    completeLesson,
    reset,
  };
}
