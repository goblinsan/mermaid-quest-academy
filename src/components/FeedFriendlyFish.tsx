import { useEffect, useRef } from 'react';
import type { PhonicsActivityConfig } from '../types/activity';
import type { PhonicsActivityStatus } from '../hooks/usePhonicsActivity';
import ObjectPhonicsCard from './ObjectPhonicsCard';
import Button from './ui/Button';
import ReplayAudioButton from './ui/ReplayAudioButton';
import FeedbackBanner from './FeedbackBanner';

interface FeedFriendlyFishProps {
  /** The phonics activity configuration to render. */
  config: PhonicsActivityConfig;
  /** The option id currently selected by the learner, or `null`. */
  selectedOptionId: string | null;
  /** Current lifecycle status of the activity. */
  status: PhonicsActivityStatus;
  /** Called when the learner taps an object card. */
  onSelectOption: (optionId: string) => void;
  /** Called when the learner taps "Try Again" or "Next Question". */
  onContinueAfterFeedback: () => void;
  /** Called when the learner taps "Claim Reward" on activity completion. */
  onClaimReward: () => void;
  /** Called when the learner taps the exit / back button. */
  onExit: () => void;
  /** When `true`, the replay button shows a loading spinner. */
  audioLoading?: boolean;
  /** Called when the learner taps the replay audio button to re-hear the prompt. */
  onReplayAudio: () => void;
  /**
   * Called when the learner taps an object card that has a `ttsText`.
   * Receives the option's TTS text so the parent can play the word aloud.
   */
  onOptionAudio?: (ttsText: string) => void;
  /**
   * Called after a short delay whenever the learner submits an incorrect answer.
   * The parent should play a corrective hint (e.g. "Apple starts with the a sound")
   * to reinforce the connection between the target phoneme and the correct object.
   * Satisfies issue #81 — corrective hint audio on incorrect answers.
   */
  onIncorrectHintAudio?: () => void;
}

/**
 * Level 2 "Feed the Friendly Fish" activity renderer.
 *
 * Presents a grid of large picture-object cards. The learner hears a phoneme
 * prompt ("Which object starts with the /s/ sound?") and taps the card whose
 * object name begins with that sound to "feed" the fish.
 *
 * Features:
 * - Large `ObjectPhonicsCard` tiles for easy touch targets (issue #78).
 * - Emoji-first design: the object's emoji dominates each card; the word
 *   label can be optionally hidden to increase challenge (currently visible).
 * - Per-card tap audio: tapping a card plays the word's TTS audio via
 *   `onOptionAudio` (issue #81 — prompt replay).
 * - Corrective hint: after an incorrect answer, `onIncorrectHintAudio` is
 *   called after 900 ms so the parent can speak the correct object's starting
 *   sound to reinforce the phoneme–object association (issue #81).
 * - Distractor balancing: ensured at the data layer — incorrect choices come
 *   from different SATPIN phonemes so they are plausible but not confusing
 *   (issue #80).
 * - Answer validation is handled by the shared `usePhonicsActivity` hook
 *   (issue #79), keeping this component purely presentational.
 */
export default function FeedFriendlyFish({
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
  onIncorrectHintAudio,
}: FeedFriendlyFishProps) {
  const isSubmitted =
    status === 'correct' || status === 'incorrect' || status === 'completed';

  const correctOption = config.options.find((o) => o.id === config.correctOptionId);

  // Store the latest hint callback in a ref so the effect closure is always fresh.
  const hintCallbackRef = useRef(onIncorrectHintAudio);
  useEffect(() => {
    hintCallbackRef.current = onIncorrectHintAudio;
  }, [onIncorrectHintAudio]);

  // Play corrective hint audio after a short delay when the learner is wrong.
  // The delay lets the "incorrect" feedback banner render before the audio fires,
  // giving the child a moment to process the visual result first. (issue #81)
  useEffect(() => {
    if (status !== 'incorrect') return;
    const timer = setTimeout(() => hintCallbackRef.current?.(), 900);
    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🐟</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-2">
            {config.title}
          </h1>
          {/* Instruction only available to screen readers (#115) */}
          <p className="sr-only">
            Tap the picture that starts with the right sound to feed the fish!
          </p>
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

        {/* Object picture cards grid */}
        <div
          className="grid grid-cols-3 gap-4 mb-8"
          role="group"
          aria-label="Object choices"
        >
          {config.options.map((option) => (
            <ObjectPhonicsCard
              key={option.id}
              option={option}
              isCorrectOption={option.id === config.correctOptionId}
              isSelected={selectedOptionId === option.id}
              isSubmitted={isSubmitted}
              onSelect={() => onSelectOption(option.id)}
              onTapAudio={onOptionAudio}
            />
          ))}
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
                🐟✨ The fish is happy! Great job! ✨🐟
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
              🏆 Claim Fish Treasure!
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
