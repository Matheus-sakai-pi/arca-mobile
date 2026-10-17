export type Reminder = {enabled:boolean;hour:number;minute:number};
export const reminderKey='arca.device.study-reminder.v1';
export const defaultReminder:Reminder={enabled:false,hour:19,minute:0};
export function parseReminder(raw:string|null):Reminder {
  if(!raw)return {...defaultReminder};
  const value:unknown=JSON.parse(raw);
  if(!value||typeof value!=='object'||!('enabled' in value)||typeof value.enabled!=='boolean'||!('hour' in value)||typeof value.hour!=='number'||!Number.isInteger(value.hour)||value.hour<0||value.hour>23||!('minute' in value)||typeof value.minute!=='number'||!Number.isInteger(value.minute)||value.minute<0||value.minute>59)throw new Error('Horário inválido.');
  return {enabled:value.enabled,hour:value.hour,minute:value.minute};
}

type Storage={getItem:(key:string)=>Promise<string|null>;setItem:(key:string,value:string)=>Promise<void>};
type Scheduler={allowed:()=>Promise<boolean>;authorize:()=>Promise<boolean>;scheduled:()=>Promise<boolean>;schedule:(value:Reminder)=>Promise<void>;cancel:()=>Promise<void>};
export function createReminderController(storage:Storage,scheduler:Scheduler){
  let queue:Promise<unknown>=Promise.resolve();
  function serial<T>(work:()=>Promise<T>):Promise<T>{const next=queue.then(work);queue=next.catch(()=>undefined);return next;}
  return {
    load:()=>serial(async()=>{
      const value=parseReminder(await storage.getItem(reminderKey));
      if(value.enabled&&(!await scheduler.allowed()||!await scheduler.scheduled())){
        const disabled={...value,enabled:false};await scheduler.cancel();await storage.setItem(reminderKey,JSON.stringify(disabled));return disabled;
      }
      if(!value.enabled)await scheduler.cancel();
      return value;
    }),
    save:(input:Reminder)=>serial(async()=>{
      const value=parseReminder(JSON.stringify(input));
      const previous=parseReminder(await storage.getItem(reminderKey));
      if(value.enabled&&!await scheduler.allowed()&&!await scheduler.authorize())throw new Error('Notificações não autorizadas. Você pode permitir nas configurações do aparelho.');
      await scheduler.cancel();
      try{if(value.enabled)await scheduler.schedule(value);await storage.setItem(reminderKey,JSON.stringify(value));}
      catch(error){await scheduler.cancel();if(previous.enabled)await scheduler.schedule(previous).catch(()=>undefined);throw error;}
      return value;
    }),
  };
}
