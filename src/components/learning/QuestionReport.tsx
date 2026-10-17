import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { ArrowLeft, CheckCircle2, Circle, CircleCheck, Flag, Send, X } from 'lucide-react-native';
import { AppText } from '@/components/common/AppText';
import { IconButton } from '@/components/common/IconButton';
import { Notice } from '@/components/common/Notice';
import { useAuth } from '@/hooks/useAuth';
import { useMotionPreference } from '@/hooks/useMotionPreference';
import { reportReasons, type ReportReason } from '@/lib/reports';
import { reportsRepository } from '@/services/reports';
import { colors, fonts } from '@/constants/theme';

let sequence = 0;
const requestKey = () => `report-${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`;
export function QuestionReport({ lessonId, questionId }: { lessonId: string; questionId: string }) {
  const { session } = useAuth();
  return (
    <ScopedReport
      key={`${session?.user.id ?? 'guest'}:${questionId}`}
      owner={session?.user.id}
      lessonId={lessonId}
      questionId={questionId}
    />
  );
}
function ScopedReport({
  owner,
  lessonId,
  questionId,
}: {
  owner?: string;
  lessonId: string;
  questionId: string;
}) {
  const reduced = useMotionPreference();
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState<ReportReason | null>(null),
    [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false),
    [sent, setSent] = useState(false),
    [error, setError] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null),
    locked = useRef(false);
  const [initialKey] = useState(requestKey),
    key = useRef(initialKey);
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );
  async function submit() {
    if (!owner || !reason || locked.current) return;
    locked.current = true;
    setBusy(true);
    setError(null);
    const controller = new AbortController();
    request.current = controller;
    try {
      await reportsRepository(owner).submit(
        lessonId,
        questionId,
        reason,
        comment,
        key.current,
        controller.signal,
      );
      if (!controller.signal.aborted) setSent(true);
    } catch (caught) {
      if (!controller.signal.aborted)
        setError(caught instanceof Error ? caught.message : 'Não foi possível enviar seu relato.');
    } finally {
      if (!controller.signal.aborted) {
        locked.current = false;
        setBusy(false);
      }
    }
  }
  function close() {
    if (!locked.current) setOpen(false);
  }
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Reportar problema na pergunta"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, triggerStyles.surface, pressed && styles.pressed]}
      >
        <Flag size={16} color={colors.primaryDark} />
        <AppText variant="small" color={colors.primaryDark} style={triggerStyles.label}>
          Reportar problema
        </AppText>
      </Pressable>
      <Modal visible={open} transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={close}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.overlayContent}>
            <View accessibilityViewIsModal style={styles.panel}>
              <View style={styles.heading}>
                <Flag size={20} color={colors.primaryDark} />
                <AppText variant="h3" style={styles.grow} accessibilityRole="header">
                  {sent ? 'Relato recebido' : 'Reportar problema'}
                </AppText>
                <IconButton icon={X} label="Fechar relato" disabled={busy} onPress={close} />
              </View>
              {sent ? (
                <View style={styles.success}>
                  <CheckCircle2 size={40} color={colors.success} />
                  <AppText style={styles.center}>Obrigado por ajudar a melhorar o Arca!</AppText>
                  <Action label="Voltar à lição" onPress={close} />
                </View>
              ) : !owner ? (
                <>
                  <AppText>
                    Entre na sua conta para enviar relatos. Você pode continuar esta lição normalmente.
                  </AppText>
                  <Action label="Voltar à lição" onPress={close} />
                </>
              ) : (
                <>
                  <AppText variant="small" color={colors.muted}>
                    Qual é o problema com esta pergunta?
                  </AppText>
                  <View
                    accessibilityRole="radiogroup"
                    accessibilityLabel="Motivo do relato"
                    style={styles.reasons}
                  >
                    {(Object.entries(reportReasons) as [ReportReason, string][]).map(([value, label]) => (
                      <Pressable
                        key={value}
                        accessibilityRole="radio"
                        accessibilityLabel={label}
                        accessibilityState={{ checked: reason === value, disabled: busy }}
                        disabled={busy}
                        onPress={() => {
                          if (value !== reason) key.current = requestKey();
                          setReason(value);
                          setError(null);
                        }}
                        style={[styles.reason, reason === value && styles.selected]}
                      >
                        {reason === value ? (
                          <CircleCheck size={20} color={colors.primaryDark} />
                        ) : (
                          <Circle size={20} color={colors.muted} />
                        )}
                        <AppText variant="small">{label}</AppText>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.comment}>
                    <AppText variant="label">Comentário (opcional)</AppText>
                    <TextInput
                      accessibilityLabel="Comentário do relato"
                      placeholder="Conte o que você encontrou"
                      placeholderTextColor={colors.muted}
                      multiline
                      maxLength={1000}
                      editable={!busy}
                      value={comment}
                      onChangeText={value => {
                        if (value !== comment) key.current = requestKey();
                        setComment(value);
                      }}
                      style={styles.input}
                    />
                    <AppText variant="label" color={colors.muted} style={styles.count}>
                      {comment.length}/1000
                    </AppText>
                  </View>
                  {error ? <Notice tone="error" message={error} /> : null}
                  <Action
                    label="Enviar relato"
                    onPress={() => void submit()}
                    disabled={!reason || busy}
                    loading={busy}
                  />
                </>
              )}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}
const triggerStyles = StyleSheet.create({
  surface: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 8 },
  label: { fontFamily: fonts.bold },
});
function Action({
  label,
  onPress,
  disabled = false,
  loading = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const Icon = label === 'Voltar à lição' ? ArrowLeft : Send;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy: loading }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.send, disabled && styles.disabled]}
    >
      {loading ? <ActivityIndicator color={colors.surface} /> : <Icon size={17} color={colors.surface} />}
      <AppText variant="small" color={colors.surface} style={styles.actionText}>
        {label}
      </AppText>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  trigger: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    minHeight: 44,
    paddingHorizontal: 12,
  },
  pressed: { opacity: 0.6 },
  overlay: { flex: 1, backgroundColor: 'rgba(14,21,40,0.48)' },
  overlayContent: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  panel: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: colors.surface,
    borderRadius: 8,
    padding: 20,
    gap: 16,
  },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  grow: { flex: 1, minWidth: 0 },
  reasons: { gap: 6 },
  reason: {
    minHeight: 46,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
  },
  selected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  comment: { gap: 6 },
  input: {
    fontFamily: fonts.medium,
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 6,
    minHeight: 86,
    maxHeight: 180,
    padding: 12,
    textAlignVertical: 'top',
  },
  count: { textAlign: 'right' },
  send: {
    minHeight: 46,
    borderRadius: 6,
    backgroundColor: colors.primaryDark,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    gap: 8,
  },
  disabled: { opacity: 0.5 },
  actionText: { fontFamily: fonts.bold },
  success: { alignItems: 'center', gap: 18 },
  center: { textAlign: 'center' },
});
