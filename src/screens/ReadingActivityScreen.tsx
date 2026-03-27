import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import ActivityShell from '../components/ActivityShell';
import { getReadingActivityById, getAllReadingActivities } from '../services/activityLoader';
import { usePhonicsActivity } from '../hooks/usePhonicsActivity';
import { useAudio, prefetchAudio } from '../hooks/useAudio';
import { useProgression } from '../hooks/useProgression';

/**
 * Screen that wires the shared `ActivityShell` together with the
 * `usePhonicsActivity` hook, audio system, and progression tracking
 * for reading/phonics mini-games at `/reading/:id`.
 */
export default function ReadingActivityScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const config = id ? getReadingActivityById(id) : undefined;

  const { selectedOptionId, status, isCorrect, selectAndSubmit, continueAfterFeedback, reset } =
    usePhonicsActivity(config ?? null);

  const { speak, replay, isLoading: audioLoading } = useAudio();
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

  return (
    <ActivityShell
      config={config}
      selectedOptionId={selectedOptionId}
      status={status}
      onSelectOption={selectAndSubmit}
      onContinueAfterFeedback={continueAfterFeedback}
      onClaimReward={handleClaimReward}
      onExit={() => navigate('/world')}
      audioLoading={audioLoading}
      onReplayAudio={replay}
    />
  );
}
