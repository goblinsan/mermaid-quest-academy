import { useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import { getLessonById } from '../services/lessonLoader';
import { useLessonState } from '../hooks/useLessonState';

export default function ActivityScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lesson, selectedAnswer, status, loadLesson, selectAnswer, submitAnswer, completeLesson, reset } =
    useLessonState();

  useEffect(() => {
    reset();
    if (id) {
      const found = getLessonById(id);
      if (found) loadLesson(found);
    }
  }, [id, reset, loadLesson]);

  useEffect(() => {
    if (status === 'completed') {
      navigate('/reward');
    }
  }, [status, navigate]);

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
            <Button variant="primary">← Back to World Map</Button>
          </Link>
        </div>
      </div>
    );
  }

  const handleFillBlankChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    selectAnswer(e.target.value);
  };

  const canSubmit =
    status === 'in-progress' &&
    selectedAnswer !== null &&
    selectedAnswer.trim().length > 0;

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">🎯</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-2">
            Quest #{id}
          </h1>
          <p className="font-body text-pearl-300">
            Complete this activity to earn stars and advance in the ocean world!
          </p>
        </div>

        <Card variant="glass" className="mb-6">
          <h2 className="font-quest text-2xl text-ocean-300 mb-4">📜 Quest Challenge</h2>
          <p className="font-body text-pearl-200 text-lg mb-6">{lesson.prompt}</p>

          {/* Multiple-choice / True-False options */}
          {lesson.options && (
            <div className="flex flex-col gap-3 mb-4">
              {lesson.options.map((option) => {
                const isSelected = selectedAnswer === option;
                const showResult = status === 'correct' || status === 'incorrect';
                const isCorrectOption = option === lesson.answer;

                let optionClass =
                  'w-full text-left rounded-xl border-2 px-5 py-4 font-body text-base transition-all duration-200 cursor-pointer ';

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
                    'border-ocean-600/40 bg-ocean-900/20 text-pearl-200 hover:border-ocean-400 hover:bg-ocean-700/30';
                }

                return (
                  <button
                    key={option}
                    className={optionClass}
                    disabled={status !== 'in-progress'}
                    onClick={() => selectAnswer(option)}
                  >
                    {showResult && isCorrectOption && '✅ '}
                    {showResult && isSelected && !isCorrectOption && '❌ '}
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
                className="w-full rounded-xl border-2 border-ocean-600/40 bg-ocean-900/20 px-5 py-4 font-body text-base text-pearl-100 placeholder-ocean-400 focus:border-ocean-400 focus:outline-none disabled:opacity-60"
                placeholder="Type your answer here…"
                value={selectedAnswer ?? ''}
                onChange={handleFillBlankChange}
                disabled={status !== 'in-progress'}
              />
            </div>
          )}

          {/* Feedback banner */}
          {status === 'correct' && (
            <div className="rounded-xl bg-seafoam-900/40 border-2 border-seafoam-400 px-5 py-4 text-seafoam-200 font-quest text-lg mb-4">
              🎉 Correct! You earned {lesson.reward.xp} XP and a {lesson.reward.item}{' '}
              {lesson.reward.emoji}!
            </div>
          )}
          {status === 'incorrect' && (
            <div className="rounded-xl bg-coral-900/40 border-2 border-coral-500 px-5 py-4 text-coral-200 font-quest text-lg mb-4">
              😢 Not quite! The correct answer is:{' '}
              <span className="font-body">{lesson.answer}</span>
            </div>
          )}
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <Link to="/world">
            <Button variant="ghost">← Back to World Map</Button>
          </Link>

          {status === 'in-progress' && (
            <Button variant="coral" disabled={!canSubmit} onClick={submitAnswer}>
              ✅ Submit Answer
            </Button>
          )}

          {(status === 'correct' || status === 'incorrect') && (
            <Button variant="coral" onClick={completeLesson}>
              🏆 Claim Reward!
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
