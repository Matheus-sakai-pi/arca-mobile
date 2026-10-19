export const avatarOptions = [
  {key:'avatar-01',label:'Sábio'},
  {key:'avatar-02',label:'Viajante'},
  {key:'avatar-03',label:'Exploradora'},
  {key:'avatar-04',label:'Companheiro'},
  {key:'avatar-05',label:'Estudiosa'},
  {key:'owl',label:'Coruja'},
  {key:'lamb',label:'Cordeiro'},
  {key:'fox',label:'Raposinha'},
  {key:'dove',label:'Pombinha'},
  {key:'turtle',label:'Tartaruga'},
  {key:'vip-sage',label:'Sábio VIP'},
  {key:'vip-explorer',label:'Explorador VIP'},
] as const;
export type AvatarKey = typeof avatarOptions[number]['key'];
export function isVIPAvatar(key: string): boolean { return key.startsWith('vip-'); }
export function isAvatarKey(value: unknown): value is AvatarKey {
  return avatarOptions.some(option=>option.key === value);
}
export function resolveAvatarKey(value: unknown): AvatarKey {
  return isAvatarKey(value) ? value : 'avatar-01';
}
