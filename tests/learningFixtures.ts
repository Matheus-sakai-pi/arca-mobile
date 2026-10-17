import type { Lesson, LessonAnswers, Question, QuestionAnswer } from '../src/types/learning.ts';

export function wrongAnswer(question: Question): QuestionAnswer {
  if (question.type === 'content_card') return 'seen';
  if (question.type === 'fix_sentence') return { ...question.correctAnswer, replacement:question.options.find(option=>option.id !== question.correctAnswer.replacement)!.id };
  if (question.type === 'classify') { const id=question.options[0]!.id; return {...question.correctAnswer,[id]:question.categories.find(category=>category.id !== question.correctAnswer[id])!.id}; }
  if (typeof question.correctAnswer === 'string') return question.options.find(option => option.id !== question.correctAnswer)!.id;
  if (question.type === 'ordering') return [...question.correctAnswer].reverse();
  if (question.type === 'multi_select') return [question.options.find(option => !question.correctAnswer.includes(option.id))?.id ?? question.correctAnswer[0]!];
  if (question.type === 'matching') {
    const keys = Object.keys(question.correctAnswer);
    const first = keys[0]!;
    const second = keys[1]!;
    return { ...question.correctAnswer, [first]: question.correctAnswer[second]!, [second]: question.correctAnswer[first]! };
  }
  throw new Error('Fixture needs an answer for this question type.');
}
export function answersFor(lesson: Lesson, correct = lesson.questions.filter(question => question.type !== 'content_card').length): LessonAnswers {
  let index=0;
  return Object.fromEntries(lesson.questions.map(question => [question.id, question.type === 'content_card' || index++ < correct ? question.correctAnswer : wrongAnswer(question)]));
}
