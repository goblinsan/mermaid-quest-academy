import type { PhonicsActivityConfig } from '../types/activity';
import type { PhonicsActivityStatus } from '../hooks/usePhonicsActivity';
import Button from './ui/Button';
import ReplayAudioButton from './ui/ReplayAudioButton';
import FeedbackBanner from './FeedbackBanner';

interface BubblePopLettersProps {
  /** The phonics activity configuration to render. */
  config: PhonicsActivityConfig;
  /** The option id currently selected by the learner, or `null`. */
  selectedOptionId: string | null;
  /** Current lifecycle status of the activity. */
  status: PhonicsActivityStatus;
  /** Called when the learner taps a letter bubble. */
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
   * Called when the learner taps a bubble that has `ttsText`.
   * Receives the option's TTS text so the parent can play the phoneme sound.
   */
  onOptionAudio?: (ttsText: string) => void;
}

/**
 * Returns the bubble animation duration in seconds based on difficulty level.
 * Lower levels = slower bubbles (easier), higher levels = faster bubbles (harder).
 */
function getBubbleDuration(difficultyLevel: number): number {
  switch (difficultyLevel) {
    case 1:
      return 5;
    case 2:
      return 3.5;
    case 3:
      return 2.5;
    case 4:
      return 1.8;
    default:
      return 5;
  }
}

/**
 * Returns evenly distributed horizontal positions (as % strings) for `count`
 * bubbles so they spread naturally across the play area.
 */
function getBubblePositions(count: number): string[] {
  if (count <= 1) return ['50%'];
  return Array.from({ length: count }, (_, i) =>
    `${Math.round(10 + (80 / (count - 1)) * i)}%`,
  );
}

/**
 * Level 1 "Bubble Pop Letters" activity renderer.
 *
 * Displays floating animated letter bubbles that drift gently up and down.
 * The learner hears a phoneme prompt and taps the bubble with the matching
 * letter to "pop" it.
 *
 * Features:
 * - Speed control: bubble animation duration scales with `difficultyLevel`
 *   (1 = slow, 4 = fast) — satisfying issues #72 and #73.
 * - Density control: bubble count is driven by `config.options.length`; as
 *   more SATPIN letters are introduced the pool grows (3 → 5 options).
 * - Per-letter TTS: tapping a bubble fires `onOptionAudio` so the parent can
 *   play the phoneme sound immediately (issue #74).
 * - Celebration: completing the activity shows an animated reward banner and
 *   celebratory text (issue #75).
 */
export default function BubblePopLetters({
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
}: BubblePopLettersProps) {
  const showResult =
    status === 'correct' || status === 'incorrect' || status === 'completed';

  const correctOption = config.options.find((o) => o.id === config.correctOptionId);
  const difficultyLevel = config.progression.difficultyLevel;
  const baseDuration = getBubbleDuration(difficultyLevel);
  const positions = getBubblePositions(config.options.length);

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🫧</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-2">
            {config.title}
          </h1>
        </div>

        {/* Prompt card */}
        <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between gap-4">
            <p className="font-body text-pearl-100 text-xl leading-relaxed flex-1">
              {config.prompt.text}
            </p>
            <ReplayAudioButton onReplay={onReplayAudio} isLoading={audioLoading} />
          </div>
        </div>

        {/* Bubble play area */}
        <div
          className="relative w-full rounded-2xl bg-ocean-950/50 border border-ocean-700/30 mb-6"
          style={{ height: '220px' }}
          role="group"
          aria-label="Floating letter bubbles"
        >
          {config.options.map((option, index) => {
            const isSelected = selectedOptionId === option.id;
            const isCorrectOption = option.id === config.correctOptionId;

            // Each bubble gets its own offset within the play area
            const topOffset = 20 + (index % 3) * 40; // stagger rows: 20, 60, 100 px
            const animDelay = index * (baseDuration / config.options.length);

            let bubbleClass =
              'absolute flex flex-col items-center justify-center rounded-full ' +
              'border-2 w-20 h-20 transition-all duration-300 ';

            if (showResult) {
              if (isCorrectOption) {
                bubbleClass +=
                  'border-seafoam-400 bg-seafoam-500/40 scale-125 ' +
                  'shadow-[0_0_24px_rgba(102,187,106,0.7)]';
              } else if (isSelected && !isCorrectOption) {
                bubbleClass += 'border-coral-500 bg-coral-900/40 opacity-60 scale-90';
              } else {
                bubbleClass += 'border-ocean-500/30 bg-ocean-900/20 opacity-30';
              }
            } else {
              bubbleClass +=
                'border-ocean-300/60 bg-ocean-700/30 backdrop-blur-sm cursor-pointer ' +
                'hover:border-ocean-200 hover:bg-ocean-600/40 hover:scale-110 active:scale-95 ' +
                'animate-float';
            }

            return (
              <button
                key={option.id}
                className={bubbleClass}
                style={{
                  left: positions[index],
                  top: `${topOffset}px`,
                  transform: 'translateX(-50%)',
                  animationDuration: `${baseDuration + index * 0.6}s`,
                  animationDelay: `${animDelay}s`,
                }}
                disabled={showResult}
                aria-label={`Letter ${option.text}`}
                onClick={() => {
                  if (option.ttsText) onOptionAudio?.(option.ttsText);
                  onSelectOption(option.id);
                }}
              >
                {/* Letter label */}
                <span className="font-quest text-3xl text-pearl-100 leading-none">
                  {option.text}
                </span>
                {/* Result icon */}
                {showResult && isCorrectOption && (
                  <span className="absolute -top-1 -right-1 text-base">✅</span>
                )}
                {showResult && isSelected && !isCorrectOption && (
                  <span className="absolute -top-1 -right-1 text-base">❌</span>
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
              <div className="mt-3 text-center font-quest text-2xl text-ocean-200 animate-float">
                🫧✨ POP! Great job! ✨🫧
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
              🏆 Claim Bubble Pearl!
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
