export type NumberTransition = { from:number; to:number; event:number };

// Presentation-only memory: no XP, progress or ranking is written here.
export function createMotionLedger() {
  const values = new Map<string,number>();
  const baselines = new Map<string,number>();
  const events = new Set<string>();
  let sequence = 0;
  return {
    peek:(key:string)=>values.get(key),
    seed:(key:string,value:number)=>{if(!baselines.has(key)) baselines.set(key,value);},
    baseline:(key:string)=>baselines.get(key),
    wasClaimed:(key:string,event:string)=>events.has(`${key}:${event}`),
    number(key:string,to:number,entrance=false,baseline=to):NumberTransition {
      const previous=values.get(key);
      values.set(key,to);
      const from=previous ?? (entrance ? 0 : baseline);
      return {from,to,event:from === to ? 0 : ++sequence};
    },
    claim(key:string,event:string):boolean {
      const token=`${key}:${event}`;
      if(events.has(token)) return false;
      events.add(token);
      return true;
    },
  };
}

export function recentCompletion(previous:readonly string[],next:readonly string[],lessonId:string|undefined):string|null {
  return lessonId && !previous.includes(lessonId) && next.includes(lessonId) ? lessonId : null;
}

export function rankDirection(from:number,to:number) { return to < from ? -1 : to > from ? 1 : 0; }
