import { defaultReminder, type Reminder } from '@/lib/reminderStore';
export const remindersSupported=false;
export async function loadReminder(){return {...defaultReminder};}
export async function saveReminder(_value:Reminder):Promise<Reminder>{throw new Error('Os lembretes estão disponíveis no aplicativo Android e iOS.');}
export { defaultReminder };
