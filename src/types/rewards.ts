/** A wearable cosmetic outfit for the mermaid avatar. */
export interface MermaidOutfit {
  /** Unique identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Emoji representing the outfit. */
  emoji: string;
  /** Short description shown in the unlocks panel. */
  description: string;
}

/** A companion pet sea creature that follows the learner. */
export interface PetSeaCreature {
  /** Unique identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Emoji representing the pet. */
  emoji: string;
  /** Short description shown in the unlocks panel. */
  description: string;
  /** The SATPIN sound this pet is associated with. */
  targetSound: string;
}

/** An explorable ocean area unlocked by reading progress. */
export interface OceanArea {
  /** Unique identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Emoji representing the area. */
  emoji: string;
  /** Short description shown in the unlocks panel. */
  description: string;
}

/** The kind of achievement that triggered a milestone badge. */
export type MilestoneType = 'sound-mastered' | 'level-completed' | 'all-sounds-mastered';

/**
 * An achievement badge earned by hitting a reading milestone.
 * Badges are permanent — once earned they are never removed.
 */
export interface MilestoneBadge {
  /** Unique identifier (e.g. `"badge-master-s"`, `"badge-level-2"`). */
  id: string;
  /** Category of milestone. */
  type: MilestoneType;
  /** Display name of the badge. */
  name: string;
  /** Emoji shown on the badge card. */
  emoji: string;
  /** Short description explaining what the badge represents. */
  description: string;
  /** Bonus pearls awarded the first time this badge is earned. */
  pearlBonus: number;
  /** ID of a `MermaidOutfit` unlocked by earning this badge, if any. */
  unlocksOutfitId?: string;
  /** ID of a `PetSeaCreature` unlocked by earning this badge, if any. */
  unlocksPetId?: string;
  /** ID of an `OceanArea` unlocked by earning this badge, if any. */
  unlocksAreaId?: string;
}
