import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { createFeedbackPlayback, feedbackAudioMode, feedbackPlayerOptions } from '../src/lib/feedbackPlayback.ts';
import { initialUnit } from '../src/data/lessons.ts';
import { isCorrect } from '../src/lib/lessonEngine.ts';
import { wrongAnswer } from './learningFixtures.ts';
import { JOURNEY_CONNECTOR_HEIGHT, journeyConnector, journeyGeometry } from '../src/lib/journeyLayout.ts';

test('Android feedback uses media output even in silent/vibrate mode without recording or background audio', () => {
  assert.equal(feedbackPlayerOptions.downloadFirst,false);
  assert.equal(feedbackAudioMode.playsInSilentMode, true);
  assert.equal(feedbackAudioMode.shouldRouteThroughEarpiece, false);
  assert.equal(feedbackAudioMode.shouldPlayInBackground, false);
  assert.equal(feedbackAudioMode.allowsRecording, false);
  assert.equal(feedbackAudioMode.allowsBackgroundRecording, false);
  assert.equal(feedbackAudioMode.interruptionMode, 'mixWithOthers');
});

test('Android decoder event error is consumed even when currentStatus.error is null; failed wrong source recovers once',async()=>{
  const audio=player(false);
  let listener:((status?:{isLoaded?:boolean;error?:string|null})=>void)|null=null;
  let reloads=0;
  const errors:unknown[]=[];
  const wrong={...audio,get currentStatus(){return {isLoaded:audio.isLoaded,error:null};},
    addListener:(_:'playbackStatusUpdate',fn:typeof listener)=>{listener=fn;return {remove:()=>{listener=null;}};},
    reload:()=>{reloads++;audio.isLoaded=true;},
  };
  const playback=createFeedbackPlayback({correct:player(),wrong},async()=>undefined,{loadTimeoutMs:1000,onError:(_,error)=>errors.push(error)});
  playback.setActive(true);
  const pending=playback.play('wrong');await Promise.resolve();
  assert.ok(listener);(listener as NonNullable<typeof listener>)({isLoaded:false,error:'SOURCE_ERROR'});
  await pending;
  assert.equal(reloads,1);assert.equal(audio.calls.filter(call=>call === 'play').length,1);assert.deepEqual(errors,[]);
  await playback.play('wrong');assert.equal(reloads,1);assert.equal(audio.calls.filter(call=>call === 'play').length,2);
});

test('failed seek reloads only the selected player once, then subsequent wrong answers reuse it',async()=>{
  const wrong=player();let reloads=0,fail=true;
  const playback=createFeedbackPlayback({correct:player(),wrong:{...wrong,
    seekTo:async seconds=>{if(fail){fail=false;throw new Error('failed native seek');}await wrong.seekTo(seconds);},
    reload:()=>{reloads++;},
  }},async()=>undefined);
  playback.setActive(true);await playback.play('wrong');await playback.play('wrong');
  assert.equal(reloads,1);assert.equal(wrong.calls.filter(call=>call === 'play').length,2);
});

test('requested wrong/wrong/correct/wrong/correct/wrong sequence and all sixteen graded formats choose independent players',async()=>{
  const correct=player(),wrong=player();const playback=createFeedbackPlayback({correct,wrong},async()=>undefined);
  playback.setActive(true);
  for(const sound of ['wrong','wrong','correct','wrong','correct','wrong'] as const)await playback.play(sound);
  assert.equal(correct.calls.filter(call=>call === 'play').length,2);assert.equal(wrong.calls.filter(call=>call === 'play').length,4);
  const types=new Set<string>();
  for(const question of initialUnit.lessons.flatMap(lesson=>lesson.questions)){
    if(question.type === 'content_card' || types.has(question.type))continue;
    types.add(question.type);
    assert.equal(isCorrect(question,wrongAnswer(question)),false);
    await playback.play(isCorrect(question,wrongAnswer(question)) ? 'correct':'wrong');
    await playback.play(isCorrect(question,question.correctAnswer) ? 'correct':'wrong');
  }
  assert.equal(types.size,16);assert.equal(wrong.calls.filter(call=>call === 'play').length,20);assert.equal(correct.calls.filter(call=>call === 'play').length,18);
});

function player(loaded = true) {
  const calls: string[] = [];
  return { calls, isLoaded: loaded, get currentStatus(): { isLoaded: boolean } { return { isLoaded: this.isLoaded }; }, pause: () => { calls.push('pause'); }, seekTo: async (time: number) => { calls.push(`seek:${time}`); }, play: () => { calls.push('play'); } };
}

test('five Android answers replay ended players even when the native isLoaded getter becomes false', async () => {
  function androidPlayer() {
    let state: 'ready' | 'ended' = 'ready';
    const calls: string[] = [];
    return {
      calls,
      get isLoaded() { return state === 'ready'; },
      get currentStatus() { return { isLoaded: state === 'ready' || state === 'ended' }; },
      pause() { calls.push('pause'); },
      async seekTo(seconds: number) { calls.push(`seek:${seconds}`); state = 'ready'; },
      play() { calls.push('play'); state = 'ended'; },
    };
  }
  for (const sequence of [
    ['correct', 'wrong', 'correct', 'wrong', 'correct'],
    ['correct', 'correct', 'correct', 'correct', 'correct'],
    ['wrong', 'wrong', 'wrong', 'wrong', 'wrong'],
  ] as const) {
    const players = { correct: androidPlayer(), wrong: androidPlayer() };
    const playback = createFeedbackPlayback(players, async () => undefined);
    playback.setActive(true);
    for (const sound of sequence) {
      await playback.play(sound);
      assert.equal(players[sound].isLoaded, false);
      assert.equal(players[sound].currentStatus.isLoaded, true);
    }
    for (const sound of ['correct', 'wrong'] as const) {
      const expected = sequence.filter(value => value === sound).length;
      assert.equal(players[sound].calls.filter(value => value === 'play').length, expected);
      assert.equal(players[sound].calls.filter(value => value === 'seek:0').length, expected);
    }
  }
});
test('correct and wrong use their own reusable player and rewind every replay', async () => {
  const correct = player();
  const wrong = player();
  const playback = createFeedbackPlayback({ correct, wrong }, async () => undefined);
  playback.setActive(true);
  await playback.play('correct');
  await playback.play('correct');
  assert.deepEqual(correct.calls, ['pause', 'seek:0', 'play', 'pause', 'seek:0', 'play']);
  assert.deepEqual(wrong.calls, ['pause', 'pause']);
  await playback.play('wrong');
  assert.deepEqual(wrong.calls.slice(-3), ['pause', 'seek:0', 'play']);
  assert.equal(correct.calls.at(-1), 'pause');
});
test('disabled or unfocused sound performs no loading/seek/play work', async () => {
  const correct = player();
  const wrong = player();
  let preparations = 0;
  const playback = createFeedbackPlayback({ correct, wrong }, async () => { preparations++; });
  await playback.play('correct');
  playback.setActive(true);
  playback.setEnabled(false);
  await playback.play('wrong');
  assert.equal(preparations, 0);
  assert.ok(!correct.calls.includes('play') && !wrong.calls.includes('play'));
});
test('unloaded asset and audio mode/decoder failures are nonfatal', async () => {
  const correct = player(false);
  const wrong = player();
  const unloaded = createFeedbackPlayback({ correct, wrong }, async () => undefined, { loadTimeoutMs: 15 });
  unloaded.setActive(true);
  await unloaded.play('correct');
  assert.deepEqual(correct.calls, []);
  const failed = createFeedbackPlayback({ correct, wrong }, async () => { throw new Error('audio unavailable'); });
  failed.setActive(true);
  await assert.doesNotReject(failed.play('wrong'));
  assert.ok(!wrong.calls.includes('play'));
  const decoder = createFeedbackPlayback({ correct: { ...player(), seekTo: async () => { throw new Error('decoder'); } }, wrong }, async () => undefined);
  decoder.setActive(true);
  await assert.doesNotReject(decoder.play('correct'));
});
test('turning sound off or leaving while seek is pending cancels late playback', async () => {
  for (const cancel of ['disabled', 'unfocused']) {
    let release: () => void = () => undefined;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const correct = { ...player(), seekTo: async () => pending };
    const playback = createFeedbackPlayback({ correct, wrong: player() }, async () => undefined);
    playback.setActive(true);
    const play = playback.play('correct');
    await Promise.resolve();
    if (cancel === 'disabled') playback.setEnabled(false); else playback.setActive(false);
    release();
    await play;
    assert.ok(!correct.calls.includes('play'));
  }
});
test('only the latest sound request plays if seeks complete out of order', async () => {
  let release: () => void = () => undefined;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const correct = { ...player(), seekTo: async () => pending };
  const wrong = player();
  const playback = createFeedbackPlayback({ correct, wrong }, async () => undefined);
  playback.setActive(true);
  const first = playback.play('correct');
  await Promise.resolve();
  await playback.play('wrong');
  release();
  await first;
  assert.ok(!correct.calls.includes('play'));
  assert.equal(wrong.calls.filter(call => call === 'play').length, 1);
});
test('focus can reactivate playback, including repeated effect setup/cleanup', async () => {
  const correct = player();
  const playback = createFeedbackPlayback({ correct, wrong: player() }, async () => undefined);
  playback.setActive(true);
  playback.setActive(false);
  playback.setActive(true);
  playback.setEnabled(false);
  playback.setEnabled(true);
  await playback.play('correct');
  assert.equal(correct.calls.at(-1), 'play');
});
function loadingPlayer() {
  const audio = player(false);
  const listeners = new Set<() => void>();
  return {
    ...audio,
    listeners,
    get currentStatus() { return { isLoaded: audio.isLoaded }; },
    setLoaded(loaded: boolean) { audio.isLoaded = loaded; for (const listener of listeners) listener(); },
    addListener(_event: 'playbackStatusUpdate', listener: () => void) {
      listeners.add(listener);
      return { remove: () => { listeners.delete(listener); } };
    },
  };
}
test('five consecutive wrong answers survive asynchronous loading/buffering instead of dropping feedback', async () => {
  const wrong = loadingPlayer();
  const correct = player();
  const playback = createFeedbackPlayback({ correct, wrong }, async () => undefined);
  playback.setActive(true);
  for (let index = 0; index < 5; index++) {
    wrong.setLoaded(false);
    const request = playback.play('wrong');
    await Promise.resolve();
    assert.equal(wrong.listeners.size, 1);
    assert.equal(wrong.calls.filter(call => call === 'play').length, index);
    wrong.setLoaded(true);
    await request;
    assert.equal(wrong.listeners.size, 0);
    assert.equal(wrong.calls.filter(call => call === 'play').length, index + 1);
    assert.equal(wrong.calls.filter(call => call === 'seek:0').length, index + 1);
  }
  await playback.play('correct');
  assert.equal(correct.calls.at(-1), 'play');
});
test('failure to pause the other player does not silence wrong or correct feedback', async () => {
  for (const sound of ['wrong', 'correct'] as const) {
    const selected = player();
    const inactive = { ...player(), pause: () => { throw new Error('inactive native player'); } };
    const players = sound === 'wrong' ? { correct: inactive, wrong: selected } : { correct: selected, wrong: inactive };
    const playback = createFeedbackPlayback(players, async () => undefined);
    playback.setActive(true);
    await playback.play(sound);
    assert.deepEqual(selected.calls, ['pause', 'seek:0', 'play']);
  }
});
test('leaving, disabling or a newer answer cancels pending load and removes listeners', async () => {
  for (const action of ['leave', 'disable', 'newer']) {
    const wrong = loadingPlayer();
    const correct = player();
    const playback = createFeedbackPlayback({ correct, wrong }, async () => undefined);
    playback.setActive(true);
    const pending = playback.play('wrong');
    await Promise.resolve();
    assert.equal(wrong.listeners.size, 1);
    if (action === 'leave') playback.setActive(false);
    else if (action === 'disable') playback.setEnabled(false);
    else await playback.play('correct');
    await pending;
    wrong.setLoaded(true);
    assert.equal(wrong.listeners.size, 0);
    assert.ok(!wrong.calls.includes('play'));
    assert.equal(correct.calls.includes('play'), action === 'newer');
  }
});
test('load timeout is bounded, reported and does not prevent the next answer', async () => {
  const wrong = loadingPlayer();
  const errors: string[] = [];
  const playback = createFeedbackPlayback({ correct: player(), wrong }, async () => undefined, { loadTimeoutMs: 15, onError: sound => errors.push(sound) });
  playback.setActive(true);
  await playback.play('wrong');
  assert.deepEqual(errors, ['wrong']);
  assert.equal(wrong.listeners.size, 0);
  wrong.setLoaded(true);
  await playback.play('wrong');
  assert.equal(wrong.calls.at(-1), 'play');
});
test('missing native status event falls back to polling readiness', async () => {
  const wrong = player(false);
  const playback = createFeedbackPlayback({ correct: player(), wrong }, async () => undefined);
  playback.setActive(true);
  const pending = playback.play('wrong');
  await Promise.resolve();
  wrong.isLoaded = true;
  await pending;
  assert.equal(wrong.calls.at(-1), 'play');
});
test('sound files are distinct valid short PCM WAVs without clipping or empty placeholders', () => {
  const hashes: string[] = [];
  for (const [name, seconds] of [['correct', 0.48], ['wrong', 0.36]] as const) {
    const wave = readFileSync(new URL(`../assets/sounds/${name}.wav`, import.meta.url));
    assert.equal(wave.toString('ascii', 0, 4), 'RIFF');
    assert.equal(wave.toString('ascii', 8, 16), 'WAVEfmt ');
    assert.equal(wave.readUInt16LE(20), 1);
    assert.equal(wave.readUInt16LE(22), 1);
    assert.equal(wave.readUInt32LE(24), 44100);
    assert.equal(wave.readUInt16LE(34), 16);
    assert.equal(wave.readUInt32LE(40), wave.length - 44);
    assert.equal((wave.length - 44) / 2 / 44100, seconds);
    let peak = 0;
    for (let offset = 44; offset < wave.length; offset += 2) peak = Math.max(peak, Math.abs(wave.readInt16LE(offset)) / 32767);
    assert.ok(peak > 0.05 && peak < 0.5);
    assert.equal(wave.readInt16LE(44), 0);
    assert.equal(wave.readInt16LE(wave.length - 2), 0);
    hashes.push(wave.toString('base64'));
  }
  assert.notEqual(hashes[0], hashes[1]);
});
test('journey repeats center-left-right-center-left-right, never a straight column', () => {
  assert.deepEqual(Array.from({ length: 9 }, (_, index) => journeyGeometry(342, index).position), ['center', 'left', 'right', 'center', 'left', 'right', 'center', 'left', 'right']);
});
test('geometry keeps circles and labels inside narrow and wide measured containers', () => {
  for (const width of [192, 272, 312, 342, 432, 800]) {
    const centers = [];
    for (let index = 0; index < 6; index++) {
      const geometry = journeyGeometry(width, index);
      assert.ok(geometry.clusterWidth >= 104 && geometry.clusterWidth <= width);
      assert.ok(geometry.centerX - geometry.clusterWidth / 2 >= 0);
      assert.ok(geometry.centerX + geometry.clusterWidth / 2 <= width);
      centers.push(geometry.centerX);
    }
    assert.equal(centers[0], width / 2);
    assert.ok(centers[1]! < centers[0]! && centers[2]! > centers[0]!);
  }
});
test('connector endpoints use the same measured node centers and survive resize', () => {
  for (const width of [272, 342, 432]) {
    const start = journeyGeometry(width, 0).centerX;
    const end = journeyGeometry(width, 1).centerX;
    assert.equal(journeyConnector(width, 0), `M ${start} 0 C ${start} ${JOURNEY_CONNECTOR_HEIGHT/2}, ${end} ${JOURNEY_CONNECTOR_HEIGHT/2}, ${end} ${JOURNEY_CONNECTOR_HEIGHT}`);
  }
  assert.notEqual(journeyConnector(272, 0), journeyConnector(432, 0));
  assert.throws(() => journeyGeometry(0, 0));
  assert.throws(() => journeyGeometry(Number.NaN, 0));
  assert.throws(() => journeyGeometry(272, -1));
});
