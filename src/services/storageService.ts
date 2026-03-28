import type { ProgressionState } from '../types/progression';
import type { ReadingSession } from '../types/session';
import { INITIAL_UNLOCKED_ACTIVITY_IDS } from '../data/zoneConfig';

const PROGRESSION_KEY = 'mqa_progression';
const ACTIVE_SESSION_KEY = 'mqa_active_session';
const LAST_SESSION_IDS_KEY = 'mqa_last_session_ids';

const defaultProgressionState: ProgressionState = {
  xp: 0,
  pearls: 0,
  completedLessonIds: [],
  earnedItems: [],
  unlockedActivityIds: INITIAL_UNLOCKED_ACTIVITY_IDS,
  lessonAttempts: [],
  phonicsMastery: {},
  earnedBadgeIds: [],
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

/**
 * Loads the currently-active reading session from localStorage.
 * Returns `null` when no session has been saved or the stored data is malformed.
 */
export function loadActiveSession(): ReadingSession | null {
  return loadFromStorage<ReadingSession | null>(ACTIVE_SESSION_KEY, null);
}

/**
 * Persists the currently-active reading session to localStorage so it can
 * be resumed if the app is closed or backgrounded (issue #100).
 */
export function saveActiveSession(session: ReadingSession): void {
  saveToStorage(ACTIVE_SESSION_KEY, session);
}

/** Removes the active session entry from localStorage. */
export function clearActiveSession(): void {
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch {
    /* ignore storage errors */
  }
}

/**
 * Returns the activity IDs from the most recently completed session so the
 * session generator can deprioritise them in the next session.
 */
export function loadLastSessionActivityIds(): string[] {
  return loadFromStorage<string[]>(LAST_SESSION_IDS_KEY, []);
}

/**
 * Saves the activity IDs of a completed session so they can be deprioritised
 * when generating the next session.
 */
export function saveLastSessionActivityIds(ids: string[]): void {
  saveToStorage(LAST_SESSION_IDS_KEY, ids);
}
