import { useCallback, useState } from 'react';
import type { Lesson } from '../types/lesson';

/** The lifecycle state of the current lesson attempt. */
export type LessonStatus = 'idle' | 'in-progress' | 'correct' | 'incorrect' | 'completed';

/** Normalises an answer string for case- and whitespace-insensitive comparison. */
function normalizeAnswer(value: string): string {
  return value.trim().toLowerCase();
}

/** Evaluates whether `given` matches the `expected` answer. */
function isAnswerCorrect(given: string, expected: string): boolean {
  return normalizeAnswer(given) === normalizeAnswer(expected);
}

interface UseLessonStateReturn {
  /** The active lesson, or `null` when none is loaded. */
  lesson: Lesson | null;
  /** The answer the learner has selected but not yet submitted. */
  selectedAnswer: string | null;
  /** Current lifecycle status of the lesson. */
  status: LessonStatus;
  /** `true` when the last submission was correct. */
  isCorrect: boolean;
  /** Load a lesson into state and begin the attempt. */
  loadLesson: (lesson: Lesson) => void;
  /** Record the learner's chosen answer (does not submit). */
  selectAnswer: (answer: string) => void;
  /** Evaluate the selected answer against the correct answer. */
  submitAnswer: () => void;
  /**
   * Selects and immediately evaluates the given answer in a single action.
   * Intended for tap-to-submit flows (e.g. multiple-choice, true/false).
   */
  selectAndSubmit: (answer: string) => void;
  /** Advance to `completed` so the caller can navigate away. */
  completeLesson: () => void;
  /** Reset all state back to `idle`. */
  reset: () => void;
}

/**
 * Manages the state for a single lesson attempt: loading, answer selection,
 * submission, and lifecycle transitions.
 *
 * @example
 * ```tsx
 * const { lesson, loadLesson, selectAnswer, submitAnswer, status } = useLessonState();
 * useEffect(() => { if (data) loadLesson(data); }, [data]);
 * ```
 */
export function useLessonState(): UseLessonStateReturn {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [status, setStatus] = useState<LessonStatus>('idle');
  const [isCorrect, setIsCorrect] = useState(false);

  const loadLesson = useCallback((newLesson: Lesson) => {
    setLesson(newLesson);
    setSelectedAnswer(null);
    setIsCorrect(false);
    setStatus('in-progress');
  }, []);

  const selectAnswer = useCallback((answer: string) => {
    setSelectedAnswer(answer);
  }, []);

  const submitAnswer = useCallback(() => {
    if (!lesson || selectedAnswer === null) return;

    const correct = isAnswerCorrect(selectedAnswer, lesson.answer);

    setIsCorrect(correct);
    setStatus(correct ? 'correct' : 'incorrect');
  }, [lesson, selectedAnswer]);

  const selectAndSubmit = useCallback(
    (answer: string) => {
      if (!lesson) return;

      setSelectedAnswer(answer);
      const correct = isAnswerCorrect(answer, lesson.answer);
      setIsCorrect(correct);
      setStatus(correct ? 'correct' : 'incorrect');
    },
    [lesson],
  );

  const completeLesson = useCallback(() => {
    setStatus('completed');
  }, []);

  const reset = useCallback(() => {
    setLesson(null);
    setSelectedAnswer(null);
    setIsCorrect(false);
    setStatus('idle');
  }, []);

  return {
    lesson,
    selectedAnswer,
    status,
    isCorrect,
    loadLesson,
    selectAnswer,
    submitAnswer,
    selectAndSubmit,
    completeLesson,
    reset,
  };
}
