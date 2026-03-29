/**
 * Phonics Audio ID Map  (issue #203 — Create phonics ID mapping examples)
 *
 * Maps every stable {@link AudioId} used in the SATPIN phonics curriculum to
 * the TTS text that should be synthesised for it.
 *
 * ─── HOW TO USE ────────────────────────────────────────────────────────────
 *
 * 1. Look up the AudioId for the clip you want to play:
 *
 *      import { PHONICS_AUDIO_ID_MAP } from '../data/phonicsAudioIds';
 *      import { audioId } from '../types/audioId';
 *
 *      const id  = audioId('phonics.letter.s');
 *      const tts = PHONICS_AUDIO_ID_MAP[id]; // 'S says sss'
 *
 * 2. Pass both to `speak()` so the cache is keyed by the stable ID:
 *
 *      speak(tts, id);
 *
 * ─── ID TAXONOMY ───────────────────────────────────────────────────────────
 *
 * phonics.letter.{x}          Isolated phoneme for letter x
 *                               (used in seashell tiles, bubble-pop bubbles,
 *                                echo-song beats, word-builder tiles)
 *
 * phonics.bin.{x}             Bin/chest label for letter x
 *                               (used in treasure-sort activity bins)
 *
 * word.cvc.{word}             Complete blended CVC word
 *                               (used in word-builder completion feedback)
 *
 * object.name.{object}        Object / picture name
 *                               (used in fish-feed and treasure-sort-obj options)
 *
 * instruction.seashell-match.{x}  Seashell-match prompt per target letter
 * instruction.fish-feed.{x}       Fish-feed prompt per target letter
 * instruction.treasure-sort.letter  Letter treasure-sort prompt
 * instruction.treasure-sort.object  Object treasure-sort prompt
 * instruction.echo-song.default     Echo-song activity prompt
 * instruction.word-builder.{word}   Word-builder prompt per target word
 */

import { audioId, type AudioId } from '../types/audioId';

/**
 * A record mapping every SATPIN phonics {@link AudioId} to the canonical TTS
 * text that should be synthesised for it.
 *
 * The IDs are stable — they must not be changed even if the TTS text is
 * revised.  See `AUDIO_ID_AUTHORING.md` for the full authoring rules.
 */
export const PHONICS_AUDIO_ID_MAP: Record<AudioId, string> = {
  // ── Letter phoneme sounds ──────────────────────────────────────────────────
  // Used as: seashell option tiles, bubble-pop bubbles,
  //          echo-song beat audio, word-builder letter tiles
  [audioId('phonics.letter.s')]: 'S says sss',
  [audioId('phonics.letter.a')]: 'A says aah',
  [audioId('phonics.letter.t')]: 'T says tuh',
  [audioId('phonics.letter.p')]: 'P says puh',
  [audioId('phonics.letter.i')]: 'I says ih',
  [audioId('phonics.letter.n')]: 'N says nnn',

  // ── Bin / chest labels ────────────────────────────────────────────────────
  // Used as: treasure-sort bin tap audio
  [audioId('phonics.bin.s')]: 'S says s like in snake',
  [audioId('phonics.bin.a')]: 'A says a like in apple',
  [audioId('phonics.bin.t')]: 'T says t like in tiger',
  [audioId('phonics.bin.p')]: 'P says p like in pig',
  [audioId('phonics.bin.i')]: 'I says i like in insect',
  [audioId('phonics.bin.n')]: 'N says n like in nest',

  // ── CVC words ─────────────────────────────────────────────────────────────
  // Used as: word-builder completion / blended word feedback
  [audioId('word.cvc.sat')]: 'sat',
  [audioId('word.cvc.sit')]: 'sit',
  [audioId('word.cvc.tap')]: 'tap',
  [audioId('word.cvc.pin')]: 'pin',
  [audioId('word.cvc.nap')]: 'nap',
  [audioId('word.cvc.pan')]: 'pan',

  // ── Object / picture names ────────────────────────────────────────────────
  // Used as: fish-feed and treasure-sort-obj option tap audio
  [audioId('object.name.sun')]: 'Sun',
  [audioId('object.name.apple')]: 'Apple',
  [audioId('object.name.tiger')]: 'Tiger',
  [audioId('object.name.pig')]: 'Pig',
  [audioId('object.name.insect')]: 'Insect',
  [audioId('object.name.net')]: 'Net',
  [audioId('object.name.ant')]: 'Ant',
  [audioId('object.name.nest')]: 'Nest',
  [audioId('object.name.ink')]: 'Ink',

  // ── Seashell-match activity prompts (one per target letter) ───────────────
  [audioId('instruction.seashell-match.s')]:
    'Tap the shell that makes the s sound, like in snake',
  [audioId('instruction.seashell-match.a')]:
    'Tap the shell that makes the a sound, like in apple',
  [audioId('instruction.seashell-match.t')]:
    'Tap the shell that makes the t sound, like in tap',
  [audioId('instruction.seashell-match.p')]:
    'Tap the shell that makes the p sound, like in pat',
  [audioId('instruction.seashell-match.i')]:
    'Tap the shell that makes the short i sound, like in insect',
  [audioId('instruction.seashell-match.n')]:
    'Tap the shell that makes the n sound, like in nest',

  // ── Fish-feed activity prompts (one per target letter) ────────────────────
  [audioId('instruction.fish-feed.s')]:
    'Which picture starts with the s sound like in snake? Tap the right one to feed the fish!',
  [audioId('instruction.fish-feed.a')]:
    'Which picture starts with the a sound like in apple? Tap the right one to feed the fish!',
  [audioId('instruction.fish-feed.t')]:
    'Which picture starts with the t sound like in turtle? Tap the right one to feed the fish!',
  [audioId('instruction.fish-feed.p')]:
    'Which picture starts with the p sound like in parrot? Tap the right one to feed the fish!',
  [audioId('instruction.fish-feed.i')]:
    'Which picture starts with the i sound like in igloo? Tap the right one to feed the fish!',
  [audioId('instruction.fish-feed.n')]:
    'Which picture starts with the n sound like in nest? Tap the right one to feed the fish!',

  // ── Treasure-sort activity prompts ────────────────────────────────────────
  [audioId('instruction.treasure-sort.letter')]:
    'Sort each letter into the right treasure chest! Listen to the sound and put it in the correct chest.',
  [audioId('instruction.treasure-sort.object')]:
    'Sort each picture into the chest that matches its starting sound!',

  // ── Echo-song activity prompt ─────────────────────────────────────────────
  [audioId('instruction.echo-song.default')]:
    'Echo the mermaid! Tap along as you hear each sound.',

  // ── Word-builder activity prompts (one per CVC target) ────────────────────
  [audioId('instruction.word-builder.sat')]:
    'Tap the letters in order to build the word: s, a, t',
  [audioId('instruction.word-builder.sit')]:
    'Tap the letters in order to build the word: s, i, t',
  [audioId('instruction.word-builder.tap')]:
    'Tap the letters in order to build the word: t, a, p',
  [audioId('instruction.word-builder.pin')]:
    'Tap the letters in order to build the word: p, i, n',
  [audioId('instruction.word-builder.nap')]:
    'Tap the letters in order to build the word: n, a, p',
  [audioId('instruction.word-builder.pan')]:
    'Tap the letters in order to build the word: p, a, n',
} as Record<AudioId, string>;
