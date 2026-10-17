import { StyleSheet, View } from 'react-native';
import { RefreshCw } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { useLearning } from '@/providers/LearningProvider';
import { colors, spacing } from '@/constants/theme';

export function SyncNotice() {
  const {offline,pending,rejected,syncing,sync,notice} = useLearning();
  const message = notice ?? (offline ? pending ? `${pending} conclusão(ões) guardada(s) neste aparelho. Conecte-se para confirmar XP e progresso.` : 'Sua conta está offline. Seu progresso continua guardado neste aparelho.' : rejected ? 'Uma conclusão não pôde ser validada pelo servidor. Ela foi guardada neste aparelho; refaça a lição disponível na trilha.' : pending ? 'Confirmando seu progresso na conta...' : null);
  if (!message) return null;
  return <View style={styles.band} accessibilityLiveRegion="polite">
    {message ? <AppText variant="small" color={colors.muted}>{message}</AppText> : null}
    {offline || pending ? <Button title="Tentar sincronizar" variant="quiet" icon={RefreshCw} loading={syncing} onPress={()=>void sync()} /> : null}
  </View>;
}
const styles=StyleSheet.create({band:{paddingHorizontal:spacing.lg,paddingVertical:spacing.sm,gap:spacing.xs,backgroundColor:colors.surface}});
