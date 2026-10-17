export type GuestImportIntent = 'preview' | 'account' | null;
export function shouldShowGuestImport(intent:GuestImportIntent,hasAccount:boolean,alreadyImported:boolean,completedLessons:number):boolean {
  if (!intent || completedLessons <= 0 || alreadyImported) return false;
  return hasAccount || intent === 'preview';
}
