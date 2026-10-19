export const profileFrames = [
  { key: 'classic', label: 'Clássica', color: '#0964FF', vip: false },
  { key: 'gold', label: 'Dourada', color: '#D29A20', vip: true },
  { key: 'laurel', label: 'Oliveira', color: '#167451', vip: true },
  { key: 'starlight', label: 'Estelar', color: '#9752CF', vip: true },
] as const;
export const profileBackgrounds = [
  { key: 'plain', label: 'Branco', color: '#FFFFFF', vip: false },
  { key: 'garden', label: 'Jardim', color: '#E9F4DD', vip: true },
  { key: 'sky', label: 'Céu', color: '#94D4FF', vip: true },
  { key: 'stars', label: 'Constelação', color: '#301331', vip: true },
] as const;
export type ProfileFrame = (typeof profileFrames)[number]['key'];
export type ProfileBackground = (typeof profileBackgrounds)[number]['key'];
export type ProfileAppearance = { frame: ProfileFrame; background: ProfileBackground; showBadge: boolean };
export type SavedProfileAppearance = ProfileAppearance & { owner: string; vip: boolean };
export const defaultAppearance: Readonly<ProfileAppearance> = Object.freeze({
  frame: 'classic',
  background: 'plain',
  showBadge: true,
});
export function isPremiumAppearance(value: ProfileAppearance) {
  return value.frame !== 'classic' || value.background !== 'plain';
}
export function decodeProfileAppearance(raw: unknown, owner: string): SavedProfileAppearance {
  if (!raw || typeof raw !== 'object') throw new Error('appearance_invalid');
  const value = raw as Record<string, unknown>;
  if (
    value.owner !== owner ||
    typeof value.vip !== 'boolean' ||
    typeof value.showBadge !== 'boolean' ||
    !profileFrames.some(frame => frame.key === value.frame) ||
    !profileBackgrounds.some(background => background.key === value.background)
  )
    throw new Error('appearance_invalid');
  return {
    owner,
    frame: value.frame as ProfileFrame,
    background: value.background as ProfileBackground,
    showBadge: value.showBadge,
    vip: value.vip,
  };
}
export function visibleProfileAppearance(value: ProfileAppearance | null, vip: boolean): ProfileAppearance {
  return vip && value ? value : { ...defaultAppearance, showBadge: false };
}
