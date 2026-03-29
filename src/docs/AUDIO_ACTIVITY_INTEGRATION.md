# Audio Activity Integration Guide

This document explains how activity screens trigger audio playback, handle
replay, and clean up on route changes.  Follow these patterns so every activity
sounds consistent and no screen-specific audio logic is needed.

---

## Quick start

Use `useAudioManager` from any activity screen or hook:

```tsx
import { useAudioManager } from '../hooks/useAudioManager';

export default function MyActivity() {
  const { playPrompt, replayCurrentPrompt, playFeedback, isLoading } =
    useAudioManager();

  // Play the instruction when the activity loads
  useEffect(() => {
    playPrompt('prompt.my_activity.default' as AudioId, config.prompt.ttsText);
  }, [config.id]);

  return (
    <>
      {/* Replay button always works without extra state */}
      <ReplayAudioButton onReplay={replayCurrentPrompt} isLoading={isLoading} />
    </>
  );
}
```

---

## API reference

| Method                                    | Priority | Description                                               |
|-------------------------------------------|----------|-----------------------------------------------------------|
| `playPrompt(audioId, ttsText)`            | HIGH     | Play instruction; registers prompt for replay             |
| `playPhoneme(audioId, ttsText)`           | HIGH     | Play isolated letter-sound                                |
| `playFeedback(audioId, ttsText)`          | HIGH     | Play correct/incorrect feedback                           |
| `play(audioId, ttsText, type?)`           | by type  | Generic play; derives priority from `type`                |
| `playReward(audioId, ttsText)`            | LOW      | Play reward/celebration sound (skipped if HIGH is active) |
| `replayCurrentPrompt()`                   | HIGH     | Replay the last prompt; always interrupts                 |
| `stop()`                                  | —        | Stop any current audio immediately                        |
| `preloadForActivity(ids, texts)`          | —        | Warm audio cache before activity renders                  |
| `isLoading`                               | —        | `true` while a fetch is in flight                         |
| `error`                                   | —        | Non-null when a required audio fetch failed               |

---

## Playing the initial prompt

Auto-play the activity prompt when the activity mounts.  Use `playPrompt` so
the audio is automatically registered for `replayCurrentPrompt()`:

```tsx
const { playPrompt } = useAudioManager();

useEffect(() => {
  playPrompt(config.prompt.audioId, config.prompt.ttsText);
}, [config.id]); // re-run when the activity changes
```

---

## Replay button

The replay button on child-facing screens should call `replayCurrentPrompt()`.
No additional state is needed — the manager stores the last prompt internally:

```tsx
const { replayCurrentPrompt, isLoading } = useAudioManager();

<ReplayAudioButton onReplay={replayCurrentPrompt} isLoading={isLoading} />
```

`replayCurrentPrompt()` is a no-op when no prompt has been played yet, so it
is safe to call at any lifecycle stage.

---

## Tap audio (phonemes and word labels)

When a learner taps a card or letter tile, play the phoneme or word immediately.
Use `playPhoneme` for isolated letter-sounds and `play` with `type='word'` for
full words:

```tsx
const { playPhoneme, play } = useAudioManager();

// Letter tile tap
<LetterTile onTap={() => playPhoneme(option.audioId, option.ttsText)} />

// Word card tap
<WordCard onTap={() => play(option.audioId, option.ttsText, 'word')} />
```

Both are HIGH-priority so they interrupt reward sounds but not each other if
already playing.

---

## Feedback audio

Play feedback immediately after the learner answers.  Correct and incorrect
feedback are both HIGH-priority:

```tsx
const { playFeedback } = useAudioManager();

// After answer evaluation
if (correct) {
  playFeedback('feedback.correct' as AudioId, config.feedback.correctMessage);
} else {
  playFeedback('feedback.incorrect' as AudioId, config.feedback.incorrectMessage);
}
```

---

## Reward audio

Play reward sounds at the end of an activity.  Rewards use LOW priority so they
are skipped if a prompt, phoneme, or feedback clip is still playing:

```tsx
const { playReward } = useAudioManager();

// On completion
playReward('reward.level_complete' as AudioId, 'Well done!');
```

A missing reward asset is swallowed silently — the learner still sees the
visual celebration.

---

## Preloading

Warm the audio cache before the activity renders so taps feel instant.  Call
`preloadForActivity` at mount time:

```tsx
const { preloadForActivity } = useAudioManager();

useEffect(() => {
  const ids   = config.options.map(o => o.audioId);
  const texts = config.options.map(o => o.ttsText);
  preloadForActivity(ids, texts);
}, [config.id]);
```

Preloading is best-effort — failures are silently swallowed and the activity
continues normally.  For next-activity preloading (so the first prompt of the
next screen feels instant), use the standalone `prefetchAudio` helper from
`useAudio`:

```tsx
useEffect(() => {
  const next = getNextActivity(config.id);
  if (next) prefetchAudio(next.prompt.ttsText, next.prompt.audioId);
}, [config.id]);
```

---

## Interruption rules

The manager enforces two priority tiers to prevent chaotic audio stacking:

| Tier | Types                             | Rule                                          |
|------|-----------------------------------|-----------------------------------------------|
| HIGH | `prompt` `phoneme` `feedback` `word` | Always interrupts any current audio           |
| LOW  | `reward` `ui` `narration`         | Skipped when any HIGH audio is actively playing |

This means:
- A reward jingle will never interrupt an instruction or feedback clip.
- Tapping a letter tile while the prompt is still speaking will interrupt the
  prompt and immediately play the phoneme.
- Calling `replayCurrentPrompt()` always interrupts everything.

---

## Cleanup on route change

`useAudioManager` creates one `AudioPlayer` instance per mount.  When the
component unmounts (e.g. navigating to another screen), the browser
automatically stops playback because the element is no longer referenced.

If you need to explicitly stop audio on unmount (e.g. when navigating away
from an activity mid-prompt), call `stop()` in a cleanup effect:

```tsx
const { stop } = useAudioManager();

useEffect(() => {
  return () => {
    stop(); // clean up on unmount
  };
}, [stop]);
```

---

## Handling missing or blocked assets

`useAudioManager` falls back to TTS automatically when a manifest entry is
missing.  For required audio (prompt, phoneme, feedback) it also logs a
`console.error` so you can identify and fix the gap in the pipeline.

You do **not** need to handle TTS fallback yourself — the manager does it.
Simply check the `error` field to show a graceful UI fallback if needed:

```tsx
const { error } = useAudioManager();

{error && (
  <p className="sr-only">
    Audio is temporarily unavailable. Please continue reading the text.
  </p>
)}
```

Optional audio (reward, ui) failures are always silent and never set `error`.

---

## Manifest initialisation

For the manifest-backed file path to work, the audio manifest must be loaded
once at app startup.  If your screen might be the first to load, ensure the
manifest is initialised in your top-level app setup:

```tsx
// src/main.tsx or a top-level provider
import { audioResolver } from './services/audioResolver';

async function initAudio() {
  try {
    const manifest = await fetch('/audio/audio-manifest.json').then(r => r.json());
    audioResolver.loadManifest(manifest);
  } catch {
    // Manifest unavailable — audio will fall back to live TTS for all clips
  }
}

initAudio();
```

When the manifest is unavailable all audio falls back to TTS automatically.

---

## Migration from `useAudio`

Existing screens using the legacy `useAudio` hook can migrate method-by-method:

| `useAudio`                         | `useAudioManager` equivalent                         |
|------------------------------------|------------------------------------------------------|
| `speak(text)`                      | `play(audioId, text, 'word')`                        |
| `speak(text)` for prompts          | `playPrompt(audioId, text)`                          |
| `speak(text)` for feedback         | `playFeedback(audioId, text)`                        |
| `replay()`                         | `replayCurrentPrompt()`                              |
| `stop()`                           | `stop()`                                             |
| `prefetchAudio(text, audioId)`     | `preloadForActivity([audioId], [text])`              |
| `isLoading`                        | `isLoading`                                          |
| `error`                            | `error`                                              |

`useAudio` remains available for components that do not yet need typed playback
or manifest-backed resolution.
