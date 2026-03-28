import { useEffect } from 'react';
import type { PhonicsActivityConfig } from '../types/activity';
import { useRhythmActivity } from '../hooks/useRhythmActivity';
import Button from './ui/Button';
import ReplayAudioButton from './ui/ReplayAudioButton';
import FeedbackBanner from './FeedbackBanner';

interface MermaidEchoSongProps {
  /** The phonics activity configuration to render. Must include `rhythmBeats`. */
  config: PhonicsActivityConfig;
  /** Called when the learner taps "Claim Treasure!" after completing all beats. */
  onClaimReward: () => void;
  /** Called when the learner taps the exit / back button. */
  onExit: () => void;
  /**
   * Called for each beat that fires during the rhythm sequence.
   * Receives the beat's `ttsText` so the parent can play the phoneme aloud.
   */
  onBeatAudio: (ttsText: string) => void;
  /** When `true`, the replay button shows a loading spinner. */
  audioLoading?: boolean;
  /** Called when the learner taps the replay audio button to re-hear the prompt. */
  onReplayAudio: () => void;
}

/**
 * Level 4 "Mermaid Echo Song" activity renderer (issues #89, #90).
 *
 * The mermaid guide plays a short phoneme rhythm — one phoneme every
 * ~1.4 seconds — while each beat lights up as a coloured bubble.  The
 * learner echoes back by tapping the big "Tap!" button in time with each
 * sound.
 *
 * Scoring is intentionally forgiving (issue #90): the tap-acceptance window
 * is 1.1 s per beat so young learners who respond a little early or late are
 * still rewarded.  All learners see a celebratory completion screen regardless
 * of hit count, with the number of hits surfaced as a fun "score" rather than
 * a pass/fail result.
 *
 * Rhythm sequencing and timing are handled by the `useRhythmActivity` hook;
 * this component is purely presentational.
 */
export default function MermaidEchoSong({
  config,
  onClaimReward,
  onExit,
  onBeatAudio,
  audioLoading = false,
  onReplayAudio,
}: MermaidEchoSongProps) {
  const beats = config.rhythmBeats ?? [];

  const { phase, activeBeatIndex, tapResults, totalHits, start, tap, reset } =
    useRhythmActivity(beats, onBeatAudio);

  // Re-initialise when the activity id changes
  useEffect(() => {
    reset();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id]);

  const isIdle = phase === 'idle';
  const isPlaying = phase === 'playing';
  const isCompleted = phase === 'completed';

  return (
    <div className="min-h-screen px-4 py-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-3">🧜‍♀️</div>
          <h1 className="font-quest text-4xl text-ocean-200 text-shadow-glow mb-2">
            {config.title}
          </h1>
          {/* Instruction only available to screen readers (#115) */}
          <p className="sr-only">
            Listen to the mermaid, then tap along with each sound!
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

        {/* Beat bubbles row */}
        {beats.length > 0 && (
          <div
            className="flex justify-center gap-4 mb-8"
            role="group"
            aria-label="Rhythm beats"
          >
            {beats.map((beat, index) => {
              const isActive = activeBeatIndex === index;
              const result = tapResults[index];
              const isHit = result === true;
              const isMiss = result === false;

              let bubbleClass =
                'flex flex-col items-center justify-center rounded-full w-20 h-20 border-4 transition-all duration-200 select-none font-quest text-2xl ';

              if (isActive) {
                bubbleClass +=
                  'bg-ocean-400/80 border-ocean-200 scale-125 shadow-lg shadow-ocean-400/60 text-white animate-pulse gpu-accelerated';
              } else if (isHit) {
                bubbleClass += 'bg-seafoam-700/60 border-seafoam-400 text-seafoam-200 scale-110';
              } else if (isMiss) {
                bubbleClass += 'bg-coral-900/40 border-coral-500 text-coral-200';
              } else {
                bubbleClass += 'bg-white/10 border-white/20 text-pearl-300';
              }

              return (
                <div key={index} className={bubbleClass} aria-label={`Beat ${index + 1}: ${beat.displayText}`}>
                  {beat.emoji && (
                    <span className="text-lg leading-none">{beat.emoji}</span>
                  )}
                  <span>{beat.displayText}</span>
                  {isHit && <span className="text-xs">✅</span>}
                  {isMiss && <span className="text-xs">❌</span>}
                </div>
              );
            })}
          </div>
        )}

        {/* Score display during / after play */}
        {(isPlaying || isCompleted) && (
          <div className="text-center mb-4">
            <span className="font-body text-pearl-300 text-lg">
              🎵 {totalHits} / {beats.length} beats echoed!
            </span>
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
              🧜‍♀️✨ Amazing rhythm! You&apos;re a sound star! ✨🧜‍♀️
            </div>
          </div>
        )}

        {/* CTA buttons */}
        <div className="flex flex-col gap-4">
          {/* Start / replay sequence button */}
          {isIdle && (
            <Button variant="coral" size="xl" fullWidth onClick={start}>
              🎵 Start Echo Song!
            </Button>
          )}

          {/* Big tap button while playing */}
          {isPlaying && (
            <button
              onClick={tap}
              aria-label="Tap along with the beat"
              className={[
                'w-full rounded-3xl py-10 font-quest text-5xl text-white border-4 transition-all duration-100 select-none',
                activeBeatIndex >= 0
                  ? 'bg-ocean-500/80 border-ocean-200 scale-105 shadow-2xl shadow-ocean-500/50 active:scale-95'
                  : 'bg-white/10 border-white/20 text-pearl-400',
              ].join(' ')}
            >
              {activeBeatIndex >= 0 ? '👏 TAP!' : '…'}
            </button>
          )}

          {/* After completion */}
          {isCompleted && (
            <>
              <Button variant="ghost" size="lg" fullWidth onClick={() => { reset(); }}>
                🔄 Play Again
              </Button>
              <Button variant="coral" size="xl" fullWidth onClick={onClaimReward}>
                🏆 Claim Song Treasure!
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
