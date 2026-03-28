import { useCallback, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import ActivityShell from '../components/ActivityShell';
import SoundSeashellMatch from '../components/SoundSeashellMatch';
import BubblePopLetters from '../components/BubblePopLetters';
import FeedFriendlyFish from '../components/FeedFriendlyFish';
import { getReadingActivityById, getAllReadingActivities } from '../services/activityLoader';
import { usePhonicsActivity } from '../hooks/usePhonicsActivity';
import { useAudio, prefetchAudio } from '../hooks/useAudio';
import { useProgression } from '../hooks/useProgression';

/**
 * Screen that wires the shared activity components together with the
 * `usePhonicsActivity` hook, audio system, and progression tracking
 * for reading/phonics mini-games at `/reading/:id`.
 *
 * The rendered component is chosen by `config.uiVariant`:
 * - `'seashell'`    → `SoundSeashellMatch`
 * - `'bubble-pop'`  → `BubblePopLetters`
 * - `'fish-feed'`   → `FeedFriendlyFish`
 * - `'default'` / unset → `ActivityShell` (generic fallback)
 */
export default function ReadingActivityScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

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

  const handleClaimReward = () => {
    progression.completeReadingActivity(config.id, config.reward, isCorrect);
    navigate('/reward', { state: { reward: config.reward, newZoneUnlocked: false } });
  };

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

  return <ActivityShell {...sharedProps} />;
}
