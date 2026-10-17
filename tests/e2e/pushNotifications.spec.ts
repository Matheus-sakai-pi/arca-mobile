import { test, expect } from './fixtures';
import { capture } from './actions';
for (const guest of [false, true]) test(`push settings are opt-in and never request permission in web ${guest ? 'guest' : 'account'}`, async ({ page, context, backend }, info) => {
  await backend.install(context, guest);
  await page.goto('/study/reminders');
  await expect(page.getByRole('heading', { name: 'Avisos do Arca', exact: true })).toBeVisible();
  for (const label of ['Avisos de energia', 'Avisos de retorno']) {
    const toggle = page.getByRole('switch', { name: label, exact: true });
    await expect(toggle).toBeDisabled(); await expect(toggle).not.toBeChecked();
  }
  await expect(page.getByRole('button', { name: 'Salvar avisos', exact: true })).toHaveCount(0);
  if (guest) await expect(page.getByText('Entre na sua conta para receber avisos de energia e da sua jornada.', { exact: true })).toBeVisible();
  else await expect(page.getByText('Os avisos automáticos estão disponíveis no aplicativo Android atualizado. A prévia web não envia notificações.', { exact: true })).toBeVisible();
  expect(backend.calls.some(call => call.name.startsWith('learning_push'))).toBe(false);
  await page.getByTestId('push-settings').scrollIntoViewIfNeeded();
  await capture(page, info, `push-settings-${guest ? 'guest' : 'account'}`);
});
