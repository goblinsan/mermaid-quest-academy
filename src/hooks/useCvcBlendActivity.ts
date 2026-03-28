import { useCallback, useEffect, useReducer } from 'react';

/**
 * The three slots of a CVC (consonant–vowel–consonant) word being built.
 * Each slot is either `null` (empty) or the phoneme letter placed there.
 */
export type CvcSlots = [string | null, string | null, string | null];

export interface UseCvcBlendActivityReturn {
  /**
   * The three letter slots of the word being assembled.
   * Each element is the phoneme tapped into that slot, or `null` if still empty.
   */
  slots: CvcSlots;
  /**
   * The index of the next empty slot (0, 1, or 2).
   * When all three slots are filled this equals 3.
   */
  currentSlot: number;
  /** `true` when all three slots hold the correct phoneme. */
  isCompleted: boolean;
  /**
   * Whether the most recent `selectLetter` call was correct (`true`),
   * incorrect (`false`), or no selection has been made yet (`null`).
   */
  lastSelectionCorrect: boolean | null;
  /**
   * Attempts to place `phoneme` into the next empty slot.
   * - If it matches the expected phoneme the slot is filled and `currentSlot`
   *   advances.
   * - If it does not match, the selection is recorded as incorrect and the
   *   slot remains empty so the learner can try again.
   * No-op when the activity is already completed.
   *
   * @param phoneme - Lowercase SATPIN letter the learner tapped (e.g. `"s"`).
   */
  selectLetter: (phoneme: string) => void;
  /** Resets all slots to empty for a fresh attempt. */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Internal reducer
// ---------------------------------------------------------------------------

interface CvcBlendState {
  slots: CvcSlots;
  currentSlot: number;
  lastSelectionCorrect: boolean | null;
}

type CvcBlendAction =
  | { type: 'INIT' }
  | { type: 'SELECT'; phoneme: string; targetPhonemes: [string, string, string] };

function initialCvcBlendState(): CvcBlendState {
  return {
    slots: [null, null, null],
    currentSlot: 0,
    lastSelectionCorrect: null,
  };
}

function cvcBlendReducer(state: CvcBlendState, action: CvcBlendAction): CvcBlendState {
  switch (action.type) {
    case 'INIT':
      return initialCvcBlendState();

    case 'SELECT': {
      if (state.currentSlot >= 3) return state; // Already completed

      const expected = action.targetPhonemes[state.currentSlot];
      const isCorrect = action.phoneme === expected;

      if (isCorrect) {
        const newSlots = [...state.slots] as CvcSlots;
        newSlots[state.currentSlot] = action.phoneme;
        return {
          slots: newSlots,
          currentSlot: state.currentSlot + 1,
          lastSelectionCorrect: true,
        };
      }

      // Incorrect — don't advance the slot; just signal the miss
      return { ...state, lastSelectionCorrect: false };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the letter-selection state for `'word-builder'` activities
 * (issues #91, #92).
 *
 * The learner taps letter tiles one by one.  Each correct tap fills the next
 * slot of the target CVC word; an incorrect tap is rejected (slot stays empty)
 * and `lastSelectionCorrect` is set to `false` so the component can provide
 * feedback.  When all three slots are filled the activity is complete and the
 * caller should trigger the blended-word TTS audio (issue #92).
 *
 * @param targetPhonemes - The three phonemes of the target CVC word in order.
 *
 * @example
 * ```tsx
 * const { slots, currentSlot, isCompleted, lastSelectionCorrect, selectLetter } =
 *   useCvcBlendActivity(config.cvcTarget?.phonemes ?? ['s', 'a', 't']);
 * ```
 */
export function useCvcBlendActivity(
  targetPhonemes: [string, string, string],
): UseCvcBlendActivityReturn {
  const [state, dispatch] = useReducer(cvcBlendReducer, undefined, initialCvcBlendState);

  // Re-initialise whenever the target word changes
  const key = targetPhonemes.join('-');
  useEffect(() => {
    dispatch({ type: 'INIT' });
  }, [key]);

  const selectLetter = useCallback(
    (phoneme: string) => {
      dispatch({ type: 'SELECT', phoneme, targetPhonemes });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key],
  );

  const reset = useCallback(() => {
    dispatch({ type: 'INIT' });
  }, []);

  const isCompleted = state.currentSlot >= 3;

  return {
    slots: state.slots,
    currentSlot: state.currentSlot,
    isCompleted,
    lastSelectionCorrect: state.lastSelectionCorrect,
    selectLetter,
    reset,
  };
}
