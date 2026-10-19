import type { PropsWithChildren, ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { AppText } from '@/components/common/AppText';
import { RewardPulse } from '@/components/animation/RewardPulse';
import { fonts } from '@/constants/theme';

export const offerColors = {
  ink: '#172036',
  muted: '#626D80',
  night: '#081A3A',
  mint: '#DFF7EB',
  green: '#08764D',
  pink: '#FFF0F6',
  white: '#FFFFFF',
  line: '#E8ECF1',
};
export const offerArt = {
  vip: require('../../../assets/membership/vip-mascot.png'),
  empty: require('../../../assets/membership/battery-empty.png'),
  invite: require('../../../assets/visuals/friends.png'),
};
export function OfferLayout({
  children,
  footer,
  tone = 'light',
}: PropsWithChildren<{ footer?: ReactNode; tone?: 'light' | 'night' | 'mint' }>) {
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={[
        styles.screen,
        {
          backgroundColor:
            tone === 'night' ? offerColors.night : tone === 'mint' ? offerColors.mint : 'white',
        },
      ]}
    >
      <ScrollView
        testID="offer-scroll"
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      {footer ? (
        <SafeAreaView edges={['bottom']} style={styles.footer}>
          <View style={styles.footerInner}>{footer}</View>
        </SafeAreaView>
      ) : null}
    </SafeAreaView>
  );
}
export function OfferHero({
  title,
  subtitle,
  image,
  tone = 'night',
  onBack,
  badge,
}: {
  title: string;
  subtitle: string;
  image: ImageSourcePropType;
  tone?: 'night' | 'mint';
  onBack: () => void;
  badge?: ReactNode;
}) {
  const dark = tone === 'night';
  return (
    <View
      testID={`offer-hero-${tone}`}
      style={[styles.hero, { backgroundColor: dark ? offerColors.night : offerColors.mint }]}
    >
      <View style={styles.navigation}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Voltar"
          onPress={onBack}
          style={styles.back}
        >
          <ArrowLeft size={23} color={dark ? 'white' : offerColors.ink} />
        </Pressable>
        {badge}
      </View>
      <AppText accessibilityRole="header" style={[styles.title, { color: dark ? 'white' : offerColors.ink }]}>
        {title}
      </AppText>
      <AppText style={[styles.subtitle, { color: dark ? '#D8E6FF' : '#396652' }]}>{subtitle}</AppText>
      <View style={styles.art}>
        <RewardPulse event={`hero-${tone}`} motion="rise">
          <Image source={image} resizeMode="contain" accessible={false} style={styles.heroImage} />
        </RewardPulse>
      </View>
      <Svg
        pointerEvents="none"
        width="100%"
        height={26}
        viewBox="0 0 480 40"
        preserveAspectRatio="none"
        style={styles.wave}
      >
        <Path
          d="M0 22C22 0 61 0 88 19C116 0 161 1 185 25C219 9 252 13 270 29C302 2 345 1 371 19C411 -2 454 2 480 17V40H0Z"
          fill="white"
        />
      </Svg>
    </View>
  );
}
export const offerStyles = StyleSheet.create({
  section: { paddingHorizontal: 20, paddingVertical: 18, gap: 14 },
  heading: { fontFamily: fonts.heavy, fontSize: 20, lineHeight: 27, color: offerColors.ink },
  small: { fontSize: 12, lineHeight: 18, textAlign: 'center', color: offerColors.muted },
  center: { textAlign: 'center' },
});
const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1, backgroundColor: 'white' },
  content: { flexGrow: 1 },
  footer: { backgroundColor: 'white', borderTopWidth: 1, borderTopColor: offerColors.line },
  footerInner: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8, gap: 7 },
  hero: { paddingHorizontal: 20, paddingTop: 8, overflow: 'hidden' },
  navigation: { height: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  title: { textAlign: 'center', fontFamily: fonts.heavy, fontSize: 28, lineHeight: 34, marginTop: 2 },
  subtitle: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 3 },
  art: { height: 142, alignItems: 'center', justifyContent: 'flex-end', marginTop: 8 },
  heroImage: { width: 186, height: 146 },
  wave: { marginHorizontal: -20, width: 'auto', alignSelf: 'stretch', height: 26 },
});
