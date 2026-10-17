export const reminderPromptKey=(owner:string)=>`arca.reminder-prompt.${owner}.v1`;
export function shouldOfferReminder(completed:readonly string[],alreadyOffered:boolean,enabled:boolean){
  return new Set(completed).size>=3&&!alreadyOffered&&!enabled;
}
