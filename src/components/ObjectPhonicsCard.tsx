import type { PhonicsAnswerOption } from '../types/activity';

interface ObjectPhonicsCardProps {
  /** The answer option to render as a large picture card. */
  option: PhonicsAnswerOption;
  /** Whether this card is the correct answer for the current activity. */
  isCorrectOption: boolean;
  /** Whether this card is the one the learner last selected. */
  isSelected: boolean;
  /** Whether any answer has been submitted (locks the card). */
  isSubmitted: boolean;
  /** Called when the learner taps the card. */
  onSelect: () => void;
  /**
   * Called when the learner taps the card and the option has a `ttsText`.
   * Receives the option's TTS text so the parent can play the word aloud.
   */
  onTapAudio?: (ttsText: string) => void;
  /**
   * When `true`, the word label below the emoji is hidden visually.
   * The label is still present in the accessibility tree for screen readers.
   * Defaults to `false` (label visible).
   */
  hideLabel?: boolean;
}

/**
 * Large-touch visual card for object-based phonics activities.
 *
 * Displays a prominent emoji and an optional word label beneath it.
 * Tapping the card fires `onSelect` and, when the option has a `ttsText`,
 * also calls `onTapAudio` so the parent can play the word's audio.
 *
 * Visual states:
 * - **idle** — translucent ocean tile with hover/active scale effects
 * - **correct** — seafoam green glow (correct option highlighted)
 * - **incorrect selection** — coral red, dimmed (wrong pick highlighted)
 * - **unselected after result** — faded out to draw attention to the correct card
 */
export default function ObjectPhonicsCard({
  option,
  isCorrectOption,
  isSelected,
  isSubmitted,
  onSelect,
  onTapAudio,
  hideLabel = false,
}: ObjectPhonicsCardProps) {
  let cardClass =
    'relative flex flex-col items-center justify-center rounded-3xl border-4 ' +
    'p-4 min-h-[140px] w-full transition-all duration-200 select-none ';

  if (isSubmitted) {
    if (isCorrectOption) {
      cardClass +=
        'border-seafoam-400 bg-seafoam-900/50 scale-105 ' +
        'shadow-[0_0_24px_rgba(102,187,106,0.6)]';
    } else if (isSelected && !isCorrectOption) {
      cardClass += 'border-coral-500 bg-coral-900/40 opacity-70';
    } else {
      cardClass += 'border-ocean-600/30 bg-ocean-900/20 opacity-40';
    }
  } else {
    cardClass +=
      'border-pearl-300/40 bg-ocean-800/60 cursor-pointer ' +
      'hover:border-ocean-300 hover:bg-ocean-700/60 hover:scale-105 ' +
      'active:scale-95';
  }

  return (
    <button
      className={cardClass}
      disabled={isSubmitted}
      aria-label={option.text}
      onClick={() => {
        if (option.ttsText) onTapAudio?.(option.ttsText);
        onSelect();
      }}
    >
      {/* Large emoji */}
      <span className="text-6xl leading-none mb-2" aria-hidden="true">
        {option.emoji}
      </span>

      {/* Word label — visually hidden when hideLabel is true, still in a11y tree */}
      <span
        className={
          'font-body text-lg font-semibold leading-snug text-center ' +
          (hideLabel ? 'sr-only' : 'text-pearl-100')
        }
      >
        {option.text}
      </span>

      {/* Result overlay icons */}
      {isSubmitted && isCorrectOption && (
        <span className="absolute -top-2 -right-2 text-2xl" aria-hidden="true">
          ✅
        </span>
      )}
      {isSubmitted && isSelected && !isCorrectOption && (
        <span className="absolute -top-2 -right-2 text-2xl" aria-hidden="true">
          ❌
        </span>
      )}
    </button>
  );
}
