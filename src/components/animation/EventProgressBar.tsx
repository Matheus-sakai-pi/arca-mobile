import { useCounterMotion } from '@/providers/RewardMotionProvider';
import { AnimatedProgressBar } from './AnimatedProgressBar';
export function EventProgressBar({value,label,motionKey}: {value:number;label:string;motionKey:string}) {
  const transition=useCounterMotion(motionKey,value,false,motionKey.split(':').slice(1).join(':'));
  return <AnimatedProgressBar value={transition.to} from={transition.from} duration={450} label={label} />;
}
