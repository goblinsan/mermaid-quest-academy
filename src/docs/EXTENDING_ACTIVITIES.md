# Extending the Phonics Activity Engine

This document explains how to add new phonics mini-game types to
Mermaid Quest Academy **without modifying any core gameplay logic**.

---

## Architecture overview

```
src/types/activity.ts          ← config shape (PhonicsActivityConfig)
src/data/readingActivities.json ← activity definitions (JSON)
src/services/activityLoader.ts ← loads & looks up configs by id
src/hooks/usePhonicsActivity.ts ← state machine (select → submit → feedback → complete)
src/components/FeedbackBanner.tsx ← correct / incorrect banner (stateless)
src/components/ActivityShell.tsx  ← full screen shell (stateless, driven by props)
src/screens/ReadingActivityScreen.tsx ← wires everything together for /reading/:id
```

The **engine is config-driven**: the screen shell and state hook are completely
generic. To add a new activity you only touch data files and, optionally, the
`PhonicsActivityType` union type.

---

## Step 1 — Add a new activity to the data file

Open `src/data/readingActivities.json` and append a new object.
Every field in `PhonicsActivityConfig` is required.

```jsonc
{
  "id": "ra-6",                          // unique string id
  "title": "Letter Sound: B",
  "type": "letter-sound",                // see PhonicsActivityType below
  "prompt": {
    "kind": "text",                      // "text" | "audio-only" | "text-and-image"
    "text": "Which word starts with the 'B' sound?",
    "ttsText": "Which word starts with the B sound?",
    "imageSrc": "/images/letter-b.png"   // optional; only needed for text-and-image
  },
  "options": [
    { "id": "opt-1", "text": "Ball",   "emoji": "⚽" },
    { "id": "opt-2", "text": "Flower", "emoji": "🌸" },
    { "id": "opt-3", "text": "Moon",   "emoji": "🌙" }
  ],
  "correctOptionId": "opt-1",            // must match one of the option ids above
  "feedback": {
    "correctMessage": "Ball starts with the B sound!",
    "incorrectMessage": "Listen again! We're looking for the B sound."
  },
  "reward": { "xp": 50, "item": "Letter Badge B", "emoji": "🅱️" },
  "completionCondition": { "type": "single-correct" }
  // or for a streak: { "type": "streak", "count": 3 }
}
```

The loader (`activityLoader.ts`) picks up the file at build time — no other
file needs to change. Navigate to `/reading/ra-6` to play the new activity.

---

## Step 2 — (Optional) Register a new activity type

If your new activity doesn't fit any of the four existing types, extend the
`PhonicsActivityType` union in `src/types/activity.ts`:

```diff
 export type PhonicsActivityType =
   | 'sound-match'
   | 'letter-sound'
   | 'word-blend'
-  | 'rhyme-match';
+  | 'rhyme-match'
+  | 'syllable-clap';   // ← new type
```

The `ActivityShell` renders every activity type identically (option tiles),
so adding a new type to the union is purely informational — it lets future
tooling, analytics, or A/B testing filter by type without any logic change.

---

## Step 3 — (Optional) Add a custom answer layout

The current `ActivityShell` renders **tap-to-submit option tiles** for all
activity types. If a future activity needs a different interaction (e.g. drag-
and-drop or a text input), you have two extension paths:

### A. Extend `ActivityShell` with a render prop

```tsx
// ActivityShell accepts optional children that replace the option tiles
<ActivityShell
  config={config}
  ...
  renderAnswerArea={() => <DragDropBoard config={config} onDrop={selectAndSubmit} />}
/>
```

Add a `renderAnswerArea?: () => React.ReactNode` prop to `ActivityShellProps`
and call it inside the card where the option tiles currently live.

### B. Create a specialised shell

Duplicate `ActivityShell` into, e.g., `DragDropShell`, sharing only the outer
layout (header, card, feedback banner, CTA buttons). Both shells can reuse
`FeedbackBanner` and `usePhonicsActivity` without modification.

---

## Completion conditions

The `PhonicsCompletionCondition` type supports two modes:

| Value | Effect |
|-------|--------|
| `{ type: "single-correct" }` | One correct answer completes the activity immediately. |
| `{ type: "streak", count: N }` | The learner must answer correctly N times **in a row** before completing. An incorrect answer resets the streak to zero. |

`usePhonicsActivity` evaluates the condition internally — screens and shells
**never** need to implement their own completion logic.

---

## Audio

Every activity prompt has a `ttsText` field. `ReadingActivityScreen` calls
`speak(config.prompt.ttsText)` on load and exposes `replay` via the shell's
replay button. To add audio to individual answer options, use `useAudio`
inside the shell or screen and call `speak(option.ttsText)` in the
`onSelectOption` callback before delegating to `selectAndSubmit`.

---

## Progression

`useProgression().completeReadingActivity(id, reward, isCorrect)` records the
attempt, awards XP and treasure, and prevents double-awarding. It does **not**
unlock sequential ocean zones (those are managed by the existing lesson system).
Future work can extend `ProgressionState` to track reading-specific milestones
(e.g. `completedReadingActivityIds`) if analytics need to distinguish them.
