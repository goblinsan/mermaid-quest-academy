import { useCallback, useRef, useState } from 'react';
import { cacheAudio, getCachedAudio } from '../services/audioCache';
import { fetchTTSAudio } from '../services/ttsService';
import { AudioPlayer } from '../utils/audioPlayer';

interface UseAudioReturn {
  /** Fetches (or retrieves from cache) the TTS audio for `text` and plays it. */
  speak: (text: string) => Promise<void>;
  /** Replays the most recently spoken audio from the beginning. */
  replay: () => void;
  /** Stops the current audio without clearing the loaded source. */
  stop: () => void;
  /** `true` while a TTS network request is in progress. */
  isLoading: boolean;
  /** Non-null when TTS fetching or playback failed; `null` when healthy. */
  error: string | null;
}

/**
 * Silently pre-fetches and caches TTS audio for a given text string.
 * Calling this before `speak()` ensures the audio is ready without delay.
 * Failures are silently swallowed so they never interrupt the learner.
 */
export async function prefetchAudio(text: string): Promise<void> {
  if (!text.trim()) return;
  if (getCachedAudio(text)) return; // already cached
  try {
    const blob = await fetchTTSAudio(text);
    cacheAudio(text, blob);
  } catch {
    // Prefetch failures are non-fatal — the audio will be fetched on demand instead
  }
}

/**
 * React hook that integrates TTS fetching, in-memory caching, and audio
 * playback into a single, easy-to-use API.
 *
 * Failures (network errors, server downtime, playback policy restrictions)
 * are caught and exposed via the `error` field so that callers can display
 * a graceful fallback instead of crashing.
 *
 * @example
 * ```tsx
 * const { speak, replay, isLoading } = useAudio();
 * return <button onClick={() => speak('Hello!')}>Say hello</button>;
 * ```
 */
export function useAudio(): UseAudioReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const playerRef = useRef<AudioPlayer>(new AudioPlayer());

  const speak = useCallback(async (text: string) => {
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      let url = getCachedAudio(text);

      if (!url) {
        const blob = await fetchTTSAudio(text);
        url = cacheAudio(text, blob);
      }

      await playerRef.current.play(url);
    } catch (err) {
      console.error('[useAudio] speak failed:', err);
      setError('Audio is currently unavailable. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const replay = useCallback(() => {
    playerRef.current.replay().catch((err) => {
      console.error('[useAudio] replay failed:', err);
      setError('Could not replay audio.');
    });
  }, []);

  const stop = useCallback(() => {
    playerRef.current.stop();
  }, []);

  return { speak, replay, stop, isLoading, error };
}
