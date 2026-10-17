import { safeSystemPath } from '@/lib/systemPath';
export function redirectSystemPath({path}: {path:string;initial:boolean}) { return safeSystemPath(path); }
