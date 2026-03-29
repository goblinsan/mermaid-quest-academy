/**
 * Phonics Audio ID Map  (issue #219 — Phonics mapping validation SATPIN)
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
 *      const id  = audioId('phoneme.letter.s');
 *      const tts = PHONICS_AUDIO_ID_MAP[id]; // 'S says sss'
 *
 * 2. Pass both to `speak()` so the cache is keyed by the stable ID:
 *
 *      speak(tts, id);
 *
 * ─── ID TAXONOMY ───────────────────────────────────────────────────────────
 *
 * phoneme.letter.{x}          Isolated phoneme for letter x
 *                               (used in seashell tiles, bubble-pop bubbles,
 *                                echo-song beats, word-builder tiles)
 *
 * phoneme.bin.{x}             Bin/chest label for letter x
 *                               (used in treasure-sort activity bins)
 *
 * word.cvc.{word}             Complete blended CVC word
 *                               (used in word-builder completion feedback)
 *
 * word.name.{object}          Object / picture name
 *                               (used in fish-feed and treasure-sort-obj options)
 *
 * prompt.seashell_match.{x}   Seashell-match prompt per target letter
 * prompt.fish_feed.{x}        Fish-feed prompt per target letter
 * prompt.treasure_sort.letter Letter treasure-sort prompt
 * prompt.treasure_sort.object Object treasure-sort prompt
 * prompt.echo_song.default    Echo-song activity prompt
 * prompt.word_builder.{word}  Word-builder prompt per target word
 *
 * reward.level_complete       Level-completion celebration audio
 * reward.badge_earned         Badge-earned celebration audio
 * reward.pearls_collected     Pearl-collection sound
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
  [audioId('phoneme.letter.s')]: 'S says sss',
  [audioId('phoneme.letter.a')]: 'A says aah',
  [audioId('phoneme.letter.t')]: 'T says tuh',
  [audioId('phoneme.letter.p')]: 'P says puh',
  [audioId('phoneme.letter.i')]: 'I says ih',
  [audioId('phoneme.letter.n')]: 'N says nnn',

  // ── Bin / chest labels ────────────────────────────────────────────────────
  // Used as: treasure-sort bin tap audio
  [audioId('phoneme.bin.s')]: 'S says s like in snake',
  [audioId('phoneme.bin.a')]: 'A says a like in apple',
  [audioId('phoneme.bin.t')]: 'T says t like in tiger',
  [audioId('phoneme.bin.p')]: 'P says p like in pig',
  [audioId('phoneme.bin.i')]: 'I says i like in insect',
  [audioId('phoneme.bin.n')]: 'N says n like in nest',

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
  [audioId('word.name.sun')]: 'Sun',
  [audioId('word.name.apple')]: 'Apple',
  [audioId('word.name.tiger')]: 'Tiger',
  [audioId('word.name.pig')]: 'Pig',
  [audioId('word.name.insect')]: 'Insect',
  [audioId('word.name.net')]: 'Net',
  [audioId('word.name.ant')]: 'Ant',
  [audioId('word.name.nest')]: 'Nest',
  [audioId('word.name.ink')]: 'Ink',

  // ── Seashell-match activity prompts (one per target letter) ───────────────
  [audioId('prompt.seashell_match.s')]:
    'Tap the shell that makes the s sound, like in snake',
  [audioId('prompt.seashell_match.a')]:
    'Tap the shell that makes the a sound, like in apple',
  [audioId('prompt.seashell_match.t')]:
    'Tap the shell that makes the t sound, like in tap',
  [audioId('prompt.seashell_match.p')]:
    'Tap the shell that makes the p sound, like in pat',
  [audioId('prompt.seashell_match.i')]:
    'Tap the shell that makes the short i sound, like in insect',
  [audioId('prompt.seashell_match.n')]:
    'Tap the shell that makes the n sound, like in nest',

  // ── Fish-feed activity prompts (one per target letter) ────────────────────
  [audioId('prompt.fish_feed.s')]:
    'Which picture starts with the s sound like in snake? Tap the right one to feed the fish!',
  [audioId('prompt.fish_feed.a')]:
    'Which picture starts with the a sound like in apple? Tap the right one to feed the fish!',
  [audioId('prompt.fish_feed.t')]:
    'Which picture starts with the t sound like in turtle? Tap the right one to feed the fish!',
  [audioId('prompt.fish_feed.p')]:
    'Which picture starts with the p sound like in parrot? Tap the right one to feed the fish!',
  [audioId('prompt.fish_feed.i')]:
    'Which picture starts with the i sound like in igloo? Tap the right one to feed the fish!',
  [audioId('prompt.fish_feed.n')]:
    'Which picture starts with the n sound like in nest? Tap the right one to feed the fish!',

  // ── Treasure-sort activity prompts ────────────────────────────────────────
  [audioId('prompt.treasure_sort.letter')]:
    'Sort each letter into the right treasure chest! Listen to the sound and put it in the correct chest.',
  [audioId('prompt.treasure_sort.object')]:
    'Sort each picture into the chest that matches its starting sound!',

  // ── Echo-song activity prompt ─────────────────────────────────────────────
  [audioId('prompt.echo_song.default')]:
    'Echo the mermaid! Tap along as you hear each sound.',

  // ── Word-builder activity prompts (one per CVC target) ────────────────────
  [audioId('prompt.word_builder.sat')]:
    'Tap the letters in order to build the word: s, a, t',
  [audioId('prompt.word_builder.sit')]:
    'Tap the letters in order to build the word: s, i, t',
  [audioId('prompt.word_builder.tap')]:
    'Tap the letters in order to build the word: t, a, p',
  [audioId('prompt.word_builder.pin')]:
    'Tap the letters in order to build the word: p, i, n',
  [audioId('prompt.word_builder.nap')]:
    'Tap the letters in order to build the word: n, a, p',
  [audioId('prompt.word_builder.pan')]:
    'Tap the letters in order to build the word: p, a, n',

  // ── Feedback ──────────────────────────────────────────────────────────────
  [audioId('feedback.correct')]: 'Well done! That is correct.',
  [audioId('feedback.incorrect')]: 'Not quite. Try again!',

  // ── Reward audio ──────────────────────────────────────────────────────────
  [audioId('reward.level_complete')]:
    'Amazing! You completed the level! Keep swimming!',
  [audioId('reward.badge_earned')]:
    'You earned a badge! Fantastic work!',
  [audioId('reward.pearls_collected')]:
    'You collected pearls!',
} as Record<AudioId, string>;
