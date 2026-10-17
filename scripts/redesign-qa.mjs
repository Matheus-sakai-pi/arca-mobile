import { createRequire } from 'node:module';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const browser = await chromium.launch({ headless: true, channel: 'chrome' });
const errors = [];
async function checkButtonPaint(page) {
  for (const paint of await page.locator('svg[viewBox="0 0 300 100"]').all()) {
    const bounds = await paint.boundingBox();
    const button = await paint.locator('..').locator('..').boundingBox();
    assert.ok(bounds && button);
    assert.ok(button.width - bounds.width >= -1 && button.width - bounds.width <= 3, 'Gradient must cover the entire inner button width');
    assert.ok(button.height - bounds.height >= -1 && button.height - bounds.height <= 8, 'Gradient must cover the entire inner button height');
  }
}
try {
  for (const width of [320, 390, 430]) {
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 640 : 844 }, reducedMotion: 'reduce' });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') console.log('BROWSER ERROR:', message.text()); });
    await page.goto('http://localhost:8084', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.getByRole('button', { name: 'Já tenho uma conta', exact: true }).waitFor({ timeout: 60000 });
    await page.getByRole('button', { name: 'Já tenho uma conta', exact: true }).click();
    await page.getByRole('button', { name: 'Continuar sem conta', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir meu perfil' }).waitFor();
    await mkdir('artifacts/screenshots/redesign', { recursive: true });
    for (const route of ['home', 'learn', 'ranking', 'profile']) {
      await page.goto('http://localhost:8084/' + route);
      await page.waitForTimeout(2200);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      assert.equal(overflow, false, route + ' horizontal overflow at ' + width);
      await checkButtonPaint(page);
      if (route === 'learn') {
        assert.equal(await page.getByText('Um passo de cada vez.', { exact: true }).count(), 0);
        assert.ok(await page.locator('[style*="blur(2px)"]').count() > 0, 'Only the learning background is blurred');
      }
      if (route === 'ranking' || route === 'profile') {
        const title = page.getByRole('heading', { name: route === 'ranking' ? 'Ranking' : 'Perfil', exact: true });
        assert.equal(await title.evaluate(element => getComputedStyle(element.parentElement).backgroundColor), 'rgb(255, 255, 255)');
      }
      await page.screenshot({ path: 'artifacts/screenshots/redesign/' + route + '-' + width + '.png' });
      console.log(route, width, (await page.locator('body').innerText()).slice(0, 180));
    }
    await page.goto('http://localhost:8084/learn');
    await page.getByRole('button', { name: /Antigo e Novo Testamento, Bloqueada/ }).click();
    await page.getByText(/Conclua O que é a Bíblia/).waitFor();
    assert.equal(new URL(page.url()).pathname, '/learn');
    await page.screenshot({ path: 'artifacts/screenshots/redesign/locked-' + width + '.png' });
    await page.getByRole('button', { name: /Começar O que é a Bíblia/ }).click();
    await page.getByRole('button', { name: 'Sair da lição', exact: true }).waitFor();
    await page.waitForTimeout(800);
    await checkButtonPaint(page);
    await page.screenshot({ path: 'artifacts/screenshots/redesign/exercise-' + width + '.png' });
    const verify = page.getByRole('button', { name: 'Verificar', exact: true });
    if (await verify.count()) {
      assert.equal(await verify.isDisabled(), true);
      if (process.env.ARCA_QA_COMPLETE_LESSON === '1') {
        const { initialUnit } = await import('../src/data/lessons.ts');
        const question = initialUnit.lessons[0].questions[0];
        await page.getByRole('radio', { name: question.options.find(option => option.id === question.correctAnswer).label, exact: true }).click();
      } else await page.getByRole('radio').first().click();
      assert.equal(await verify.isDisabled(), false);
      await checkButtonPaint(page);
      await verify.click();
      await page.getByRole('button', { name: 'Continuar', exact: true }).waitFor();
      await page.screenshot({ path: 'artifacts/screenshots/redesign/feedback-' + width + '.png' });
    }
    if (process.env.ARCA_QA_COMPLETE_LESSON === '1') {
      const { initialUnit } = await import('../src/data/lessons.ts');
      const lesson = initialUnit.lessons[0];
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      for (const question of lesson.questions.slice(1)) {
        if (question.type === 'classify') {
          for (const option of question.options) {
            await page.getByRole('button', { name: option.label, exact: true }).click();
            const category = question.categories.find(item => item.id === question.correctAnswer[option.id]);
            await page.getByRole('button', { name: 'Classificar em ' + category.label, exact: true }).click();
          }
        } else if (question.type === 'multi_select') {
          for (const id of question.correctAnswer) await page.getByRole('checkbox', { name: question.options.find(option => option.id === id).label, exact: true }).click();
        } else {
          const option = question.options.find(item => item.id === question.correctAnswer);
          await page.getByRole(question.type === 'spot_the_error' ? 'button' : 'radio', { name: option.label, exact: true }).click();
        }
        await page.getByRole('button', { name: 'Verificar', exact: true }).click();
        await page.getByRole('button', { name: 'Continuar', exact: true }).click();
      }
      const resultTitle = page.getByRole('heading', { name: 'Lição concluída!', exact: true });
      await resultTitle.waitFor();
      await page.waitForFunction(() => Array.from(document.images).every(image => image.complete && image.naturalWidth > 0));
      assert.equal(await resultTitle.evaluate(element => getComputedStyle(element.parentElement).backgroundColor), 'rgb(255, 255, 255)');
      await page.screenshot({ path: 'artifacts/screenshots/redesign/result-' + width + '.png' });
      await page.getByRole('button', { name: 'Continuar', exact: true }).click();
    } else {
    await page.getByRole('button', { name: 'Sair da lição', exact: true }).click();
    await page.getByRole('button', { name: 'Sair da lição', exact: true }).last().click();
    }
    await page.getByRole('button', { name: /Expandir unidade 2:/ }).first().waitFor();
    if (process.env.ARCA_QA_EXERCISES === '1') {
    await page.goto('http://localhost:8084/qa-redesign');
    await page.getByRole('button', { name: 'Resposta de teste', exact: true }).waitFor();
    for (let exercise = 0; exercise < 16; exercise++) {
      await page.waitForTimeout(200);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'Exercise overflow ' + exercise);
      await page.screenshot({ path: 'artifacts/screenshots/redesign/type-' + exercise + '-' + width + '.png' });
      await page.getByRole('button', { name: 'Resposta de teste', exact: true }).click();
      await page.getByRole('button', { name: 'Verificar', exact: true }).click();
      await page.getByText(/^Correto!/).waitFor();
      await page.getByRole('button', { name: 'Próximo exercício', exact: true }).click();
    }
    }
    await context.close();
  }
  assert.deepEqual(errors, []);
  console.log('Responsive screenshots and navigation passed; isolated guest contexts, no changes to existing user profiles or progress.');
} finally { await browser.close(); }
