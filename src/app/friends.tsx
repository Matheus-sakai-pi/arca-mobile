import { useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft, Check, RefreshCw, Search, Swords, UserMinus, UserPlus, UsersRound, X } from 'lucide-react-native';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { Button } from '@/components/common/Button';
import { Field } from '@/components/common/Field';
import { IconButton } from '@/components/common/IconButton';
import { Notice } from '@/components/common/Notice';
import { EmptyState, LoadingState } from '@/components/common/States';
import { Avatar } from '@/components/profile/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { useFriends } from '@/hooks/useFriends';
import { useLearning } from '@/providers/LearningProvider';
import { colors, fonts } from '@/constants/theme';
import type { FriendAction, Person } from '@/types/friends';
import { hasChosenUsername } from '@/lib/username';

export default function FriendsScreen() {
  const {session}=useAuth();
  const {profile}=useLearning();
  const {data,results,error,searchError,loading,searching,busy,refresh,search,act}=useFriends();
  const [query,setQuery]=useState('');
  const [removing,setRemoving]=useState<Person|null>(null);
  const disabled=busy || loading || searching;
  function action(person:Person,action:FriendAction) {
    if(action==='remove') setRemoving(person);
    else void act(person.id,action);
  }
  function people(title:string,list:Person[]) {
    return <View style={styles.section}><AppText variant="h3" accessibilityRole="header">{title} · {list.length}</AppText>{list.map(person=><PersonRow key={person.id} person={person} disabled={disabled} onAction={action} />)}</View>;
  }
  return <Screen keyboard>
    <View style={styles.heading}><IconButton icon={ArrowLeft} label="Voltar" onPress={()=>router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} /><AppText variant="h2" accessibilityRole="header" style={styles.title}>Amigos</AppText>{session ? <IconButton icon={RefreshCw} label="Atualizar amigos" disabled={disabled} onPress={()=>void refresh()} /> : null}</View>
    {!session ? <><EmptyState icon={UsersRound} artwork="friends" title="Uma jornada em boa companhia" message="Entre na sua conta para buscar amigos e receber pedidos de amizade." /><Button title="Entrar" onPress={()=>router.push('/(auth)/login')} /></> : <>
      <Button title="Desafios entre amigos" icon={Swords} variant="secondary" onPress={()=>router.push('/challenges')} />
      {profile && hasChosenUsername(profile) ? <AppText selectable color={colors.muted}>{profile.display_name}</AppText> : null}
      <View style={styles.search}><View style={styles.field}><Field label="Buscar por usuário" placeholder="@usuario" icon={Search} autoCapitalize="none" autoCorrect={false} maxLength={61} value={query} onChangeText={setQuery} editable={!busy} returnKeyType="search" onSubmitEditing={()=>void search(query)} /></View><IconButton icon={Search} label="Buscar pessoas" disabled={disabled || query.trim().length<3} onPress={()=>void search(query)} /></View>
      {error ? <Notice tone="error" message={error} /> : null}
      {searchError ? <Notice tone="error" message={searchError} /> : null}
      {searching ? <LoadingState message="Buscando pessoas…" /> : null}
      {results ? results.people.length ? people('Resultados',results.people) : <EmptyState icon={Search} artwork="friends" title="Nenhuma pessoa encontrada" message={`Nenhuma pessoa encontrada para @${results.query}.`} /> : null}
      {loading && !data ? <LoadingState message="Buscando amigos…" /> : null}
      {data?.incoming.length ? people('Pedidos recebidos',data.incoming) : null}
      {data?.outgoing.length ? people('Pedidos enviados',data.outgoing) : null}
      {data ? data.friends.length ? people('Meus amigos',data.friends) : !results && !searching ? <EmptyState icon={UsersRound} artwork="friends" title="Sua jornada pode ter companhia" message="Você ainda não tem amizades aceitas." /> : null : null}
    </>}
    {removing ? <Modal transparent visible animationType="fade" onRequestClose={()=>setRemoving(null)}><ScrollView style={styles.overlay} contentContainerStyle={styles.overlayContent}><View style={styles.dialog} accessibilityViewIsModal><AppText variant="h3">Remover amizade?</AppText><AppText>{removing.display_name} deixará de aparecer no seu ranking de amigos.</AppText><Button title="Remover amizade" icon={UserMinus} variant="secondary" onPress={()=>{void act(removing.id,'remove');setRemoving(null);}} /><Button title="Cancelar" variant="quiet" onPress={()=>setRemoving(null)} /></View></ScrollView></Modal> : null}
  </Screen>;
}

function PersonRow({person,disabled,onAction}:{person:Person;disabled:boolean;onAction:(person:Person,action:FriendAction)=>void}) {
  const actions=person.relationship==='none' ? [{action:'request',Icon:UserPlus,label:'Adicionar'}] : person.relationship==='incoming'
    ? [{action:'accept',Icon:Check,label:'Aceitar'},{action:'decline',Icon:X,label:'Recusar'}]
    : person.relationship==='outgoing' ? [{action:'cancel',Icon:X,label:'Cancelar pedido de'}] : [{action:'remove',Icon:UserMinus,label:'Remover'}];
  return <View testID={`person-${person.id}`} style={styles.person}><Avatar avatarKey={person.avatar_key} size={42} /><View style={styles.identity}><AppText style={styles.name}>{person.display_name}</AppText><AppText variant="small" color={colors.muted}>{person.relationship==='incoming' ? 'Quer ser seu amigo' : person.relationship==='outgoing' ? 'Pedido enviado' : person.relationship==='friend' ? 'Amigos' : ''}</AppText></View><View style={styles.actions}>{actions.map(({action,Icon,label})=><IconButton key={action} icon={Icon} label={`${label} ${person.display_name}`} disabled={disabled} onPress={()=>onAction(person,action as FriendAction)} />)}</View></View>;
}
const styles=StyleSheet.create({heading:{flexDirection:'row',alignItems:'center',gap:12},title:{flex:1,minWidth:0},search:{flexDirection:'row',alignItems:'flex-end',gap:8},field:{flex:1,minWidth:0},section:{gap:8},person:{flexDirection:'row',alignItems:'center',gap:8,paddingVertical:12,borderBottomWidth:1,borderColor:colors.border},identity:{flex:1,minWidth:0,gap:2},name:{fontFamily:fonts.heavy},actions:{flexDirection:'row',gap:4},overlay:{flex:1,backgroundColor:'rgba(34,33,42,0.45)'},overlayContent:{flexGrow:1,alignItems:'center',justifyContent:'center',padding:16},dialog:{width:'100%',maxWidth:420,backgroundColor:colors.surface,padding:24,borderRadius:8,gap:16}});
