import type { LessonReward } from '../types/lesson';

interface FeedbackBannerProps {
  /** Whether the learner's last answer was correct or incorrect. */
  status: 'correct' | 'incorrect';
  /** Message body displayed inside the banner. */
  message: string;
  /**
   * The reward to display on a correct submission.
   * Shown only when provided (e.g. on final completion, not on mid-streak correct).
   */
  reward?: LessonReward;
  /**
   * The text of the correct answer, shown when the learner answers incorrectly
   * so they can see what the right choice was.
   */
  correctAnswer?: string;
}

/**
 * Reusable feedback banner displayed after the learner submits an answer.
 *
 * - **Correct** state: seafoam (green) styling with 🎉 and optional reward.
 * - **Incorrect** state: coral (red) styling with 😢 and optional correct-answer hint.
 */
export default function FeedbackBanner({
  status,
  message,
  reward,
  correctAnswer,
}: FeedbackBannerProps) {
  if (status === 'correct') {
    return (
      <div className="rounded-2xl bg-seafoam-900/40 border-2 border-seafoam-400 px-6 py-5 text-seafoam-200 font-quest text-xl mb-2">
        🎉 {message}
        {reward && (
          <span>
            {' '}
            You earned {reward.xp} XP and a {reward.item} {reward.emoji}!
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl bg-coral-900/40 border-2 border-coral-500 px-6 py-5 text-coral-200 font-quest text-xl mb-2">
      😢 {message}
      {correctAnswer && (
        <span className="font-body"> The correct answer is: {correctAnswer}</span>
      )}
    </div>
  );
}
