import { Component, type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Button } from './Button';
import { recordDiagnostic } from '@/lib/diagnostics';
import { colors, spacing } from '@/constants/theme';
import { privacyContact } from '@/constants/privacy';

export class AppErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { recordDiagnostic('render_failed'); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <View style={styles.container}><AppText accessibilityRole="header" variant="h2">Não foi possível abrir esta tela</AppText><AppText>Seu progresso salvo permanece guardado.</AppText><Button title="Tentar novamente" onPress={() => this.setState({ failed: false })} /><AppText selectable variant="small">{privacyContact.email}</AppText></View>;
  }
}
const styles=StyleSheet.create({container:{flex:1,justifyContent:'center',padding:spacing.lg,gap:spacing.md,backgroundColor:colors.background}});
