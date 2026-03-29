# Audio Regeneration Workflow

This document explains the day-to-day workflow for maintaining the audio
assets in Mermaid Quest Academy using the batch TTS rendering pipeline.

---

## Overview

Audio assets are synthesised from the inventory in `src/data/audio-phrases.json`
using the local TTS engine.  The pipeline is deterministic: the same inventory
entry always produces the same output file path and the same audio content.

The pipeline has three modes:

| Mode           | Use case                                           |
|----------------|----------------------------------------------------|
| `validate`     | Check content integrity; no files written          |
| `changed-only` | (default) Re-render only new or modified assets    |
| `full`         | Re-render every asset (after engine upgrade, etc.) |

---

## Quick reference

```bash
# Validate only (fastest; use before committing content changes)
npm run audio:render -- --validate

# Render changed or new assets (normal day-to-day use)
npm run audio:render

# Force re-render of everything
npm run audio:render -- --full

# Dry run (exercises the pipeline without real TTS calls)
npm run audio:render -- --dry-run
```

---

## Step-by-step: adding a new audio asset

1. **Add the entry** to `src/data/audio-phrases.json`.

   Follow the schema in `src/docs/AUDIO_PHRASES_AUTHORING.md`.

   ```json
   {
     "id": "phoneme.letter.b",
     "type": "phoneme",
     "text": "B says buh",
     "voiceProfile": "mermaid-default",
     "locale": "en-US",
     "renderStrategy": "tts",
     "sourceRefs": [{ "type": "activity", "id": "ra-b-seashell" }],
     "tags": ["satpin", "level-1", "seashell-match"],
     "status": "experimental",
     "phonicsMetadata": {
       "phonemeSymbol": "b",
       "isolationRequired": true,
       "maxDurationMs": 1500,
       "allowLetterName": true,
       "reviewRequired": true
     }
   }
   ```

2. **Reference the new ID** in the relevant content (activity, component, or
   the `PHONICS_AUDIO_ID_MAP` in `src/data/phonicsAudioIds.ts`).

3. **Validate** to confirm there are no content integrity errors:

   ```bash
   npm run audio:render -- --validate
   ```

   A clean run prints:
   ```
   ── Phrase Extraction Diagnostics ──────────────────────────
   Resolved        : 50
   Missing         : 0
   ...
   Validation complete. No files written (--validate mode).
   ```

   Fix any errors before proceeding.

4. **Run changed-only rendering** to synthesise only the new file:

   ```bash
   npm run audio:render
   ```

   The report shows `Generated: 1` (or however many new assets were added).

5. **Review** the generated file in `public/audio/` and verify the pronunciation
   sounds correct.

6. If the pronunciation is acceptable, set `"status": "active"` in the inventory
   and commit both the JSON change and the new audio file.

---

## Interpreting the render report

After a run the CLI prints a report like:

```
── Batch TTS Render Report ──────────────────────────────────
Mode       : changed-only
Total      : 49
Generated  : 2
Skipped    : 45
Failed     : 0
Stale      : 1
Blocked    : 1
Status     : ✓ success
```

| Field      | Meaning                                                          |
|------------|------------------------------------------------------------------|
| Generated  | New audio files written to disk                                  |
| Skipped    | Assets unchanged since last run (render key matched manifest)    |
| Failed     | Assets that could not be rendered; see failure details below     |
| Stale      | Assets in the manifest whose output file is missing or corrupt   |
| Blocked    | Assets with `status: "blocked"` in the inventory; not rendered   |

### Stale assets

Stale assets have a manifest entry but their output file has been deleted or
moved.  Re-render them with:

```bash
npm run audio:render -- --full
```

Or delete the stale entries from `public/audio/render-manifest.json` and re-run
`changed-only`.

### Failed assets

The report lists each failure with a class and message:

```
Failed assets:
  [terminal] phoneme.letter.s: [unsupported-voice] Voice "mermaid-default" not found
  [retryable] word.cvc.sat: [engine-unavailable] Engine process not running
```

| Failure class       | Retryable | Action                                          |
|---------------------|-----------|-------------------------------------------------|
| `engine-unavailable`| yes       | Start the TTS engine and re-run                 |
| `timeout`           | yes       | Check engine health; re-run                     |
| `invalid-input`     | no        | Fix `text` in the inventory entry               |
| `unsupported-voice` | no        | Change `voiceProfile` or install the voice      |
| `write-failure`     | yes       | Check disk space and permissions; re-run        |
| `validation-failure`| no        | Inspect the generated file; check engine config |

### Blocked assets

Assets with `"status": "blocked"` require a pronunciation review before they
can be rendered.  They are intentionally excluded from all render runs.

Once a review passes:
1. Set `"status": "active"` in the inventory.
2. Re-run the renderer.

---

## Forcing a re-render of specific assets

To force re-render of one asset without running a full re-render:

1. Delete its entry from `public/audio/render-manifest.json`.
2. Run `npm run audio:render` (changed-only mode will now pick it up).

To force re-render of **all** assets (e.g. after a TTS engine upgrade):

```bash
npm run audio:render -- --full
```

Or bump the pipeline version in `src/services/renderKeyGenerator.ts`
(`PIPELINE_VERSION` constant) — this invalidates every render key and
triggers a full re-render on the next `changed-only` run.

---

## CI integration

Add a validation step to your CI pipeline to catch content errors early:

```yaml
- name: Validate audio content
  run: npm run audio:render -- --validate
```

For a full dry-run smoke test (no TTS engine required):

```yaml
- name: Smoke-test rendering pipeline
  run: npm run audio:render -- --dry-run
```

---

## File locations

| Path                                      | Purpose                                        |
|-------------------------------------------|------------------------------------------------|
| `src/data/audio-phrases.json`             | Audio phrase inventory (source of truth)       |
| `src/data/phonicsAudioIds.ts`             | SATPIN AudioId → TTS text map                  |
| `src/scripts/renderAudio.ts`             | CLI entry point                                |
| `src/services/batchTtsRenderer.ts`        | Batch render orchestrator                      |
| `src/services/renderKeyGenerator.ts`      | Deterministic render key computation           |
| `src/services/renderOutputPaths.ts`       | Output path resolution                         |
| `src/services/ttsEngineAdapter.ts`        | Local TTS engine adapter                       |
| `src/types/batchRenderer.ts`              | Type definitions for the batch pipeline        |
| `public/audio/`                           | Generated audio files                          |
| `public/audio/render-manifest.json`       | Render manifest (render keys + timestamps)     |

---

## Related documentation

- `src/docs/AUDIO_PHRASES_AUTHORING.md` — how to add and maintain inventory entries
- `src/docs/AUDIO_ID_AUTHORING.md` — AudioId grammar and stability rules
