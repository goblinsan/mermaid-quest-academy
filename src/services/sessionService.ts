import type { PhonicsActivityConfig } from '../types/activity';
import type { ProgressionState } from '../types/progression';
import type { ReadingSession } from '../types/session';
import { getAllReadingActivities } from './activityLoader';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Minimum number of activities that must be completed at level N before
 * level N+1 is unlocked (issue #97).
 */
const LEVEL_UNLOCK_THRESHOLD = 3;

/** Minimum number of activities selected per session. */
const SESSION_MIN_ACTIVITIES = 2;

/** Maximum number of activities selected per session. */
const SESSION_MAX_ACTIVITIES = 3;

// ---------------------------------------------------------------------------
// Level unlock rules (issue #97)
// ---------------------------------------------------------------------------

/**
 * Determines the highest phonics level currently unlocked for the learner,
 * based on the number of activities they have completed at each level.
 *
 * Rules:
 * - **Level 1** — always available.
 * - **Level 2** — requires ≥ {@link LEVEL_UNLOCK_THRESHOLD} Level-1 completions.
 * - **Level 3** — requires ≥ {@link LEVEL_UNLOCK_THRESHOLD} Level-2 completions.
 * - **Level 4** — requires ≥ {@link LEVEL_UNLOCK_THRESHOLD} Level-3 completions
 *   (individual activities are also gated by `requiredSounds`).
 *
 * @param progression - Slice of `ProgressionState` needed for the calculation.
 * @returns The highest unlocked phonics level (1–4).
 */
export function getUnlockedPhonicsLevel(
  progression: Pick<ProgressionState, 'completedLessonIds'>,
): number {
  const all = getAllReadingActivities();
  const completed = new Set(progression.completedLessonIds);

  const countAtLevel = (level: number): number =>
    all.filter((a) => a.progression.difficultyLevel === level && completed.has(a.id)).length;

  if (countAtLevel(3) >= LEVEL_UNLOCK_THRESHOLD) return 4;
  if (countAtLevel(2) >= LEVEL_UNLOCK_THRESHOLD) return 3;
  if (countAtLevel(1) >= LEVEL_UNLOCK_THRESHOLD) return 2;
  return 1;
}

// ---------------------------------------------------------------------------
// Session generator (issue #96)
// ---------------------------------------------------------------------------

/**
 * Assigns a priority score to a candidate activity so the session generator
 * can rank them.  **Lower score = higher priority.**
 *
 * Scoring components:
 * - +100  sound is already mastered (consecutiveCorrect ≥ 2) → deprioritise
 * - +50   activity was played in the most-recent session      → deprioritise
 * - +25   activity has already been completed at least once  → deprioritise
 * - ±[0,10) small random jitter to vary order between sessions
 */
function scoreActivity(
  activity: PhonicsActivityConfig,
  mastery: ProgressionState['phonicsMastery'],
  completed: Set<string>,
  recentlyPlayedIds: string[],
): number {
  const soundMastery = mastery[activity.progression.targetSound];
  const isMastered = soundMastery !== undefined && soundMastery.consecutiveCorrect >= 2;
  const isRecent = recentlyPlayedIds.includes(activity.id);
  const isCompleted = completed.has(activity.id);

  return (
    (isMastered ? 100 : 0) +
    (isRecent ? 50 : 0) +
    (isCompleted ? 25 : 0) +
    Math.random() * 10
  );
}

/**
 * Returns `true` if the activity's `requiredSounds` are satisfied by the
 * learner's existing completions (mirrors the gating in `ReadingActivityScreen`).
 */
function areRequiredSoundsMet(
  activity: PhonicsActivityConfig,
  all: PhonicsActivityConfig[],
  completed: Set<string>,
): boolean {
  if (!activity.requiredSounds || activity.requiredSounds.length === 0) return true;
  return activity.requiredSounds.every((sound) => {
    const prereqs = all.filter(
      (x) => x.progression.targetSound === sound && x.progression.difficultyLevel < 4,
    );
    return prereqs.some((x) => completed.has(x.id));
  });
}

/**
 * Generates a new reading session with 2–3 activities appropriate for the
 * learner's current phonics level and mastery state (issue #96).
 *
 * Selection algorithm:
 * 1. Determine the learner's current phonics level via
 *    {@link getUnlockedPhonicsLevel}.
 * 2. Collect all activities at that level, filtering out any Level-4
 *    activities whose `requiredSounds` have not yet been met.
 * 3. Score and sort candidates:  unplayed + unmastered sounds rank highest.
 * 4. Select the top 2–3 candidates (preferring 3 when enough are available).
 * 5. Fall back to Level-1 activities if the current level has no eligible
 *    candidates (e.g. immediately after a fresh level unlock).
 *
 * @param progression        - The learner's current progression state.
 * @param recentlyPlayedIds  - Activity IDs from the previous session; these
 *                             are deprioritised to encourage variety.
 * @returns A new, unsaved `ReadingSession`.
 */
export function generateSession(
  progression: ProgressionState,
  recentlyPlayedIds: string[],
): ReadingSession {
  const all = getAllReadingActivities();
  const completed = new Set(progression.completedLessonIds);
  const level = getUnlockedPhonicsLevel(progression);
  const mastery = progression.phonicsMastery ?? {};

  const score = (a: PhonicsActivityConfig) =>
    scoreActivity(a, mastery, completed, recentlyPlayedIds);

  // Collect candidates at the current level, applying requiredSounds gating
  // for Level-4 activities.
  let candidates = all
    .filter(
      (a) =>
        a.progression.difficultyLevel === level &&
        areRequiredSoundsMet(a, all, completed),
    )
    .sort((a, b) => score(a) - score(b));

  // Fallback: use Level-1 when nothing is available at the current level.
  if (candidates.length === 0) {
    candidates = all
      .filter((a) => a.progression.difficultyLevel === 1)
      .sort((a, b) => score(a) - score(b));
  }

  const count = Math.min(
    SESSION_MAX_ACTIVITIES,
    Math.max(SESSION_MIN_ACTIVITIES, candidates.length),
  );
  const selected = candidates.slice(0, count);

  return {
    id: `session-${Date.now()}`,
    activityIds: selected.map((a) => a.id),
    currentIndex: 0,
    completedActivityIds: [],
    xpEarned: 0,
    startedAt: new Date().toISOString(),
    phonicsLevel: level,
  };
}
