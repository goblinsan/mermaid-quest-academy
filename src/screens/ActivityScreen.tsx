import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import ReplayAudioButton from '../components/ui/ReplayAudioButton';
import { getLessonById, getAllLessons } from '../services/lessonLoader';
import { useLessonState } from '../hooks/useLessonState';
import { useAudio } from '../hooks/useAudio';
import { useProgression } from '../hooks/useProgression';

export default function ActivityScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lesson, selectedAnswer, status, loadLesson, selectAnswer, selectAndSubmit, submitAnswer, reset } =
    useLessonState();
  const { speak, replay, isLoading: audioLoading } = useAudio();
  const progression = useProgression();

  useEffect(() => {
    reset();
    if (id) {
      const found = getLessonById(id);
      if (found) loadLesson(found);
    }
  }, [id, reset, loadLesson]);

  // Auto-play the question prompt whenever a lesson loads
  useEffect(() => {
    if (lesson) {
      speak(lesson.ttsText);
    }
  }, [lesson, speak]);

  const handleClaimReward = () => {
    if (!lesson) return;
    const totalLessons = getAllLessons().length;
    const nextActivityId = String(Number(lesson.id) + 1);
    const newZoneUnlocked =
      !progression.isActivityUnlocked(nextActivityId) && Number(lesson.id) < totalLessons;
    progression.completeLesson(lesson, status === 'correct');
    navigate('/reward', { state: { reward: lesson.reward, newZoneUnlocked } });
  };

  if (!lesson) {
    return (
      <div className="min-h-screen px-4 py-10">
        <div className="mx-auto max-w-2xl text-center">
          <div className="text-6xl mb-4">🔍</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-4">
            Quest Not Found
          </h1>
          <p className="font-body text-pearl-300 mb-6">
            We couldn't find activity #{id}. Head back to the world map!
          </p>
          <Link to="/world">
            <Button variant="primary" size="lg">← Back to World Map</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleFillBlankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectAnswer(e.target.value);
  };

  const canSubmitFillBlank =
    status === 'in-progress' &&
    selectedAnswer !== null &&
    selectedAnswer.trim().length > 0;

  const showResult = status === 'correct' || status === 'incorrect';

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🎯</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-2">
            Quest #{id}
          </h1>
        </div>

        {/* Question card */}
        <Card variant="glass" className="mb-6">
          {/* Prompt + always-visible replay button */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <p className="font-body text-pearl-100 text-xl leading-relaxed flex-1">{lesson.prompt}</p>
            <ReplayAudioButton onReplay={replay} isLoading={audioLoading} />
          </div>

          {/* Multiple-choice / True-False options — tap to auto-submit */}
          {lesson.options && (
            <div className="flex flex-col gap-4 mb-4">
              {lesson.options.map((option) => {
                const isSelected = selectedAnswer === option;
                const isCorrectOption = option === lesson.answer;

                let optionClass =
                  'w-full text-left rounded-2xl border-2 px-6 py-5 font-body text-lg transition-all duration-200 min-h-[72px] flex items-center gap-3 ';

                if (showResult) {
                  if (isCorrectOption) {
                    optionClass += 'border-seafoam-400 bg-seafoam-900/40 text-seafoam-200';
                  } else if (isSelected && !isCorrectOption) {
                    optionClass += 'border-coral-500 bg-coral-900/40 text-coral-200';
                  } else {
                    optionClass += 'border-ocean-600/40 bg-ocean-900/20 text-pearl-400';
                  }
                } else if (isSelected) {
                  optionClass += 'border-ocean-400 bg-ocean-700/50 text-pearl-100';
                } else {
                  optionClass +=
                    'border-ocean-600/40 bg-ocean-900/20 text-pearl-200 hover:border-ocean-400 hover:bg-ocean-700/30 active:scale-98 cursor-pointer';
                }

                return (
                  <button
                    key={option}
                    className={optionClass}
                    disabled={showResult}
                    onClick={() => selectAndSubmit(option)}
                  >
                    {showResult && isCorrectOption && <span className="text-2xl">✅</span>}
                    {showResult && isSelected && !isCorrectOption && <span className="text-2xl">❌</span>}
                    {!showResult && <span className="text-2xl opacity-0 select-none" aria-hidden="true">▶</span>}
                    {option}
                  </button>
                );
              })}
            </div>
          )}

          {/* Fill-in-the-blank input */}
          {lesson.type === 'fill-blank' && (
            <div className="mb-4">
              <input
                type="text"
                className="w-full rounded-2xl border-2 border-ocean-600/40 bg-ocean-900/20 px-6 py-5 font-body text-lg text-pearl-100 placeholder-ocean-400 focus:border-ocean-400 focus:outline-none disabled:opacity-60 min-h-[72px]"
                placeholder="Type your answer here…"
                value={selectedAnswer ?? ''}
                onChange={handleFillBlankChange}
                disabled={showResult}
              />
            </div>
          )}

          {/* Feedback banner */}
          {status === 'correct' && (
            <div className="rounded-2xl bg-seafoam-900/40 border-2 border-seafoam-400 px-6 py-5 text-seafoam-200 font-quest text-xl mb-2">
              🎉 Correct! You earned {lesson.reward.xp} XP and a {lesson.reward.item}{' '}
              {lesson.reward.emoji}!
            </div>
          )}
          {status === 'incorrect' && (
            <div className="rounded-2xl bg-coral-900/40 border-2 border-coral-500 px-6 py-5 text-coral-200 font-quest text-xl mb-2">
              😢 Not quite! The correct answer is:{' '}
              <span className="font-body">{lesson.answer}</span>
            </div>
          )}
        </Card>

        {/* Single primary CTA per phase */}
        <div className="flex flex-col gap-4">
          {/* Fill-blank submit — only shown while answer is being typed */}
          {lesson.type === 'fill-blank' && status === 'in-progress' && (
            <Button variant="coral" size="xl" fullWidth disabled={!canSubmitFillBlank} onClick={submitAnswer}>
              ✅ Submit Answer
            </Button>
          )}

          {/* After answering — claim reward */}
          {showResult && (
            <Button variant="coral" size="xl" fullWidth onClick={handleClaimReward}>
              🏆 Claim Reward!
            </Button>
          )}

          {/* Secondary escape — less prominent */}
          <Link to="/world" className="block">
            <Button variant="ghost" size="lg" fullWidth>← Back to World Map</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
