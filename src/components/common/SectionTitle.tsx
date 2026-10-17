import { Image, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { redesignAssets } from '@/constants/redesignAssets';
export function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="h2" style={styles.title}>
        {title}
      </AppText>
      <Image source={redesignAssets.bibleOpen} resizeMode="contain" style={styles.book} accessible={false} />
    </View>
  );
}
const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', minHeight: 60, gap: 8 },
  title: { flex: 1 },
  book: { width: 86, height: 68 },
});
