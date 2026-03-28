import type { PhonicsActivityConfig } from '../types/activity';
import type { PhonicsActivityStatus } from '../hooks/usePhonicsActivity';
import Button from './ui/Button';
import ReplayAudioButton from './ui/ReplayAudioButton';
import FeedbackBanner from './FeedbackBanner';

interface SoundSeashellMatchProps {
  /** The phonics activity configuration to render. */
  config: PhonicsActivityConfig;
  /** The option id currently selected by the learner, or `null`. */
  selectedOptionId: string | null;
  /** Current lifecycle status of the activity. */
  status: PhonicsActivityStatus;
  /** Called when the learner taps a seashell tile. */
  onSelectOption: (optionId: string) => void;
  /** Called when the learner taps "Try Again" or "Next Question". */
  onContinueAfterFeedback: () => void;
  /** Called when the learner taps "Claim Reward" on activity completion. */
  onClaimReward: () => void;
  /** Called when the learner taps the exit / back button. */
  onExit: () => void;
  /** When `true`, the replay button shows a loading spinner. */
  audioLoading?: boolean;
  /** Called when the learner taps the replay audio button. */
  onReplayAudio: () => void;
  /**
   * Called when the learner taps a shell that has `ttsText`.
   * Receives the option's TTS text so the parent can play the phoneme sound.
   */
  onOptionAudio?: (ttsText: string) => void;
}

/**
 * Level 1 "Sound Seashell Match" activity renderer.
 *
 * Displays a row of circular seashell tiles, each labelled with a single
 * letter.  The learner hears a phoneme prompt and taps the shell whose letter
 * makes that sound.
 *
 * Features:
 * - Graduated letter-set: number of shells grows from 3 (S, A, T) up to 5 as
 *   more SATPIN letters are introduced — driven by `config.options.length`.
 * - Per-letter TTS playback: tapping a shell fires `onOptionAudio` so the
 *   parent can play the letter's phoneme sound alongside the selection.
 * - Celebration feedback: the completion state shows an animated reward banner
 *   with pearl emoji and XP summary.
 */
export default function SoundSeashellMatch({
  config,
  selectedOptionId,
  status,
  onSelectOption,
  onContinueAfterFeedback,
  onClaimReward,
  onExit,
  audioLoading = false,
  onReplayAudio,
  onOptionAudio,
}: SoundSeashellMatchProps) {
  const showResult =
    status === 'correct' || status === 'incorrect' || status === 'completed';

  const correctOption = config.options.find((o) => o.id === config.correctOptionId);

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🐚</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-2">
            {config.title}
          </h1>
        </div>

        {/* Sticky prompt card — replay button always reachable (#116) */}
        <div className="sticky top-0 z-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 mb-8">
          <div className="flex items-center justify-between gap-4">
            <p className="font-body text-pearl-100 text-xl leading-relaxed flex-1">
              {config.prompt.text}
            </p>
            <ReplayAudioButton onReplay={onReplayAudio} isLoading={audioLoading} />
          </div>
        </div>

        {/* Seashell tiles */}
        <div
          className="flex flex-wrap justify-center gap-4 mb-8"
          role="group"
          aria-label="Letter choices"
        >
          {config.options.map((option) => {
            const isSelected = selectedOptionId === option.id;
            const isCorrectOption = option.id === config.correctOptionId;

            let shellClass =
              'relative flex flex-col items-center justify-center w-28 h-28 rounded-full ' +
              'border-4 transition-all duration-200 select-none ';

            if (showResult) {
              if (isCorrectOption) {
                shellClass +=
                  'border-seafoam-400 bg-seafoam-900/50 scale-110 shadow-[0_0_20px_rgba(102,187,106,0.6)]';
              } else if (isSelected && !isCorrectOption) {
                shellClass += 'border-coral-500 bg-coral-900/40 opacity-70';
              } else {
                shellClass += 'border-ocean-600/30 bg-ocean-900/20 opacity-40';
              }
            } else {
              shellClass +=
                'border-pearl-300/50 bg-ocean-800/60 cursor-pointer ' +
                'hover:border-ocean-300 hover:bg-ocean-700/60 hover:scale-110 ' +
                'active:scale-95 animate-float gpu-accelerated';
            }

            return (
              <button
                key={option.id}
                className={shellClass}
                style={{
                  animationDelay: `${config.options.indexOf(option) * 0.4}s`,
                }}
                disabled={showResult}
                aria-label={`Letter ${option.text}`}
                onClick={() => {
                  if (option.ttsText) onOptionAudio?.(option.ttsText);
                  onSelectOption(option.id);
                }}
              >
                {/* Shell emoji background */}
                <span className="text-3xl leading-none mb-1" aria-hidden="true">
                  🐚
                </span>
                {/* Letter label */}
                <span className="font-quest text-3xl text-pearl-100 leading-none">
                  {option.text}
                </span>
                {/* Result overlay icon */}
                {showResult && isCorrectOption && (
                  <span className="absolute -top-2 -right-2 text-xl">✅</span>
                )}
                {showResult && isSelected && !isCorrectOption && (
                  <span className="absolute -top-2 -right-2 text-xl">❌</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Feedback banner */}
        {(status === 'correct' || status === 'completed') && (
          <div className="mb-6">
            <FeedbackBanner
              status="correct"
              message={config.feedback.correctMessage}
              reward={status === 'completed' ? config.reward : undefined}
            />
            {status === 'completed' && (
              <div className="mt-3 text-center font-quest text-2xl text-ocean-200 animate-float gpu-accelerated">
                🌊✨ Amazing work! Keep it up! ✨🌊
              </div>
            )}
          </div>
        )}
        {status === 'incorrect' && (
          <div className="mb-6">
            <FeedbackBanner
              status="incorrect"
              message={config.feedback.incorrectMessage}
              correctAnswer={correctOption?.text}
            />
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex flex-col gap-4">
          {status === 'incorrect' && (
            <Button variant="coral" size="xl" fullWidth onClick={onContinueAfterFeedback}>
              🔄 Try Again
            </Button>
          )}
          {status === 'correct' && (
            <Button variant="coral" size="xl" fullWidth onClick={onContinueAfterFeedback}>
              ➡️ Next Question
            </Button>
          )}
          {status === 'completed' && (
            <Button variant="coral" size="xl" fullWidth onClick={onClaimReward}>
              🏆 Claim Pearl Reward!
            </Button>
          )}
          <Button variant="ghost" size="lg" fullWidth onClick={onExit}>
            ← Back to World Map
          </Button>
        </div>
      </div>
    </div>
  );
}
