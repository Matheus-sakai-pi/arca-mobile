import { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Camera, Check, ChevronRight, Crown, RefreshCw, RotateCcw, Save, X } from '@/components/icons';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { IconButton } from '@/components/common/IconButton';
import { Notice } from '@/components/common/Notice';
import { profileArtwork } from '@/constants/profileArtwork';
import { colors, fonts } from '@/constants/theme';
import {
  defaultAppearance,
  isPremiumAppearance,
  profileBackgrounds,
  profileFrames,
  type ProfileAppearance,
} from '@/lib/profileAppearance';
import { ProfileAvatar, ProfileCover, VIPBadge } from './ProfileDecoration';

export function ProfileAppearancePicker({
  current,
  avatarKey,
  name,
  vip,
  loading,
  loadError,
  onRetry,
  onSave,
  onClose,
  onPhoto,
}: {
  current: ProfileAppearance | null;
  avatarKey: string;
  name: string;
  vip: boolean;
  loading: boolean;
  loadError: string | null;
  onRetry: () => void;
  onSave: (value: ProfileAppearance) => Promise<void>;
  onClose: () => void;
  /** Abre a foto de perfil (só para contas; visitantes não enviam foto). */
  onPhoto?: () => void;
}) {
  const [selection, setSelected] = useState<ProfileAppearance | null>(null);
  const selected = selection ?? current ?? defaultAppearance;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsVIP = isPremiumAppearance(selected) && !vip;
  async function save() {
    if (saving) return;
    if (needsVIP) {
      onClose();
      router.push('/vip');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(selected);
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Não foi possível salvar seu estilo. Tente novamente.',
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal
      visible
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!saving) onClose();
      }}
    >
      <SafeAreaView style={styles.overlay}>
        <View style={styles.dialog} accessibilityViewIsModal testID="profile-appearance-picker">
          <View style={styles.header}>
            <AppText variant="h3" style={styles.title}>
              Personalizar perfil
            </AppText>
            <IconButton icon={X} label="Fechar personalização" disabled={saving} onPress={onClose} />
          </View>
          <View testID="profile-appearance-preview" style={styles.preview}>
            <ProfileCover background={selected.background} />
            <AppText style={styles.previewLabel}>PRÉVIA</AppText>
            <ProfileAvatar avatarKey={avatarKey} frame={selected.frame} size={76} />
            <View style={styles.previewName}>
              <AppText style={styles.name}>{name}</AppText>
              {selected.showBadge ? <VIPBadge /> : null}
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.choices} showsVerticalScrollIndicator={false}>
            {onPhoto ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Foto de perfil"
                disabled={saving}
                onPress={onPhoto}
                style={({ pressed }) => [styles.photoRow, pressed && styles.photoPressed]}
              >
                <View style={styles.photoIcon}>
                  <Camera size={20} color={colors.primary} />
                </View>
                <View style={styles.photoText}>
                  <AppText variant="label">Foto de perfil</AppText>
                  <AppText variant="small" color={colors.muted}>
                    Use uma foto sua no lugar do avatar
                  </AppText>
                </View>
                <ChevronRight size={20} color={colors.muted} />
              </Pressable>
            ) : null}
            <AppText variant="label">Moldura</AppText>
            <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Moldura do perfil">
              {profileFrames.map(option => (
                <Pressable
                  key={option.key}
                  accessibilityRole="radio"
                  accessibilityLabel={'Moldura ' + option.label}
                  accessibilityState={{ checked: selected.frame === option.key, disabled: saving }}
                  aria-checked={selected.frame === option.key}
                  disabled={saving}
                  onPress={() => {
                    setSelected(value => ({ ...(value ?? current ?? defaultAppearance), frame: option.key }));
                    setError(null);
                  }}
                  style={[styles.option, selected.frame === option.key && styles.selected]}
                >
                  <ProfileAvatar avatarKey={avatarKey} frame={option.key} size={36} animate={false} />
                  <View style={styles.optionLabel}>
                    <AppText style={styles.label}>{option.label}</AppText>
                    {option.vip ? <Crown size={13} color="#916500" /> : null}
                    {selected.frame === option.key ? <Check size={14} color={colors.primary} /> : null}
                  </View>
                </Pressable>
              ))}
            </View>
            <AppText variant="label">Fundo</AppText>
            <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Fundo do perfil">
              {profileBackgrounds.map(option => (
                <Pressable
                  key={option.key}
                  accessibilityRole="radio"
                  accessibilityLabel={'Fundo ' + option.label}
                  accessibilityState={{ checked: selected.background === option.key, disabled: saving }}
                  aria-checked={selected.background === option.key}
                  disabled={saving}
                  onPress={() => {
                    setSelected(value => ({
                      ...(value ?? current ?? defaultAppearance),
                      background: option.key,
                    }));
                    setError(null);
                  }}
                  style={[styles.option, selected.background === option.key && styles.selected]}
                >
                  <View style={[styles.swatch, { backgroundColor: option.color }]}>
                    {profileArtwork[option.key] ? (
                      <Image
                        source={profileArtwork[option.key]}
                        resizeMode="cover"
                        style={styles.swatchImage}
                        accessible={false}
                      />
                    ) : null}
                  </View>
                  <View style={styles.optionLabel}>
                    <AppText style={styles.label}>{option.label}</AppText>
                    {option.vip ? <Crown size={13} color="#916500" /> : null}
                    {selected.background === option.key ? <Check size={14} color={colors.primary} /> : null}
                  </View>
                </Pressable>
              ))}
            </View>
            <View style={styles.toggle}>
              <View style={styles.optionLabel}>
                <Crown size={17} color="#916500" />
                <AppText variant="label">Mostrar selo VIP</AppText>
              </View>
              <Switch
                accessibilityLabel="Mostrar selo VIP"
                value={selected.showBadge}
                disabled={saving}
                onValueChange={showBadge => {
                  setSelected(value => ({ ...(value ?? current ?? defaultAppearance), showBadge }));
                }}
                trackColor={{ false: '#C9D1DF', true: colors.primary }}
              />
            </View>
            {!vip ? (
              <AppText style={styles.exclusive}>Molduras, fundos e selo exclusivos Arca VIP.</AppText>
            ) : null}
            {error || loadError ? <Notice tone="error" message={error ?? loadError!} /> : null}
            {loadError ? (
              <Button
                title="Tentar carregar novamente"
                icon={RefreshCw}
                variant="secondary"
                loading={loading}
                disabled={saving}
                onPress={onRetry}
              />
            ) : null}
          </ScrollView>
          <View style={styles.footer}>
            <Button
              title={needsVIP ? 'Conhecer Arca VIP' : 'Salvar personalização'}
              icon={needsVIP ? Crown : Save}
              loading={saving}
              disabled={loading || (!needsVIP && !!loadError)}
              onPress={() => void save()}
            />
            <Button
              title="Restaurar padrão"
              icon={RotateCcw}
              variant="quiet"
              disabled={saving}
              onPress={() => {
                setSelected({ ...defaultAppearance });
                setError(null);
              }}
            />
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(20,30,48,0.55)',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dialog: {
    width: '100%',
    maxWidth: 440,
    maxHeight: '96%',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    overflow: 'hidden',
  },
  header: { flexDirection: 'row', alignItems: 'center', padding: 12, gap: 8 },
  title: { flex: 1, fontSize: 20, lineHeight: 26 },
  preview: {
    marginHorizontal: 12,
    backgroundColor: '#FFFFFF',
    minHeight: 194,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    paddingTop: 10,
    paddingBottom: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  previewLabel: {
    fontSize: 10,
    lineHeight: 14,
    color: '#23344A',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  previewName: {
    width: '100%',
    paddingHorizontal: 12,
    paddingTop: 6,
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFFFFF',
    marginTop: 0,
  },
  name: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 24, textAlign: 'center', maxWidth: '100%' },
  choices: { padding: 12, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  option: {
    width: '48%',
    minHeight: 88,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    gap: 8,
  },
  selected: { borderColor: colors.primary, backgroundColor: '#F0F6FF' },
  optionLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  label: { fontSize: 12, lineHeight: 17, flexShrink: 1 },
  swatch: {
    width: '100%',
    height: 40,
    borderRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#DFE7EE',
  },
  swatchImage: { width: '100%', height: '100%' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingVertical: 4,
  },
  exclusive: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    padding: 12,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 8,
  },
  photoPressed: { backgroundColor: '#F0F6FF' },
  photoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0F6FF',
  },
  photoText: { flex: 1, minWidth: 0, gap: 2 },
  footer: { padding: 12, gap: 4, borderTopWidth: 1, borderColor: colors.border },
});
