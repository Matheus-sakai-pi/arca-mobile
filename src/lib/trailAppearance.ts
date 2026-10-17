import type { Lesson } from '../types/learning.ts';
import { restoredDraft, type LessonDraft } from './studyStore.ts';

export const UNIT_TRAIL_COLORS = ['#0964FF', '#22C55E', '#8B3DFF', '#FF8A00', '#FF4FA3', '#F43F3F', '#00B5C2', '#FFC107', '#B5763C', '#1E3A8A'] as const;
export function darkerTrailColor(color: string): string {
  return '#' + [1, 3, 5].map(offset => Math.round(parseInt(color.slice(offset, offset + 2), 16) * 0.74).toString(16).padStart(2, '0')).join('').toUpperCase();
}
export function unitTrailTheme(index: number) {
  const color = UNIT_TRAIL_COLORS[index] ?? UNIT_TRAIL_COLORS[0];
  return { color, side: darkerTrailColor(color), ink: [1, 3, 4, 5, 6, 7, 8].includes(index) ? '#101828' : '#FFFFFF' };
}
export function savedLessonPercent(lesson: Lesson, saved: LessonDraft | undefined): number {
  const draft = restoredDraft(lesson, saved);
  const exercises = lesson.questions.filter(question => question.type !== 'content_card');
  if (!draft || !exercises.length) return 0;
  const mastered = new Set(draft.state.mastered);
  return Math.round(exercises.filter(question => mastered.has(question.id)).length / exercises.length * 100);
}
