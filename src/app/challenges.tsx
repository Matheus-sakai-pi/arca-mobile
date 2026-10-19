import { useCallback, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Check, Plus, RefreshCw, Send, Swords, X } from '@/components/icons';
import { Screen } from '@/components/common/Screen';
import { AppText } from '@/components/common/AppText';
import { IconButton } from '@/components/common/IconButton';
import { Button } from '@/components/common/Button';
import { Notice } from '@/components/common/Notice';
import { EmptyState, LoadingState } from '@/components/common/States';
import { Avatar } from '@/components/profile/Avatar';
import { useAuth } from '@/hooks/useAuth';
import { challengesRepository } from '@/services/challenges';
import { friendsRepository } from '@/services/friends';
import type { ChallengePage } from '@/lib/challenges';
import { createChallengeKey } from '@/lib/challenges';
import type { Person } from '@/types/friends';
import { colors } from '@/constants/theme';

export default function Challenges() {
  const { session } = useAuth();
  return session ? (
    <Content key={session.user.id} owner={session.user.id} />
  ) : (
    <Screen>
      <IconButton icon={ArrowLeft} label="Voltar" onPress={() => router.back()} />
      <EmptyState
        icon={Swords}
        artwork="challenge"
        title="Desafie seus amigos"
        message="Entre na sua conta para participar."
      />
      <Button title="Entrar" onPress={() => router.push('/(auth)/login')} />
    </Screen>
  );
}
function Content({ owner }: { owner: string }) {
  const [page, setPage] = useState<ChallengePage | null>(null),
    [friends, setFriends] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [choosing, setChoosing] = useState(false);
  const generation = useRef(0),
    request = useRef<AbortController | null>(null),
    locked = useRef(false),
    keys = useRef(new Map<string, string>());
  const load = useCallback(async () => {
    if (locked.current) return;
    const version = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true);
    setError(null);
    try {
      const [next, people] = await Promise.all([
        challengesRepository(owner).load(controller.signal),
        friendsRepository(owner).load(controller.signal),
      ]);
      if (version === generation.current) {
        setPage(next);
        setFriends(people.friends);
      }
    } catch (cause) {
      if (version === generation.current)
        setError(cause instanceof Error ? cause.message : 'Não foi possível buscar os desafios.');
    } finally {
      if (version === generation.current) setLoading(false);
    }
  }, [owner]);
  useFocusEffect(
    useCallback(() => {
      void load();
      return () => {
        generation.current++;
        request.current?.abort();
      };
    }, [load]),
  );
  async function act(id: string, action: 'accept' | 'decline' | 'cancel' | 'create') {
    if (locked.current) return;
    locked.current = true;
    const version = ++generation.current;
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError(null);
    try {
      const api = challengesRepository(owner);
      let next: ChallengePage;
      if (action === 'create') {
        let key = keys.current.get(id);
        if (!key) {
          key = createChallengeKey();
          keys.current.set(id, key);
        }
        await api.create(id, key, controller.signal);
        next = await api.load(controller.signal);
      } else next = await api.act(id, action, controller.signal);
      if (version === generation.current) {
        if (action === 'create') keys.current.delete(id);
        setPage(next);
        setChoosing(false);
      }
    } catch (cause) {
      if (version === generation.current)
        setError(cause instanceof Error ? cause.message : 'Não foi possível concluir.');
    } finally {
      locked.current = false;
      if (version === generation.current) {
        setBusy(false);
        setLoading(false);
      }
    }
  }
  return (
    <Screen>
      <View style={styles.heading}>
        <IconButton
          icon={ArrowLeft}
          label="Voltar"
          disabled={busy}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/friends'))}
        />
        <AppText variant="h2" style={styles.grow}>
          Desafios
        </AppText>
        <IconButton
          icon={RefreshCw}
          label="Atualizar desafios"
          disabled={loading || busy}
          onPress={() => void load()}
        />
      </View>
      <Button
        title="Desafiar amigo"
        icon={Plus}
        disabled={loading || busy || !page}
        onPress={() => {
          setError(null);
          setChoosing(true);
        }}
      />
      {error && !choosing ? <Notice tone="error" message={error} /> : null}
      {loading && !page ? <LoadingState /> : null}
      {page && !page.items.length ? (
        <EmptyState
          icon={Swords}
          artwork="challenge"
          title="Uma nova forma de praticar"
          message="Dez perguntas, uma tentativa para cada amigo. O resultado aparece quando os dois terminam. Sem XP extra."
        />
      ) : null}
      {page?.items.map(item => {
        const incoming = item.recipient === owner;
        const finished = item.myScore !== null && item.theirScore !== null;
        const status = finished
          ? item.myScore === item.theirScore
            ? 'Empate'
            : item.myScore! > item.theirScore!
              ? 'Você venceu'
              : 'Seu amigo venceu'
          : item.status === 'expired'
            ? 'Prazo encerrado'
            : item.status === 'declined'
              ? 'Convite recusado'
              : item.status === 'cancelled'
                ? 'Convite cancelado'
                : item.status === 'pending'
                  ? incoming
                    ? 'Convite recebido'
                    : 'Aguardando aceite'
                  : item.myScore !== null
                    ? 'Aguardando seu amigo'
                    : 'Pronto para jogar';
        return (
          <View key={item.id} style={styles.item}>
            <View style={styles.heading}>
              <Avatar avatarKey={item.avatarKey} size={44} />
              <View style={styles.grow}>
                <AppText variant="h3">{item.friendName}</AppText>
                <AppText variant="small" color={colors.muted}>
                  {status}
                </AppText>
              </View>
              <Swords size={22} color={colors.tealInk} />
            </View>
            <AppText variant="small" color={colors.muted}>
              {item.total} perguntas
            </AppText>
            {item.myScore !== null ? (
              <AppText>
                Você: {item.myScore}/{item.total}
                {item.theirScore !== null ? ` · ${item.friendName}: ${item.theirScore}/${item.total}` : ''}
              </AppText>
            ) : null}
            {!finished && ['pending', 'accepted'].includes(item.status) ? (
              <AppText variant="small" color={colors.muted}>
                Até {new Date(item.expiresAt).toLocaleDateString('pt-BR')}
              </AppText>
            ) : null}
            {item.status === 'pending' ? (
              incoming ? (
                <View style={styles.heading}>
                  <Button
                    title="Aceitar"
                    icon={Check}
                    variant="secondary"
                    disabled={busy}
                    onPress={() => void act(item.id, 'accept')}
                  />
                  <IconButton
                    label={`Recusar desafio de ${item.friendName}`}
                    icon={X}
                    disabled={busy}
                    onPress={() => void act(item.id, 'decline')}
                  />
                </View>
              ) : (
                <Button
                  title="Cancelar convite"
                  variant="quiet"
                  icon={X}
                  disabled={busy}
                  onPress={() => void act(item.id, 'cancel')}
                />
              )
            ) : null}
            {item.status === 'accepted' && item.myScore === null ? (
              <Button
                title="Começar desafio"
                icon={Swords}
                disabled={busy}
                onPress={() => router.push({ pathname: '/challenges/[id]', params: { id: item.id } })}
              />
            ) : null}
          </View>
        );
      })}
      {choosing ? (
        <Modal
          visible
          transparent
          animationType="fade"
          onRequestClose={() => {
            if (!busy) setChoosing(false);
          }}
        >
          <ScrollView style={styles.overlay} contentContainerStyle={styles.overlayContent}>
            <View style={styles.dialog} accessibilityViewIsModal>
              <View style={styles.heading}>
                <AppText variant="h3" style={styles.grow}>
                  Escolher amigo
                </AppText>
                <IconButton
                  icon={X}
                  label="Fechar convite"
                  disabled={busy}
                  onPress={() => setChoosing(false)}
                />
              </View>
              <AppText color={colors.muted}>
                Dez perguntas em comum. Prazo de 7 dias para os dois concluírem.
              </AppText>
              {error ? <Notice tone="error" message={error} /> : null}
              {friends.length ? (
                friends.map(person => (
                  <View key={person.id} style={styles.heading}>
                    <Avatar avatarKey={person.avatar_key} size={36} />
                    <AppText style={styles.grow}>{person.display_name}</AppText>
                    <IconButton
                      icon={Send}
                      label={`Desafiar ${person.display_name}`}
                      disabled={busy}
                      onPress={() => void act(person.id, 'create')}
                    />
                  </View>
                ))
              ) : (
                <>
                  <AppText>Você ainda não tem amizades aceitas.</AppText>
                  <Button
                    title="Buscar amigos"
                    icon={Plus}
                    onPress={() => {
                      setChoosing(false);
                      router.push('/friends');
                    }}
                  />
                </>
              )}
            </View>
          </ScrollView>
        </Modal>
      ) : null}
    </Screen>
  );
}
const styles = StyleSheet.create({
  heading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  item: { gap: 12, paddingVertical: 20, borderBottomWidth: 1, borderColor: colors.border },
  overlay: { flex: 1, backgroundColor: 'rgba(34,33,42,0.45)' },
  overlayContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  dialog: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 20,
    gap: 16,
  },
});
