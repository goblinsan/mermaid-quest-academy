import { useEffect, useRef } from 'react';
import type { PhonicsActivityConfig } from '../types/activity';
import { useCvcBlendActivity } from '../hooks/useCvcBlendActivity';
import Button from './ui/Button';
import ReplayAudioButton from './ui/ReplayAudioButton';
import FeedbackBanner from './FeedbackBanner';

interface UnderwaterWordBuilderProps {
  /** The phonics activity configuration. Must include `cvcTarget`. */
  config: PhonicsActivityConfig;
  /** Called when the learner taps "Claim Reward!" after assembling the word. */
  onClaimReward: () => void;
  /** Called when the learner taps the exit / back button. */
  onExit: () => void;
  /**
   * Called when the learner taps a letter tile.
   * Receives the letter's TTS text so the parent can play the phoneme aloud
   * (issue #92 — sequential phoneme playback).
   */
  onLetterAudio: (ttsText: string) => void;
  /**
   * Called once all three phonemes have been placed correctly.
   * Receives the blended word text so the parent can speak the full word
   * (issue #92 — blended word output).
   */
  onBlendedWordAudio: (word: string) => void;
  /** When `true`, the replay button shows a loading spinner. */
  audioLoading?: boolean;
  /** Called when the learner taps the replay audio button to re-hear the prompt. */
  onReplayAudio: () => void;
}

/**
 * Level 4 "Underwater Word Builder" activity renderer (issues #91, #92).
 *
 * Shows a target word's emoji and three empty slots.  The learner taps letter
 * tiles in phoneme order (consonant → vowel → consonant) to assemble the CVC
 * word.  As each correct tile is placed:
 * - The phoneme sound plays via `onLetterAudio`.
 * - The slot lights up with the letter.
 *
 * When all three slots are filled the blended word is spoken via
 * `onBlendedWordAudio` and a celebration screen appears (issue #92).
 *
 * Incorrect taps briefly highlight the tile in red without advancing the slot,
 * so the learner can try again without losing progress.
 *
 * Letter-selection state is managed by the `useCvcBlendActivity` hook;
 * this component is purely presentational.
 */
export default function UnderwaterWordBuilder({
  config,
  onClaimReward,
  onExit,
  onLetterAudio,
  onBlendedWordAudio,
  audioLoading = false,
  onReplayAudio,
}: UnderwaterWordBuilderProps) {
  const target = config.cvcTarget;
  const targetPhonemes: [string, string, string] = target?.phonemes ?? ['s', 'a', 't'];

  const { slots, currentSlot, isCompleted, lastSelectionCorrect, selectLetter, reset } =
    useCvcBlendActivity(targetPhonemes);

  // Re-initialise when the activity id changes
  useEffect(() => {
    reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id]);

  // Play the blended word once when the activity transitions to completed.
  // Using a ref to avoid running on every render and to hold the latest callback.
  const blendedWordCallbackRef = useRef(onBlendedWordAudio);
  useEffect(() => {
    blendedWordCallbackRef.current = onBlendedWordAudio;
  }, [onBlendedWordAudio]);

  const prevCompletedRef = useRef(false);
  useEffect(() => {
    if (isCompleted && !prevCompletedRef.current && target) {
      blendedWordCallbackRef.current(target.word);
    }
    prevCompletedRef.current = isCompleted;
  }, [isCompleted, target]);

  // Slot labels: show the letter if placed, or a placeholder
  const slotLabels = slots.map((s) => s?.toUpperCase() ?? '_');
  const builtWord = slotLabels.join('');

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🌊</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-2">
            {config.title}
          </h1>
          {/* Instruction only available to screen readers (#115) */}
          <p className="sr-only">
            Tap the letters in order to build the word!
          </p>
        </div>

        {/* Sticky prompt card — replay button always reachable (#116) */}
        <div className="sticky top-0 z-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between gap-4">
            <p className="font-body text-pearl-100 text-xl leading-relaxed flex-1">
              {config.prompt.text}
            </p>
            <ReplayAudioButton onReplay={onReplayAudio} isLoading={audioLoading} />
          </div>
        </div>

        {/* Target emoji */}
        {target && (
          <div className="text-center mb-6">
            <div className="text-8xl mb-2">{target.emoji}</div>
            <p className="sr-only">
              Build this word
            </p>
          </div>
        )}

        {/* Word slots */}
        <div
          className="flex justify-center gap-4 mb-8"
          role="group"
          aria-label="Word slots"
          aria-live="polite"
          aria-atomic="true"
        >
          {slots.map((letter, index) => {
            const isFilled = letter !== null;
            const isActive = index === currentSlot && !isCompleted;

            return (
              <div
                key={index}
                aria-label={isFilled ? `Slot ${index + 1}: ${slotLabels[index]}` : `Slot ${index + 1}: empty`}
                className={[
                  'flex items-center justify-center w-20 h-20 rounded-2xl border-4 font-quest text-3xl transition-all duration-200',
                  isFilled
                    ? 'bg-seafoam-700/60 border-seafoam-400 text-seafoam-100 scale-110'
                    : isActive
                      ? 'bg-ocean-800/40 border-ocean-300 text-pearl-300 animate-pulse'
                      : 'bg-white/5 border-white/10 text-pearl-500',
                ].join(' ')}
              >
                {slotLabels[index]}
              </div>
            );
          })}
        </div>

        {/* Built word display */}
        {isCompleted && (
          <div className="text-center mb-6">
            <p className="font-quest text-5xl text-ocean-200 text-shadow-glow">
              {builtWord}
            </p>
          </div>
        )}

        {/* Incorrect tap feedback */}
        {lastSelectionCorrect === false && !isCompleted && (
          <div className="mb-4 rounded-2xl bg-coral-900/40 border-2 border-coral-500 px-5 py-3 text-coral-200 font-quest text-lg text-center">
            ❌ Not quite! Try the next sound.
          </div>
        )}

        {/* Completion feedback */}
        {isCompleted && (
          <div className="mb-6">
            <FeedbackBanner
              status="correct"
              message={config.feedback.correctMessage}
              reward={config.reward}
            />
            <div className="mt-3 text-center font-quest text-2xl text-ocean-200 animate-float gpu-accelerated">
              🌊✨ You built the word! Amazing! ✨🌊
            </div>
          </div>
        )}

        {/* Letter tile grid — 3 cols on small screens, 6 cols on wider screens
             to reduce vertical height and fit landscape tablet viewports (#118) */}
        {!isCompleted && (
          <div
            className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8"
            role="group"
            aria-label="Letter tiles"
          >
            {config.options.map((option) => {
              const phoneme = option.text.toLowerCase();
              const ttsText = option.ttsText ?? option.text;

              return (
                <button
                  key={option.id}
                  onClick={() => {
                    onLetterAudio(ttsText);
                    selectLetter(phoneme);
                  }}
                  aria-label={`Letter ${option.text.toUpperCase()}`}
                  className={[
                    'flex flex-col items-center justify-center gap-1 rounded-2xl p-4 min-h-[90px]',
                    'border-2 font-quest text-3xl transition-all duration-150 select-none cursor-pointer',
                    'bg-white/10 border-white/20 text-pearl-100',
                    'hover:bg-ocean-700/40 hover:border-ocean-300 hover:scale-105 active:scale-95',
                  ].join(' ')}
                >
                  {option.text.toUpperCase()}
                  {option.emoji && (
                    <span className="font-body text-sm text-pearl-400">{option.emoji}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex flex-col gap-4">
          {isCompleted && (
            <>
              <Button variant="ghost" size="lg" fullWidth onClick={() => { reset(); }}>
                🔄 Try Another Word
              </Button>
              <Button variant="coral" size="xl" fullWidth onClick={onClaimReward}>
                🏆 Claim Word Treasure!
              </Button>
            </>
          )}
          <Button variant="ghost" size="lg" fullWidth onClick={onExit}>
            ← Back to World Map
          </Button>
        </div>
      </div>
    </div>
  );
}
