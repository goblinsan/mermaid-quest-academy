/**
 * Audio Phrases Schema — Type Definitions  (issue #206 / Audio V5)
 *
 * Defines the source-of-truth schema for every renderable audio asset in
 * Mermaid Quest Academy.  This schema is the contract between content
 * authoring, extraction, rendering, QA, and runtime playback.
 *
 * ─── FIELDS ─────────────────────────────────────────────────────────────────
 *
 *  id              Stable semantic AudioId (immutable once shipped)
 *  type            Asset type — drives required/optional field rules
 *  text            Canonical TTS text (may be revised; id stays fixed)
 *  voiceProfile    TTS voice profile identifier
 *  locale          BCP-47 locale string (e.g. 'en-US')
 *  renderStrategy  How the asset is rendered ('tts' | 'prerecorded')
 *  sourceRefs      Activities/files that use this clip
 *  tags            Free-form categorisation tags
 *  status          Lifecycle state
 *  phonicsMetadata Phonics-specific constraints (required for 'phoneme' type)
 *  replacedBy      Replacement AudioId when status === 'replaced'
 *  notes           Human-readable notes for authors / QA
 *
 * ─── TYPE-SPECIFIC CONTRACTS ─────────────────────────────────────────────────
 *
 *  phoneme    phonicsMetadata is REQUIRED
 *  word       phonicsMetadata is optional (encouraged for CVC blends)
 *  prompt     sourceRefs must be non-empty
 *  feedback   no extra constraints
 *  reward     no extra constraints
 *  ui         no extra constraints
 *  narration  no extra constraints
 *
 * ─── LIFECYCLE ───────────────────────────────────────────────────────────────
 *
 *  active        In active use — rendered and shipped
 *  deprecated    Retired; stop emitting in new code; keep until refs cleared
 *  experimental  Under development; not yet in production
 *  blocked       Blocked from rendering (pronunciation review required)
 *  replaced      Superseded by another entry (replacedBy must be set)
 */

import type { AudioId } from './audioId';

// ─── Asset type ──────────────────────────────────────────────────────────────

/**
 * The ordered list of audio asset types.
 * Each type drives its own required/optional field contract.
 *
 * | Type        | Description                                              |
 * |-------------|----------------------------------------------------------|
 * | `phoneme`   | Isolated phoneme / letter-sound (phonicsMetadata required)|
 * | `word`      | Complete spoken word (CVC blend or object name)          |
 * | `prompt`    | Activity instruction or direction (sourceRefs required)  |
 * | `feedback`  | Learner-response feedback (correct / incorrect)          |
 * | `reward`    | Reward or celebration audio                              |
 * | `ui`        | General UI interaction sound                             |
 * | `narration` | Narrative or story audio                                 |
 */
export const AUDIO_PHRASE_TYPES = [
  'phoneme',
  'word',
  'prompt',
  'feedback',
  'reward',
  'ui',
  'narration',
] as const;

/** Union of all valid audio phrase type strings. */
export type AudioPhraseType = (typeof AUDIO_PHRASE_TYPES)[number];

// ─── Lifecycle status ─────────────────────────────────────────────────────────

/**
 * Lifecycle states for an audio phrase entry.
 *
 * | Status         | Rendering behaviour                                       |
 * |----------------|-----------------------------------------------------------|
 * | `active`       | Rendered and shipped to production                        |
 * | `deprecated`   | No longer emitted; preserved until all references cleared |
 * | `experimental` | Development-only; excluded from production builds         |
 * | `blocked`      | Blocked from rendering until review is complete           |
 * | `replaced`     | Superseded; replacedBy field must name the successor ID   |
 */
export const AUDIO_PHRASE_STATUSES = [
  'active',
  'deprecated',
  'experimental',
  'blocked',
  'replaced',
] as const;

/** Union of all valid audio phrase lifecycle status strings. */
export type AudioPhraseStatus = (typeof AUDIO_PHRASE_STATUSES)[number];

// ─── Render strategy ─────────────────────────────────────────────────────────

/**
 * How an audio phrase asset is rendered.
 *
 * | Strategy      | Description                                   |
 * |---------------|-----------------------------------------------|
 * | `tts`         | Synthesised at runtime via the TTS service    |
 * | `prerecorded` | Served as a static pre-recorded audio file    |
 */
export const AUDIO_RENDER_STRATEGIES = ['tts', 'prerecorded'] as const;

/** Union of all valid render strategy strings. */
export type AudioRenderStrategy = (typeof AUDIO_RENDER_STRATEGIES)[number];

// ─── Source reference ─────────────────────────────────────────────────────────

/**
 * A reference to a source activity, data file, or component that uses an
 * audio phrase.  Used to trace where each clip is consumed in the game.
 */
export interface AudioSourceRef {
  /**
   * The kind of source.
   *
   * - `activity`  — a reading activity by its ID in readingActivities.json
   * - `data-file` — a data file (e.g. phonicsVocabulary.json)
   * - `component` — a UI component by its module name
   */
  type: 'activity' | 'data-file' | 'component';

  /**
   * The identifier of the source:
   * - For `activity`: the activity ID string (e.g. 'ra-s-seashell')
   * - For `data-file`: the filename relative to `src/data/`
   * - For `component`: the component module name (e.g. 'FeedFriendlyFish')
   */
  id: string;
}

// ─── Phonics metadata ─────────────────────────────────────────────────────────

/**
 * Phonics-specific constraints for a phoneme or word audio asset.
 *
 * Required when `type === 'phoneme'`.  Optional (but encouraged) when
 * `type === 'word'` and the word is a CVC blend.
 *
 * These fields prevent bad pronunciation handling by making constraints
 * explicit so that TTS rendering pipelines and QA checks can enforce them.
 */
export interface PhonicsAudioMetadata {
  /**
   * IPA phoneme symbol or ASCII approximation that identifies the target
   * phoneme (e.g. `"s"`, `"æ"`, `"t"`, `"p"`, `"ɪ"`, `"n"`).
   *
   * Used to map the asset back to the phonics curriculum phoneme chart and
   * to detect semantic duplicates across entries.
   */
  phonemeSymbol: string;

  /**
   * When `true`, this clip must be rendered in isolation — the TTS output
   * must not include any surrounding silence fillers, extra letter names, or
   * blending artefacts that would corrupt the isolated phoneme.
   *
   * Set to `false` for bin-label entries where contextual phrasing is expected
   * (e.g. "S says s like in snake").
   */
  isolationRequired: boolean;

  /**
   * Maximum allowed rendered duration in milliseconds.
   *
   * Clips that exceed this limit will be flagged by the QA validator as
   * potentially too long for the UI context in which they are used.
   *
   * Recommended defaults:
   *  - Isolated phoneme (`isolationRequired: true`): 1500 ms
   *  - Bin label with context (`isolationRequired: false`): 3000 ms
   */
  maxDurationMs: number;

  /**
   * Whether the letter name may appear in the TTS text.
   *
   * For example, "S says sss" uses the letter name "S".  When `false`, only
   * the bare phoneme sound is acceptable (e.g. "sss").  Setting this to
   * `false` enables the validator to reject entries whose TTS text contains
   * the letter name.
   */
  allowLetterName: boolean;

  /**
   * When `true`, this clip requires a human pronunciation review before it
   * is considered production-ready.  The pipeline should treat it as
   * `blocked` until review is recorded.
   */
  reviewRequired: boolean;
}

// ─── Core entry type ─────────────────────────────────────────────────────────

/**
 * A single entry in the audio phrase inventory.
 *
 * This is the canonical, source-of-truth record for one renderable audio
 * asset.  All fields — ID, text, voice profile, phonics constraints, and
 * lifecycle status — live together so that authoring, rendering, QA, and
 * runtime are all reading from the same contract.
 */
export interface AudioPhraseEntry {
  /**
   * The stable semantic AudioId for this clip.
   *
   * Immutable once authored and shipped.  See `AUDIO_ID_AUTHORING.md` for
   * the full grammar and stability rules.
   */
  id: AudioId;

  /**
   * The asset type.  Drives which fields are required for this entry.
   */
  type: AudioPhraseType;

  /**
   * The canonical TTS text to be synthesised for this clip.
   *
   * This field **may** be revised (for clarity or pronunciation) without
   * changing the ID.  The cache is keyed by `id`, not by `text`.
   */
  text: string;

  /**
   * Voice profile identifier for TTS synthesis.
   *
   * Examples: `'mermaid-default'`, `'narrator'`, `'child-tutor'`
   */
  voiceProfile: string;

  /**
   * BCP-47 locale string for TTS synthesis.
   *
   * Example: `'en-US'`, `'en-GB'`
   */
  locale: string;

  /**
   * How this asset is rendered.
   */
  renderStrategy: AudioRenderStrategy;

  /**
   * References to source activities, data files, or components that use
   * this clip.
   *
   * Required (non-empty) for `type === 'prompt'`.  Optional for all others.
   */
  sourceRefs: AudioSourceRef[];

  /**
   * Free-form categorisation tags for filtering and tooling.
   *
   * Examples: `['satpin', 'level-1', 'seashell-match']`
   */
  tags: string[];

  /**
   * Lifecycle status of this entry.
   */
  status: AudioPhraseStatus;

  /**
   * Phonics-specific rendering constraints.
   *
   * Required when `type === 'phoneme'`.
   * Optional (but encouraged) when `type === 'word'` and the word is a CVC blend.
   */
  phonicsMetadata?: PhonicsAudioMetadata;

  /**
   * The AudioId of the entry that supersedes this one.
   * Must be set (and must be a valid AudioId) when `status === 'replaced'`.
   */
  replacedBy?: AudioId;

  /**
   * Human-readable notes for content authors or QA reviewers.
   * Not used by any runtime pipeline — authoring guidance only.
   */
  notes?: string;
}

// ─── Inventory root ───────────────────────────────────────────────────────────

/**
 * The root structure of the `audio-phrases.json` source-of-truth file.
 */
export interface AudioPhrasesInventory {
  /**
   * Schema version for forward-compatibility.  Increment when a
   * breaking change is made to the entry shape.
   */
  schemaVersion: string;

  /**
   * ISO-8601 date of the last inventory update.
   * Used by tooling to detect stale cached renders.
   */
  updatedAt: string;

  /**
   * The full inventory of audio phrase entries.
   * Every renderable audio asset in the game must have exactly one entry here.
   */
  phrases: AudioPhraseEntry[];
}
