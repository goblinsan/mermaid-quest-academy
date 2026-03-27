import { useCallback, useEffect, useReducer } from 'react';
import type { PhonicsActivityConfig, PhonicsCompletionCondition } from '../types/activity';

/** Lifecycle state of a phonics activity attempt. */
export type PhonicsActivityStatus = 'idle' | 'in-progress' | 'correct' | 'incorrect' | 'completed';

export interface UsePhonicsActivityReturn {
  /** The id of the option the learner last selected, or `null`. */
  selectedOptionId: string | null;
  /** Current lifecycle status of the activity. */
  status: PhonicsActivityStatus;
  /** Whether the most recent submission was correct. */
  isCorrect: boolean;
  /** Running count of consecutive correct answers. Resets on any incorrect answer. */
  correctStreak: number;
  /** `true` when the completion condition has been satisfied. */
  isCompletionMet: boolean;
  /**
   * Selects and immediately evaluates the given option.
   * No-op when status is not `'in-progress'`.
   */
  selectAndSubmit: (optionId: string) => void;
  /**
   * Advances state after feedback has been shown.
   * - `'incorrect'` → back to `'in-progress'` (retry).
   * - `'correct'`   → back to `'in-progress'` (next attempt in a streak).
   */
  continueAfterFeedback: () => void;
  /** Resets all state and begins a fresh attempt at the current config. */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Internal reducer
// ---------------------------------------------------------------------------

interface ActivityState {
  selectedOptionId: string | null;
  status: PhonicsActivityStatus;
  isCorrect: boolean;
  correctStreak: number;
}

type ActivityAction =
  | { type: 'INIT'; hasConfig: boolean }
  | { type: 'SELECT_AND_SUBMIT'; optionId: string; config: PhonicsActivityConfig }
  | { type: 'CONTINUE' };

function initialState(hasConfig: boolean): ActivityState {
  return {
    selectedOptionId: null,
    status: hasConfig ? 'in-progress' : 'idle',
    isCorrect: false,
    correctStreak: 0,
  };
}

/** Returns `true` when the given completion condition is satisfied. */
function checkCompletion(
  condition: PhonicsCompletionCondition,
  streak: number,
  correct: boolean,
): boolean {
  if (!correct) return false;
  if (condition.type === 'single-correct') return true;
  if (condition.type === 'streak') return streak >= condition.count;
  return false;
}

function activityReducer(state: ActivityState, action: ActivityAction): ActivityState {
  switch (action.type) {
    case 'INIT':
      return initialState(action.hasConfig);

    case 'SELECT_AND_SUBMIT': {
      if (state.status !== 'in-progress') return state;
      const correct = action.optionId === action.config.correctOptionId;
      const newStreak = correct ? state.correctStreak + 1 : 0;
      const done = checkCompletion(action.config.completionCondition, newStreak, correct);
      return {
        selectedOptionId: action.optionId,
        status: done ? 'completed' : correct ? 'correct' : 'incorrect',
        isCorrect: correct,
        correctStreak: newStreak,
      };
    }

    case 'CONTINUE':
      if (state.status === 'incorrect' || state.status === 'correct') {
        return { ...state, selectedOptionId: null, status: 'in-progress' };
      }
      return state;

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages the state for a single phonics activity attempt: option selection,
 * answer evaluation, streak counting, and lifecycle transitions.
 *
 * Pass a `PhonicsActivityConfig` to load an activity. The hook resets
 * automatically whenever the config's `id` changes.
 *
 * @example
 * ```tsx
 * const config = getReadingActivityById(id);
 * const { selectedOptionId, status, selectAndSubmit, continueAfterFeedback } =
 *   usePhonicsActivity(config ?? null);
 * ```
 */
export function usePhonicsActivity(
  config: PhonicsActivityConfig | null,
): UsePhonicsActivityReturn {
  const [state, dispatch] = useReducer(activityReducer, config !== null, initialState);

  // Re-initialise whenever the activity id changes
  const configId = config?.id ?? null;
  useEffect(() => {
    dispatch({ type: 'INIT', hasConfig: configId !== null });
  }, [configId]);

  const selectAndSubmit = useCallback(
    (optionId: string) => {
      if (!config) return;
      dispatch({ type: 'SELECT_AND_SUBMIT', optionId, config });
    },
    [config],
  );

  const continueAfterFeedback = useCallback(() => {
    dispatch({ type: 'CONTINUE' });
  }, []);

  const reset = useCallback(() => {
    dispatch({ type: 'INIT', hasConfig: configId !== null });
  }, [configId]);

  return {
    selectedOptionId: state.selectedOptionId,
    status: state.status,
    isCorrect: state.isCorrect,
    correctStreak: state.correctStreak,
    isCompletionMet: state.status === 'completed',
    selectAndSubmit,
    continueAfterFeedback,
    reset,
  };
}
