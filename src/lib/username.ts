export const normalizeUsername = (value: string) => value.trim().replace(/^@/, '').toLowerCase();
export const validUsername = (value: string) => /^[a-z0-9_]{3,30}$/.test(normalizeUsername(value));
export const usernameHint = 'Use de 3 a 30 letras sem acento, números ou _.';
export function hasChosenUsername(profile: {username:string;display_name:string}) {
  return validUsername(profile.username) && profile.username === normalizeUsername(profile.username)
    && profile.display_name === `@${profile.username}`;
}
