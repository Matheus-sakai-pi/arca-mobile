import type { Question, QuestionAnswer } from '../types/learning.ts';

type QuestionDefinition = {
  valid: (question: Question, answer: unknown) => boolean;
  complete: (question: Question, answer: QuestionAnswer) => boolean;
  correct: (question: Question, answer: QuestionAnswer) => boolean;
  solution: (question: Question) => string;
};
const optionLabel = (question: Question, id: string) => question.options.find(option => option.id === id)?.label ?? id;
export function isAnswerList(answer: unknown): answer is readonly string[] {
  return Array.isArray(answer) && answer.every(id => typeof id === 'string');
}
export function isAnswerPairs(answer: unknown): answer is Readonly<Record<string, string>> {
  return typeof answer === 'object' && answer !== null && !Array.isArray(answer) && Object.values(answer).every(id => typeof id === 'string');
}
function validList(question: Question, answer: unknown) {
  return isAnswerList(answer) && new Set(answer).size === answer.length && answer.every(id => question.options.some(option => option.id === id));
}
const single: QuestionDefinition = {
  valid: (question, answer) => typeof answer === 'string' && question.options.some(option => option.id === answer),
  complete: () => true,
  correct: (question, answer) => answer === question.correctAnswer,
  solution: question => typeof question.correctAnswer === 'string' ? optionLabel(question, question.correctAnswer) : '',
};
const definitions: Record<Question['type'], QuestionDefinition> = {
  content_card: { valid: (_question,answer) => answer === 'seen', complete: () => true, correct: () => true, solution: () => '' },
  multiple_choice: single,
  true_false: single,
  fill_blank: single,
  who_am_i: single,
  odd_one_out: single,
  before_after: single,
  sequence: single,
  cause_effect: single,
  quote_character: single,
  spot_the_error: single,
  story_summary: single,
  fix_sentence: {
    valid: (question, answer) => question.type === 'fix_sentence' && isAnswerPairs(answer)
      && Object.keys(answer).every(key => key === 'fragment' || key === 'replacement')
      && (!answer.fragment || question.fragments.some(part => part.id === answer.fragment))
      && (!answer.replacement || question.options.some(option => option.id === answer.replacement)),
    complete: (_question, answer) => isAnswerPairs(answer) && !!answer.fragment && !!answer.replacement,
    correct: (question, answer) => question.type === 'fix_sentence' && isAnswerPairs(answer)
      && answer.fragment === question.correctAnswer.fragment && answer.replacement === question.correctAnswer.replacement,
    solution: question => question.type === 'fix_sentence' ? question.fragments.map(part => part.id === question.correctAnswer.fragment ? optionLabel(question, question.correctAnswer.replacement) : part.label).join(' ') : '',
  },
  classify: {
    valid: (question, answer) => question.type === 'classify' && isAnswerPairs(answer)
      && Object.keys(answer).every(id => question.options.some(option => option.id === id))
      && Object.values(answer).every(id => question.categories.some(category => category.id === id)),
    complete: (question, answer) => isAnswerPairs(answer) && Object.keys(answer).length === question.options.length,
    correct: (question, answer) => question.type === 'classify' && isAnswerPairs(answer) && question.options.every(option => answer[option.id] === question.correctAnswer[option.id]),
    solution: question => question.type === 'classify' ? question.categories.map(category => `${category.label}: ${question.options.filter(option => question.correctAnswer[option.id] === category.id).map(option => option.label).join(', ')}`).join('; ') : '',
  },
  multi_select: {
    valid: validList,
    complete: (_question, answer) => isAnswerList(answer) && answer.length > 0,
    correct: (question, answer) => question.type === 'multi_select' && isAnswerList(answer) && answer.length === question.correctAnswer.length && answer.every(id => question.correctAnswer.includes(id)),
    solution: question => question.type === 'multi_select' ? question.correctAnswer.map(id => optionLabel(question, id)).join(', ') : '',
  },
  ordering: {
    valid: validList,
    complete: (question, answer) => isAnswerList(answer) && answer.length === question.options.length,
    correct: (question, answer) => question.type === 'ordering' && isAnswerList(answer) && answer.every((id, index) => id === question.correctAnswer[index]),
    solution: question => question.type === 'ordering' ? question.correctAnswer.map(id => optionLabel(question, id)).join(' → ') : '',
  },
  matching: {
    valid: (question, answer) => question.type === 'matching' && isAnswerPairs(answer)
      && Object.keys(answer).every(id => question.options.some(option => option.id === id))
      && Object.values(answer).every(id => question.rightOptions.some(option => option.id === id))
      && new Set(Object.values(answer)).size === Object.keys(answer).length,
    complete: (question, answer) => isAnswerPairs(answer) && Object.keys(answer).length === question.options.length,
    correct: (question, answer) => question.type === 'matching' && isAnswerPairs(answer) && question.options.every(option => answer[option.id] === question.correctAnswer[option.id]),
    solution: question => question.type === 'matching' ? question.options.map(option => `${option.label}: ${question.rightOptions.find(right => right.id === question.correctAnswer[option.id])?.label ?? ''}`).join('; ') : '',
  },
};
export function isValidAnswer(question: Question, answer: unknown): answer is QuestionAnswer {
  return definitions[question.type].valid(question, answer);
}
export function canVerify(question: Question, answer: unknown): answer is QuestionAnswer {
  return isValidAnswer(question, answer) && definitions[question.type].complete(question, answer);
}
export function evaluateQuestion(question: Question, answer: unknown): boolean {
  return canVerify(question, answer) && definitions[question.type].correct(question, answer);
}
export function correctResponse(question: Question): string {
  return definitions[question.type].solution(question);
}
export function copyAnswer(answer: QuestionAnswer): QuestionAnswer {
  return typeof answer === 'string' ? answer : isAnswerList(answer) ? [...answer] : { ...answer };
}

export function isValidQuestion(question: Question): boolean {
  if (question.type === 'content_card') return !!question.id && !!question.prompt && typeof question.body === 'string' && !!question.body.trim() && Array.isArray(question.options) && question.options.length === 0 && question.correctAnswer === 'seen';
  if (!question.id || !question.prompt || !question.explanation || question.options.length < 2
    || question.options.some(option => !option.id || !option.label)
    || new Set(question.options.map(option => option.id)).size !== question.options.length
    || !canVerify(question, question.correctAnswer) || !evaluateQuestion(question, question.correctAnswer)) return false;
  if (question.type === 'fill_blank' && question.sentence.split('{{blank}}').length !== 2) return false;
  if (question.type === 'who_am_i' && (question.clues.length < 2 || question.clues.some(clue => !clue.trim()))) return false;
  if (question.type === 'multi_select' && question.correctAnswer.length < 2) return false;
  if (question.type === 'matching' && (question.rightOptions.length !== question.options.length
    || question.rightOptions.some(option => !option.id || !option.label)
    || new Set(question.rightOptions.map(option => option.id)).size !== question.rightOptions.length)) return false;
  if (question.type === 'true_false' && (question.options.length !== 2 || !question.options.some(option => option.id === 'true') || !question.options.some(option => option.id === 'false'))) return false;
  if (question.type === 'odd_one_out' && question.options.length !== 4) return false;
  if (question.type === 'before_after' && question.options.length !== 2) return false;
  if (question.type === 'sequence' && (question.sequence.length < 3 || question.sequence.filter(item => item === null).length !== 1 || question.sequence.some(item => item !== null && !item.trim()))) return false;
  if (question.type === 'classify' && (question.categories.length !== 2 || question.categories.some(category => !category.id || !category.label) || new Set(question.categories.map(category => category.id)).size !== 2)) return false;
  if (question.type === 'fix_sentence' && (question.fragments.length < 2 || question.fragments.some(part => !part.id || !part.label) || new Set(question.fragments.map(part => part.id)).size !== question.fragments.length)) return false;
  if (question.type === 'cause_effect' && (!question.event.trim() || !['cause','effect'].includes(question.relation))) return false;
  if (question.type === 'quote_character' && (!question.quote.trim() || !question.source.trim())) return false;
  if (question.type === 'story_summary' && (question.options.length !== 3 || !question.contentId)) return false;
  return true;
}
