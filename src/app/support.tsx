import { useState } from 'react';
import { Switch, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Mail } from 'lucide-react-native';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Notice } from '@/components/common/Notice';
import { privacyContact } from '@/constants/privacy';
import { colors, spacing } from '@/constants/theme';
import { openSupport } from '@/services/support';
export default function Support() {
  const [include,setInclude]=useState(false);
  const [error,setError]=useState(false);
  const [busy,setBusy]=useState(false);
  async function contact() {setBusy(true);setError(false);try{await openSupport(include);}catch{setError(true);}finally{setBusy(false);}}
  return <Screen><IconButton icon={ArrowLeft} label="Voltar" onPress={()=>router.canGoBack() ? router.back() : router.replace('/')} /><AppText accessibilityRole="header" variant="h2">Ajuda e suporte</AppText><AppText selectable>{privacyContact.email}</AppText><View style={{flexDirection:'row',alignItems:'center',gap:spacing.sm}}><AppText style={{flex:1}}>Incluir diagnóstico técnico</AppText><Switch accessibilityLabel="Incluir diagnóstico técnico" value={include} onValueChange={setInclude} trackColor={{false:colors.track,true:colors.primary}} /></View><AppText variant="small" color={colors.muted}>O diagnóstico contém apenas códigos de falha e tempos de carregamento desta sessão. Não inclui senha, e-mail, respostas ou localização. O envio ocorre pelo seu aplicativo de e-mail, após sua confirmação.</AppText>{error ? <Notice tone="error" message="Não foi possível abrir seu aplicativo de e-mail. Use o endereço de suporte acima." /> : null}<Button title="Entrar em contato" icon={Mail} onPress={()=>void contact()} loading={busy} /></Screen>;
}
