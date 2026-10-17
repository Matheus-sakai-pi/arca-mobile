import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { learningUnits } from '../src/data/lessons.ts';
import { evaluateQuestion, isValidQuestion } from '../src/lib/questionEngine.ts';
import type { Unit } from '../src/types/learning.ts';

export function auditCurriculum(units: readonly Unit[]) {
  const issues: { lessonId: string; questionId: string; code: string }[] = [];
  const ids = new Set<string>();
  const formats: Record<string, number> = {};
  let exercises=0, readings=0;
  for (const unit of units) for (const lesson of unit.lessons) {
    const graded=lesson.questions.filter(q=>q.type !== 'content_card');
    if(graded.length !== 10) issues.push({lessonId:lesson.id,questionId:'',code:'exercise_count'});
    if(new Set(graded.map(q=>q.type)).size < 3) issues.push({lessonId:lesson.id,questionId:'',code:'insufficient_variety'});
    for(const question of lesson.questions) {
      if(ids.has(question.id)) issues.push({lessonId:lesson.id,questionId:question.id,code:'duplicate_id'});
      ids.add(question.id);
      if(!isValidQuestion(question) || !evaluateQuestion(question,question.correctAnswer)) issues.push({lessonId:lesson.id,questionId:question.id,code:'invalid_answer_or_structure'});
      const labels=question.options.map(option=>option.label.trim().toLocaleLowerCase('pt-BR'));
      if(new Set(labels).size !== labels.length) issues.push({lessonId:lesson.id,questionId:question.id,code:'ambiguous_duplicate_options'});
      if(question.type === 'matching' && new Set(question.rightOptions.map(option=>option.label.trim().toLocaleLowerCase('pt-BR'))).size !== question.rightOptions.length) issues.push({lessonId:lesson.id,questionId:question.id,code:'ambiguous_matching'});
      if(question.type === 'story_summary' && !lesson.questions.some(q=>q.type === 'content_card' && q.id === question.contentId)) issues.push({lessonId:lesson.id,questionId:question.id,code:'missing_reading'});
      if(question.type === 'content_card') readings++;else exercises++;
      formats[question.type]=(formats[question.type] ?? 0)+1;
    }
  }
  return {units:units.length,lessons:units.reduce((n,unit)=>n+unit.lessons.length,0),exercises,readings,formats,issues};
}
if(process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const audit=auditCurriculum(learningUnits);
  await mkdir('artifacts/content-review',{recursive:true});
  await writeFile('artifacts/content-review/audit.json',JSON.stringify(audit,null,2)+'\n');
  const rows=learningUnits.flatMap((unit,i)=>unit.lessons.map((lesson,j)=>({unit:i+1,lesson:j+1,id:lesson.id,title:lesson.title,reference:lesson.description,questions:lesson.questions})));
  await writeFile('artifacts/content-review/catalog.json',JSON.stringify(rows,null,2)+'\n');
  console.log(JSON.stringify(audit,null,2));
  if(audit.issues.length)process.exitCode=1;
}
