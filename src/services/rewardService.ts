import type { ProgressionState } from '../types/progression';
import type { MilestoneBadge, MermaidOutfit, PetSeaCreature, OceanArea } from '../types/rewards';
import { getAllReadingActivities } from './activityLoader';
import {
  PEARLS_PER_ACTIVITY_LEVEL,
  PEARLS_CORRECT_BONUS,
  PEARLS_SESSION_COMPLETION_BONUS,
  MILESTONE_BADGES,
  MERMAID_OUTFITS,
  PET_SEA_CREATURES,
  OCEAN_AREAS,
} from '../data/rewardsConfig';
import cvcWordsData from '../data/cvcWords.json';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Number of consecutive correct completions needed before a sound is
 * considered "mastered" (mirrors the threshold in `sessionService.ts`).
 */
const MASTERY_CONSECUTIVE_CORRECT_THRESHOLD = 2;

/**
 * Number of distinct activity completions required at a given phonics level
 * before that level's completion badge is awarded.
 * Only unique activity IDs count — the guard in `useProgression.completeReadingActivity`
 * prevents the same activity from being credited more than once.
 */
const LEVEL_COMPLETION_THRESHOLD = 3;

/** SATPIN sounds tracked for the "all-sounds-mastered" milestone. */
const SATPIN_SOUNDS = ['s', 'a', 't', 'p', 'i', 'n'] as const;

// ---------------------------------------------------------------------------
// Pearl computation (issues #102, #103)
// ---------------------------------------------------------------------------

/**
 * Computes the number of pearls awarded for completing a single reading activity.
 *
 * @param difficultyLevel - The activity's phonics difficulty level (1–4).
 * @param isCorrect - Whether the learner completed the activity correctly on their first try.
 * @returns Total pearls to award (base rate + optional correct bonus).
 */
export function computeActivityPearls(difficultyLevel: number, isCorrect: boolean): number {
  const base = PEARLS_PER_ACTIVITY_LEVEL[difficultyLevel] ?? PEARLS_PER_ACTIVITY_LEVEL[1];
  return base + (isCorrect ? PEARLS_CORRECT_BONUS : 0);
}

/**
 * Returns the session completion bonus pearls.
 * Applied once when all activities in a session are finished.
 */
export function computeSessionBonus(): number {
  return PEARLS_SESSION_COMPLETION_BONUS;
}

// ---------------------------------------------------------------------------
// Milestone detection (issues #104, #105)
// ---------------------------------------------------------------------------

/**
 * Returns every milestone badge whose trigger condition is satisfied by the
 * given progression state.  Used internally to compute which badges a learner
 * should hold at any point in time.
 *
 * @param completedLessonIds - Full list of completed activity/lesson IDs.
 * @param phonicsMastery     - Per-sound mastery state.
 */
function getEarnedBadgesForProgression(
  completedLessonIds: string[],
  phonicsMastery: ProgressionState['phonicsMastery'],
): MilestoneBadge[] {
  const completedSet = new Set(completedLessonIds);
  const all = getAllReadingActivities();

  const countAtLevel = (level: number): number =>
    all.filter((a) => a.progression.difficultyLevel === level && completedSet.has(a.id)).length;

  return MILESTONE_BADGES.filter((badge) => {
    if (badge.type === 'sound-mastered') {
      const pet = badge.unlocksPetId
        ? PET_SEA_CREATURES.find((p) => p.id === badge.unlocksPetId)
        : null;
      if (!pet) return false;
      const mastery = phonicsMastery[pet.targetSound];
      return mastery !== undefined && mastery.consecutiveCorrect >= MASTERY_CONSECUTIVE_CORRECT_THRESHOLD;
    }

    if (badge.type === 'level-completed') {
      // Extract level number: 'badge-level-2' → 2
      const badgeLevel = parseInt(badge.id.replace('badge-level-', ''), 10);
      return countAtLevel(badgeLevel) >= LEVEL_COMPLETION_THRESHOLD;
    }

    if (badge.type === 'all-sounds-mastered') {
      return SATPIN_SOUNDS.every((sound) => {
        const mastery = phonicsMastery[sound];
        return mastery !== undefined && mastery.consecutiveCorrect >= MASTERY_CONSECUTIVE_CORRECT_THRESHOLD;
      });
    }

    return false;
  });
}

/**
 * Computes the full list of badge IDs that should be earned for the given
 * progression state.  Called by `useProgression.completeReadingActivity` to
 * determine which badges are newly unlocked.
 *
 * @param completedLessonIds - Full list of completed activity/lesson IDs.
 * @param phonicsMastery     - Per-sound mastery state.
 */
export function computeEarnedBadgeIds(
  completedLessonIds: string[],
  phonicsMastery: ProgressionState['phonicsMastery'],
): string[] {
  return getEarnedBadgesForProgression(completedLessonIds, phonicsMastery).map((b) => b.id);
}

// ---------------------------------------------------------------------------
// Unlock queries (issue #104)
// ---------------------------------------------------------------------------

/**
 * Returns the mermaid outfits currently unlocked by the learner's earned badges.
 * @param earnedBadgeIds - All badge IDs the learner has permanently accumulated.
 */
export function getUnlockedOutfits(earnedBadgeIds: string[]): MermaidOutfit[] {
  const earnedSet = new Set(earnedBadgeIds);
  const unlockedIds = new Set(
    MILESTONE_BADGES.filter((b) => earnedSet.has(b.id) && b.unlocksOutfitId).map(
      (b) => b.unlocksOutfitId as string,
    ),
  );
  return MERMAID_OUTFITS.filter((o) => unlockedIds.has(o.id));
}

/**
 * Returns the pet sea creatures currently unlocked by the learner's earned badges.
 * @param earnedBadgeIds - All badge IDs the learner has permanently accumulated.
 */
export function getUnlockedPets(earnedBadgeIds: string[]): PetSeaCreature[] {
  const earnedSet = new Set(earnedBadgeIds);
  const unlockedIds = new Set(
    MILESTONE_BADGES.filter((b) => earnedSet.has(b.id) && b.unlocksPetId).map(
      (b) => b.unlocksPetId as string,
    ),
  );
  return PET_SEA_CREATURES.filter((p) => unlockedIds.has(p.id));
}

/**
 * Returns the ocean areas currently unlocked by the learner's earned badges.
 * @param earnedBadgeIds - All badge IDs the learner has permanently accumulated.
 */
export function getUnlockedAreas(earnedBadgeIds: string[]): OceanArea[] {
  const earnedSet = new Set(earnedBadgeIds);
  const unlockedIds = new Set(
    MILESTONE_BADGES.filter((b) => earnedSet.has(b.id) && b.unlocksAreaId).map(
      (b) => b.unlocksAreaId as string,
    ),
  );
  return OCEAN_AREAS.filter((a) => unlockedIds.has(a.id));
}

// ---------------------------------------------------------------------------
// CVC word unlock computation (issue #108)
// ---------------------------------------------------------------------------

interface CvcWordEntry {
  word: string;
  phonemes: string[];
}

/**
 * Returns the CVC words (lowercase) that are unlocked because every one of
 * their component phonemes has been mastered by the learner.
 *
 * A phoneme is considered mastered when the learner's `PhonicsLetterMastery`
 * for that sound has `consecutiveCorrect ≥ 2` (mirrors the mastery threshold
 * used elsewhere in the codebase).
 *
 * @param phonicsMastery - The learner's per-sound mastery state.
 * @returns Array of lowercase CVC word strings (e.g. `["sat", "tap"]`).
 */
export function computeUnlockedCvcWords(
  phonicsMastery: ProgressionState['phonicsMastery'],
): string[] {
  const masteredSounds = new Set(
    Object.entries(phonicsMastery)
      .filter(([, m]) => m.consecutiveCorrect >= MASTERY_CONSECUTIVE_CORRECT_THRESHOLD)
      .map(([sound]) => sound),
  );

  return (cvcWordsData as CvcWordEntry[])
    .filter((entry) => entry.phonemes.every((p) => masteredSounds.has(p)))
    .map((entry) => entry.word);
}
