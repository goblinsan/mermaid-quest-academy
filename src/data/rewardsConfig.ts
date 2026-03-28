import type { MermaidOutfit, PetSeaCreature, OceanArea, MilestoneBadge } from '../types/rewards';

// ---------------------------------------------------------------------------
// Pearl reward rates (issues #102, #103)
// ---------------------------------------------------------------------------

/**
 * Base pearls awarded for completing an activity at each difficulty level.
 * Higher levels feel more rewarding without flooding the early economy.
 */
export const PEARLS_PER_ACTIVITY_LEVEL: Record<number, number> = {
  1: 2,
  2: 3,
  3: 4,
  4: 5,
};

/** Bonus pearls awarded when the learner answers correctly on their first try. */
export const PEARLS_CORRECT_BONUS = 1;

/**
 * Bonus pearls awarded when a full session (all activities) is completed.
 * Applied once per session on top of the per-activity totals.
 */
export const PEARLS_SESSION_COMPLETION_BONUS = 5;

// ---------------------------------------------------------------------------
// Mermaid outfits (issue #104)
// ---------------------------------------------------------------------------

/** Cosmetic outfits unlocked by advancing through phonics levels. */
export const MERMAID_OUTFITS: MermaidOutfit[] = [
  {
    id: 'outfit-coral',
    name: 'Coral Fins',
    emoji: '🌺',
    description: 'Coral-red fins earned by completing your first letter sounds.',
  },
  {
    id: 'outfit-pearl',
    name: 'Pearl Necklace',
    emoji: '🦪',
    description: 'A shimmering pearl necklace earned by mastering sound & object matching.',
  },
  {
    id: 'outfit-crown',
    name: 'Golden Crown',
    emoji: '👑',
    description: 'A radiant golden crown earned by conquering sound sorting challenges.',
  },
  {
    id: 'outfit-queen',
    name: 'Ocean Queen',
    emoji: '🌊',
    description: 'The full Ocean Queen regalia, earned by mastering word blending!',
  },
];

// ---------------------------------------------------------------------------
// Pet sea creatures (issue #104)
// ---------------------------------------------------------------------------

/** Companion pets unlocked by mastering each SATPIN sound. */
export const PET_SEA_CREATURES: PetSeaCreature[] = [
  {
    id: 'pet-seahorse',
    name: 'Sandy the Seahorse',
    emoji: '🐴',
    description: 'A golden seahorse who loves the /s/ sound.',
    targetSound: 's',
  },
  {
    id: 'pet-clam',
    name: 'Amara the Clam',
    emoji: '🐚',
    description: 'A shimmering clam who cheers for the /a/ sound.',
    targetSound: 'a',
  },
  {
    id: 'pet-turtle',
    name: 'Tide the Turtle',
    emoji: '🐢',
    description: 'A wise turtle who moves to the rhythm of the /t/ sound.',
    targetSound: 't',
  },
  {
    id: 'pet-pufferfish',
    name: 'Pippa the Pufferfish',
    emoji: '🐡',
    description: 'A bouncy pufferfish who pops with the /p/ sound.',
    targetSound: 'p',
  },
  {
    id: 'pet-icefish',
    name: 'Iris the Icefish',
    emoji: '🐠',
    description: 'A shiny icefish who glitters for the /i/ sound.',
    targetSound: 'i',
  },
  {
    id: 'pet-narwhal',
    name: 'Neptune the Narwhal',
    emoji: '🦄',
    description: "A magical narwhal whose horn sings the /n/ sound.",
    targetSound: 'n',
  },
];

// ---------------------------------------------------------------------------
// Ocean areas (issue #104)
// ---------------------------------------------------------------------------

/** Extra ocean areas unlocked by advancing through phonics levels. */
export const OCEAN_AREAS: OceanArea[] = [
  {
    id: 'area-starfish-shores',
    name: 'Starfish Shores',
    emoji: '⭐',
    description: 'Sun-warmed shores teeming with starfish — unlocked at Level 2.',
  },
  {
    id: 'area-crystal-caves',
    name: 'Crystal Caves',
    emoji: '💎',
    description: 'Glittering crystal caves of wonder — unlocked at Level 3.',
  },
  {
    id: 'area-deep-sea-kingdom',
    name: 'Deep Sea Kingdom',
    emoji: '🏰',
    description: 'The legendary Deep Sea Kingdom — unlocked by mastering word blending!',
  },
];

// ---------------------------------------------------------------------------
// Milestone badges (issues #104, #105)
// ---------------------------------------------------------------------------

/**
 * Achievement badges for reading milestones.
 * Each badge is earned once its condition is first satisfied and is
 * then permanently stored in the learner's progression.
 */
export const MILESTONE_BADGES: MilestoneBadge[] = [
  // --- Sound mastery badges (one per SATPIN sound) ---
  {
    id: 'badge-master-s',
    type: 'sound-mastered',
    name: 'S Sound Star',
    emoji: '⭐',
    description: 'You mastered the /s/ sound!',
    pearlBonus: 10,
    unlocksPetId: 'pet-seahorse',
  },
  {
    id: 'badge-master-a',
    type: 'sound-mastered',
    name: 'A Sound Star',
    emoji: '⭐',
    description: 'You mastered the /a/ sound!',
    pearlBonus: 10,
    unlocksPetId: 'pet-clam',
  },
  {
    id: 'badge-master-t',
    type: 'sound-mastered',
    name: 'T Sound Star',
    emoji: '⭐',
    description: 'You mastered the /t/ sound!',
    pearlBonus: 10,
    unlocksPetId: 'pet-turtle',
  },
  {
    id: 'badge-master-p',
    type: 'sound-mastered',
    name: 'P Sound Star',
    emoji: '⭐',
    description: 'You mastered the /p/ sound!',
    pearlBonus: 10,
    unlocksPetId: 'pet-pufferfish',
  },
  {
    id: 'badge-master-i',
    type: 'sound-mastered',
    name: 'I Sound Star',
    emoji: '⭐',
    description: 'You mastered the /i/ sound!',
    pearlBonus: 10,
    unlocksPetId: 'pet-icefish',
  },
  {
    id: 'badge-master-n',
    type: 'sound-mastered',
    name: 'N Sound Star',
    emoji: '⭐',
    description: 'You mastered the /n/ sound!',
    pearlBonus: 10,
    unlocksPetId: 'pet-narwhal',
  },
  // --- Level completion badges ---
  {
    id: 'badge-level-1',
    type: 'level-completed',
    name: 'Letter Sounds Explorer',
    emoji: '🐚',
    description: 'You completed Level 1 – Letter Sounds!',
    pearlBonus: 15,
    unlocksOutfitId: 'outfit-coral',
  },
  {
    id: 'badge-level-2',
    type: 'level-completed',
    name: 'Sound & Object Champion',
    emoji: '🐟',
    description: 'You completed Level 2 – Sound & Object Matching!',
    pearlBonus: 15,
    unlocksOutfitId: 'outfit-pearl',
    unlocksAreaId: 'area-starfish-shores',
  },
  {
    id: 'badge-level-3',
    type: 'level-completed',
    name: 'Sorting Superstar',
    emoji: '🏴‍☠️',
    description: 'You completed Level 3 – Sorting Sounds!',
    pearlBonus: 15,
    unlocksOutfitId: 'outfit-crown',
    unlocksAreaId: 'area-crystal-caves',
  },
  {
    id: 'badge-level-4',
    type: 'level-completed',
    name: 'Word Blending Master',
    emoji: '🌊',
    description: 'You completed Level 4 – Word Blending!',
    pearlBonus: 20,
    unlocksOutfitId: 'outfit-queen',
    unlocksAreaId: 'area-deep-sea-kingdom',
  },
  // --- All sounds mastered ---
  {
    id: 'badge-all-sounds',
    type: 'all-sounds-mastered',
    name: 'SATPIN Champion',
    emoji: '🏆',
    description: 'You mastered ALL the SATPIN sounds — incredible!',
    pearlBonus: 25,
  },
];
