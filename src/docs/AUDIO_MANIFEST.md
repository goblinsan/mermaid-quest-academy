# Audio Manifest Contract

This document describes the **audio manifest** — the runtime-facing JSON file
that maps every generated audio asset to its file path, duration, and playback
metadata.  It is the contract between the TTS rendering pipeline and the
frontend audio playback layer.

---

## What is the audio manifest?

`public/audio/audio-manifest.json` is the file that the frontend reads to
resolve AudioIds to playable files at runtime.

It is distinct from the **render manifest** (`public/audio/render-manifest.json`),
which is a pipeline artefact used to skip unchanged assets between render runs.
The audio manifest is for consumption by the frontend; the render manifest is for
the pipeline only.

---

## How the frontend resolves an AudioId

```typescript
// 1. Load the manifest once (e.g. at app startup or session start)
import audioManifest from '/audio/audio-manifest.json';

// 2. Check compatibility (optional but recommended)
import { isManifestCompatible } from '../types/audioManifest';
if (!isManifestCompatible(audioManifest)) {
  throw new Error('Audio manifest schema mismatch — please regenerate');
}

// 3. Look up an asset by its AudioId (O(1) — plain object property access)
const entry = audioManifest.entries['phoneme.letter.s'];

if (!entry) {
  // Handle gracefully — see "Handling missing assets" below
  console.warn('Audio asset not found: phoneme.letter.s');
  return;
}

// 4. Play the audio
const audio = new Audio('/' + entry.filePath);
audio.play();
```

---

## Manifest structure

```json
{
  "manifestVersion": "1.0.0",
  "pipelineVersion": "1.0.0",
  "generatedAt": "2026-03-29T09:00:00.000Z",
  "entries": {
    "phoneme.letter.s": {
      "id": "phoneme.letter.s",
      "filePath": "audio/phoneme_letter_s__a3f2b1c4.mp3",
      "hash": "a3f2b1c4",
      "durationMs": 1200,
      "type": "phoneme",
      "voiceProfile": "mermaid-default",
      "locale": "en-US",
      "preloadPriority": "critical",
      "tags": ["satpin", "level-1"],
      "generatedAt": "2026-03-29T08:00:00.000Z"
    }
  }
}
```

### Root fields

| Field             | Type     | Description                                         |
|-------------------|----------|-----------------------------------------------------|
| `manifestVersion` | `string` | Schema version; check with `isManifestCompatible()` |
| `pipelineVersion` | `string` | Pipeline version that generated this manifest       |
| `generatedAt`     | `string` | ISO-8601 timestamp of manifest generation           |
| `entries`         | `object` | Map of `AudioId → AudioManifestEntry` (O(1) lookup) |

### Entry fields

| Field             | Type                  | Description                                                      |
|-------------------|-----------------------|------------------------------------------------------------------|
| `id`              | `string` (AudioId)    | Stable semantic identifier; equals the key in `entries`          |
| `filePath`        | `string`              | Relative path from `public/`; use as URL with leading `/`        |
| `hash`            | `string`              | Render key; changes when audio inputs change                     |
| `durationMs`      | `number \| null`      | Clip duration in ms; `null` if not measured                      |
| `type`            | `AudioPhraseType`     | Asset type: `phoneme`, `word`, `prompt`, `feedback`, etc.        |
| `voiceProfile`    | `string`              | TTS voice profile identifier                                     |
| `locale`          | `string`              | BCP-47 locale (e.g. `"en-US"`)                                   |
| `preloadPriority` | `PreloadPriority`     | `critical` \| `high` \| `normal` \| `low`                        |
| `tags`            | `string[]`            | Free-form categorisation tags from the inventory                 |
| `generatedAt`     | `string`              | ISO-8601 timestamp of the last successful render                 |

---

## Using `durationMs`

`durationMs` is `null` when duration could not be measured (e.g. dry-run or
when the TTS engine does not report it).  **Always null-guard this field.**

Use cases:
- Show a progress indicator timed to the clip length
- Pad UI transitions to avoid cutting audio short
- Validate that phoneme clips are within the `maxDurationMs` constraint

```typescript
if (entry.durationMs !== null) {
  showProgressBar(entry.durationMs);
}
```

---

## Handling missing assets

Not every AudioId in the inventory will have a manifest entry:

- The render pipeline may have failed for that asset
- The asset may not have been rendered yet (experimental / blocked)

**Never crash when an entry is missing — always fall back gracefully:**

```typescript
const entry = manifest.entries[audioId];
if (!entry) {
  // Option A: fall back to TTS fetch (online-only path)
  return speak(ttsText);
  // Option B: silently skip (for non-critical audio)
  return;
}
```

---

## Preload integration

Use `preloadPriority` to decide when to warm each asset:

| Priority   | Asset types              | When to preload                        |
|------------|--------------------------|----------------------------------------|
| `critical` | `phoneme`                | Before any phonics activity renders    |
| `high`     | `feedback`, `prompt`     | At activity initialisation             |
| `normal`   | `word`                   | During activity idle time              |
| `low`      | `reward`, `ui`, `narration` | Background / best-effort            |

```typescript
// Preload all critical assets for the current activity
const criticalEntries = Object.values(manifest.entries)
  .filter(e => e.preloadPriority === 'critical');

for (const entry of criticalEntries) {
  preloadAudio(entry.filePath);
}
```

---

## Versioning and compatibility

The manifest uses semantic versioning for `manifestVersion`:

- **MAJOR** — breaking change; runtime **must** reject incompatible manifests
- **MINOR** — additive change; runtime may safely ignore unknown fields
- **PATCH** — non-schema fix; always compatible

Always check compatibility at startup:

```typescript
import { isManifestCompatible } from '../types/audioManifest';

if (!isManifestCompatible(manifest)) {
  // Manifest was generated by a different schema version.
  // Either regenerate it with `npm run audio:render` or
  // update the frontend to the new schema.
  throw new Error('Audio manifest schema mismatch');
}
```

---

## Regenerating the manifest

The manifest is produced automatically by the TTS rendering pipeline:

```bash
npm run audio:render
```

After a successful run, `public/audio/audio-manifest.json` is updated with all
successfully rendered assets.  Failed, blocked, and stale assets are excluded.

---

## Validation

The manifest can be validated against the inventory with:

```typescript
import { validateManifest } from '../services/audioManifestValidator';

const result = validateManifest(audioManifest, inventory, {
  checkFileExistence: true,
  projectRoot: process.cwd(),
});

if (!result.valid) {
  // result.errors lists every missing or stale asset
  // result.warnings lists orphaned entries to clean up
}
```

See `src/services/audioManifestValidator.ts` for full API documentation.
