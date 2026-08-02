import fs from 'node:fs';
import path from 'node:path';

const SAMPLE_RATE = 22_050;
const AUDIO_DIR = path.resolve('public/audio');

fs.mkdirSync(AUDIO_DIR, { recursive: true });

const TAU = Math.PI * 2;

function clamp(value) {
  return Math.max(-1, Math.min(1, value));
}

function hashNoise(index, seed) {
  let value = (index + seed) | 0;
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 13), 0x45d9f3b);
  return ((value ^ (value >>> 16)) >>> 0) / 0x1_0000_0000 * 2 - 1;
}

function envelope(t, duration, attack = 0.01, release = 0.06) {
  const fadeIn = Math.min(1, t / attack);
  const fadeOut = Math.min(1, Math.max(0, (duration - t) / release));
  return Math.max(0, Math.min(fadeIn, fadeOut));
}

function tone(frequency, t, phase = 0) {
  return Math.sin(TAU * frequency * t + phase);
}

function writeWav(name, duration, sample) {
  const sampleCount = Math.max(1, Math.round(duration * SAMPLE_RATE));
  const data = Buffer.alloc(sampleCount * 2);
  for (let index = 0; index < sampleCount; index += 1) {
    const t = index / SAMPLE_RATE;
    const value = clamp(sample(index, t, duration));
    data.writeInt16LE(Math.round(value * 0x7fff), index * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(path.join(AUDIO_DIR, `${name}.wav`), Buffer.concat([header, data]));
}

const oneShot = (name, duration, sample) => writeWav(name, duration, (index, t, length) => sample(index, t, length) * envelope(t, length));

oneShot('ui-confirm', 0.13, (index, t) =>
  0.48 * tone(t < 0.06 ? 660 : 880, t) + 0.16 * tone(1320, t) * envelope(t, 0.13, 0.004, 0.04));
oneShot('ui-error', 0.2, (index, t) => 0.42 * tone(170, t) + 0.16 * tone(113, t));
oneShot('footstep-ground', 0.12, (index, t) => 0.48 * hashNoise(index, 31) + 0.38 * tone(88, t));
oneShot('footstep-wood', 0.13, (index, t) => 0.42 * hashNoise(index, 47) + 0.3 * tone(128, t) + 0.1 * tone(240, t));
oneShot('tool-wood', 0.18, (index, t) => 0.5 * hashNoise(index, 71) + 0.4 * tone(110, t) + 0.12 * tone(220, t));
oneShot('tool-soil', 0.16, (index, t) => 0.36 * hashNoise(index, 83) + 0.48 * tone(82, t));
oneShot('tool-metal', 0.28, (index, t) => 0.34 * tone(780, t) + 0.22 * tone(1180, t) + 0.12 * hashNoise(index, 101));
oneShot('shot', 0.2, (index, t) => 0.7 * hashNoise(index, 113) + 0.24 * tone(74, t));
oneShot('water', 0.3, (index, t) => 0.5 * hashNoise(index, 127) + 0.2 * tone(300 + 160 * t, t));
oneShot('crop-harvest', 0.32, (index, t) =>
  0.3 * tone(520, t) + 0.24 * tone(780, t) + 0.12 * tone(1040, t));
oneShot('fox-threat', 0.42, (index, t) =>
  0.42 * tone(145 + 22 * Math.sin(TAU * 3 * t), t) + 0.14 * tone(290, t));
oneShot('fox-hit', 0.16, (index, t) => 0.48 * hashNoise(index, 151) + 0.22 * tone(190, t));
oneShot('fox-trap', 0.22, (index, t) => 0.28 * hashNoise(index, 167) + 0.4 * tone(230, t) + 0.12 * tone(510, t));
oneShot('defeat', 0.3, (index, t) => 0.3 * tone(330 - 170 * t, t) + 0.18 * tone(165 - 60 * t, t));
oneShot('building', 0.36, (index, t) => 0.28 * tone(260, t) + 0.25 * tone(390, t) + 0.18 * tone(520, t));
oneShot('reward', 0.46, (index, t) => {
  const note = t < 0.14 ? 523 : t < 0.28 ? 659 : 784;
  return 0.26 * tone(note, t) + 0.12 * tone(note * 2, t);
});
oneShot('merchant', 0.34, (index, t) =>
  0.24 * tone(700, t) + 0.2 * tone(980, t) + 0.13 * hashNoise(index, 181));
oneShot('day-transition', 0.72, (index, t) =>
  0.22 * tone(260 + 320 * t, t) + 0.14 * tone(520 + 260 * t, t));
oneShot('save-success', 0.26, (index, t) => 0.27 * tone(t < 0.11 ? 660 : 880, t));
oneShot('save-error', 0.26, (index, t) => 0.32 * tone(150, t) + 0.12 * tone(106, t));

writeWav('music-day', 4, (index, t) => {
  const chord = [220, 277.5, 330, 440];
  const pulse = 0.5 + 0.5 * Math.sin(TAU * t / 4);
  return chord.reduce((sum, frequency, offset) => sum + 0.11 * tone(frequency, t + offset * 0.13), 0) * (0.72 + pulse * 0.18);
});
writeWav('music-night', 4, (index, t) => {
  const chord = [165, 196.25, 247.5];
  return chord.reduce((sum, frequency, offset) => sum + 0.12 * tone(frequency, t + offset * 0.19), 0) * (0.8 + 0.2 * Math.sin(TAU * t / 4));
});
writeWav('ambience-day', 4, (index, t) =>
  0.055 * hashNoise(index, 211) + 0.025 * tone(96, t) + 0.04 * tone(880, t) * Math.max(0, Math.sin(TAU * t / 2)));
writeWav('ambience-night', 4, (index, t) =>
  0.045 * hashNoise(index, 227) + 0.035 * tone(72, t) + 0.035 * tone(580, t) * Math.max(0, Math.sin(TAU * 2 * t)));

console.log(`Generated ${fs.readdirSync(AUDIO_DIR).filter((name) => name.endsWith('.wav')).length} authored WAV files in ${AUDIO_DIR}`);
