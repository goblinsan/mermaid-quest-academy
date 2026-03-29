import type { AudioId } from '../types/audioId';

/**
 * Produces a stable numeric hash for a string.
 * Uses the djb2 algorithm (fast, good distribution for short strings).
 */
function hashText(text: string): string {
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  // Use unsigned 32-bit integer to keep the value positive
  return (hash >>> 0).toString(16);
}

/**
 * Primary cache: AudioId → object URL.
 * When a stable AudioId is available it is always preferred over the text
 * hash so that the same clip is found even if its TTS text is revised.
 */
const idCache = new Map<string, string>();

/**
 * Fallback cache: text-hash → object URL.
 * Used when no AudioId is supplied (legacy / ad-hoc TTS calls).
 */
const textCache = new Map<string, string>();

// ─── ID-based API ────────────────────────────────────────────────────────────

/**
 * Returns the cached object URL for the given {@link AudioId}, or `null` if
 * the clip has not been stored under this ID yet.
 */
export function getCachedAudioById(audioId: AudioId): string | null {
  return idCache.get(audioId) ?? null;
}

/**
 * Stores the audio blob under the given {@link AudioId} and returns a reusable
 * object URL.  Any previously cached URL for the same ID is revoked first to
 * avoid memory leaks.
 */
export function cacheAudioById(audioId: AudioId, blob: Blob): string {
  const existing = idCache.get(audioId);
  if (existing) {
    URL.revokeObjectURL(existing);
  }
  const url = URL.createObjectURL(blob);
  idCache.set(audioId, url);
  return url;
}

// ─── Text-hash API (legacy / fallback) ───────────────────────────────────────

/**
 * Returns the cached object URL for the given text, or `null` if not yet
 * stored.
 */
export function getCachedAudio(text: string): string | null {
  return textCache.get(hashText(text)) ?? null;
}

/**
 * Stores the audio blob under the text's hash and returns a reusable object
 * URL.  Call this after a successful TTS fetch so subsequent requests can
 * skip the network round-trip.
 */
export function cacheAudio(text: string, blob: Blob): string {
  const hash = hashText(text);
  // Revoke any previously stored URL for this hash to avoid memory leaks
  const existing = textCache.get(hash);
  if (existing) {
    URL.revokeObjectURL(existing);
  }
  const url = URL.createObjectURL(blob);
  textCache.set(hash, url);
  return url;
}

// ─── Shared utilities ─────────────────────────────────────────────────────────

/**
 * Removes all entries from both caches and revokes all stored object URLs.
 * Useful for testing or when the user session ends.
 */
export function clearAudioCache(): void {
  idCache.forEach((url) => URL.revokeObjectURL(url));
  idCache.clear();
  textCache.forEach((url) => URL.revokeObjectURL(url));
  textCache.clear();
}
