import assert from 'node:assert/strict';
import { test } from 'node:test';
import { initialUnit } from '../../src/data/lessons.ts';
import { decodeChallengePlay, decodeChallenges } from '../../src/lib/challenges.ts';

const owner = '00000000-0000-4000-8000-000000000001';
const friend = '00000000-0000-4000-8000-000000000002';
const id = '00000000-0000-4000-8000-000000000003';
const item = { id, sender: owner, recipient: friend, total: 10, status: 'accepted',
  createdAt: '2026-10-16T12:00:00Z', expiresAt: '2026-10-23T12:00:00Z',
  friendName: '@amigo', avatarKey: 'dove', myScore: null, theirScore: null, friendFinished: false };
const play = () => ({ owner, id, questions: initialUnit.lessons[0]!.questions.map(
  ({ id, type, prompt, correctAnswer: _answer, explanation: _explanation, ...content }) => ({ id, type, prompt, content }),
) });

for (const score of [-1, 11, 0.5, NaN, Infinity, '10']) {
  test(`challenge scores reject invalid boundary ${String(score)}`, () => {
    assert.throws(() => decodeChallenges({ owner, items: [{ ...item, myScore: score }] }, owner));
  });
}

test('challenge list accepts zero/full score but hides unfinished opponent and duplicate identities', () => {
  assert.equal(decodeChallenges({ owner, items: [{ ...item, myScore: 0, theirScore: 10, friendFinished: true }] }, owner).items[0]!.myScore, 0);
  for (const change of [{ theirScore: 0 }, { myScore: 10, theirScore: 0 }, { recipient: owner }, { total: 7 }]) {
    assert.throws(() => decodeChallenges({ owner, items: [{ ...item, ...change }] }, owner));
  }
  assert.throws(() => decodeChallenges({ owner, items: [item, item] }, owner));
});

test('challenge questions reject leaked solutions, duplicate questions, wrong account and wrong challenge', () => {
  assert.equal(decodeChallengePlay(play(), owner, id).length, 10);
  const leaked = play(); Object.assign(leaked.questions[0]!.content, { correctAnswer: 'secret' });
  assert.throws(() => decodeChallengePlay(leaked, owner, id));
  const duplicate = play(); duplicate.questions[1] = duplicate.questions[0]!;
  assert.throws(() => decodeChallengePlay(duplicate, owner, id));
  assert.throws(() => decodeChallengePlay(play(), friend, id));
  assert.throws(() => decodeChallengePlay(play(), owner, friend));
});
