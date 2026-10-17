import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createFeedbackPlayback } from '../src/lib/feedbackPlayback.ts';
import { createWebFeedbackPlayer } from '../src/lib/webFeedbackPlayer.ts';

function media() {
  let rejectPlay: (error: Error) => void = () => {};
  const value = {
    readyState: 4, error: null, currentTime: 0, src: '', preload: '', volume: 1,
    play: () => new Promise<void>((_resolve, reject) => { rejectPlay = reject; }),
    pause: () => rejectPlay(new Error('interrupted')), load: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, removeAttribute: () => {},
  };
  return value;
}
test('browser pause handles the rejected play promise without an unhandled error', async () => {
  const selected = createWebFeedbackPlayer(media(), 'correct.wav', 0.65);
  const other = createWebFeedbackPlayer(media(), 'wrong.wav', 0.65);
  const errors: unknown[] = [];
  const playback = createFeedbackPlayback({correct:selected,wrong:other}, async () => {}, {onError:(_sound,error)=>errors.push(error)});
  playback.setActive(true);
  const pending = playback.play('correct');
  await new Promise(resolve => setImmediate(resolve));
  playback.setActive(false);
  await assert.doesNotReject(pending);
  assert.deepEqual(errors, []);
});
test('web source and volume are preserved when loading and no media is safe during server rendering', async () => {
  const element = media();
  const player = createWebFeedbackPlayer(element, 'correct.wav', 0.65);
  player.reload?.(); assert.equal(element.src, 'correct.wav'); assert.equal(element.volume, 0.65);
  await player.seekTo(0); player.dispose();
  const server = createWebFeedbackPlayer(null, 'correct.wav', 0.65);
  assert.equal(server.currentStatus.isLoaded, false);
  await server.play(); server.pause(); server.dispose();
});
