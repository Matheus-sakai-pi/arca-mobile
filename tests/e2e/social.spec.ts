import { test, expect } from './fixtures';
import { initialUnit } from '../../src/data/lessons.ts';
import { capture, chooseAnswer } from './actions';
import type { Question, QuestionAnswer } from '../../src/types/learning.ts';

test('search, friendship consent, ten-question challenge, resume and lost-receipt retry', async ({ page, context, backend }, info) => {
  await backend.install(context); await page.goto('/friends');
  await expect(page.getByText(`@${backend.username}`, { exact: true })).toBeVisible();
  await expect(page.getByText('Você ainda não tem amizades aceitas.', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Atualizar amigos', exact: true })).toBeEnabled();
  await page.getByLabel('Buscar por usuário', { exact: true }).fill(backend.friendName);
  await page.getByRole('button', { name: 'Buscar pessoas', exact: true }).click();
  await expect.poll(() => backend.calls.some(call => call.name === 'search_learning_people')).toBe(true);
  await page.getByRole('button', { name: `Adicionar @${backend.friendName}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pedidos enviados · 1', exact: true })).toBeVisible();
  const before = await backend.rpc<{ friends: unknown[] }>('learning_friends'); expect(before.friends).toHaveLength(0);
  await backend.rpc('learning_friend_action', { p_person: backend.owner, p_action: 'accept' }, backend.friend);
  await page.getByRole('button', { name: 'Atualizar amigos', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Meus amigos · 1', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Desafios entre amigos', exact: true }).click();
  await page.getByRole('button', { name: 'Desafiar amigo', exact: true }).click();
  await page.getByRole('button', { name: `Desafiar @${backend.friendName}`, exact: true }).click();
  await expect(page.getByText('Aguardando aceite', { exact: true })).toBeVisible();
  const invite = backend.calls.find(call => call.name === 'learning_challenge_create_ten')!;
  expect(invite.body.p_friend).toBe(backend.friend);
  const id = (await backend.db.query<{ id: string }>('select id from learning_challenges where sender=$1', [backend.owner])).rows[0]!.id;
  await backend.rpc('learning_challenge_action', { p_id: id, p_action: 'accept' }, backend.friend);
  await page.getByRole('button', { name: 'Atualizar desafios', exact: true }).click();
  await page.getByRole('button', { name: 'Começar desafio', exact: true }).click();
  const frozen = (await backend.db.query<{ questions: { id: string; type: string; prompt: string; content: { correctAnswer: QuestionAnswer } }[] }>('select questions from learning_challenges where id=$1', [id])).rows[0]!.questions;
  expect(frozen).toHaveLength(10);
  const answers = Object.fromEntries(frozen.map(q => [q.id, q.content.correctAnswer]));
  const publicPlay = await backend.rpc<{ questions: { content: object }[] }>('learning_challenge_play', { p_id: id });
  expect(publicPlay.questions.every(q => !('correctAnswer' in q.content))).toBe(true);
  for (const [index, row] of frozen.entries()) {
    await expect(page.getByText(`Pergunta ${index + 1}/10`, { exact: true })).toBeVisible();
    const question = { id: row.id, type: row.type, prompt: row.prompt, explanation: '', ...row.content } as Question;
    await chooseAnswer(page, question, answers[row.id]!);
    await page.getByRole('button', { name: 'Próxima pergunta', exact: true }).click();
    if (index === 2) { await page.reload(); await expect(page.getByText('Pergunta 4/10', { exact: true })).toBeVisible(); }
  }
  backend.failNext('learning_challenge_submit', true);
  await page.getByRole('button', { name: 'Enviar respostas', exact: true }).click();
  await expect(page.getByText('Não foi possível concluir. Confira sua conexão e tente novamente.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Enviar respostas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Respostas recebidas', exact: true })).toBeVisible();
  const submissions = backend.calls.filter(call => call.name === 'learning_challenge_submit');
  expect(submissions).toHaveLength(2); expect(submissions[0]!.body).toEqual(submissions[1]!.body);
  expect(submissions[0]!.body.p_answers).toEqual(answers);
  expect((await backend.db.query('select * from learning_challenge_results where challenge_id=$1 and user_id=$2', [id, backend.owner])).rows).toHaveLength(1);
  await backend.rpc('learning_challenge_submit', { p_id: id, p_answers: answers }, backend.friend);
  await page.getByRole('button', { name: 'Ver resultado', exact: true }).click();
  await expect(page.getByText('Empate', { exact: true })).toBeVisible();
  await expect(page.getByText(`Você: 10/10 · @${backend.friendName}: 10/10`, { exact: true })).toBeVisible();
  expect((await backend.db.query<{ xp_total: number }>('select xp_total from profiles where id=$1', [backend.owner])).rows[0]!.xp_total).toBe(0);
  await capture(page, info, 'challenge-result');
});

test('total, weekly and friends rankings change scope, render assets and recover from failure', async ({ page, context, backend }, info) => {
  await backend.completeLessons(1); await backend.befriend(); await backend.install(context);
  await page.goto('/ranking');
  await expect(page.getByTestId('leaderboard-podium')).toBeVisible();
  await expect(page.getByTestId('ranking-stats')).toContainText('35 XP');
  await expect(page.getByRole('button', { name: 'Atualizar ranking', exact: true })).toBeEnabled();
  await expect(page.getByRole('tab', { name: 'XP TOTAL', exact: true })).toHaveAttribute('aria-selected', 'true');
  backend.failNext('learning_leaderboard_scope');
  await page.getByRole('tab', { name: 'XP SEMANAL', exact: true }).click();
  await expect(page.getByRole('tab', { name: 'XP SEMANAL', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Não foi possível atualizar o ranking. Confira sua conexão e tente novamente.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await expect(page.getByTestId('leaderboard-podium')).toBeVisible();
  await expect(page.getByText(/Horário de Brasília/)).toBeVisible();
  await page.getByRole('tab', { name: 'AMIGOS', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Gerenciar amigos', exact: true })).toBeVisible();
  await expect(page.getByTestId('leaderboard-podium')).toBeVisible();
  await expect(page.getByTestId('podium-identity-1')).toContainText(`@${backend.username}`);
  await capture(page, info, 'friends-ranking');
  for (const img of await page.getByTestId('leaderboard-podium').locator('img').all()) {
    expect(await img.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  const number = await page.getByTestId('podium-rank-1').boundingBox();
  const identity = await page.getByTestId('podium-identity-1').boundingBox();
  expect(number!.y + number!.height).toBeLessThanOrEqual(identity!.y + 1);
  expect(backend.calls.some(call => call.name === 'learning_leaderboard_scope' && call.body.p_scope === 'weekly')).toBe(true);
  expect(backend.calls.some(call => call.name === 'learning_leaderboard_scope' && call.body.p_scope === 'friends')).toBe(true);
});

test('guest cannot submit reports or challenges', async ({ page, context, backend }) => {
  await backend.install(context, true); await page.goto('/challenges');
  await expect(page.getByText('Entre na sua conta para participar.', { exact: true })).toBeVisible();
  await page.goto(`/lesson/${initialUnit.lessons[0]!.id}`);
  await page.getByRole('button', { name: 'Reportar problema na pergunta', exact: true }).click();
  await expect(page.getByText('Entre na sua conta para enviar relatos. Você pode continuar esta lição normalmente.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Voltar à lição', exact: true }).click();
  expect(backend.calls.some(call => ['submit_question_report', 'learning_challenge_create_ten'].includes(call.name))).toBe(false);
});
