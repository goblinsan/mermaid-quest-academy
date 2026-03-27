import lessonsData from '../data/lessons.json';
import type { Lesson } from '../types/lesson';

const lessons = lessonsData as Lesson[];

/**
 * Returns the lesson matching the given `id`, or `undefined` if not found.
 *
 * @param id - The lesson identifier (matches the activity route param).
 */
export function getLessonById(id: string): Lesson | undefined {
  return lessons.find((lesson) => lesson.id === id);
}

/**
 * Returns all lessons in their defined order.
 */
export function getAllLessons(): Lesson[] {
  return lessons;
}
