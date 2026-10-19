import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, CalendarDays, Crown, Gift, History, LockKeyhole, LogIn, LogOut, Mail, Palette, Pencil, Settings, ShieldCheck, Smile, Trash2, UserRound } from '@/components/icons';
import { ProfileAppearancePicker } from '@/components/profile/ProfileAppearancePicker';
import { ProfileAvatar, ProfileCover, VIPBadge } from '@/components/profile/ProfileDecoration';
import { AvatarPicker } from '@/components/profile/AvatarPicker';
import { ProfilePhotoPicker } from '@/components/profile/ProfilePhotoPicker';
import { ProfileSettings } from '@/components/profile/ProfileSettings';
import { ProfileActionGroup, ProfileActionRow } from '@/components/profile/ProfileActionList';
import { IconButton } from '@/components/common/IconButton';
import { LearningStats } from '@/components/learning/LearningStats';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Notice } from '@/components/common/Notice';
import { UsernameForm } from '@/components/profile/UsernameForm';
import { hasChosenUsername } from '@/lib/username';
import { LearningGate } from '@/components/learning/LearningGate';
import { useAuth } from '@/hooks/useAuth';
import { useProfileAppearance } from '@/hooks/useProfileAppearance';
import { useMembership } from '@/providers/MembershipProvider';
import { visibleProfileAppearance } from '@/lib/profileAppearance';
import { useLearning } from '@/providers/LearningProvider';
import { requestPasswordReset, signOut } from '@/services/auth';
import { authErrorMessage } from '@/services/validation';
import { colors, fonts, radius, spacing, surfaces } from '@/constants/theme';

export default function Profile() {
  return <LearningGate><ProfileContent /></LearningGate>;
}
function ProfileContent() {
  const { session, isGuest, exitGuest } = useAuth();
  const {profile,progress,offline,importAvailable,requestGuestImport,updateAvatar,sync} = useLearning();
  const [settings,setSettings]=useState(false);
  const [avatarPicker,setAvatarPicker] = useState(false);
  const [photoPicker,setPhotoPicker] = useState(false);
  const [appearancePicker,setAppearancePicker] = useState(false);
  const { status: membership } = useMembership();
  const vip = !!membership?.vip;
  const appearance = useProfileAppearance(session?.user.id ?? null, vip);
  const visibleAppearance = visibleProfileAppearance(appearance.appearance, vip && !!appearance.appearance?.vip);
  const [busy, setBusy] = useState<'logout' | 'reset' | 'save' | null>(null);
  const [editing,setEditing] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const name: unknown = session?.user.user_metadata.display_name;
  const displayName = profile?.display_name ?? (typeof name === 'string' && name.trim() ? name.trim() : 'Sua conta');
  async function logout() {
    if (isGuest) { exitGuest(); router.replace('/(auth)/login'); return; }
    setBusy('logout');
    try { await signOut(); } catch (error) { setNotice({ tone: 'error', message: authErrorMessage(error) }); }
    finally { setBusy(null); }
  }
  async function reset() {
    if (!session?.user.email) return;
    setBusy('reset');
    try { await requestPasswordReset(session.user.email); setResetSent(true); setNotice({ tone: 'success', message: 'Confira seu e-mail para escolher uma nova senha.' }); }
    catch (error) { setNotice({ tone: 'error', message: authErrorMessage(error) }); }
    finally { setBusy(null); }
  }
  return <Screen keyboard>
    <View style={styles.heading}><AppText accessibilityRole="header" style={styles.title}>Perfil</AppText><IconButton icon={Settings} label="Configurações" onPress={()=>setSettings(true)} /></View>
    {settings ? <ProfileSettings onClose={()=>setSettings(false)} /> : null}
    <View style={[styles.identity, { overflow: 'hidden' }]} testID="profile-identity">
      <ProfileCover background={visibleAppearance.background} />
      <ProfileAvatar avatarKey={profile?.avatar_key} frame={visibleAppearance.frame} size={124} label="Seu avatar" />
      <AppText variant="h2" style={styles.center}>{isGuest ? 'Olá, visitante.' : displayName}</AppText>
      {visibleAppearance.showBadge ? <VIPBadge /> : null}
      {session?.user.email ? <View style={styles.email}><Mail size={16} color={colors.muted} /><AppText variant="small" color={colors.muted} style={styles.emailText}>{session.user.email}</AppText></View> : <AppText color={colors.muted} style={styles.center}>Comece com uma conta só sua.</AppText>}
      <LearningStats motionKey="profile" entrance centered xp={progress?.xp ?? profile?.xp_total ?? 0} streak={profile?.current_streak ?? 0} />
      {profile ? <><Button title="Escolher avatar" icon={Smile} disabled={offline || !!busy} onPress={()=>setAvatarPicker(true)} /><Button title="Personalizar perfil" icon={Palette} variant="secondary" disabled={offline || !!busy || appearance.loading} onPress={()=>setAppearancePicker(true)} /></> : null}
    </View>
    {photoPicker && profile && session ? <ProfilePhotoPicker key={session.user.id} owner={session.user.id} avatarKey={profile.avatar_key} onClose={()=>setPhotoPicker(false)} onChanged={async()=>{await sync();}} /> : null}
    {avatarPicker && profile ? <AvatarPicker currentKey={profile.avatar_key} onSave={updateAvatar} onClose={()=>setAvatarPicker(false)} /> : null}
    {appearancePicker && profile ? <ProfileAppearancePicker key={profile.id} current={appearance.appearance} avatarKey={profile.avatar_key} name={displayName}
      vip={vip} loading={appearance.loading} loadError={appearance.error} onRetry={()=>void appearance.refresh()}
      onSave={async value=>{await appearance.save(value);setNotice({tone:'success',message:'Personalização salva.'});}}
      onClose={()=>setAppearancePicker(false)} onPhoto={!isGuest && session ? ()=>{setAppearancePicker(false);setPhotoPicker(true);} : undefined} /> : null}
    {notice ? <Notice {...notice} /> : null}
    <View testID="profile-actions" style={actionStyles.actions}>
      <ProfileActionGroup title="Conta">
        <ProfileActionRow title="Arca VIP" icon={Crown} onPress={() => router.push('/vip')} />
        <ProfileActionRow title="Convide e ganhe bateria" icon={Gift} onPress={() => router.push('/invite')} />
        {profile ? editing ? <UsernameForm onBusyChange={saving=>setBusy(saving ? 'save' : null)} onDone={()=>{setEditing(false);setNotice({tone:'success',message:'Nome de usuário atualizado.'});}} onCancel={()=>setEditing(false)} /> : <ProfileActionRow title={hasChosenUsername(profile) ? 'Editar perfil' : 'Escolher nome de usuário'} icon={Pencil} disabled={offline || !!busy} onPress={()=>{setEditing(true);setNotice(null);}} /> : null}
        {isGuest ? <><ProfileActionRow title="Salve seu progresso" icon={UserRound} onPress={() => { if (progress?.completedLessonIds.length) requestGuestImport(); else router.push('/(auth)/signup'); }} /><ProfileActionRow title="Já tenho uma conta" icon={LogIn} onPress={() => router.push('/(auth)/login')} /></> : <><ProfileActionRow title={resetSent ? 'E-mail de recuperação enviado' : 'Alterar senha'} icon={LockKeyhole} onPress={() => void reset()} loading={busy === 'reset'} disabled={!!busy || resetSent} />{importAvailable ? <ProfileActionRow title="Salve seu progresso" icon={UserRound} onPress={()=>requestGuestImport()} disabled={!!busy} /> : null}</>}
      </ProfileActionGroup>
      <ProfileActionGroup title="Estudo"><ProfileActionRow title="Resumo semanal" icon={CalendarDays} onPress={()=>router.push('/study/weekly')} disabled={!!busy} /><ProfileActionRow title="Lembrete de estudo" icon={Bell} onPress={()=>router.push('/study/reminders')} disabled={!!busy} /></ProfileActionGroup>
      <ProfileActionGroup title="Suporte">
        <ProfileActionRow title="Histórico de estudo" icon={History} onPress={() => router.push('/study/history')} disabled={!!busy} />
        <ProfileActionRow title="Ajuda e suporte" icon={Mail} onPress={() => router.push('/support')} disabled={!!busy} />
        <ProfileActionRow title="Política de Privacidade" icon={ShieldCheck} onPress={() => router.push('/privacy')} disabled={!!busy} />
      </ProfileActionGroup>
      <ProfileActionGroup title="Sessão"><ProfileActionRow title={isGuest ? 'Sair do modo de visita' : 'Sair da conta'} icon={LogOut} onPress={() => void logout()} loading={busy === 'logout'} disabled={!!busy} /></ProfileActionGroup>
      {!isGuest ? <View style={actionStyles.danger}><ProfileActionRow title="Excluir conta" icon={Trash2} danger onPress={() => router.push('/account/delete')} disabled={!!busy} /></View> : null}
    </View>
  </Screen>;
}
const actionStyles=StyleSheet.create({actions:{gap:24},editForm:{gap:12,paddingVertical:12},danger:{paddingTop:8,borderTopWidth:1,borderColor:colors.errorSoft}});

const styles = StyleSheet.create({
  title: { fontFamily: fonts.heavy, fontSize: 32, lineHeight: 40, color: colors.text },
  heading:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',paddingTop:spacing.xs},milestones:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm,padding:spacing.lg,backgroundColor:colors.surface,borderRadius:28,boxShadow:'0 8px 22px rgba(71,121,218,0.1)'},milestone:{flex:1,minWidth:74,alignItems:'center',gap:spacing.xs},achievements:{flexDirection:'row',alignItems:'center',gap:spacing.sm,paddingVertical:spacing.xs},soon:{marginLeft:'auto'},identity: { ...surfaces.card, alignItems: 'center', gap: spacing.md, padding: spacing.lg }, avatar: { padding: 5, borderWidth: 2, borderColor: colors.primary, borderRadius: radius.pill, backgroundColor: colors.surface, boxShadow: '0 6px 20px rgba(46,107,239,0.12)' }, center: { textAlign: 'center' }, email: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' }, emailText: { flexShrink: 1 } });
