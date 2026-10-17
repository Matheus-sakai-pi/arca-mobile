import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import { initialUnit } from '../src/data/lessons.ts';
import { wrongAnswer } from '../tests/learningFixtures.ts';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const base = process.env.ARCA_QA_URL ?? 'http://127.0.0.1:8084';
const browser = await chromium.launch({ headless: true, channel: 'chrome', args: ['--no-proxy-server'] });
const errors = [];
const lesson = initialUnit.lessons[0];
await mkdir('artifacts/screenshots/lesson-retry', { recursive: true });
async function answer(page, question, expected) {
  await page.getByText(question.prompt, { exact: true }).filter({ visible: true }).first().waitFor();
  assert.equal(await page.getByRole('button', { name: 'Verificar', exact: true }).isDisabled(), true);
  if (question.type === 'classify') {
    for (const option of question.options) {
      await page.getByRole('button', { name: option.label, exact: true }).click();
      const category = question.categories.find(item => item.id === expected[option.id]);
      await page.getByRole('button', { name: 'Classificar em ' + category.label, exact: true }).click();
    }
  } else if (question.type === 'multi_select') {
    for (const id of expected) await page.getByRole('checkbox', { name: question.options.find(option => option.id === id).label, exact: true }).click();
  } else {
    await page.getByRole(question.type === 'spot_the_error' ? 'button' : 'radio', { name: question.options.find(option => option.id === expected).label, exact: true }).click();
  }
  assert.equal(await page.getByRole('button', { name: 'Verificar', exact: true }).isDisabled(), false);
  await page.getByRole('button', { name: 'Verificar', exact: true }).click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).waitFor();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}
try {
  for (const width of [320, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 640 : 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: 'Já tenho uma conta', exact: true }).waitFor({ timeout: 120000 });
    await page.getByRole('button', { name: 'Já tenho uma conta', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar sem conta', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir meu perfil' }).waitFor();
    await page.goto(base + '/learn');
    await page.getByRole('button', { name: /Começar O que é a Bíblia/ }).click();
    await page.getByText('Exercício 1/10', { exact: true }).waitFor();
    for (const [index, question] of lesson.questions.entries()) {
      await answer(page, question, index === 0 || index === 9 ? wrongAnswer(question) : question.correctAnswer);
      if (index === 0 || index === 7) await page.screenshot({ path: `artifacts/screenshots/lesson-retry/exercise-${index}-${width}.png` });
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    }
    await page.getByText('Revisão · 2 pendentes', { exact: true }).waitFor();
    await answer(page, lesson.questions[0], wrongAnswer(lesson.questions[0]));
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await answer(page, lesson.questions[9], lesson.questions[9].correctAnswer);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByText('Revisão · 1 pendente', { exact: true }).waitFor();
    await page.screenshot({ path: `artifacts/screenshots/lesson-retry/retry-${width}.png` });
    await answer(page, lesson.questions[0], lesson.questions[0].correctAnswer);
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('heading', { name: 'Lição concluída!', exact: true }).waitFor();
    const result = await page.locator('body').innerText();
    assert.match(result, /8\/10/); assert.match(result, /80%/); assert.match(result, /\+26/);
    await page.screenshot({ path: `artifacts/screenshots/lesson-retry/result-${width}.png` });
    await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    await page.getByRole('button', { name: /O que é a Bíblia\?, Concluída/ }).waitFor();
    await page.reload();
    await page.getByRole('button', { name: /O que é a Bíblia\?, Concluída/ }).waitFor();
    await page.getByRole('button', { name: /Antigo e Novo Testamento, Atual/ }).waitFor();
    console.log(`PASS ${width}px: 10 questions, 3 retries, 8/10 accuracy, 26 XP, restored completion/unlock.`);
    await context.close();
  }
  assert.deepEqual(errors, []);
} finally { await browser.close(); }
