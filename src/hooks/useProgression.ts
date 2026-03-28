import { useCallback, useState } from 'react';
import type { Lesson, LessonReward } from '../types/lesson';
import type { EarnedItem, LessonAttempt, PhonicsLetterMastery, ProgressionState } from '../types/progression';
import type { ReadingSession } from '../types/session';
import { INITIAL_UNLOCKED_ACTIVITY_IDS } from '../data/zoneConfig';
import { loadProgression, saveProgression } from '../services/storageService';
import { getAllReadingActivities } from '../services/activityLoader';
import { computeActivityPearls, computeEarnedBadgeIds, computeUnlockedCvcWords } from '../services/rewardService';
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
  /**
   * Lowercase SATPIN sounds that have been introduced to the learner (i.e.
   * at least one activity has been attempted for each sound).
   */
  introducedSounds: string[];
  /**
   * CVC words (lowercase) that the learner can currently build because all
   * component phonemes have been mastered.
   */
  unlockedCvcWords: string[];
  /**
   * Ordered history of completed reading sessions (issue #110).
   */
  sessionHistory: ProgressionState['sessionHistory'];
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
   * When the activity has already been completed before (a replay), mastery
   * and retry counts are still updated but no additional XP or pearls are
   * awarded (issue #109).
   * @param activityId - The reading activity id (e.g. `"ra-1"`).
   * @param reward     - The reward to award on first completion.
   * @param isCorrect  - Whether the learner completed correctly (first-try accuracy).
   */
  completeReadingActivity: (activityId: string, reward: LessonReward, isCorrect: boolean) => void;
  /**
   * Persists a completed session record to the learner's session history
   * (issue #110). No-op if a record for the same session id already exists.
   * @param session - The `ReadingSession` that was just finished.
   */
  recordCompletedSession: (session: ReadingSession) => void;
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
        introducedSounds: prev.introducedSounds ?? [],
        unlockedCvcWords: prev.unlockedCvcWords ?? [],
        sessionHistory: prev.sessionHistory ?? [],
      };

      saveProgression(next);
      return next;
    });
  }, []);

  const completeReadingActivity = useCallback(
    (activityId: string, reward: LessonReward, isCorrect: boolean) => {
      setState((prev) => {
        const isReplay = prev.completedLessonIds.includes(activityId);

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
            retryCount: 0,
          };
          updatedMastery = {
            ...updatedMastery,
            [sound]: {
              // On replays, only retryCount increases; primary attempt stats
              // are not incremented again so accuracy reflects first-time
              // performance (issue #109).
              attemptCount: isReplay ? existing.attemptCount : existing.attemptCount + 1,
              correctCount: isReplay ? existing.correctCount : existing.correctCount + (isCorrect ? 1 : 0),
              consecutiveCorrect: isCorrect ? existing.consecutiveCorrect + 1 : 0,
              lastCompletedAt: attempt.completedAt,
              retryCount: isReplay ? existing.retryCount + 1 : existing.retryCount,
            },
          };
        }

        // Derive introduced sounds from mastery keys (issue #108).
        // Only track the 6 single-character SATPIN sounds; multi-character mastery
        // keys (e.g. CVC word targets like "sat") represent blend targets, not
        // individual introduced phonemes.
        const SATPIN = ['s', 'a', 't', 'p', 'i', 'n'];
        const updatedIntroducedSounds = Object.keys(updatedMastery).filter((sound) =>
          SATPIN.includes(sound),
        );

        // Recompute unlocked CVC words from newly updated mastery (issue #108)
        const updatedUnlockedCvcWords = computeUnlockedCvcWords(updatedMastery);

        // For replays: update mastery & CVC words, but skip XP / pearl / badge awards.
        if (isReplay) {
          const next: ProgressionState = {
            ...prev,
            lessonAttempts: [...prev.lessonAttempts, attempt],
            phonicsMastery: updatedMastery,
            introducedSounds: updatedIntroducedSounds,
            unlockedCvcWords: updatedUnlockedCvcWords,
          };
          saveProgression(next);
          return next;
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
          introducedSounds: updatedIntroducedSounds,
          unlockedCvcWords: updatedUnlockedCvcWords,
        };

        saveProgression(next);
        return next;
      });
    },
    [],
  );

  const recordCompletedSession = useCallback((session: ReadingSession) => {
    setState((prev) => {
      // Idempotency guard: skip if this session has already been recorded.
      if ((prev.sessionHistory ?? []).some((r) => r.sessionId === session.id)) return prev;

      const record = {
        sessionId: session.id,
        completedAt: session.completedAt ?? new Date().toISOString(),
        activityIds: session.completedActivityIds,
        pearlsEarned: session.pearlsEarned,
        phonicsLevel: session.phonicsLevel,
      };

      const next: ProgressionState = {
        ...prev,
        sessionHistory: [...(prev.sessionHistory ?? []), record],
      };
      saveProgression(next);
      return next;
    });
  }, []);

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
      introducedSounds: [],
      unlockedCvcWords: [],
      sessionHistory: [],
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
    introducedSounds: state.introducedSounds ?? [],
    unlockedCvcWords: state.unlockedCvcWords ?? [],
    sessionHistory: state.sessionHistory ?? [],
    isLessonCompleted,
    isActivityUnlocked,
    completeLesson,
    completeReadingActivity,
    recordCompletedSession,
    reset,
  };
}

