import type { ProgressionState } from '../types/progression';
import { INITIAL_UNLOCKED_ACTIVITY_IDS } from '../data/zoneConfig';

const PROGRESSION_KEY = 'mqa_progression';

const defaultProgressionState: ProgressionState = {
  xp: 0,
  completedLessonIds: [],
  earnedItems: [],
  unlockedActivityIds: INITIAL_UNLOCKED_ACTIVITY_IDS,
  lessonAttempts: [],
};

/**
 * Loads a JSON-serialised value from localStorage.
 * Returns `defaultValue` when the key is absent or the stored data is malformed.
 */
export function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (stored !== null) {
      return JSON.parse(stored) as T;
    }
  } catch {
    /* ignore malformed data */
  }
  return defaultValue;
}

/**
 * Serialises `value` to JSON and persists it in localStorage under `key`.
 * Silently ignores write errors (e.g. private-browsing quota exceeded).
 */
export function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore storage errors */
  }
}

/** Loads the learner's persisted progression, merging with defaults. */
export function loadProgression(): ProgressionState {
  const stored = loadFromStorage<Partial<ProgressionState>>(PROGRESSION_KEY, {});
  return { ...defaultProgressionState, ...stored };
}

/** Persists the learner's current progression state. */
export function saveProgression(state: ProgressionState): void {
  saveToStorage(PROGRESSION_KEY, state);
}
