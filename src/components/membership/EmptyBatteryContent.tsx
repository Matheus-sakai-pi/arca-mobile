import { Image, StyleSheet, View } from 'react-native';
import { Clock3, ShieldCheck } from '@/components/icons';
import { AppText } from '@/components/common/AppText';
import { RewardPulse } from '@/components/animation/RewardPulse';
import { EnergyOffers } from './EnergyOffers';
import { offerArt, offerColors } from './OfferLayout';
import { fonts } from '@/constants/theme';
export function EmptyBatteryContent({
  title,
  wait,
  onNavigate,
  lesson,
}: {
  title: string;
  wait?: string;
  onNavigate?: () => void;
  lesson?: string;
}) {
  return (
    <View testID="empty-battery-scene" style={styles.content}>
      <View style={styles.art}>
        <RewardPulse event="battery-empty" motion="tilt">
          <Image source={offerArt.empty} resizeMode="contain" accessible={false} style={styles.battery} />
        </RewardPulse>
      </View>
      <View style={styles.heading}>
        <AppText accessibilityRole="header" style={styles.title}>
          {title}
        </AppText>
        <AppText style={styles.subtitle}>Uma pausa na bateria, não na sua jornada.</AppText>
        {lesson ? (
          <AppText numberOfLines={2} style={styles.lesson}>
            {lesson}
          </AppText>
        ) : null}
      </View>
      {wait ? (
        <View style={styles.timer}>
          <Clock3 size={18} color="#A32362" />
          <AppText style={styles.wait}>Próxima energia em {wait}</AppText>
        </View>
      ) : null}
      <View style={styles.choices}>
        <EnergyOffers onNavigate={onNavigate} />
        <AppText style={styles.fine}>O presente para os dois é liberado após a primeira lição do seu amigo.</AppText>
      </View>
      <View style={styles.saved}>
        <ShieldCheck size={17} color={offerColors.green} />
        <AppText style={styles.fine}>Sua tentativa está guardada. Continue de onde parou.</AppText>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    gap: 20,
    justifyContent: 'center',
  },
  art: { height: 134, alignItems: 'center', justifyContent: 'center' },
  battery: { width: 202, height: 134 },
  heading: { gap: 6, alignItems: 'center' },
  title: {
    fontFamily: fonts.heavy,
    fontSize: 27,
    lineHeight: 34,
    textAlign: 'center',
    color: offerColors.ink,
  },
  subtitle: { fontSize: 14, lineHeight: 21, color: offerColors.muted, textAlign: 'center' },
  lesson: { fontSize: 12, lineHeight: 18, color: offerColors.muted, textAlign: 'center' },
  timer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  wait: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 19, color: '#A32362', flexShrink: 1 },
  choices: { gap: 10 },
  fine: { fontSize: 11, lineHeight: 17, textAlign: 'center', color: offerColors.muted, flexShrink: 1 },
  saved: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
