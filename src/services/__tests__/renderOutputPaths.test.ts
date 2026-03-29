/**
 * Tests for the Deterministic Output Path Resolver  (issue #233 / Audio V5 v2)
 *
 * Covers:
 *  - audioIdToFileStem  — dot-to-underscore conversion
 *  - buildOutputFilename — filename construction from audioId + renderKey
 *  - resolveOutputPath  — absolute/relative path and exists flag
 *  - defaultManifestPath — default manifest file location
 */

import { describe, it, expect } from 'vitest';
import { join, sep } from 'node:path';
import {
  audioIdToFileStem,
  buildOutputFilename,
  resolveOutputPath,
  defaultManifestPath,
  AUDIO_FILE_EXTENSION,
  RENDER_KEY_SEPARATOR,
  DEFAULT_MANIFEST_FILENAME,
} from '../renderOutputPaths';
import type { RenderKey } from '../../types/batchRenderer';
import { audioId } from '../../types/audioId';

// ─── audioIdToFileStem ────────────────────────────────────────────────────────

describe('audioIdToFileStem', () => {
  it('replaces dots with underscores', () => {
    expect(audioIdToFileStem(audioId('phoneme.letter.s'))).toBe('phoneme_letter_s');
  });

  it('handles two-segment IDs', () => {
    expect(audioIdToFileStem(audioId('feedback.correct'))).toBe('feedback_correct');
  });

  it('handles four-segment IDs', () => {
    expect(audioIdToFileStem(audioId('prompt.seashell_match.a.v2'))).toBe(
      'prompt.seashell_match.a.v2'.replace(/\./g, '_'),
    );
  });

  it('returns the stem unchanged for IDs with no dots', () => {
    // Normally all AudioIds have at least one dot, but the function should
    // still behave correctly for any string input.
    expect(audioIdToFileStem(audioId('nodots' as string))).toBe('nodots');
  });
});

// ─── buildOutputFilename ──────────────────────────────────────────────────────

describe('buildOutputFilename', () => {
  it('produces the expected filename format', () => {
    const id = audioId('phoneme.letter.s');
    const key = 'a3f2b1c4' as RenderKey;
    expect(buildOutputFilename(id, key)).toBe(
      `phoneme_letter_s${RENDER_KEY_SEPARATOR}a3f2b1c4${AUDIO_FILE_EXTENSION}`,
    );
  });

  it('uses __ as separator', () => {
    const filename = buildOutputFilename(audioId('feedback.correct'), 'deadbeef' as RenderKey);
    expect(filename).toContain('__');
  });

  it('ends with .mp3', () => {
    const filename = buildOutputFilename(audioId('feedback.correct'), 'deadbeef' as RenderKey);
    expect(filename.endsWith('.mp3')).toBe(true);
  });

  it('two jobs with different render keys produce different filenames', () => {
    const id = audioId('phoneme.letter.s');
    const f1 = buildOutputFilename(id, 'aaaaaaaa' as RenderKey);
    const f2 = buildOutputFilename(id, 'bbbbbbbb' as RenderKey);
    expect(f1).not.toBe(f2);
  });

  it('two different audioIds with the same key produce different filenames', () => {
    const key = 'aaaaaaaa' as RenderKey;
    const f1 = buildOutputFilename(audioId('phoneme.letter.s'), key);
    const f2 = buildOutputFilename(audioId('phoneme.letter.a'), key);
    expect(f1).not.toBe(f2);
  });
});

// ─── resolveOutputPath ────────────────────────────────────────────────────────

describe('resolveOutputPath', () => {
  const projectRoot = '/project';
  const outputDir = '/project/public/audio';
  const id = audioId('phoneme.letter.s');
  const key = 'a3f2b1c4' as RenderKey;

  it('returns an absolute path under outputDir', () => {
    const result = resolveOutputPath(id, key, outputDir, projectRoot);
    expect(result.absolutePath.startsWith(outputDir)).toBe(true);
  });

  it('returns a relative path relative to projectRoot', () => {
    const result = resolveOutputPath(id, key, outputDir, projectRoot);
    // On any platform the relative path should start with "public"
    expect(result.relativePath.startsWith('public')).toBe(true);
  });

  it('absolutePath and relativePath reference the same file', () => {
    const result = resolveOutputPath(id, key, outputDir, projectRoot);
    expect(result.absolutePath).toBe(join(projectRoot, result.relativePath));
  });

  it('returns exists: false when the file does not exist', () => {
    // The file definitely does not exist under a temp path
    const result = resolveOutputPath(id, key, '/tmp/nonexistent-audio-dir-xyz', projectRoot);
    expect(result.exists).toBe(false);
  });

  it('same audioId + renderKey always produces the same path', () => {
    const r1 = resolveOutputPath(id, key, outputDir, projectRoot);
    const r2 = resolveOutputPath(id, key, outputDir, projectRoot);
    expect(r1.absolutePath).toBe(r2.absolutePath);
  });

  it('different renderKey produces a different path for the same audioId', () => {
    const r1 = resolveOutputPath(id, 'aaaaaaaa' as RenderKey, outputDir, projectRoot);
    const r2 = resolveOutputPath(id, 'bbbbbbbb' as RenderKey, outputDir, projectRoot);
    expect(r1.absolutePath).not.toBe(r2.absolutePath);
  });

  it('filename contains the separator between stem and key', () => {
    const result = resolveOutputPath(id, key, outputDir, projectRoot);
    const filename = result.absolutePath.split(sep).pop()!;
    expect(filename).toContain(RENDER_KEY_SEPARATOR);
  });
});

// ─── defaultManifestPath ──────────────────────────────────────────────────────

describe('defaultManifestPath', () => {
  it('returns a path inside the output directory', () => {
    const outputDir = '/project/public/audio';
    const result = defaultManifestPath(outputDir);
    expect(result.startsWith(outputDir)).toBe(true);
  });

  it('uses the default manifest filename', () => {
    const result = defaultManifestPath('/project/public/audio');
    expect(result.endsWith(DEFAULT_MANIFEST_FILENAME)).toBe(true);
  });
});
