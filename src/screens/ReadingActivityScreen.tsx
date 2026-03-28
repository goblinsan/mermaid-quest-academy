import { useCallback, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import Button from '../components/ui/Button';
import ActivityShell from '../components/ActivityShell';
import SoundSeashellMatch from '../components/SoundSeashellMatch';
import BubblePopLetters from '../components/BubblePopLetters';
import FeedFriendlyFish from '../components/FeedFriendlyFish';
import TreasureChestSort from '../components/TreasureChestSort';
import MermaidEchoSong from '../components/MermaidEchoSong';
import UnderwaterWordBuilder from '../components/UnderwaterWordBuilder';
import { getReadingActivityById, getAllReadingActivities } from '../services/activityLoader';
import { usePhonicsActivity } from '../hooks/usePhonicsActivity';
import { useAudio, prefetchAudio } from '../hooks/useAudio';
import { useProgression } from '../hooks/useProgression';
import { loadActiveSession, saveActiveSession } from '../services/storageService';
import { computeActivityPearls } from '../services/rewardService';
import type { SessionActivityContext, SessionRewardNavigationState } from '../types/session';

/**
 * Screen that wires the shared activity components together with the
 * `usePhonicsActivity` hook, audio system, and progression tracking
 * for reading/phonics mini-games at `/reading/:id`.
 *
 * The rendered component is chosen by `config.uiVariant`:
 * - `'seashell'`       → `SoundSeashellMatch`
 * - `'bubble-pop'`     → `BubblePopLetters`
 * - `'fish-feed'`      → `FeedFriendlyFish`
 * - `'treasure-sort'`  → `TreasureChestSort`
 * - `'echo-song'`      → `MermaidEchoSong`
 * - `'word-builder'`   → `UnderwaterWordBuilder`
 * - `'default'` / unset → `ActivityShell` (generic fallback)
 *
 * Activities that include `requiredSounds` are gated: if the learner has not
 * yet completed at least one earlier activity for each required phoneme, a
 * locked screen is shown instead of the activity (issue #93).
 */
export default function ReadingActivityScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  // If this activity was launched from a reading session, the session context
  // is available in location state so we can navigate back correctly.
  const sessionContext = (location.state as SessionActivityContext | null)?.sessionId
    ? (location.state as SessionActivityContext)
    : null;

  const config = id ? getReadingActivityById(id) : undefined;

  const { selectedOptionId, status, isCorrect, selectAndSubmit, continueAfterFeedback, reset } =
    usePhonicsActivity(config ?? null);

  const { speak, replay, isLoading: audioLoading } = useAudio();
  const { speak: speakOption } = useAudio();
  const progression = useProgression();

  // Auto-play the prompt whenever a new config loads
  useEffect(() => {
    reset();
    if (config) {
      speak(config.prompt.ttsText);
    }
  }, [config, reset, speak]);

  // Prefetch audio for the next activity so it plays instantly
  useEffect(() => {
    if (!config) return;
    const all = getAllReadingActivities();
    const currentIndex = all.findIndex((a) => a.id === config.id);
    const next = currentIndex >= 0 ? all[currentIndex + 1] : undefined;
    if (next) {
      prefetchAudio(next.prompt.ttsText);
    }
  }, [config]);

  /**
   * Plays a corrective hint for the learner after an incorrect answer.
   * Defined unconditionally (before the early return) to satisfy the Rules of
   * Hooks. It is only passed to `FeedFriendlyFish`, which fires it after a
   * short delay so the child hears the correct object's starting sound
   * reinforced on the right word. (issue #81)
   */
  const handleIncorrectHintAudio = useCallback(() => {
    if (!config) return;
    const correctOption = config.options.find((o) => o.id === config.correctOptionId);
    if (!correctOption) return;
    const hintText = `${correctOption.text} starts with the ${config.progression.targetSound} sound`;
    speakOption(hintText);
  }, [config, speakOption]);

  /**
   * Unified reward handler for all activity variants.
   *
   * When the activity was launched from a reading session (session context
   * present in location state), this function advances the session state in
   * localStorage and navigates back to the session screen — or to the session
   * reward screen when the session is complete (issues #99, #100).
   *
   * Otherwise it navigates to the standalone `/reward` screen.
   *
   * Defined unconditionally before early returns to satisfy the Rules of Hooks.
   */
  const handleClaimRewardWithContext = useCallback(
    (correct: boolean) => {
      if (!config) return;
      progression.completeReadingActivity(config.id, config.reward, correct);

      if (sessionContext?.sessionId) {
        const storedSession = loadActiveSession();
        if (storedSession && storedSession.id === sessionContext.sessionId) {
          const activityPearls = computeActivityPearls(
            config.progression.difficultyLevel,
            correct,
          );
          const updated = {
            ...storedSession,
            completedActivityIds: [...storedSession.completedActivityIds, config.id],
            currentIndex: storedSession.currentIndex + 1,
            xpEarned: storedSession.xpEarned + config.reward.xp,
            pearlsEarned: (storedSession.pearlsEarned ?? 0) + activityPearls,
          };
          const isSessionDone = updated.currentIndex >= updated.activityIds.length;
          if (isSessionDone) {
            updated.completedAt = new Date().toISOString();
          }
          saveActiveSession(updated);

          if (isSessionDone) {
            navigate('/session/reward', {
              state: { session: updated } satisfies SessionRewardNavigationState,
            });
          } else {
            navigate('/session', { state: { fromActivity: true } });
          }
          return;
        }
        // Session not found in storage — fall through to standalone reward
        navigate('/session', { state: { fromActivity: true } });
        return;
      }

      navigate('/reward', { state: { reward: config.reward, newZoneUnlocked: false } });
    },
    [config, progression, sessionContext, navigate],
  );

  if (!config) {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-4">
            Activity Not Found
          </h1>
          <p className="font-body text-pearl-300 mb-6">
            We couldn't find reading activity #{id}. Head back to the world map!
          </p>
          <Link to="/world">
            <Button variant="primary" size="lg">← Back to World Map</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------
  // CVC gating (issue #93): check that every required phoneme has been
  // practised in at least one earlier (level 1–3) activity before
  // allowing the learner to attempt this level-4 activity.
  // ------------------------------------------------------------------
  if (config.requiredSounds && config.requiredSounds.length > 0) {
    const allActivities = getAllReadingActivities();
    const unmastered = config.requiredSounds.filter((sound) => {
      const prerequisiteActivities = allActivities.filter(
        (a) =>
          a.progression.targetSound === sound &&
          a.progression.difficultyLevel < 4,
      );
      return !prerequisiteActivities.some((a) =>
        progression.completedLessonIds.includes(a.id),
      );
    });

    if (unmastered.length > 0) {
      return (
        <div className="min-h-screen px-4 py-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="text-6xl mb-4">🔒</div>
            <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-4">
              {config.title}
            </h1>
            <p className="font-body text-pearl-300 mb-2">
              You need to practise these sounds first:
            </p>
            <p className="font-quest text-3xl text-ocean-300 mb-6">
              {unmastered.map((s) => s.toUpperCase()).join('  ·  ')}
            </p>
            <p className="font-body text-pearl-400 text-sm mb-8">
              Complete earlier phonics activities to unlock this word-blending challenge!
            </p>
            <Link to="/world">
              <Button variant="primary" size="lg">← Back to World Map</Button>
            </Link>
          </div>
        </div>
      );
    }
  }

  /**
   * Reward handler for treasure-sort / echo-song / word-builder activities.
   * These activities are only completable when fully correct, so `isCorrect`
   * is always `true` at this point.
   */
  const handleClaimReward = () => handleClaimRewardWithContext(isCorrect);
  const handleSortingClaimReward = () => handleClaimRewardWithContext(true);

  /** Plays the per-letter phoneme sound when the learner taps an option tile. */
  const handleOptionAudio = (ttsText: string) => {
    speakOption(ttsText);
  };

  const sharedProps = {
    config,
    selectedOptionId,
    status,
    onSelectOption: selectAndSubmit,
    onContinueAfterFeedback: continueAfterFeedback,
    onClaimReward: handleClaimReward,
    onExit: () => navigate('/world'),
    audioLoading,
    onReplayAudio: replay,
    onOptionAudio: handleOptionAudio,
  };

  if (config.uiVariant === 'seashell') {
    return <SoundSeashellMatch {...sharedProps} />;
  }

  if (config.uiVariant === 'bubble-pop') {
    return <BubblePopLetters {...sharedProps} />;
  }

  if (config.uiVariant === 'fish-feed') {
    return (
      <FeedFriendlyFish
        {...sharedProps}
        onIncorrectHintAudio={handleIncorrectHintAudio}
      />
    );
  }

  if (config.uiVariant === 'treasure-sort') {
    return (
      <TreasureChestSort
        config={config}
        onClaimReward={handleSortingClaimReward}
        onExit={() => navigate('/world')}
        audioLoading={audioLoading}
        onReplayAudio={replay}
        onItemAudio={handleOptionAudio}
        onBinAudio={handleOptionAudio}
      />
    );
  }

  if (config.uiVariant === 'echo-song') {
    return (
      <MermaidEchoSong
        config={config}
        onClaimReward={handleSortingClaimReward}
        onExit={() => navigate('/world')}
        audioLoading={audioLoading}
        onReplayAudio={replay}
        onBeatAudio={handleOptionAudio}
      />
    );
  }

  if (config.uiVariant === 'word-builder') {
    return (
      <UnderwaterWordBuilder
        config={config}
        onClaimReward={handleSortingClaimReward}
        onExit={() => navigate('/world')}
        audioLoading={audioLoading}
        onReplayAudio={replay}
        onLetterAudio={handleOptionAudio}
        onBlendedWordAudio={(word) => speakOption(word)}
      />
    );
  }

  return <ActivityShell {...sharedProps} />;
}
