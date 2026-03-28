import type { PhonicsActivityConfig } from '../types/activity';
import type { PhonicsActivityStatus } from '../hooks/usePhonicsActivity';
import Card from './ui/Card';
import Button from './ui/Button';
import ReplayAudioButton from './ui/ReplayAudioButton';
import FeedbackBanner from './FeedbackBanner';

interface ActivityShellProps {
  /** The phonics activity configuration to render. */
  config: PhonicsActivityConfig;
  /** The option id currently selected by the learner, or `null`. */
  selectedOptionId: string | null;
  /** Current lifecycle status of the activity. */
  status: PhonicsActivityStatus;
  /**
   * Called when the learner taps an answer tile.
   * Receives the selected option's `id`.
   */
  onSelectOption: (optionId: string) => void;
  /**
   * Called when the learner taps "Try Again" (after incorrect) or
   * "Next Question" (after a non-final correct answer in a streak).
   */
  onContinueAfterFeedback: () => void;
  /** Called when the learner taps "Claim Reward" on activity completion. */
  onClaimReward: () => void;
  /** Called when the learner taps the exit / back button at any time. */
  onExit: () => void;
  /** When `true`, the replay button shows a loading spinner. */
  audioLoading?: boolean;
  /** Called when the learner taps the replay audio button. */
  onReplayAudio: () => void;
  /**
   * Optional callback invoked when the learner taps an answer tile that has a
   * `ttsText` value.  Receives the option's TTS text so the parent can play
   * the per-letter phoneme sound.
   */
  onOptionAudio?: (ttsText: string) => void;
}

/**
 * Shared activity screen shell for reading/phonics mini-games.
 *
 * Renders:
 * - An activity header with title
 * - A prompt area (text + optional image) with a replay audio button
 * - Answer option tiles (tap-to-submit)
 * - A feedback banner after submission
 * - Primary CTA buttons (Try Again / Next Question / Claim Reward)
 * - A secondary ghost exit button
 *
 * The shell is intentionally layout-only; all state is driven by props so
 * the parent screen can manage progression, audio, and navigation.
 *
 * @example
 * ```tsx
 * <ActivityShell
 *   config={config}
 *   selectedOptionId={selectedOptionId}
 *   status={status}
 *   onSelectOption={selectAndSubmit}
 *   onContinueAfterFeedback={continueAfterFeedback}
 *   onClaimReward={handleClaimReward}
 *   onExit={() => navigate('/world')}
 *   audioLoading={audioLoading}
 *   onReplayAudio={replay}
 * />
 * ```
 */
export default function ActivityShell({
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
}: ActivityShellProps) {
  const showResult =
    status === 'correct' || status === 'incorrect' || status === 'completed';

  const correctOption = config.options.find((o) => o.id === config.correctOptionId);

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">📖</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-2">
            {config.title}
          </h1>
        </div>

        {/* Sticky prompt card — replay button always reachable (#116) */}
        <div className="sticky top-0 z-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 mb-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <p className="font-body text-pearl-100 text-xl leading-relaxed">
                {config.prompt.text}
              </p>
              {config.prompt.imageSrc && (
                <img
                  src={config.prompt.imageSrc}
                  alt=""
                  aria-hidden="true"
                  className="mt-4 rounded-xl max-h-40 object-contain"
                />
              )}
            </div>
            <ReplayAudioButton onReplay={onReplayAudio} isLoading={audioLoading} />
          </div>
        </div>

        {/* Activity card — options + feedback */}
        <Card variant="glass" className="mb-6">
          {/* Answer option tiles — tap-to-submit (#114: min-h-[80px] for tablet touch targets) */}
          <div className="flex flex-col gap-4 mb-4">
            {config.options.map((option) => {
              const isSelected = selectedOptionId === option.id;
              const isCorrectOption = option.id === config.correctOptionId;

              let optionClass =
                'w-full text-left rounded-2xl border-2 px-6 py-5 font-body text-lg transition-all duration-200 min-h-[80px] flex items-center gap-3 ';

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
                  key={option.id}
                  className={optionClass}
                  disabled={showResult}
                  aria-label={`${option.text}${isSelected ? ', selected' : ''}`}
                  aria-pressed={isSelected}
                  onClick={() => {
                    if (option.ttsText) onOptionAudio?.(option.ttsText);
                    onSelectOption(option.id);
                  }}
                >
                  {showResult && isCorrectOption && <span className="text-2xl">✅</span>}
                  {showResult && isSelected && !isCorrectOption && (
                    <span className="text-2xl">❌</span>
                  )}
                  {!showResult && (
                    <span className="text-2xl opacity-0 select-none" aria-hidden="true">
                      ▶
                    </span>
                  )}
                  {option.emoji && <span className="text-2xl">{option.emoji}</span>}
                  <span>{option.text}</span>
                </button>
              );
            })}
          </div>

          {/* Feedback banner */}
          {(status === 'correct' || status === 'completed') && (
            <FeedbackBanner
              status="correct"
              message={config.feedback.correctMessage}
              reward={status === 'completed' ? config.reward : undefined}
            />
          )}
          {status === 'incorrect' && (
            <FeedbackBanner
              status="incorrect"
              message={config.feedback.incorrectMessage}
              correctAnswer={correctOption?.text}
            />
          )}
        </Card>

        {/* Primary CTA — one visible at a time */}
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
              🏆 Claim Reward!
            </Button>
          )}

          {/* Secondary escape — always visible */}
          <Button variant="ghost" size="lg" fullWidth onClick={onExit}>
            ← Back to World Map
          </Button>
        </div>
      </div>
    </div>
  );
}
