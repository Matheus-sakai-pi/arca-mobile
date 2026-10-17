import { Buffer } from 'node:buffer';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const sampleRate = 44100;
const directory = new URL('../assets/sounds/', import.meta.url);
mkdirSync(directory, { recursive: true });

function synthesize(name, duration, notes) {
  const count = Math.round(sampleRate * duration);
  const wave = Buffer.alloc(44 + count * 2);
  wave.write('RIFF', 0);
  wave.writeUInt32LE(wave.length - 8, 4);
  wave.write('WAVEfmt ', 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(sampleRate, 24);
  wave.writeUInt32LE(sampleRate * 2, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write('data', 36);
  wave.writeUInt32LE(count * 2, 40);
  for (let index = 0; index < count; index++) {
    const time = index / sampleRate;
    let sample = 0;
    for (const { start, length, frequency, amplitude } of notes) {
      const local = time - start;
      if (local < 0 || local >= length) continue;
      // Soft attacks and release ramps avoid clicks; sine harmonics avoid a buzzer timbre.
      const envelope = Math.min(1, local / 0.008) * Math.exp(-local / (length * 0.42)) * Math.min(1, (length - local) / 0.04);
      const phase = 2 * Math.PI * frequency * local;
      sample += amplitude * envelope * (Math.sin(phase) + 0.16 * Math.sin(2 * phase));
    }
    wave.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2);
  }
  writeFileSync(new URL(`${name}.wav`, directory), wave);
  console.log(`${name}: ${duration}s, ${wave.length} bytes, ${fileURLToPath(directory)}`);
}

synthesize('correct', 0.48, [
  { start: 0, length: 0.18, frequency: 659.25, amplitude: 0.18 },
  { start: 0.105, length: 0.20, frequency: 830.61, amplitude: 0.17 },
  { start: 0.21, length: 0.26, frequency: 987.77, amplitude: 0.18 },
]);
synthesize('wrong', 0.36, [
  { start: 0, length: 0.20, frequency: 392, amplitude: 0.13 },
  { start: 0.10, length: 0.25, frequency: 329.63, amplitude: 0.12 },
]);
