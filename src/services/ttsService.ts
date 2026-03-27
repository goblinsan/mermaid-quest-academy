/**
 * Base URL of the local TTS server (no trailing slash, no path).
 * Override with the `VITE_TTS_URL` environment variable, e.g.
 * `VITE_TTS_URL=http://localhost:5500`
 */
const TTS_BASE_URL: string =
  import.meta.env.VITE_TTS_URL ?? 'http://localhost:5000';

/**
 * Fetches synthesised audio for the given text from the local TTS server.
 * The server is expected to accept `POST /tts` with a JSON body
 * `{ text: string }` and respond with an audio blob (wav / mpeg).
 *
 * @throws {Error} when the server responds with a non-OK status
 */
export async function fetchTTSAudio(text: string): Promise<Blob> {
  const response = await fetch(`${TTS_BASE_URL}/tts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`TTS request failed with status ${response.status}`);
  }

  return response.blob();
}
