/**
 * Shared content-model types for phonics vocabulary and CVC word data.
 * These types back the `phonicsVocabulary.json` and `cvcWords.json` data files
 * used when generating or validating sound-to-object and blending activities.
 */

/** A single age-appropriate object associated with a target phoneme. */
export interface PhonicsVocabularyObject {
  /** Display word shown to the learner (title-cased), e.g. `"Sun"`. */
  word: string;
  /** Emoji that illustrates the object, used as a visual hint. */
  emoji: string;
}

/**
 * Full vocabulary entry for one phoneme in the SATPIN teaching sequence.
 * Each entry lists objects whose names begin with the target phoneme so
 * they can be used as correct and distractor options in sound-to-object
 * activities.
 */
export interface PhonicsVocabularyEntry {
  /**
   * The target phoneme in lowercase, matching the `targetSound` field used
   * in `PhonicsProgressionMetadata` (e.g. `"s"`, `"a"`).
   */
  sound: string;
  /** Uppercase letter representation shown to learners (e.g. `"S"`). */
  letter: string;
  /** Phoneme written in slash notation for teacher/parent reference (e.g. `"/s/"`). */
  phoneme: string;
  /**
   * A memorable anchor word that exemplifies the target sound.
   * Used in activity prompts such as "…like in sssnake".
   */
  exampleWord: string;
  /** Age-appropriate objects that start with this phoneme. */
  objects: PhonicsVocabularyObject[];
}

/**
 * A single CVC (consonant–vowel–consonant) word built exclusively from
 * phonemes introduced in the SATPIN teaching sequence.
 *
 * All entries in `cvcWords.json` satisfy the constraint that every phoneme
 * in the `phonemes` tuple belongs to the set {s, a, t, p, i, n}.
 */
export interface CvcWord {
  /** The CVC word in lowercase (e.g. `"sat"`, `"pin"`). */
  word: string;
  /**
   * Ordered tuple of the three individual phonemes.
   * Each element is a single lowercase letter from the SATPIN set.
   *
   * @example ["s", "a", "t"]
   */
  phonemes: [string, string, string];
  /** Emoji that visually represents the word, used on answer tiles. */
  emoji: string;
}
