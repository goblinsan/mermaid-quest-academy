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
 * activities in a reading session (issue #99).
 *
 * Displays:
 * - Celebration header with pearls/XP earned
 * - Activities completed in this session
 * - New phonics level unlock message (when applicable)
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
      earnedItems: progression.earnedItems,
      unlockedActivityIds: progression.unlockedActivityIds,
      lessonAttempts: progression.lessonAttempts,
      phonicsMastery: progression.phonicsMastery,
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

        {/* XP summary */}
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
