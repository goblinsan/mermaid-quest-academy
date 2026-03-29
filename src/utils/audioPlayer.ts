/**
 * Lightweight wrapper around HTMLAudioElement providing play, replay, and stop
 * support.  A single instance can be reused across multiple calls – each
 * `play()` invocation replaces the previous audio source.
 */
export class AudioPlayer {
  private audio: HTMLAudioElement | null = null;

  /**
   * Begins playback of the audio at `url`.  Any audio currently playing is
   * stopped first.
   */
  play(url: string): Promise<void> {
    this.stop();
    this.audio = new Audio(url);
    return this.audio.play();
  }

  /**
   * Replays the most recently loaded audio from the beginning.
   * Resolves immediately if no audio has been loaded yet.
   */
  replay(): Promise<void> {
    if (!this.audio) return Promise.resolve();
    this.audio.currentTime = 0;
    return this.audio.play();
  }

  /**
   * Pauses and resets the current audio to the start without releasing the
   * source, so `replay()` can still be called afterwards.
   */
  stop(): void {
    if (!this.audio) return;
    this.audio.pause();
    this.audio.currentTime = 0;
  }

  /**
   * Returns `true` when audio is actively playing (not paused, not ended).
   * Used by the audio manager to enforce interruption priority rules.
   */
  isPlaying(): boolean {
    return this.audio !== null && !this.audio.paused && !this.audio.ended;
  }
}
