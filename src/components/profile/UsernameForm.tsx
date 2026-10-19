import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AtSign, Save } from '@/components/icons';
import { useLearning } from '@/providers/LearningProvider';
import { normalizeUsername, validUsername, usernameHint, hasChosenUsername } from '@/lib/username';
import { authErrorMessage } from '@/services/validation';
import { Field } from '@/components/common/Field';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Notice } from '@/components/common/Notice';
import { colors } from '@/constants/theme';

export function UsernameForm({
  onDone,
  onCancel,
  onBusyChange,
  cancelLabel = 'Cancelar',
}: {
  onDone: () => void;
  onCancel: () => void;
  onBusyChange?: (busy: boolean) => void;
  cancelLabel?: string;
}) {
  const { profile, offline, updateProfile } = useLearning();
  const [value, setValue] = useState(profile && hasChosenUsername(profile) ? profile.username : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!profile || busy || offline) return;
    if (!validUsername(value)) {
      setError(usernameHint);
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setError(null);
    const username = normalizeUsername(value);
    try {
      await updateProfile({ username, display_name: `@${username}`, avatar_key: profile.avatar_key });
      onDone();
    } catch (cause) {
      setError(authErrorMessage(cause));
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }
  return (
    <View style={styles.form}>
      <Field
        label="Nome de usuário"
        icon={AtSign}
        placeholder="seu_usuario"
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={31}
        value={value}
        onChangeText={next => {
          setValue(next);
          setError(null);
        }}
        editable={!busy}
        returnKeyType="done"
        onSubmitEditing={() => void save()}
      />
      <AppText variant="small" color={colors.muted}>
        {usernameHint}
      </AppText>
      {error ? <Notice tone="error" message={error} /> : null}
      {offline ? <Notice message="Conecte-se à internet para escolher seu nome de usuário." /> : null}
      <Button
        title="Salvar"
        accessibilityLabel="Salvar nome de usuário"
        icon={Save}
        loading={busy}
        disabled={offline || !profile}
        onPress={() => void save()}
      />
      <Button title={cancelLabel} variant="quiet" disabled={busy} onPress={onCancel} />
    </View>
  );
}
const styles = StyleSheet.create({ form: { gap: 12, paddingVertical: 12 } });
