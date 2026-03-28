import { useCallback, useReducer, useEffect } from 'react';
import type { PhonicsActivityConfig } from '../types/activity';

/**
 * Outcome of the most recent placement attempt.
 * `null` when no attempt has been made yet (or the activity just reset).
 */
export interface SortingAttempt {
  /** The item the learner tried to place. */
  optionId: string;
  /** The bin the learner dropped it into. */
  binId: string;
  /** Whether the placement was correct. */
  isCorrect: boolean;
}

export interface UseSortingActivityReturn {
  /** The id of the item the learner has tapped to select, or `null`. */
  selectedItemId: string | null;
  /**
   * Map of `optionId → binId` for every item that has been **correctly** placed.
   * Items absent from this map are still pending.
   */
  correctPlacements: Record<string, string>;
  /**
   * The most recent placement attempt (correct or incorrect).
   * `null` when no attempt has been made yet.
   * Cleared automatically when the learner selects a new item or resets.
   */
  lastAttempt: SortingAttempt | null;
  /** `true` when every item has been correctly placed in its bin. */
  isCompleted: boolean;
  /**
   * Selects (or deselects) an item by id.
   * Tapping an already-selected item deselects it.
   * No-op when the activity is completed.
   */
  selectItem: (optionId: string) => void;
  /**
   * Attempts to place the currently selected item into the given bin.
   * No-op when no item is selected or the activity is completed.
   */
  placeInBin: (binId: string) => void;
  /** Resets all state for a fresh attempt. */
  reset: () => void;
}

// ---------------------------------------------------------------------------
// Internal reducer
// ---------------------------------------------------------------------------

interface SortingState {
  selectedItemId: string | null;
  correctPlacements: Record<string, string>;
  lastAttempt: SortingAttempt | null;
}

type SortingAction =
  | { type: 'INIT' }
  | { type: 'SELECT_ITEM'; optionId: string }
  | { type: 'PLACE_IN_BIN'; binId: string; config: PhonicsActivityConfig };

function initialSortingState(): SortingState {
  return {
    selectedItemId: null,
    correctPlacements: {},
    lastAttempt: null,
  };
}

function sortingReducer(state: SortingState, action: SortingAction): SortingState {
  switch (action.type) {
    case 'INIT':
      return initialSortingState();

    case 'SELECT_ITEM': {
      // Deselect if tapping the already-selected item, otherwise select
      const next = state.selectedItemId === action.optionId ? null : action.optionId;
      return { ...state, selectedItemId: next, lastAttempt: null };
    }

    case 'PLACE_IN_BIN': {
      if (!state.selectedItemId) return state;

      const option = action.config.options.find((o) => o.id === state.selectedItemId);
      if (!option) return state;

      const isCorrect = option.correctBinId === action.binId;

      const attempt: SortingAttempt = {
        optionId: state.selectedItemId,
        binId: action.binId,
        isCorrect,
      };

      if (isCorrect) {
        return {
          selectedItemId: null,
          correctPlacements: {
            ...state.correctPlacements,
            [state.selectedItemId]: action.binId,
          },
          lastAttempt: attempt,
        };
      }

      // Incorrect: item stays pending, selection cleared
      return {
        ...state,
        selectedItemId: null,
        lastAttempt: attempt,
      };
    }

    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Manages state for a `'treasure-sort'` phonics activity.
 *
 * The learner taps an item to select it, then taps a treasure chest bin to
 * place it.  Correct placements are recorded; incorrect ones bounce back to
 * the pending tray.  The activity is complete when every item is correctly
 * placed.
 *
 * @example
 * ```tsx
 * const { selectedItemId, correctPlacements, lastAttempt, isCompleted,
 *         selectItem, placeInBin, reset } = useSortingActivity(config);
 * ```
 */
export function useSortingActivity(
  config: PhonicsActivityConfig | null,
): UseSortingActivityReturn {
  const [state, dispatch] = useReducer(sortingReducer, undefined, initialSortingState);

  // Re-initialise whenever the activity id changes
  const configId = config?.id ?? null;
  useEffect(() => {
    dispatch({ type: 'INIT' });
  }, [configId]);

  const selectItem = useCallback(
    (optionId: string) => {
      dispatch({ type: 'SELECT_ITEM', optionId });
    },
    [],
  );

  const placeInBin = useCallback(
    (binId: string) => {
      if (!config) return;
      dispatch({ type: 'PLACE_IN_BIN', binId, config });
    },
    [config],
  );

  const reset = useCallback(() => {
    dispatch({ type: 'INIT' });
  }, []);

  const isCompleted =
    config !== null &&
    config.options.every((o) => state.correctPlacements[o.id] !== undefined);

  return {
    selectedItemId: state.selectedItemId,
    correctPlacements: state.correctPlacements,
    lastAttempt: state.lastAttempt,
    isCompleted,
    selectItem,
    placeInBin,
    reset,
  };
}
