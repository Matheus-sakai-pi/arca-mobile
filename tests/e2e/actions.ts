import { expect, type Page, type TestInfo } from '@playwright/test';
import type { Question, QuestionAnswer } from '../../src/types/learning.ts';

export async function chooseAnswer(page: Page, question: Question, answer: QuestionAnswer) {
  if (question.type === 'classify') {
    const value = answer as Record<string, string>;
    for (const option of question.options) {
      await page.getByRole('button', { name: option.label, exact: true }).click();
      const category = question.categories!.find(item => item.id === value[option.id])!;
      await page.getByRole('button', { name: `Classificar em ${category.label}`, exact: true }).click();
    }
  } else if (question.type === 'multi_select') {
    for (const id of answer as string[]) {
      await page.getByRole('checkbox', { name: question.options.find(option => option.id === id)!.label, exact: true }).click();
    }
  } else {
    await page.getByRole(question.type === 'spot_the_error' ? 'button' : 'radio', {
      name: question.options.find(option => option.id === answer)!.label, exact: true,
    }).click();
  }
}

export async function verifyAnswer(page: Page, question: Question, answer = question.correctAnswer) {
  const verify = page.getByRole('button', { name: 'Verificar', exact: true });
  await expect(verify).toBeDisabled();
  await chooseAnswer(page, question, answer);
  await expect(verify).toBeEnabled(); await verify.click();
  await page.getByRole('button', { name: 'Continuar', exact: true }).click();
}

export async function capture(page: Page, info: TestInfo, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(img => img.decode().catch(() => undefined)));
  });
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const path = info.outputPath(`${name}.png`);
  await page.screenshot({ path, fullPage: true });
  await info.attach(name, { path, contentType: 'image/png' });
}
