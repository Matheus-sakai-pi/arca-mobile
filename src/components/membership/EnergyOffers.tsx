import { router } from 'expo-router';
import { ArrowRight, Crown, MessageCircle } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/components/common/AppText';
import { offerColors } from './OfferLayout';
import { MEMBERSHIP_CONFIG } from '@/config/membership';
export function EnergyOffers({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <View style={styles.options}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Bateria infinita com Arca VIP"
        style={({ pressed }) => [styles.option, styles.vip, pressed && styles.pressed]}
        onPress={() => {
          onNavigate?.();
          router.push('/vip');
        }}
      >
        <View style={[styles.icon, styles.vipIcon]}>
          <Crown size={23} color={offerColors.green} />
        </View>
        <View style={styles.copy}>
          <AppText variant="h3" style={styles.title}>
            Arca VIP
          </AppText>
          <AppText style={styles.detail}>Bateria infinita e +10% de XP</AppText>
        </View>
        <ArrowRight size={19} color={offerColors.green} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Convidar amigo pelo WhatsApp"
        style={({ pressed }) => [styles.option, pressed && styles.pressed]}
        onPress={() => {
          onNavigate?.();
          router.push('/invite');
        }}
      >
        <View style={styles.icon}>
          <MessageCircle size={22} color="#0964FF" />
        </View>
        <View style={styles.copy}>
          <AppText variant="h3" style={styles.title}>
            Convide um amigo
          </AppText>
          <AppText style={styles.detail}>
            Os dois ganham {MEMBERSHIP_CONFIG.referralDays} dias de bateria infinita
          </AppText>
        </View>
        <ArrowRight size={19} color="#0964FF" />
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  options: { gap: 12 },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1.5,
    borderColor: '#E0E6EF',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 15,
    minHeight: 84,
    backgroundColor: 'white',
  },
  vip: { borderColor: '#84CFAB', backgroundColor: '#F0FBF5' },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EAF2FF',
  },
  vipIcon: { backgroundColor: '#D8F3E6' },
  copy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, lineHeight: 22, color: offerColors.ink },
  detail: { fontSize: 12, lineHeight: 18, color: offerColors.muted },
  pressed: { opacity: 0.7 },
});
