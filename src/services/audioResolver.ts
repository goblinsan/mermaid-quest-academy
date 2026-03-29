/**
 * Audio Resolver  (issues #248, #254 / Audio V5 v2)
 *
 * Provides O(1) manifest-backed resolution of AudioIds to file paths,
 * durations, and playback metadata.  The resolver is the single gateway
 * between gameplay and the audio manifest — activity screens never reference
 * raw file paths directly.
 *
 * ─── USAGE ────────────────────────────────────────────────────────────────────
 *
 *   // 1. Initialise once at app startup
 *   const manifest: AudioManifest = await fetch('/audio/audio-manifest.json')
 *     .then(r => r.json());
 *   audioResolver.loadManifest(manifest);
 *
 *   // 2. Resolve anywhere in gameplay (O(1) lookup)
 *   const entry = audioResolver.resolve('phoneme.letter.s' as AudioId);
 *   if (entry) {
 *     playAudio('/' + entry.filePath);
 *   }
 *
 * ─── MISSING ASSETS (issue #254) ─────────────────────────────────────────────
 *
 * Not every AudioId will have a manifest entry — assets may be blocked,
 * deprecated, or not yet rendered.  The resolver distinguishes between
 * required and optional assets:
 *
 * | Method           | Missing behaviour                                        |
 * |------------------|----------------------------------------------------------|
 * | resolve()        | Returns null silently (optional semantics)               |
 * | resolveRequired()| Returns null AND logs console.error (required semantics) |
 *
 * Neither method throws.  Callers must always null-guard the return value and
 * fall back gracefully (e.g. TTS fetch) rather than crashing.
 */

import type { AudioManifest, AudioManifestEntry, PreloadPriority } from '../types/audioManifest';
import { isManifestCompatible } from '../types/audioManifest';
import type { AudioId } from '../types/audioId';

// ─── Resolver class ───────────────────────────────────────────────────────────

/**
 * Manifest-backed audio resolver.
 *
 * Holds a loaded `AudioManifest` and provides O(1) AudioId → entry lookup.
 * Use the module-level `audioResolver` singleton for app-wide resolution.
 */
export class AudioResolver {
  private manifest: AudioManifest | null = null;

  /**
   * Loads (or replaces) the manifest held by this resolver.
   *
   * @throws {Error} when the manifest version is incompatible with the current
   *   schema.  Call `isManifestCompatible()` first if you want a softer check.
   */
  loadManifest(manifest: AudioManifest): void {
    if (!isManifestCompatible(manifest)) {
      throw new Error(
        `[AudioResolver] Manifest schema mismatch: got version ${manifest.manifestVersion}. ` +
          'Please regenerate the audio manifest with `npm run audio:render`.',
      );
    }
    this.manifest = manifest;
  }

  /**
   * Returns `true` when a compatible manifest has been loaded and the resolver
   * is ready to serve lookups.
   */
  isReady(): boolean {
    return this.manifest !== null;
  }

  /**
   * Resolves an AudioId to its manifest entry.
   *
   * Returns `null` **silently** when:
   *  - No manifest has been loaded yet
   *  - The AudioId has no entry in the manifest
   *
   * Use this for optional audio (e.g. rewards, UI sounds) where a silent skip
   * is acceptable.  For required instruction audio, use `resolveRequired()`.
   */
  resolve(id: AudioId): AudioManifestEntry | null {
    if (!this.manifest) return null;
    return this.manifest.entries[id] ?? null;
  }

  /**
   * Resolves an AudioId to its manifest entry, logging a console error when
   * the asset is missing.
   *
   * Use this for required instruction audio (e.g. activity prompts, phoneme
   * sounds) where a missing asset should be flagged for investigation even
   * though the app falls back gracefully rather than crashing. (issue #254)
   *
   * @returns The entry if found, or `null` when absent.
   */
  resolveRequired(id: AudioId): AudioManifestEntry | null {
    const entry = this.resolve(id);
    if (!entry) {
      if (!this.manifest) {
        console.error(
          `[AudioResolver] Required audio "${id}" requested before manifest was loaded.`,
        );
      } else {
        console.error(
          `[AudioResolver] Required audio "${id}" not found in manifest. ` +
            'Falling back to TTS. Regenerate the manifest to fix this.',
        );
      }
    }
    return entry;
  }

  /**
   * Returns the browser-ready URL path for an AudioId, or `null` when not found.
   *
   * The returned string is ready for use as an `<audio src>` attribute or with
   * `new Audio(path)`:
   *
   * ```typescript
   * const path = audioResolver.getFilePath('phoneme.letter.s' as AudioId);
   * if (path) new Audio(path).play();
   * ```
   */
  getFilePath(id: AudioId): string | null {
    const entry = this.resolve(id);
    if (!entry) return null;
    return '/' + entry.filePath;
  }

  /**
   * Returns all manifest entries whose `preloadPriority` matches the given value.
   *
   * Used by the preloader to group assets by urgency before an activity starts.
   * Returns an empty array when no manifest is loaded.
   */
  getEntriesByPriority(priority: PreloadPriority): AudioManifestEntry[] {
    if (!this.manifest) return [];
    return Object.values(this.manifest.entries).filter(
      (entry) => entry.preloadPriority === priority,
    );
  }

  /**
   * Returns all manifest entries whose `tags` array includes at least one of
   * the given tags.
   *
   * Use this to collect all audio assets associated with a specific activity,
   * phoneme, or curriculum level so they can be preloaded together.
   *
   * ```typescript
   * // Preload all SATPIN-tagged assets for the current session
   * const entries = audioResolver.getEntriesByTags(['satpin']);
   * ```
   *
   * Returns an empty array when no manifest is loaded or no entries match.
   */
  getEntriesByTags(tags: string[]): AudioManifestEntry[] {
    if (!this.manifest) return [];
    const tagSet = new Set(tags);
    return Object.values(this.manifest.entries).filter((entry) =>
      entry.tags.some((t) => tagSet.has(t)),
    );
  }

  /**
   * Removes the loaded manifest, resetting the resolver to its uninitialised
   * state.  Useful in tests or when the audio pipeline regenerates the manifest
   * mid-session.
   */
  reset(): void {
    this.manifest = null;
  }
}

// ─── Module-level singleton ───────────────────────────────────────────────────

/**
 * App-wide audio resolver singleton.
 *
 * Initialise once at app startup (e.g. in your top-level component or audio
 * context provider), then call `audioResolver.resolve()` anywhere in gameplay.
 *
 * @example
 * ```typescript
 * // App startup
 * const manifest = await fetch('/audio/audio-manifest.json').then(r => r.json());
 * audioResolver.loadManifest(manifest);
 *
 * // In any component or hook
 * const entry = audioResolver.resolve('phoneme.letter.s' as AudioId);
 * ```
 */
export const audioResolver = new AudioResolver();
