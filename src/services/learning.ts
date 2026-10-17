import type { SupabaseClient } from '@supabase/supabase-js';
import { combineUnits, initialUnit } from '@/data/lessons';
import { decodeResult, decodeSnapshot, decodeUnit, object } from '@/lib/backendDecoders';
import type { Database, Json, LearningRepository } from '@/types/backend';
import type { Unit } from '@/types/learning';
import { BackendRejectedError } from '@/lib/backendErrors';
import { scopedSupabase, supabase } from '@/lib/supabase';
import { isAvatarKey } from '@/constants/avatarKeys';
import { loadAllRows } from '@/lib/loadAllRows';
import { recordDiagnostic } from '@/lib/diagnostics';
import { assertUsernameAvailable } from './username';
import { normalizeUsername } from '@/lib/username';

export async function loadLessonHistory(userId: string) {
  if (!supabase) return [];
  const client = scopedSupabase(supabase, userId);
  const { data, error } = await client
    .from('lesson_attempts')
    .select('result')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(500);
  check(error);
  return (data ?? []).map(row => decodeResult(row.result));
}

function check(error: { code?: string; message: string } | null) {
  if (!error) return;
  if (error.message.includes('battery_receipts_required'))
    throw new Error(
      'Sua tentativa continua guardada. Conecte-se e retome a lição para conferir as respostas registradas.',
    );
  if (error.message.includes('energy_start_required') || error.message.includes('energy_exhausted'))
    throw new Error(
      'Esta tentativa continua guardada. Conecte-se e autorize a lição com energia antes de sincronizar novamente.',
    );
  if (['P0001', '42501', '23505', '23514', '22P02'].includes(error.code ?? ''))
    throw new BackendRejectedError(error.message);
  throw new Error('Não foi possível acessar sua conta agora.');
}
export function createLearningRepository(
  authClient: SupabaseClient<Database>,
  userId: string,
): LearningRepository {
  const client = scopedSupabase(authClient, userId);
  let unit: Unit = initialUnit;
  return {
    async loadUnit() {
      const started = Date.now();
      const header = await client
        .from('units')
        .select('*')
        .eq('course_id', 'biblia-basica')
        .order('order_index');
      check(header.error);
      const lessons = await client
        .from('lessons')
        .select('*')
        .in('unit_id', header.data?.map(item => item.id) ?? [])
        .order('order_index');
      check(lessons.error);
      const questions = await loadAllRows(
        (start, end) =>
          client
            .from('questions')
            .select('*')
            .in('lesson_id', lessons.data?.map(lesson => lesson.id) ?? [])
            .lt('order_index', 1000)
            .order('lesson_id')
            .order('order_index')
            .range(start, end),
        check,
      );
      unit = combineUnits(
        (header.data ?? []).map(item =>
          decodeUnit(
            item,
            lessons.data?.filter(lesson => lesson.unit_id === item.id),
            questions,
          ),
        ),
      );
      recordDiagnostic('curriculum_loaded', Date.now() - started);
      return unit;
    },
    async loadSnapshot() {
      const { data, error } = await client.rpc('learning_snapshot', { p_unit: unit.id });
      check(error);
      return decodeSnapshot(data, userId, unit);
    },
    async start(lessonId) {
      const { error } = await client.rpc('start_learning_lesson', { p_lesson_id: lessonId });
      check(error);
    },
    async complete(attempt) {
      const { data, error } = await client.rpc('complete_learning_lesson', {
        p_lesson_id: attempt.lessonId,
        p_answers: attempt.answers as Json,
        p_attempt_id: attempt.id,
      });
      check(error);
      if (!object(data)) throw new Error('Resposta do servidor inválida.');
      const result = decodeResult(data.result);
      if (result.attemptId !== attempt.id || result.lessonId !== attempt.lessonId)
        throw new Error('Tentativa do servidor inválida.');
      return { snapshot: decodeSnapshot(data.snapshot, userId, unit), result };
    },
    async importGuest(sourceId, progress) {
      const { data, error } = await client.rpc('import_guest_progress', {
        p_source_id: sourceId,
        p_completed_ids: progress.completedLessonIds,
        p_xp: progress.xp,
      });
      check(error);
      return decodeSnapshot(data, userId, unit);
    },
    async updateProfile(identity) {
      const username = normalizeUsername(identity.username);
      await assertUsernameAvailable(username, userId);
      const { error } = await client
        .from('profiles')
        .update({ ...identity, username, display_name: `@${username}` })
        .eq('id', userId);
      check(error);
      return (await this.loadSnapshot()).profile;
    },
    async updateAvatar(key) {
      if (!isAvatarKey(key)) throw new Error('Escolha um avatar disponível.');
      const { data, error } = await client
        .from('profiles')
        .update({ avatar_key: key })
        .eq('id', userId)
        .select('avatar_key, updated_at')
        .single();
      check(error);
      if (!data || data.avatar_key !== key || !Number.isFinite(Date.parse(data.updated_at)))
        throw new Error('Não foi possível confirmar seu avatar.');
      return data;
    },
  };
}
