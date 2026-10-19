// Guarda, por conta, se o último estado visto era VIP. A boas-vindas aparece só na virada
// de "não VIP" para "VIP" (compra, pagamento confirmado depois ou VIP dado pelo painel).
export const vipWelcomeKey = (owner: string) => `arca.vip-welcome.${owner}.v1`;
export function shouldWelcomeVip(stored: string | null, vip: boolean): boolean {
  return vip && stored === 'false';
}
// O que gravar depois de ler o estado (null = nada a mudar). Uma conta que já era VIP na
// primeira leitura grava "true" sem comemorar; a virada para VIP só é gravada ao fechar a tela.
export function nextVipWelcomeValue(stored: string | null, vip: boolean): string | null {
  if (!vip) return stored === 'false' ? null : 'false';
  return stored === null ? 'true' : null;
}
