import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialUnit } from '../../src/data/lessons.ts';
import { createAccountLearningStore } from '../../src/lib/accountLearningStore.ts';
import { decodeResult, decodeSnapshot } from '../../src/lib/backendDecoders.ts';
import { BackendRejectedError } from '../../src/lib/backendErrors.ts';
import type { LearningRepository } from '../../src/types/backend.ts';
import { answersFor } from '../learningFixtures.ts';
import { createTestDatabase, createTestUser, databaseRpc } from '../helpers/database.ts';

test('account store integrates with all SQL migrations: lost receipt, restart, outbox, XP, RLS and review', async t => {
  const db = await createTestDatabase(); t.after(() => db.close());
  const owner = '00000000-0000-4000-8000-000000000301';
  const other = '00000000-0000-4000-8000-000000000302';
  await createTestUser(db, owner, 'integration_owner'); await createTestUser(db, other, 'integration_other');
  const values = new Map<string, string>();
  const storage = { getItem: async (key: string) => values.get(key) ?? null, setItem: async (key: string, value: string) => { values.set(key, value); } };
  let online = true, loseReceipt = true;
  const snapshot = async () => decodeSnapshot(await databaseRpc(db, owner, 'learning_snapshot'), owner, initialUnit);
  const repo: LearningRepository = {
    loadUnit: async () => { if (!online) throw new Error('offline'); return initialUnit; },
    loadSnapshot: async () => { if (!online) throw new Error('offline'); return snapshot(); },
    start: async lesson => { await databaseRpc(db, owner, 'start_learning_lesson', { p_lesson_id: lesson }); },
    complete: async attempt => {
      if (!online) throw new Error('offline');
      try {
        const value = await databaseRpc<{ snapshot: unknown; result: unknown }>(db, owner, 'complete_learning_lesson', {
          p_lesson_id: attempt.lessonId, p_answers: attempt.answers, p_attempt_id: attempt.id,
        });
        if (loseReceipt) { loseReceipt = false; online = false; throw new Error('lost receipt'); }
        return { snapshot: decodeSnapshot(value.snapshot, owner, initialUnit), result: decodeResult(value.result) };
      } catch (error) {
        if (error instanceof Error && /answer_invalid|attempt_conflict/.test(error.message)) throw new BackendRejectedError(error.message);
        throw error;
      }
    },
    importGuest: async () => { throw new Error('unused'); },
    updateAvatar: async () => { throw new Error('unused'); },
    updateProfile: async () => { throw new Error('unused'); },
  };
  const first = initialUnit.lessons[0]!, second = initialUnit.lessons[1]!;
  const store = createAccountLearningStore(storage, owner, repo); await store.load();
  const provisional = await store.complete(first, answersFor(first), 'receipt-lost');
  assert.equal(provisional.state.pending, 1); assert.equal((await snapshot()).progress.xp, 35);
  await store.complete(second, answersFor(second), 'offline-second');
  const reopened = createAccountLearningStore(storage, owner, repo);
  assert.equal((await reopened.load()).pending, 2);
  online = true;
  const synced = await reopened.sync();
  assert.equal(synced.pending, 0); assert.equal(synced.progress.xp, 70); assert.equal(synced.profile.xp_total, 70);
  const review = await reopened.complete(first, answersFor(first), 'review-first');
  assert.equal(review.result.xpEarned, 0); assert.equal(review.state.progress.xp, 70);
  assert.equal((await db.query<{ n: number }>('select count(*)::int n from xp_events where user_id=$1', [owner])).rows[0]!.n, 2);
  assert.equal(decodeSnapshot(await databaseRpc(db, other, 'learning_snapshot'), other, initialUnit).progress.xp, 0);
  await assert.rejects(databaseRpc(db, other, 'complete_learning_lesson', { p_lesson_id: second.id, p_answers: answersFor(second), p_attempt_id: 'locked' }), /lesson_locked/);
});
