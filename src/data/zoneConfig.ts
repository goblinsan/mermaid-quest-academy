/** Configuration for each ocean zone on the World Map. */
export interface ZoneConfig {
  /** Unique identifier for the zone. */
  id: string;
  /** Display name shown on the map card. */
  name: string;
  /** Emoji icon for the zone card. */
  icon: string;
  /** The lesson/activity ID that this zone launches. */
  activityId: string;
}

/** Ordered list of all ocean zones. */
export const ZONES: ZoneConfig[] = [
  { id: 'coral-reef', name: 'Coral Reef Cove', icon: '🐠', activityId: '1' },
  { id: 'kelp-forest', name: 'Kelp Forest', icon: '🌿', activityId: '2' },
  { id: 'sunken-ship', name: 'Sunken Ship', icon: '⚓', activityId: '3' },
  { id: 'deep-abyss', name: 'The Deep Abyss', icon: '🌑', activityId: '4' },
  { id: 'pearl-palace', name: 'Pearl Palace', icon: '🏰', activityId: '5' },
  { id: 'volcano-vent', name: 'Volcano Vent', icon: '🌋', activityId: '6' },
];

/**
 * Activity IDs that are unlocked from the very start, before any lessons are
 * completed. Must reference valid `activityId` values from `ZONES`.
 */
export const INITIAL_UNLOCKED_ACTIVITY_IDS: string[] = ['1', '2'];
