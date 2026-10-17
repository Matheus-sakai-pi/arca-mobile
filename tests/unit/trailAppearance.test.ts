import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialUnit } from '../../src/data/lessons.ts';
import { UNIT_TRAIL_COLORS, darkerTrailColor, savedLessonPercent, unitTrailTheme } from '../../src/lib/trailAppearance.ts';
import { createAttempt, reduceAttempt } from '../../src/lib/lessonEngine.ts';
import { lessonFingerprint, type LessonDraft } from '../../src/lib/studyStore.ts';

test('all ten unit colors match the requested palette and have genuinely darker sides', () => {
  assert.deepEqual(UNIT_TRAIL_COLORS, ['#0964FF', '#22C55E', '#8B3DFF', '#FF8A00', '#FF4FA3', '#F43F3F', '#00B5C2', '#FFC107', '#B5763C', '#1E3A8A']);
  UNIT_TRAIL_COLORS.forEach((color, index) => {
    assert.equal(unitTrailTheme(index).color, color);
    for (const offset of [1, 3, 5]) assert.ok(parseInt(darkerTrailColor(color).slice(offset, offset + 2), 16) <= parseInt(color.slice(offset, offset + 2), 16));
    assert.notEqual(unitTrailTheme(index).side, color);
    const luminance = (hex: string) => [1, 3, 5].map(offset => {
      const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
      return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    }).reduce((total, value, channel) => total + value * [0.2126, 0.7152, 0.0722][channel]!, 0);
    const text = luminance(unitTrailTheme(index).ink), background = luminance(color);
    assert.ok((Math.max(text, background) + 0.05) / (Math.min(text, background) + 0.05) >= 4.5, `Unit ${index + 1} banner text must meet AA contrast`);
  });
});

test('current lesson ring uses restored mastered exercises, not selected answers or fabricated percentages', () => {
  const lesson = initialUnit.lessons[0]!;
  let state = createAttempt();
  const draft = (): LessonDraft => ({ attemptId: 'ring-test', fingerprint: lessonFingerprint(lesson), state, updatedAt: new Date().toISOString() });
  assert.equal(savedLessonPercent(lesson, undefined), 0);
  state = reduceAttempt(lesson, state, { type: 'answer', answer: lesson.questions[0]!.correctAnswer });
  assert.equal(savedLessonPercent(lesson, draft()), 0);
  for (const question of lesson.questions.slice(0, 4)) {
    state = reduceAttempt(lesson, state, { type: 'answer', answer: question.correctAnswer });
    state = reduceAttempt(lesson, state, { type: 'verify' });
    state = reduceAttempt(lesson, state, { type: 'continue' });
  }
  assert.equal(savedLessonPercent(lesson, draft()), 40);
  assert.equal(savedLessonPercent(lesson, { ...draft(), fingerprint: 'outdated-lesson' }), 0);
  assert.equal(savedLessonPercent(lesson, { ...draft(), state: { ...state, mastered: ['unknown'] } }), 0);
});
