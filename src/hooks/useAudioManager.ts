import { useCallback, useRef, useState } from 'react';
import {
  cacheAudioById,
  getCachedAudioById,
} from '../services/audioCache';
import { audioResolver } from '../services/audioResolver';
import { fetchTTSAudio } from '../services/ttsService';
import type { AudioId } from '../types/audioId';
import type { AudioPhraseType } from '../types/audioPhrases';
import { AudioPlayer } from '../utils/audioPlayer';

/**
 * Audio Playback Manager  (issues #249–253 / Audio V5 v2)
 *
 * ─── PURPOSE ──────────────────────────────────────────────────────────────────
 *
 * Provides a single, typed audio API that all activity screens share.
 * Activity developers never need to:
 *  - Build their own replay logic
 *  - Reach for raw file paths
 *  - Manage audio overlap themselves
 *  - Handle TTS fallback manually
 *
 * ─── PLAYBACK PRIORITY (issue #250) ──────────────────────────────────────────
 *
 * The manager enforces two priority tiers to prevent chaotic audio stacking:
 *
 * | Tier | Types                       | Behaviour                            |
 * |------|-----------------------------|--------------------------------------|
 * | HIGH | prompt, phoneme, feedback,  | Always interrupts any current audio  |
 * |      | word                        |                                      |
 * | LOW  | reward, ui, narration       | Skipped when HIGH-tier audio is      |
 * |      |                             | actively playing                     |
 *
 * This ensures that reward jingles and UI sounds never interrupt instructional
 * audio, while any learner interaction (tap, replay) is always responsive.
 *
 * ─── ASSET RESOLUTION (issue #248, #253, #254) ───────────────────────────────
 *
 * Each play call resolves audio in this priority order:
 *
 *  1. In-memory blob cache (getCachedAudioById) — instant, no network
 *  2. Manifest file path   (audioResolver)       — fetch static asset
 *  3. Live TTS fetch       (fetchTTSAudio)        — online fallback
 *
 * For required audio (prompt, phoneme, feedback) a missing manifest entry is
 * logged so it can be investigated.  For optional audio (reward, ui) the miss
 * is silent.  Neither path throws — failures surface via the `error` state.
 *
 * ─── PROMPT REPLAY (issue #252) ──────────────────────────────────────────────
 *
 * `playPrompt()` stores the prompt details so `replayCurrentPrompt()` can
 * replay it at any time without the caller tracking state.  Replay always
 * interrupts whatever is currently playing.
 */

// ─── Priority tiers ───────────────────────────────────────────────────────────

const HIGH_PRIORITY_TYPES = new Set<AudioPhraseType>([
  'phoneme',
  'word',
  'prompt',
  'feedback',
]);

/** Returns `true` when the given audio type should use the HIGH priority tier. */
function isHighPriority(type: AudioPhraseType): boolean {
  return HIGH_PRIORITY_TYPES.has(type);
}

// ─── Public API ───────────────────────────────────────────────────────────────

export interface UseAudioManagerReturn {
  /**
   * Plays an activity prompt and registers it as the "current prompt" for
   * `replayCurrentPrompt()`.  Uses HIGH priority — interrupts any current audio.
   *
   * Falls back to TTS when the manifest entry is missing or the file fails to
   * load.  A missing entry is logged as an error (required audio, issue #254).
   */
  playPrompt: (audioId: AudioId, ttsText: string) => Promise<void>;

  /**
   * Plays a phoneme (isolated letter-sound) clip.  Uses HIGH priority.
   *
   * Falls back to TTS on missing manifest entry (logged as error).
   */
  playPhoneme: (audioId: AudioId, ttsText: string) => Promise<void>;

  /**
   * Plays a correct/incorrect feedback clip.  Uses HIGH priority.
   *
   * Falls back to TTS on missing manifest entry (logged as error).
   */
  playFeedback: (audioId: AudioId, ttsText: string) => Promise<void>;

  /**
   * Plays a reward/celebration clip.  Uses LOW priority — silently skipped
   * when any HIGH-priority audio (prompt, phoneme, feedback, word) is currently
   * playing so that reward sounds never interrupt instructions.
   *
   * A missing manifest entry is swallowed silently (optional audio, issue #254).
   */
  playReward: (audioId: AudioId, ttsText: string) => Promise<void>;

  /**
   * Generic play method.  Resolves priority from the `type` parameter.
   *
   * Use the typed helpers (playPrompt, playPhoneme, etc.) when possible —
   * they set the correct priority automatically and give better semantics.
   */
  play: (audioId: AudioId, ttsText: string, type?: AudioPhraseType) => Promise<void>;

  /**
   * Replays the most recently played prompt from the beginning.
   *
   * Uses HIGH priority so it always interrupts background audio.  No-op when
   * no prompt has been played in the current mount.
   */
  replayCurrentPrompt: () => void;

  /**
   * Stops any currently playing audio immediately.
   */
  stop: () => void;

  /**
   * Preloads audio for a set of AudioIds so they play instantly when requested.
   *
   * Resolves each ID via the manifest (static file fetch) or TTS fallback, then
   * stores the result in the in-memory cache.  Failures are swallowed silently —
   * preloading is best-effort and must never block the activity. (issue #251)
   *
   * @param ids     AudioIds to preload.
   * @param texts   Parallel array of TTS fallback texts (same index as ids).
   *                Required for the TTS fallback path.
   */
  preloadForActivity: (ids: AudioId[], texts: string[]) => void;

  /** `true` while a TTS network request or file fetch is in progress. */
  isLoading: boolean;

  /**
   * Non-null when a required audio fetch or playback attempt failed.
   * `null` when healthy.  Optional audio failures do not set this field.
   */
  error: string | null;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Resolves an AudioId to a playable blob URL.
 *
 * Resolution order (issue #253):
 *  1. In-memory cache (instant)
 *  2. Manifest file path → fetch static asset
 *  3. TTS server → live synthesis
 *
 * Caches the result in the in-memory ID cache so subsequent calls are instant.
 */
async function resolveToUrl(audioId: AudioId, ttsText: string): Promise<string> {
  // 1. In-memory cache
  const cached = getCachedAudioById(audioId);
  if (cached) return cached;

  // 2. Manifest file path
  const filePath = audioResolver.getFilePath(audioId);
  if (filePath) {
    try {
      const response = await fetch(filePath);
      if (response.ok) {
        const blob = await response.blob();
        return cacheAudioById(audioId, blob);
      }
    } catch {
      // File fetch failed — fall through to TTS
    }
  }

  // 3. TTS fallback (issue #254 — never fail silently for required assets;
  //    the caller decides whether to log the miss before calling resolveToUrl)
  const blob = await fetchTTSAudio(ttsText);
  return cacheAudioById(audioId, blob);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * React hook that exposes the full runtime audio playback API.
 *
 * All activity screens should use this hook instead of `useAudio` so that
 * priority rules, prompt replay, and manifest-backed resolution work
 * consistently across the app.
 *
 * @example
 * ```tsx
 * const { playPrompt, replayCurrentPrompt, playFeedback, isLoading } =
 *   useAudioManager();
 *
 * // On mount: play the activity instruction
 * useEffect(() => {
 *   playPrompt('prompt.seashell_match.s' as AudioId, config.prompt.ttsText);
 * }, [config.id]);
 *
 * // On correct answer
 * playFeedback('feedback.correct' as AudioId, config.feedback.correctMessage);
 *
 * // Replay button
 * <ReplayAudioButton onReplay={replayCurrentPrompt} isLoading={isLoading} />
 * ```
 */
export function useAudioManager(): UseAudioManagerReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playerRef = useRef<AudioPlayer>(new AudioPlayer());

  /**
   * Stores the most recently played prompt so replayCurrentPrompt() works
   * without each caller tracking state.  (issue #252)
   */
  const currentPromptRef = useRef<{ audioId: AudioId; ttsText: string } | null>(null);

  // ─── Core play engine ──────────────────────────────────────────────────────

  /**
   * Internal play function.
   *
   * @param audioId   The AudioId to resolve and play.
   * @param ttsText   TTS fallback text.
   * @param type      Asset type, used to derive the priority tier.
   * @param required  When true, a missing manifest entry is logged as an error.
   *                  When false, the miss is silent.
   */
  const playInternal = useCallback(
    async (
      audioId: AudioId,
      ttsText: string,
      type: AudioPhraseType,
      required: boolean,
    ): Promise<void> => {
      if (!ttsText.trim()) return;

      const highPriority = isHighPriority(type);

      // Priority check (issue #250): skip LOW-priority audio when HIGH-priority
      // audio is currently playing so rewards/UI never interrupt instructions.
      if (!highPriority && playerRef.current.isPlaying()) {
        return;
      }

      // Always stop current audio before starting new to prevent overlap.
      playerRef.current.stop();

      setIsLoading(true);
      setError(null);

      try {
        // Log required asset misses BEFORE resolving so the warning appears
        // even when the TTS fallback succeeds.  (issue #254)
        if (required && !audioResolver.resolve(audioId)) {
          audioResolver.resolveRequired(audioId);
        }

        const url = await resolveToUrl(audioId, ttsText);
        await playerRef.current.play(url);
      } catch (err) {
        if (required) {
          console.error(`[useAudioManager] Failed to play required audio "${audioId}":`, err);
          setError('Audio is currently unavailable. Please try again later.');
        }
        // Optional audio failures are swallowed silently (issue #254)
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // ─── Typed play methods ────────────────────────────────────────────────────

  const playPrompt = useCallback(
    async (audioId: AudioId, ttsText: string): Promise<void> => {
      // Register as the current prompt for replayCurrentPrompt() (issue #252)
      currentPromptRef.current = { audioId, ttsText };
      await playInternal(audioId, ttsText, 'prompt', true);
    },
    [playInternal],
  );

  const playPhoneme = useCallback(
    async (audioId: AudioId, ttsText: string): Promise<void> => {
      await playInternal(audioId, ttsText, 'phoneme', true);
    },
    [playInternal],
  );

  const playFeedback = useCallback(
    async (audioId: AudioId, ttsText: string): Promise<void> => {
      await playInternal(audioId, ttsText, 'feedback', true);
    },
    [playInternal],
  );

  const playReward = useCallback(
    async (audioId: AudioId, ttsText: string): Promise<void> => {
      await playInternal(audioId, ttsText, 'reward', false);
    },
    [playInternal],
  );

  const play = useCallback(
    async (
      audioId: AudioId,
      ttsText: string,
      type: AudioPhraseType = 'word',
    ): Promise<void> => {
      const required = isHighPriority(type);
      await playInternal(audioId, ttsText, type, required);
    },
    [playInternal],
  );

  // ─── Replay (issue #252) ───────────────────────────────────────────────────

  const replayCurrentPrompt = useCallback((): void => {
    const prompt = currentPromptRef.current;
    if (!prompt) return;

    // Replay always interrupts — stop low-priority guard by treating it as HIGH.
    playerRef.current.stop();

    // Fire-and-forget: errors are handled inside playInternal
    void playInternal(prompt.audioId, prompt.ttsText, 'prompt', true);
  }, [playInternal]);

  // ─── Stop ──────────────────────────────────────────────────────────────────

  const stop = useCallback((): void => {
    playerRef.current.stop();
  }, []);

  // ─── Preload (issue #251) ──────────────────────────────────────────────────

  /**
   * Preloads audio for a list of AudioIds without playing them.
   *
   * Each ID is resolved via manifest file path or TTS and stored in the
   * in-memory cache.  Failures are swallowed — preloading is best-effort.
   * Call this at activity mount so common audio feels instant.
   */
  const preloadForActivity = useCallback((ids: AudioId[], texts: string[]): void => {
    ids.forEach((id, i) => {
      const text = texts[i] ?? '';
      if (!text.trim() && !audioResolver.resolve(id)) return;

      // Resolve without playing — errors are intentionally swallowed
      resolveToUrl(id, text).catch(() => {
        // Preload failures are non-fatal
      });
    });
  }, []);

  return {
    playPrompt,
    playPhoneme,
    playFeedback,
    playReward,
    play,
    replayCurrentPrompt,
    stop,
    preloadForActivity,
    isLoading,
    error,
  };
}
