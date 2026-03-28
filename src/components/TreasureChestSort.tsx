import type { PhonicsActivityConfig, PhonicsActivityBin } from '../types/activity';
import { useSortingActivity } from '../hooks/useSortingActivity';
import Button from './ui/Button';
import ReplayAudioButton from './ui/ReplayAudioButton';
import FeedbackBanner from './FeedbackBanner';

interface TreasureChestSortProps {
  /** The phonics activity configuration to render. Must include `bins`. */
  config: PhonicsActivityConfig;
  /** Called when the learner taps "Claim Treasure!" after completing the sort. */
  onClaimReward: () => void;
  /** Called when the learner taps the exit / back button. */
  onExit: () => void;
  /** When `true`, the replay button shows a loading spinner. */
  audioLoading?: boolean;
  /** Called when the learner taps the replay audio button to re-hear the prompt. */
  onReplayAudio: () => void;
  /**
   * Called when the learner taps an item card that has a `ttsText`.
   * Receives the item's TTS text so the parent can play the word aloud.
   */
  onItemAudio?: (ttsText: string) => void;
  /**
   * Called when the learner taps a bin label.
   * Receives the bin's TTS text so the parent can speak the sound aloud.
   */
  onBinAudio?: (ttsText: string) => void;
}

/**
 * Level 3 "Treasure Chest Sorting" activity renderer.
 *
 * Presents a tray of letter or object cards and two sound-labelled treasure
 * chests.  The learner taps an item to select it (tap again to deselect), then
 * taps a chest to place it.
 *
 * - **Correct placement**: item appears inside the chest with a ✅ chip.
 * - **Incorrect placement**: item bounces back to the tray; the incorrect
 *   chest briefly highlights in red and a corrective message is shown
 *   (issue #86 — partial-placement feedback).
 * - **Completion**: all items sorted → celebratory banner + "Claim Treasure!"
 *   button.
 *
 * Contrast pairs are introduced in order of phonetic distinctiveness
 * (e.g. S vs A first, then T vs P, then I vs N) following the curriculum
 * sequence defined in issue #87.
 *
 * Tap-to-place interaction satisfies issue #85 — works on both touch and
 * pointer devices with large touch targets throughout.
 */
export default function TreasureChestSort({
  config,
  onClaimReward,
  onExit,
  audioLoading = false,
  onReplayAudio,
  onItemAudio,
  onBinAudio,
}: TreasureChestSortProps) {
  const {
    selectedItemId,
    correctPlacements,
    lastAttempt,
    isCompleted,
    selectItem,
    placeInBin,
  } = useSortingActivity(config);

  // Derive which bin to highlight in red from the most recent incorrect attempt.
  // Cleared naturally whenever the learner selects another item (lastAttempt is reset).
  const incorrectBinId =
    lastAttempt && !lastAttempt.isCorrect ? lastAttempt.binId : null;

  const bins: PhonicsActivityBin[] = config.bins ?? [];
  const pendingItems = config.options.filter((o) => correctPlacements[o.id] === undefined);

  return (
    <div className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🏴‍☠️</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-2">
            {config.title}
          </h1>
          <p className="font-body text-pearl-300 text-sm">
            Tap a card, then tap the right treasure chest!
          </p>
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

        {/* Items tray — shows only items not yet correctly placed */}
        {pendingItems.length > 0 && (
          <div className="mb-6">
            <p className="font-body text-pearl-400 text-xs uppercase tracking-widest mb-3 text-center">
              Items to sort
            </p>
            <div
              className="flex flex-wrap justify-center gap-3"
              role="group"
              aria-label="Items to sort"
            >
              {pendingItems.map((item) => {
                const isSelected = selectedItemId === item.id;
                const isIncorrectFlash = lastAttempt?.optionId === item.id && !lastAttempt.isCorrect;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      selectItem(item.id);
                      if (item.ttsText) onItemAudio?.(item.ttsText);
                    }}
                    aria-pressed={isSelected}
                    aria-label={`${item.text}${isSelected ? ', selected' : ''}`}
                    className={[
                      'flex flex-col items-center justify-center gap-1 rounded-2xl p-3 min-w-[80px] min-h-[80px]',
                      'border-2 transition-all duration-150 select-none cursor-pointer',
                      'font-body text-sm font-bold',
                      isSelected
                        ? 'bg-ocean-400/60 border-ocean-200 scale-110 text-white shadow-lg shadow-ocean-400/40'
                        : isIncorrectFlash
                          ? 'bg-coral-900/40 border-coral-400 text-coral-200'
                          : 'bg-white/10 border-white/20 text-pearl-100 hover:bg-white/20 hover:scale-105',
                    ].join(' ')}
                  >
                    {item.emoji && <span className="text-3xl leading-none">{item.emoji}</span>}
                    <span>{item.text}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Treasure chest bins */}
        <div
          className={`grid gap-4 mb-6 ${bins.length <= 2 ? 'grid-cols-2' : 'grid-cols-3'}`}
          role="group"
          aria-label="Treasure chests"
        >
          {bins.map((bin) => {
            const placedItems = config.options.filter(
              (o) => correctPlacements[o.id] === bin.id,
            );
            const isFlashing = incorrectBinId === bin.id;
            const canReceive = selectedItemId !== null && !isCompleted;

            return (
              <button
                key={bin.id}
                onClick={() => {
                  if (canReceive) {
                    placeInBin(bin.id);
                  } else if (bin.ttsText) {
                    onBinAudio?.(bin.ttsText);
                  }
                }}
                aria-label={`${bin.label} treasure chest${canReceive ? ', tap to place selected item' : ''}`}
                className={[
                  'flex flex-col items-center rounded-2xl border-2 p-4 transition-all duration-150 select-none',
                  canReceive
                    ? 'cursor-pointer hover:scale-105 hover:border-ocean-300'
                    : 'cursor-default',
                  isFlashing
                    ? 'bg-coral-900/60 border-coral-400 scale-105'
                    : 'bg-amber-900/30 border-amber-600/60',
                ].join(' ')}
              >
                {/* Chest icon + letter label */}
                <div className="text-4xl mb-1">📦</div>
                <div className="font-quest text-3xl text-amber-200 mb-1">{bin.label}</div>
                {bin.emoji && (
                  <div className="font-body text-pearl-400 text-xs mb-2">
                    {bin.emoji} /{bin.sound}/
                  </div>
                )}

                {/* Correctly placed items inside the chest */}
                {placedItems.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1 mt-2 w-full">
                    {placedItems.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 bg-seafoam-800/60 border border-seafoam-500 rounded-full px-2 py-0.5 text-seafoam-200 font-body text-xs"
                      >
                        {item.emoji} {item.text} ✅
                      </span>
                    ))}
                  </div>
                )}

                {/* Drop hint when item is selected and chest is empty */}
                {canReceive && placedItems.length === 0 && (
                  <div className="mt-2 text-pearl-400 font-body text-xs animate-pulse">
                    Tap to place
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Per-placement feedback message */}
        {lastAttempt && !isCompleted && (
          <div className="mb-4">
            {lastAttempt.isCorrect ? (
              <div className="rounded-2xl bg-seafoam-900/40 border-2 border-seafoam-400 px-5 py-3 text-seafoam-200 font-quest text-lg text-center">
                ✅ Great job! Keep going!
              </div>
            ) : (
              <div className="rounded-2xl bg-coral-900/40 border-2 border-coral-500 px-5 py-3 text-coral-200 font-quest text-lg text-center">
                ❌ Hmm, try again! Listen to the starting sound.
              </div>
            )}
          </div>
        )}

        {/* Overall completion feedback */}
        {isCompleted && (
          <div className="mb-6">
            <FeedbackBanner
              status="correct"
              message={config.feedback.correctMessage}
              reward={config.reward}
            />
            <div className="mt-3 text-center font-quest text-2xl text-ocean-200 animate-float">
              🏴‍☠️✨ Amazing sorting! You&apos;re a sound champion! ✨🏴‍☠️
            </div>
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex flex-col gap-4">
          {isCompleted && (
            <Button variant="coral" size="xl" fullWidth onClick={onClaimReward}>
              🏆 Claim Treasure!
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
