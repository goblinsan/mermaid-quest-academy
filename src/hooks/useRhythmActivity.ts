import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { PhonicsRhythmBeat } from '../types/activity';

/**
 * Phase of the rhythm echo-song activity:
 * - `idle`      — not yet started
 * - `playing`   — beats are being played in sequence
 * - `completed` — all beats have fired (activity may be claimed)
 */
export type RhythmPhase = 'idle' | 'playing' | 'completed';

export interface UseRhythmActivityReturn {
  /** Current phase of the activity. */
  phase: RhythmPhase;
  /**
   * Index of the beat that is currently active (i.e. the timing window is open).
   * `-1` when no beat is currently active.
   */
  activeBeatIndex: number;
  /**
   * Per-beat tap results.  `true` = learner tapped within the window (hit),
   * `false` = window closed without a tap (miss), `null` = not yet played.
   */
  tapResults: (boolean | null)[];
  /** Number of beats the learner successfully tapped. */
  totalHits: number;
  /**
   * Starts the beat sequence from the beginning.
   * No-op if already playing; call `reset()` first to restart.
   */
  start: () => void;
  /**
   * Records a tap from the learner.
   * If the timing window for the active beat is open, the tap is registered
   * as a hit.  Taps outside of any window are silently ignored.
   */
  tap: () => void;
  /** Resets all state to `idle` so the sequence can be replayed. */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Timing constants
// ---------------------------------------------------------------------------

/** Milliseconds between the start of consecutive beats. */
const BEAT_INTERVAL_MS = 1400;

/**
 * Duration of the tap-acceptance window around each beat.
 * Generously wide so young learners can tap a little early or late
 * and still be counted as correct (issue #90 — forgiving scoring).
 */
const TAP_WINDOW_MS = 1100;

// ---------------------------------------------------------------------------
// Internal reducer
// ---------------------------------------------------------------------------

interface RhythmState {
  phase: RhythmPhase;
  activeBeatIndex: number;
  tapResults: (boolean | null)[];
}

type RhythmAction =
  | { type: 'START'; beatCount: number }
  | { type: 'ACTIVATE_BEAT'; index: number }
  | { type: 'CLOSE_WINDOW'; index: number }
  | { type: 'TAP' }
  | { type: 'COMPLETE' }
  | { type: 'RESET'; beatCount: number };

function initialRhythmState(beatCount: number): RhythmState {
  return {
    phase: 'idle',
    activeBeatIndex: -1,
    tapResults: Array<null>(beatCount).fill(null),
  };
}

function rhythmReducer(state: RhythmState, action: RhythmAction): RhythmState {
  switch (action.type) {
    case 'START':
      if (state.phase !== 'idle') return state;
      return { ...state, phase: 'playing' };

    case 'ACTIVATE_BEAT':
      if (state.phase !== 'playing') return state;
      return { ...state, activeBeatIndex: action.index };

    case 'CLOSE_WINDOW': {
      if (state.phase !== 'playing') return state;
      if (state.activeBeatIndex !== action.index) return state;
      // If the learner hasn't tapped yet for this beat, record as miss
      const updated = [...state.tapResults];
      if (updated[action.index] === null) {
        updated[action.index] = false;
      }
      return { ...state, activeBeatIndex: -1, tapResults: updated };
    }

    case 'TAP': {
      if (state.phase !== 'playing' || state.activeBeatIndex < 0) return state;
      const updated = [...state.tapResults];
      // Only record the first tap per window
      if (updated[state.activeBeatIndex] === null) {
        updated[state.activeBeatIndex] = true;
      }
      return { ...state, tapResults: updated };
    }

    case 'COMPLETE':
      return { ...state, phase: 'completed', activeBeatIndex: -1 };

    case 'RESET':
      return initialRhythmState(action.beatCount);

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the rhythm tap-along state for `'echo-song'` activities (issues #89, #90).
 *
 * The caller kicks off the sequence with `start()`, which schedules a beat
 * every `BEAT_INTERVAL_MS` ms.  Each beat opens a forgiving tap window of
 * `TAP_WINDOW_MS` ms — wide enough for young learners to respond comfortably.
 *
 * The `onBeatPlay` callback is fired for each beat so the parent screen can
 * trigger the per-phoneme TTS audio at the right moment.
 *
 * @param beats       - Ordered array of phoneme beats from the activity config.
 * @param onBeatPlay  - Called with the beat's `ttsText` when each beat fires.
 *
 * @example
 * ```tsx
 * const { phase, activeBeatIndex, tapResults, start, tap } = useRhythmActivity(
 *   config.rhythmBeats ?? [],
 *   (ttsText) => speakOption(ttsText),
 * );
 * ```
 */
export function useRhythmActivity(
  beats: PhonicsRhythmBeat[],
  onBeatPlay: (ttsText: string) => void,
): UseRhythmActivityReturn {
  const [state, dispatch] = useReducer(
    rhythmReducer,
    beats.length,
    initialRhythmState,
  );

  // Keep onBeatPlay stable in closure so timer callbacks always use the latest
  const onBeatPlayRef = useRef(onBeatPlay);
  useEffect(() => {
    onBeatPlayRef.current = onBeatPlay;
  }, [onBeatPlay]);

  // Keep active timer IDs in a ref so we can cancel them on reset/unmount
  const timerIdsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimers = useCallback(() => {
    timerIdsRef.current.forEach(clearTimeout);
    timerIdsRef.current = [];
  }, []);

  // Clean up timers when the component unmounts
  useEffect(() => () => clearAllTimers(), [clearAllTimers]);

  const start = useCallback(() => {
    if (beats.length === 0) return;
    dispatch({ type: 'START', beatCount: beats.length });

    beats.forEach((beat, index) => {
      const activateAt = index * BEAT_INTERVAL_MS;
      const closeAt = activateAt + TAP_WINDOW_MS;
      const completeAt = beats.length * BEAT_INTERVAL_MS;

      const activateId = setTimeout(() => {
        dispatch({ type: 'ACTIVATE_BEAT', index });
        onBeatPlayRef.current(beat.ttsText);
      }, activateAt);

      const closeId = setTimeout(() => {
        dispatch({ type: 'CLOSE_WINDOW', index });
      }, closeAt);

      timerIdsRef.current.push(activateId, closeId);

      if (index === beats.length - 1) {
        const completeId = setTimeout(() => {
          dispatch({ type: 'COMPLETE' });
        }, completeAt);
        timerIdsRef.current.push(completeId);
      }
    });
  }, [beats]);

  const tap = useCallback(() => {
    dispatch({ type: 'TAP' });
  }, []);

  const reset = useCallback(() => {
    clearAllTimers();
    dispatch({ type: 'RESET', beatCount: beats.length });
  }, [beats.length, clearAllTimers]);

  const totalHits = state.tapResults.filter((r) => r === true).length;

  return {
    phase: state.phase,
    activeBeatIndex: state.activeBeatIndex,
    tapResults: state.tapResults,
    totalHits,
    start,
    tap,
    reset,
  };
}
