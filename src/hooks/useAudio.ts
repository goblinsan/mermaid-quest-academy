import { useCallback, useRef, useState } from 'react';
import {
  cacheAudio,
  cacheAudioById,
  getCachedAudio,
  getCachedAudioById,
} from '../services/audioCache';
import { fetchTTSAudio } from '../services/ttsService';
import type { AudioId } from '../types/audioId';
import { AudioPlayer } from '../utils/audioPlayer';

interface UseAudioReturn {
  /** Fetches (or retrieves from cache) the TTS audio for `text` and plays it. */
  speak: (text: string, audioId?: AudioId) => Promise<void>;
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
 * Looks up a cached audio URL by stable ID (preferred) or text hash (fallback).
 * Returns `null` when no cached URL exists for either key.
 */
function lookupCachedUrl(text: string, audioId?: AudioId): string | null {
  return audioId ? getCachedAudioById(audioId) : getCachedAudio(text);
}

/**
 * Stores an audio blob in the appropriate cache (ID-keyed or text-hash keyed)
 * and returns the resulting object URL.
 */
function storeInCache(text: string, blob: Blob, audioId?: AudioId): string {
  return audioId ? cacheAudioById(audioId, blob) : cacheAudio(text, blob);
}

/**
 * Silently pre-fetches and caches TTS audio.
 *
 * When `audioId` is provided the clip is stored under the stable ID so it
 * can be retrieved by ID even if the TTS text is later revised.  Falls back
 * to text-hash caching when no ID is supplied.
 *
 * Failures are silently swallowed so they never interrupt the learner.
 */
export async function prefetchAudio(
  text: string,
  audioId?: AudioId,
): Promise<void> {
  if (!text.trim()) return;
  if (lookupCachedUrl(text, audioId)) return; // already cached
  try {
    const blob = await fetchTTSAudio(text);
    storeInCache(text, blob, audioId);
  } catch {
    // Prefetch failures are non-fatal — the audio will be fetched on demand instead
  }
}

/**
 * React hook that integrates TTS fetching, in-memory caching, and audio
 * playback into a single, easy-to-use API.
 *
 * Pass an optional `audioId` to `speak()` to use stable ID-based caching —
 * the clip will be found in the cache even if the TTS text is later revised.
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

  const speak = useCallback(async (text: string, audioId?: AudioId) => {
    if (!text.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      // Prefer stable ID cache; fall back to text-hash cache for legacy callers.
      let url = lookupCachedUrl(text, audioId);

      if (!url) {
        const blob = await fetchTTSAudio(text);
        url = storeInCache(text, blob, audioId);
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
