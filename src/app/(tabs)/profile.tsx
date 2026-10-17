import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { Bell, BookOpen, CalendarDays, CheckCircle2, Flame, History, LockKeyhole, LogIn, LogOut, Mail, Pencil, Settings, ShieldCheck, Smile, Swords, Trash2, UserRound, UsersRound } from 'lucide-react-native';
import { Avatar } from '@/components/profile/Avatar';
import { AvatarPicker } from '@/components/profile/AvatarPicker';
import { ProfileSettings } from '@/components/profile/ProfileSettings';
import { AchievementsSection } from '@/components/profile/AchievementsSection';
import { ProfileActionGroup, ProfileActionRow } from '@/components/profile/ProfileActionList';
import { AnimatedCounter } from '@/components/animation/AnimatedCounter';
import { useCounterMotion } from '@/providers/RewardMotionProvider';
import { IconButton } from '@/components/common/IconButton';
import { journeyUnits } from '@/data/lessons';
import { LearningStats } from '@/components/learning/LearningStats';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Notice } from '@/components/common/Notice';
import { UsernameForm } from '@/components/profile/UsernameForm';
import { hasChosenUsername } from '@/lib/username';
import { LearningGate } from '@/components/learning/LearningGate';
import { SectionTitle } from '@/components/common/SectionTitle';
import { useAuth } from '@/hooks/useAuth';
import { useLearning } from '@/providers/LearningProvider';
import { requestPasswordReset, signOut } from '@/services/auth';
import { authErrorMessage } from '@/services/validation';
import { colors, fonts, radius, spacing } from '@/constants/theme';

export default function Profile() {
  return <LearningGate><ProfileContent /></LearningGate>;
}
function ProfileContent() {
  const { session, isGuest, exitGuest } = useAuth();
  const {profile,progress,unit,offline,importAvailable,requestGuestImport,updateAvatar} = useLearning();
  const [settings,setSettings]=useState(false);
  const [avatarPicker,setAvatarPicker] = useState(false);
  const [busy, setBusy] = useState<'logout' | 'reset' | 'save' | null>(null);
  const [editing,setEditing] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [notice, setNotice] = useState<{ message: string; tone: 'error' | 'success' } | null>(null);
  const name: unknown = session?.user.user_metadata.display_name;
  const displayName = profile?.display_name ?? (typeof name === 'string' && name.trim() ? name.trim() : 'Sua conta');
  const completedUnits=journeyUnits(unit).filter(item=>item.lessons.every(lesson=>progress?.completedLessonIds.includes(lesson.id))).length;
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
  return <Screen keyboard scene="ark" sceneScrolls>
    <View style={styles.heading}><AppText accessibilityRole="header" style={styles.title}>Perfil</AppText><IconButton icon={Settings} label="Configurações" onPress={()=>setSettings(true)} /></View>
    {settings ? <ProfileSettings onClose={()=>setSettings(false)} /> : null}
    <View style={styles.identity}><View style={styles.avatar}><Avatar avatarKey={profile?.avatar_key} size={124} label="Seu avatar" /></View><AppText variant="h2" style={styles.center}>{isGuest ? 'Olá, visitante.' : displayName}</AppText>{session?.user.email ? <View style={styles.email}><Mail size={16} color={colors.muted} /><AppText variant="small" color={colors.muted} style={styles.emailText}>{session.user.email}</AppText></View> : <AppText color={colors.muted} style={styles.center}>Comece com uma conta só sua.</AppText>}<LearningStats motionKey="profile" entrance centered xp={progress?.xp ?? profile?.xp_total ?? 0} streak={profile?.current_streak ?? 0} />{profile ? <Button title="Escolher avatar" icon={Smile} disabled={offline || !!busy} onPress={()=>setAvatarPicker(true)} /> : null}</View>
    {avatarPicker && profile ? <AvatarPicker currentKey={profile.avatar_key} onSave={updateAvatar} onClose={()=>setAvatarPicker(false)} /> : null}
    {notice ? <Notice {...notice} /> : null}
    <SectionTitle title="Minhas estatísticas" /><View style={styles.milestones}>{[{label:'Lições concluídas',value:progress?.completedLessonIds.length ?? 0,Icon:CheckCircle2},{label:'Unidades concluídas',value:completedUnits,Icon:BookOpen},{label:'Maior sequência',value:profile?.longest_streak ?? 0,Icon:Flame}].map(({label,value,Icon})=><View key={label} style={styles.milestone}><Icon size={20} color={colors.tealInk} /><ProfileCounter label={label} value={value} /><AppText variant="small" color={colors.muted} style={styles.center}>{label}</AppText></View>)}</View>
    <View testID="profile-actions" style={actionStyles.actions}>
      <ProfileActionGroup title="Conta">
        {profile ? editing ? <UsernameForm onBusyChange={saving=>setBusy(saving ? 'save' : null)} onDone={()=>{setEditing(false);setNotice({tone:'success',message:'Nome de usuário atualizado.'});}} onCancel={()=>setEditing(false)} /> : <ProfileActionRow title={hasChosenUsername(profile) ? 'Editar perfil' : 'Escolher nome de usuário'} icon={Pencil} disabled={offline || !!busy} onPress={()=>{setEditing(true);setNotice(null);}} /> : null}
        {isGuest ? <><ProfileActionRow title="Salve seu progresso" icon={UserRound} onPress={() => { if (progress?.completedLessonIds.length) requestGuestImport(); else router.push('/(auth)/signup'); }} /><ProfileActionRow title="Já tenho uma conta" icon={LogIn} onPress={() => router.push('/(auth)/login')} /></> : <><ProfileActionRow title={resetSent ? 'E-mail de recuperação enviado' : 'Alterar senha'} icon={LockKeyhole} onPress={() => void reset()} loading={busy === 'reset'} disabled={!!busy || resetSent} />{importAvailable ? <ProfileActionRow title="Salve seu progresso" icon={UserRound} onPress={()=>requestGuestImport()} disabled={!!busy} /> : null}</>}
      </ProfileActionGroup>
      <ProfileActionGroup title="Estudo"><ProfileActionRow title="Resumo semanal" icon={CalendarDays} onPress={()=>router.push('/study/weekly')} disabled={!!busy} /><ProfileActionRow title="Lembrete de estudo" icon={Bell} onPress={()=>router.push('/study/reminders')} disabled={!!busy} /></ProfileActionGroup>
      <ProfileActionGroup title="Comunidade"><ProfileActionRow title="Amigos" icon={UsersRound} onPress={()=>router.push('/friends')} disabled={!!busy} /><ProfileActionRow title="Desafios entre amigos" icon={Swords} onPress={()=>router.push('/challenges')} disabled={!!busy} /></ProfileActionGroup>
      <ProfileActionGroup title="Suporte">
        <ProfileActionRow title="Histórico de estudo" icon={History} onPress={() => router.push('/study/history')} disabled={!!busy} />
        <ProfileActionRow title="Ajuda e suporte" icon={Mail} onPress={() => router.push('/support')} disabled={!!busy} />
        <ProfileActionRow title="Política de Privacidade" icon={ShieldCheck} onPress={() => router.push('/privacy')} disabled={!!busy} />
      </ProfileActionGroup>
      <ProfileActionGroup title="Sessão"><ProfileActionRow title={isGuest ? 'Sair do modo de visita' : 'Sair da conta'} icon={LogOut} onPress={() => void logout()} loading={busy === 'logout'} disabled={!!busy} /></ProfileActionGroup>
      {!isGuest ? <View style={actionStyles.danger}><ProfileActionRow title="Excluir conta" icon={Trash2} danger onPress={() => router.push('/account/delete')} disabled={!!busy} /></View> : null}
    </View>
    <AchievementsSection />
  </Screen>;
}
const actionStyles=StyleSheet.create({actions:{gap:24},editForm:{gap:12,paddingVertical:12},danger:{paddingTop:8,borderTopWidth:1,borderColor:colors.errorSoft}});

function ProfileCounter({label,value}: {label:string;value:number}) {
  const transition=useCounterMotion(`profile:${label}`,value,true);
  return <AnimatedCounter transition={transition} variant="h2" duration={650} />;
}
const styles = StyleSheet.create({
  title: { fontFamily: fonts.heavy, fontSize: 36, lineHeight: 44, color: colors.surface, textShadowColor: 'rgba(0,30,75,0.85)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 7 },
  heading:{flexDirection:'row',justifyContent:'space-between',alignItems:'flex-start',minHeight:126,paddingTop:spacing.lg},milestones:{flexDirection:'row',flexWrap:'wrap',gap:spacing.sm,padding:spacing.lg,backgroundColor:colors.surface,borderRadius:28,boxShadow:'0 8px 22px rgba(71,121,218,0.1)'},milestone:{flex:1,minWidth:74,alignItems:'center',gap:spacing.xs},achievements:{flexDirection:'row',alignItems:'center',gap:spacing.sm,paddingVertical:spacing.xs},soon:{marginLeft:'auto'},identity: { alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor:colors.surface,borderRadius:28,boxShadow:'0 8px 22px rgba(71,121,218,0.1)' }, avatar: { padding: 5, borderWidth: 2, borderColor: colors.primary, borderRadius: radius.pill, backgroundColor: colors.surface, boxShadow: '0 6px 20px rgba(46,107,239,0.12)' }, center: { textAlign: 'center' }, email: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, maxWidth: '100%' }, emailText: { flexShrink: 1 } });
