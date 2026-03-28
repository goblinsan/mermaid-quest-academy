import { useLocation, useNavigate, Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useProgression } from '../hooks/useProgression';
import { getUnlockedPhonicsLevel } from '../services/sessionService';
import {
  clearActiveSession,
  saveLastSessionActivityIds,
  loadLastSessionActivityIds,
  loadActiveSession,
} from '../services/storageService';
import { generateSession } from '../services/sessionService';
import { saveActiveSession } from '../services/storageService';
import { getReadingActivityById } from '../services/activityLoader';
import { computeSessionBonus, getUnlockedOutfits, getUnlockedPets, getUnlockedAreas } from '../services/rewardService';
import { MILESTONE_BADGES } from '../data/rewardsConfig';
import type { SessionRewardNavigationState } from '../types/session';

/** Human-readable label for each phonics level. */
const LEVEL_LABELS: Record<number, string> = {
  1: 'Level 1 – Letter Sounds',
  2: 'Level 2 – Sound & Object',
  3: 'Level 3 – Sorting Sounds',
  4: 'Level 4 – Word Blending',
};

/** Celebration emoji for each phonics level. */
const LEVEL_CELEBRATION: Record<number, string> = {
  1: '🐚',
  2: '🐟',
  3: '🏴‍☠️',
  4: '🌊',
};

/**
 * End-of-session reward screen shown after the learner completes all
 * activities in a reading session (issues #99, #102–#106).
 *
 * Displays:
 * - Celebration header with pearls and XP earned this session
 * - Session completion pearl bonus
 * - Newly earned milestone badges with their pearl bonuses
 * - Newly unlocked mermaid outfits, pet sea creatures, and ocean areas
 * - New phonics level unlock message (when applicable)
 * - Activities completed in this session
 * - "Start Another Session" and "Home" buttons
 */
export default function SessionRewardScreen() {
  const location = useLocation();
  const navigate = useNavigate();
  const progression = useProgression();

  const navState = location.state as SessionRewardNavigationState | null;
  const session = navState?.session ?? null;

  // Determine whether a new phonics level was unlocked during this session.
  const currentLevel = getUnlockedPhonicsLevel({
    completedLessonIds: progression.completedLessonIds,
  });
  const newLevelUnlocked =
    session !== null && currentLevel > session.phonicsLevel ? currentLevel : null;

  // Compute which milestone badges are new this session (issue #105).
  const badgesAtStart = session?.earnedBadgeIdsAtStart ?? [];
  const newSessionBadgeIds = progression.earnedBadgeIds.filter(
    (id) => !badgesAtStart.includes(id),
  );
  const newBadges = MILESTONE_BADGES.filter((b) => newSessionBadgeIds.includes(b.id));

  // Pearl totals (issue #102).
  const sessionBonus = computeSessionBonus();
  const milestonePearlBonus = newBadges.reduce((sum, b) => sum + b.pearlBonus, 0);
  const totalSessionPearls = (session?.pearlsEarned ?? 0) + sessionBonus + milestonePearlBonus;

  // Newly unlocked cosmetics, pets, and areas (issue #104).
  const allUnlockedOutfits = getUnlockedOutfits(progression.earnedBadgeIds);
  const prevUnlockedOutfits = new Set(getUnlockedOutfits(badgesAtStart).map((o) => o.id));
  const newOutfits = allUnlockedOutfits.filter((o) => !prevUnlockedOutfits.has(o.id));

  const allUnlockedPets = getUnlockedPets(progression.earnedBadgeIds);
  const prevUnlockedPets = new Set(getUnlockedPets(badgesAtStart).map((p) => p.id));
  const newPets = allUnlockedPets.filter((p) => !prevUnlockedPets.has(p.id));

  const allUnlockedAreas = getUnlockedAreas(progression.earnedBadgeIds);
  const prevUnlockedAreas = new Set(getUnlockedAreas(badgesAtStart).map((a) => a.id));
  const newAreas = allUnlockedAreas.filter((a) => !prevUnlockedAreas.has(a.id));

  const hasNewUnlocks = newOutfits.length > 0 || newPets.length > 0 || newAreas.length > 0;

  /** Clears the completed session and generates a fresh one, then navigates to it. */
  const handleStartAnotherSession = () => {
    const prev = loadActiveSession();
    if (prev) {
      saveLastSessionActivityIds(prev.activityIds);
    }
    clearActiveSession();

    const recentIds = loadLastSessionActivityIds();
    const progressionState = {
      completedLessonIds: progression.completedLessonIds,
      xp: progression.xp,
      pearls: progression.pearls,
      earnedItems: progression.earnedItems,
      unlockedActivityIds: progression.unlockedActivityIds,
      lessonAttempts: progression.lessonAttempts,
      phonicsMastery: progression.phonicsMastery,
      earnedBadgeIds: progression.earnedBadgeIds,
    };
    const newSession = generateSession(progressionState, recentIds);
    saveActiveSession(newSession);

    // Navigate to session screen, suppressing the resume prompt since we just
    // generated a fresh session (not an interrupted one).
    navigate('/session', { replace: true, state: { fromActivity: true } });
  };

  // Graceful fallback if landed without navigation state.
  if (!session) {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-xl text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-4">
            Session Complete!
          </h1>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" size="lg" onClick={handleStartAnotherSession}>
              🔁 Start Another Session
            </Button>
            <Link to="/">
              <Button variant="ghost" size="lg">🏠 Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const completedActivities = session.completedActivityIds.map((id) =>
    getReadingActivityById(id),
  );

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-xl text-center">
        {/* Celebration header */}
        <div className="mb-6">
          <div className="text-7xl mb-4 animate-wave inline-block">🎉</div>
          <h1 className="font-quest text-4xl text-coral-300 text-shadow mb-2">
            Session Complete!
          </h1>
          <p className="font-body text-pearl-300 text-lg">
            You earned{' '}
            <span className="font-quest text-ocean-200">{session.xpEarned} XP</span> and completed{' '}
            <span className="font-quest text-ocean-200">
              {session.completedActivityIds.length} activit
              {session.completedActivityIds.length === 1 ? 'y' : 'ies'}
            </span>
            !
          </p>
        </div>

        {/* Pearl earnings summary (issue #102) */}
        <Card variant="glass" className="mb-6 text-left">
          <CardHeader>
            <CardTitle>🪙 Pearls Earned</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-body text-sm text-ocean-300">Activities</p>
                <p className="font-quest text-ocean-200">+{session.pearlsEarned ?? 0}</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="font-body text-sm text-ocean-300">Session bonus</p>
                <p className="font-quest text-ocean-200">+{sessionBonus}</p>
              </div>
              {milestonePearlBonus > 0 && (
                <div className="flex items-center justify-between">
                  <p className="font-body text-sm text-ocean-300">Milestone bonus</p>
                  <p className="font-quest text-seafoam-400">+{milestonePearlBonus}</p>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-white/10 pt-2 mt-2">
                <p className="font-quest text-ocean-200">Total this session</p>
                <p className="font-quest text-2xl text-coral-300">+{totalSessionPearls} 🪙</p>
              </div>
              <div className="flex items-center justify-between">
                <p className="font-body text-xs text-ocean-400">Total pearls collected</p>
                <p className="font-body text-sm text-ocean-300">{progression.pearls} 🪙</p>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Milestone celebration (issue #105) */}
        {newBadges.length > 0 && (
          <Card variant="ocean" className="mb-6 text-left">
            <CardHeader>
              <CardTitle>🏅 Milestones Reached!</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {newBadges.map((badge) => (
                  <div
                    key={badge.id}
                    className="flex items-center gap-3 rounded-xl bg-ocean-700/40 px-4 py-3"
                  >
                    <span className="text-3xl">{badge.emoji}</span>
                    <div className="flex-1">
                      <p className="font-quest text-pearl-200">{badge.name}</p>
                      <p className="font-body text-xs text-ocean-400">{badge.description}</p>
                    </div>
                    <p className="font-quest text-seafoam-400 whitespace-nowrap">
                      +{badge.pearlBonus} 🪙
                    </p>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {/* New unlocks: outfits, pets, ocean areas (issue #104) */}
        {hasNewUnlocks && (
          <Card variant="ocean" className="mb-6 text-left">
            <CardHeader>
              <CardTitle>🔓 New Unlocks!</CardTitle>
            </CardHeader>
            <CardBody>
              <div className="space-y-3">
                {newOutfits.map((outfit) => (
                  <div
                    key={outfit.id}
                    className="flex items-center gap-3 rounded-xl bg-ocean-700/40 px-4 py-3"
                  >
                    <span className="text-3xl">{outfit.emoji}</span>
                    <div>
                      <p className="font-quest text-pearl-200">{outfit.name}</p>
                      <p className="font-body text-xs text-ocean-400">{outfit.description}</p>
                    </div>
                  </div>
                ))}
                {newPets.map((pet) => (
                  <div
                    key={pet.id}
                    className="flex items-center gap-3 rounded-xl bg-ocean-700/40 px-4 py-3"
                  >
                    <span className="text-3xl">{pet.emoji}</span>
                    <div>
                      <p className="font-quest text-pearl-200">{pet.name}</p>
                      <p className="font-body text-xs text-ocean-400">{pet.description}</p>
                    </div>
                  </div>
                ))}
                {newAreas.map((area) => (
                  <div
                    key={area.id}
                    className="flex items-center gap-3 rounded-xl bg-ocean-700/40 px-4 py-3"
                  >
                    <span className="text-3xl">{area.emoji}</span>
                    <div>
                      <p className="font-quest text-pearl-200">{area.name}</p>
                      <p className="font-body text-xs text-ocean-400">{area.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}

        {/* New level unlock banner */}
        {newLevelUnlocked !== null && (
          <div className="mb-6 rounded-2xl bg-ocean-700/60 border-2 border-ocean-400 px-6 py-4">
            <p className="font-quest text-2xl text-ocean-200 mb-1">
              🔓 New Level Unlocked!
            </p>
            <p className="font-body text-ocean-300">
              {LEVEL_CELEBRATION[newLevelUnlocked] ?? '🎯'}{' '}
              {LEVEL_LABELS[newLevelUnlocked] ?? `Level ${newLevelUnlocked}`}
            </p>
          </div>
        )}

        {/* Activities completed */}
        <Card variant="ocean" className="mb-6 text-left">
          <CardHeader>
            <CardTitle>✅ Activities Completed</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="divide-y divide-white/10">
              {completedActivities.map((config, i) => (
                <div
                  key={session.completedActivityIds[i]}
                  className="flex items-center gap-3 py-3"
                >
                  <span className="text-seafoam-400 text-xl">✓</span>
                  <div>
                    <p className="font-quest text-pearl-200">
                      {config?.title ?? session.completedActivityIds[i]}
                    </p>
                    {config && (
                      <p className="font-body text-xs text-ocean-400">
                        Sound: {config.progression.targetSound.toUpperCase()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* XP and level summary */}
        <Card variant="glass" className="mb-8 text-left">
          <CardBody>
            <div className="flex items-center justify-between">
              <p className="font-quest text-ocean-300">⚡ XP This Session</p>
              <p className="font-quest text-2xl text-ocean-200">+{session.xpEarned}</p>
            </div>
            <div className="flex items-center justify-between mt-2">
              <p className="font-quest text-ocean-300">
                {LEVEL_CELEBRATION[currentLevel] ?? '🎯'} Current Level
              </p>
              <p className="font-body text-sm text-ocean-300">
                {LEVEL_LABELS[currentLevel] ?? `Level ${currentLevel}`}
              </p>
            </div>
          </CardBody>
        </Card>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="primary" size="lg" onClick={handleStartAnotherSession}>
            🔁 Start Another Session
          </Button>
          <Link to="/">
            <Button variant="ghost" size="lg">🏠 Home</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
