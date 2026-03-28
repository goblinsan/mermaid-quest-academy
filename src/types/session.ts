/**
 * A single reading session containing 2–3 phonics activities selected for
 * the learner's current progression level.
 *
 * Sessions are persisted to localStorage so they survive app backgrounding
 * and can be resumed (issue #100).
 */
export interface ReadingSession {
  /** Unique identifier for this session (timestamp-based, e.g. `"session-1711234567890"`). */
  id: string;
  /** Ordered list of activity IDs selected for this session. */
  activityIds: string[];
  /**
   * Index of the next activity to play in `activityIds`.
   * Equal to `activityIds.length` once all activities have been completed.
   */
  currentIndex: number;
  /** IDs of activities that were completed during this session. */
  completedActivityIds: string[];
  /** Total XP accumulated across all activities in this session. */
  xpEarned: number;
  /** ISO 8601 timestamp when the session was first started. */
  startedAt: string;
  /** ISO 8601 timestamp when all activities were finished. Absent on incomplete sessions. */
  completedAt?: string;
  /** The highest phonics level unlocked at the time this session was generated. */
  phonicsLevel: number;
}

/**
 * Location state injected into `/reading/:id` when the activity is launched
 * as part of a structured reading session (via `SessionScreen`).
 */
export interface SessionActivityContext {
  /** The ID of the parent `ReadingSession`. */
  sessionId: string;
  /** Zero-based position of this activity within the session's `activityIds` list. */
  activityIndex: number;
}

/**
 * Navigation state passed to `SessionRewardScreen` when the last activity
 * in a session is completed.
 */
export interface SessionRewardNavigationState {
  /** The session that was just completed. */
  session: ReadingSession;
}
