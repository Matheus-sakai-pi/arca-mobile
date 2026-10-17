import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
const source=async(path:string)=>readFile(new URL('../src/'+path,import.meta.url),'utf8');

test('compact study summary keeps real counts, resume identity and both study destinations',async()=>{
  const summary=await source('components/learning/StudySummary.tsx');
  for(const logic of ['dailyExercises(state.history,day)','dueReviews(state.history,unit,progress.completedLessonIds)','draft(lesson)','params:{id:resume.id}']) assert.ok(summary.includes(logic));
  assert.match(summary,/<ProgressBar compact/);
  assert.match(summary,/accessibilityLabel=\{`Retomar: \$\{resume.title\}`\}/);
  assert.match(summary,/Continuar estudando/);
  for(const route of ['/study/review','/study/history']) assert.ok(summary.includes(route));
  assert.doesNotMatch(summary,/<Button|finishLesson|completeLesson|setItem/);
  const home=await source('app/(tabs)/home.tsx');
  assert.doesNotMatch(home,/SectionTitle/);
  assert.match(home,/accessibilityRole="header">Nesta unidade/);
});

test('account action groups preserve safeguards and isolate the destructive entry',async()=>{
  const profile=await source('app/(tabs)/profile.tsx');
  for(const title of ['Conta','Suporte','Sessão']) assert.ok(profile.includes(`<ProfileActionGroup title="${title}">`));
  assert.match(profile,/title="Excluir conta" icon=\{Trash2\} danger/);
  assert.match(profile,/!isGuest \? <View style=\{actionStyles.danger\}/);
  for(const label of ['Editar perfil','Alterar senha','Salve seu progresso','Histórico de estudo','Ajuda e suporte','Política de Privacidade']) assert.ok(profile.includes(label));
  assert.match(profile,/disabled=\{offline \|\| !!busy\}/);
  assert.match(profile,/disabled=\{!!busy \|\| resetSent\}/);
  assert.match(profile,/router.push\('\/account\/delete'\)/);
  const row=await source('components/profile/ProfileActionList.tsx');
  assert.match(row,/accessibilityState=\{\{disabled:disabled \|\| loading,busy:loading\}\}/);
  assert.match(row,/minHeight:56/);
  assert.match(row,/colors.error : colors.text/);
});

test('compact progress is opt-in, retaining the default animated bars and motion preferences',async()=>{
  const bar=await source('components/animation/AnimatedProgressBar.tsx');
  assert.match(bar,/compact=false/);
  assert.match(bar,/compactTrack:\{height:8,borderWidth:0/);
  assert.match(bar,/useMotionPreference/);
  assert.match(bar,/ReduceMotion.System/);
  assert.match(bar,/height:16/);
});
