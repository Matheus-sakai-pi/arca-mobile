document.querySelector('#request-form')?.addEventListener('submit', event => {
  event.preventDefault();
  const email = document.querySelector('#account-email').value.trim();
  const subject = 'Exclusão de conta — Arca';
  const body = `Olá, solicito a exclusão da minha conta no Arca: Aprenda a Bíblia e dos dados associados.\n\nE-mail usado no cadastro: ${email}\n\nPor favor, informem como confirmar a titularidade e quando a exclusão for concluída. Não estou enviando minha senha.`;
  document.querySelector('#request-status').textContent = 'Pedido preparado. Envie a mensagem no seu aplicativo de e-mail. Nada foi enviado automaticamente por esta página.';
  window.location.href = `mailto:matheussakai23032001@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
});
