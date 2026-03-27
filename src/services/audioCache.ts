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

/** In-memory store: text-hash → object URL */
const cache = new Map<string, string>();

/**
 * Returns the cached object URL for the given text, or `null` if not yet
 * stored.
 */
export function getCachedAudio(text: string): string | null {
  return cache.get(hashText(text)) ?? null;
}

/**
 * Stores the audio blob under the text's hash and returns a reusable object
 * URL.  Call this after a successful TTS fetch so subsequent requests can
 * skip the network round-trip.
 */
export function cacheAudio(text: string, blob: Blob): string {
  const hash = hashText(text);
  // Revoke any previously stored URL for this hash to avoid memory leaks
  const existing = cache.get(hash);
  if (existing) {
    URL.revokeObjectURL(existing);
  }
  const url = URL.createObjectURL(blob);
  cache.set(hash, url);
  return url;
}

/**
 * Removes all entries from the cache and revokes all stored object URLs.
 * Useful for testing or when the user session ends.
 */
export function clearAudioCache(): void {
  cache.forEach((url) => URL.revokeObjectURL(url));
  cache.clear();
}
