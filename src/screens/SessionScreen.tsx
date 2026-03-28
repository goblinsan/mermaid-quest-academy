import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import Card, { CardHeader, CardTitle, CardBody } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { useProgression } from '../hooks/useProgression';
import { generateSession, getUnlockedPhonicsLevel } from '../services/sessionService';
import {
  loadActiveSession,
  saveActiveSession,
  clearActiveSession,
  loadLastSessionActivityIds,
  saveLastSessionActivityIds,
} from '../services/storageService';
import { getReadingActivityById } from '../services/activityLoader';
import type { ReadingSession } from '../types/session';
import type { SessionActivityContext } from '../types/session';

/** Human-readable label for each phonics level. */
const LEVEL_LABELS: Record<number, string> = {
  1: 'Level 1 – Letter Sounds',
  2: 'Level 2 – Sound & Object',
  3: 'Level 3 – Sorting Sounds',
  4: 'Level 4 – Word Blending',
};

/** Emoji badge displayed alongside the level label. */
const LEVEL_ICONS: Record<number, string> = {
  1: '🐚',
  2: '🐟',
  3: '🏴‍☠️',
  4: '🌊',
};

/**
 * Orchestrates a structured phonics reading session lasting 5–10 minutes
 * (2–3 activities) and advances the learner through phonics levels.
 *
 * Responsibilities:
 * - Generates a new session when none exists, using the learner's current
 *   phonics level and mastery state.
 * - Shows session progress and the title of the next activity to play.
 * - Navigates to `/reading/:id` with session context so `ReadingActivityScreen`
 *   can route back here on completion.
 * - Offers a resume prompt when the app is reopened mid-session (issue #100).
 * - Navigates to `/session/reward` when all activities are finished (issue #99).
 */
export default function SessionScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const progression = useProgression();

  // `fromActivity` is true when we just returned from completing an activity —
  // in that case we suppress the resume prompt and continue seamlessly.
  const fromActivity =
    (location.state as { fromActivity?: boolean } | null)?.fromActivity === true;

  // Initialise session state from localStorage on each mount.
  const [session, setSession] = useState<ReadingSession | null>(() => {
    const stored = loadActiveSession();
    if (stored && !stored.completedAt) return stored;
    return null;
  });

  // Show the resume prompt when an incomplete session was found on a fresh
  // visit (not when returning from an activity in that very session).
  const [showResumePrompt, setShowResumePrompt] = useState<boolean>(
    () => session !== null && !fromActivity,
  );

  // ------------------------------------------------------------------
  // Session actions
  // ------------------------------------------------------------------

  /** Generates and persists a brand-new session, discarding any saved one. */
  const startNewSession = () => {
    // Preserve the old session's activity IDs as "recently played" so the
    // generator can deprioritise them.
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
    setSession(newSession);
    setShowResumePrompt(false);
  };

  /** Resumes the previously-saved incomplete session. */
  const resumeSession = () => {
    setShowResumePrompt(false);
  };

  // Generate session on first visit when none exists.
  if (!session && !showResumePrompt) {
    startNewSession();
    // `startNewSession` calls `setSession`, so re-render will pick it up.
    // Return null for this render cycle.
    return null;
  }

  // ------------------------------------------------------------------
  // Render helpers
  // ------------------------------------------------------------------

  const isSessionComplete =
    session !== null && session.currentIndex >= session.activityIds.length;

  // Navigate to session reward if somehow we land here with a complete session.
  if (isSessionComplete && session) {
    navigate('/session/reward', { state: { session }, replace: true });
    return null;
  }

  const currentLevel = session
    ? session.phonicsLevel
    : getUnlockedPhonicsLevel({ completedLessonIds: progression.completedLessonIds });

  const totalActivities = session?.activityIds.length ?? 0;
  const completedCount = session?.completedActivityIds.length ?? 0;
  const nextActivityId = session?.activityIds[session.currentIndex];
  const nextActivityConfig = nextActivityId ? getReadingActivityById(nextActivityId) : undefined;

  const handlePlayActivity = () => {
    if (!nextActivityId || !session) return;
    const ctx: SessionActivityContext = {
      sessionId: session.id,
      activityIndex: session.currentIndex,
    };
    navigate(`/reading/${nextActivityId}`, { state: ctx });
  };

  // ------------------------------------------------------------------
  // Resume prompt
  // ------------------------------------------------------------------

  if (showResumePrompt && session) {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-xl text-center">
          <div className="text-6xl mb-4">📖</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-2">
            Unfinished Session
          </h1>
          <p className="font-body text-pearl-300 mb-2">
            You started a session earlier and didn't finish it.
          </p>
          <p className="font-body text-ocean-300 mb-8">
            {completedCount} of {totalActivities} activities completed
          </p>

          <Card variant="ocean" className="mb-8 text-left">
            <CardBody>
              <p className="font-quest text-ocean-300 mb-1">
                {LEVEL_ICONS[currentLevel] ?? '🎯'} {LEVEL_LABELS[currentLevel] ?? `Level ${currentLevel}`}
              </p>
              <div className="flex gap-2 mt-3">
                {session.activityIds.map((id, i) => (
                  <div
                    key={id}
                    className={`flex-1 h-3 rounded-full transition-all ${
                      i < completedCount
                        ? 'bg-seafoam-400'
                        : 'bg-ocean-800'
                    }`}
                  />
                ))}
              </div>
            </CardBody>
          </Card>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="primary" size="lg" onClick={resumeSession}>
              ▶ Continue Session
            </Button>
            <Button variant="ghost" size="lg" onClick={startNewSession}>
              🔄 Start Fresh
            </Button>
          </div>

          <div className="mt-6">
            <Link to="/">
              <Button variant="ghost" size="sm">← Back to Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // Main session view
  // ------------------------------------------------------------------

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-3">
            {LEVEL_ICONS[currentLevel] ?? '🎯'}
          </div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-1">
            Reading Session
          </h1>
          <p className="font-body text-ocean-300">
            {LEVEL_LABELS[currentLevel] ?? `Level ${currentLevel}`}
          </p>
        </div>

        {/* Progress bar */}
        <Card variant="ocean" className="mb-6">
          <CardHeader>
            <CardTitle>
              Progress — {completedCount} / {totalActivities} activities
            </CardTitle>
          </CardHeader>
          <CardBody>
            <div className="flex gap-2">
              {(session?.activityIds ?? []).map((id, i) => (
                <div
                  key={id}
                  className={`flex-1 h-4 rounded-full transition-all duration-500 ${
                    i < completedCount
                      ? 'bg-seafoam-400'
                      : i === completedCount
                      ? 'bg-ocean-400 animate-pulse'
                      : 'bg-ocean-800'
                  }`}
                />
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Next activity card */}
        {nextActivityConfig && (
          <Card variant="glass" className="mb-6">
            <CardHeader>
              <CardTitle>
                🎯 Activity {completedCount + 1} of {totalActivities}
              </CardTitle>
            </CardHeader>
            <CardBody>
              <p className="font-quest text-xl text-ocean-200 mb-1">
                {nextActivityConfig.title}
              </p>
              <p className="font-body text-sm text-ocean-400">
                {nextActivityConfig.prompt.text}
              </p>
            </CardBody>
          </Card>
        )}

        {/* Action buttons */}
        <div className="flex flex-col gap-4">
          <Button
            variant="primary"
            size="xl"
            onClick={handlePlayActivity}
            disabled={!nextActivityId}
          >
            ▶ Play Activity
          </Button>

          <div className="flex gap-3 justify-center">
            <Link to="/">
              <Button variant="ghost" size="sm">← Home</Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={startNewSession}>
              🔄 New Session
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
