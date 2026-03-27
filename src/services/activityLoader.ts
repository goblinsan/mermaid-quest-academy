import activitiesData from '../data/readingActivities.json';
import type { PhonicsActivityConfig } from '../types/activity';

/**
 * Reading activity definitions loaded from the JSON data file.
 * Cast is safe because the JSON shape is validated by the TypeScript compiler
 * through the `PhonicsActivityConfig` type.
 */
const activities: PhonicsActivityConfig[] = activitiesData as PhonicsActivityConfig[];

/**
 * Returns the phonics activity with the given id, or `undefined` if not found.
 *
 * @example
 * ```ts
 * const config = getReadingActivityById('ra-1');
 * if (config) { … }
 * ```
 */
export function getReadingActivityById(id: string): PhonicsActivityConfig | undefined {
  return activities.find((a) => a.id === id);
}

/**
 * Returns all registered reading/phonics activity configs in their defined order.
 *
 * @example
 * ```ts
 * const all = getAllReadingActivities();
 * all.forEach(config => prefetchAudio(config.prompt.ttsText));
 * ```
 */
export function getAllReadingActivities(): PhonicsActivityConfig[] {
  return activities;
}
