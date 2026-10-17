import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import * as Linking from 'expo-linking';
import { ArrowLeft, Mail, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { IconButton } from '@/components/common/IconButton';
import { Button } from '@/components/common/Button';
import { Notice } from '@/components/common/Notice';
import { privacyContact, privacySections } from '@/constants/privacy';
import { colors, spacing } from '@/constants/theme';

export default function Privacy() {
  const [error, setError] = useState(false);
  async function contact() {
    try { await Linking.openURL(`mailto:${privacyContact.email}`); setError(false); } catch { setError(true); }
  }
  return <Screen>
    <View style={styles.heading}><IconButton icon={ArrowLeft} label="Voltar" onPress={() => router.canGoBack() ? router.back() : router.replace('/')} /><AppText accessibilityRole="header" variant="h2" style={styles.title}>Política de Privacidade</AppText></View>
    <AppText variant="small" color={colors.muted}>{privacyContact.appName} · Atualizada em {privacyContact.updated}</AppText>
    {privacySections.map(section => <View key={section.title} style={styles.section}><AppText accessibilityRole="header" variant="h3">{section.title}</AppText>{section.paragraphs.map(text => <AppText key={text}>{text}</AppText>)}</View>)}
    <AppText selectable>{privacyContact.email}</AppText>
    {error ? <Notice tone="error" message={`Não foi possível abrir seu e-mail. Envie sua mensagem para ${privacyContact.email}.`} /> : null}
    <Button title="Contato de privacidade" variant="secondary" icon={Mail} onPress={() => void contact()} />
    <Button title="Excluir conta" variant="quiet" icon={Trash2} onPress={() => router.push('/account/delete')} />
  </Screen>;
}
const styles = StyleSheet.create({ heading: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }, title: { flex: 1 }, section: { gap: spacing.sm } });
