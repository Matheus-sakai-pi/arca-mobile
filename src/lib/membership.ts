import { MEMBERSHIP_CONFIG as config } from '../config/membership.ts';

export type Membership = {
  owner: string;
  serverNow: string;
  vip: boolean;
  vipUntil: string | null;
  unlimited: boolean;
  referralUntil: string | null;
  code: string;
  billingReady: boolean;
  rewardDays: number;
  xpPercent: number;
  invites: { pending: number; rewarded: number; blocked: number };
};
const iso = (value: unknown) => typeof value === 'string' && Number.isFinite(Date.parse(value));
export function formatMembershipPrice(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function referralCode(value: unknown): string {
  return typeof value === 'string' && /^[A-F0-9]{16}$/.test(value.trim().toUpperCase())
    ? value.trim().toUpperCase()
    : '';
}
export function installReferral(value: string): string {
  return referralCode(new URLSearchParams(value).get('arca_invite'));
}
export function referralMessage(code: string): string {
  if (!referralCode(code)) throw new Error('Convite indisponível.');
  const referrer = encodeURIComponent(`arca_invite=${code}`);
  return `Vamos aprender a Bíblia juntos no Arca? Crie sua conta com meu código ${code} e seremos amigos no app. Ao concluir sua primeira lição em outro celular, nós dois ganhamos ${config.referralDays} dias de bateria infinita!\nhttps://play.google.com/store/apps/details?id=${config.packageName}&referrer=${referrer}\nCódigo do convite: ${code}`;
}
export function decodeMembership(value: unknown, owner: string): Membership {
  const m = value as Membership | null;
  if (
    !m ||
    m.owner !== owner ||
    !iso(m.serverNow) ||
    typeof m.vip !== 'boolean' ||
    typeof m.unlimited !== 'boolean' ||
    !(m.vipUntil === null || iso(m.vipUntil)) ||
    !(m.referralUntil === null || iso(m.referralUntil)) ||
    !referralCode(m.code) ||
    typeof m.billingReady !== 'boolean' ||
    !Number.isSafeInteger(m.rewardDays) ||
    m.rewardDays < 1 ||
    !Number.isSafeInteger(m.xpPercent) ||
    m.xpPercent < 0 ||
    !m.invites ||
    [m.invites.pending, m.invites.rewarded, m.invites.blocked].some(n => !Number.isSafeInteger(n) || n < 0) ||
    m.vip !== (m.vipUntil !== null) ||
    m.unlimited !== (m.vip || m.referralUntil !== null)
  )
    throw new Error('Não foi possível conferir seus benefícios.');
  return m;
}
