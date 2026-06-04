/**
 * Procedural Audio Module for Penalty Shooter
 * Provides synthesized sound effects using the Web Audio API.
 */

let audioCtx: AudioContext | null = null;

export function getAudioCtx(): AudioContext | null {
  if (audioCtx === null) {
    try {
      audioCtx = new AudioContext();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export function closeAudioContext(): void {
  if (audioCtx !== null) {
    audioCtx.close();
    audioCtx = null;
  }
}

export function playKickSound(): void {
  const ctx = getAudioCtx();
  if (ctx === null) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.6, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.12);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };

  // Noise burst for attack
  const bufferSize = Math.floor(ctx.sampleRate * 0.04);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * 0.3;
  const noise = ctx.createBufferSource();
  const noiseGain = ctx.createGain();
  noise.buffer = buffer;
  noiseGain.gain.setValueAtTime(0.5, ctx.currentTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.06);
  noise.connect(noiseGain).connect(ctx.destination);
  noise.start(ctx.currentTime);
  noise.onended = () => { noise.disconnect(); noiseGain.disconnect(); };
}

export function playGoalSound(): void {
  const ctx = getAudioCtx();
  if (ctx === null) return;
  // Net thud
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(220, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.25);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  // Crowd cheer (filtered noise)
  const bufferSize = Math.floor(ctx.sampleRate * 0.5);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const noise = ctx.createBufferSource();
  const noiseGain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1200;
  filter.Q.value = 0.8;
  noise.buffer = buffer;
  noiseGain.gain.setValueAtTime(0, ctx.currentTime + 0.08);
  noiseGain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.2);
  noiseGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.6);
  noise.connect(filter).connect(noiseGain).connect(ctx.destination);
  noise.start(ctx.currentTime + 0.08);
  noise.onended = () => { noise.disconnect(); noiseGain.disconnect(); filter.disconnect(); };
}

export function playSaveSound(): void {
  const ctx = getAudioCtx();
  if (ctx === null) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.05);
  gain.gain.setValueAtTime(0.3, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

export function playMissSound(): void {
  const ctx = getAudioCtx();
  if (ctx === null) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(300, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(150, ctx.currentTime + 0.15);
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.2);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
}

export function playWhooshSound(intensity: number): void {
  const ctx = getAudioCtx();
  if (ctx === null) return;
  const bufferSize = Math.floor(ctx.sampleRate * 0.2);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const noise = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "highpass";
  filter.frequency.setValueAtTime(2000, ctx.currentTime);
  filter.frequency.exponentialRampToValueAtTime(400, ctx.currentTime + 0.15);
  noise.buffer = buffer;
  gain.gain.setValueAtTime(0.2 * intensity, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(ctx.currentTime);
  noise.onended = () => { noise.disconnect(); gain.disconnect(); filter.disconnect(); };
}

/** Metallic clang for post/crossbar hits */
export function playPostHitSound(): void {
  const ctx = getAudioCtx();
  if (ctx === null) return;
  // High metallic ring
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(1800, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.3);
  gain.gain.setValueAtTime(0.35, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.4);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); };
  // Secondary harmonic for metallic quality
  const osc2 = ctx.createOscillator();
  const gain2 = ctx.createGain();
  osc2.type = "sine";
  osc2.frequency.setValueAtTime(3600, ctx.currentTime);
  osc2.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.2);
  gain2.gain.setValueAtTime(0.15, ctx.currentTime);
  gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
  osc2.connect(gain2).connect(ctx.destination);
  osc2.start(ctx.currentTime);
  osc2.stop(ctx.currentTime + 0.25);
  osc2.onended = () => { osc2.disconnect(); gain2.disconnect(); };
}

/** Crowd gasp when ball is kicked */
export function playCrowdGaspSound(): void {
  const ctx = getAudioCtx();
  if (ctx === null) return;
  const bufferSize = Math.floor(ctx.sampleRate * 0.35);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const noise = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 800;
  filter.Q.value = 1.2;
  noise.buffer = buffer;
  gain.gain.setValueAtTime(0, ctx.currentTime);
  gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.06);
  gain.gain.linearRampToValueAtTime(0.08, ctx.currentTime + 0.15);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(ctx.currentTime);
  noise.onended = () => { noise.disconnect(); gain.disconnect(); filter.disconnect(); };
}

/** Keeper dive effort grunt */
export function playDiveGruntSound(): void {
  const ctx = getAudioCtx();
  if (ctx === null) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(120, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 0.08);
  gain.gain.setValueAtTime(0.08, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 400;
  osc.connect(filter).connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime);
  osc.stop(ctx.currentTime + 0.1);
  osc.onended = () => { osc.disconnect(); gain.disconnect(); filter.disconnect(); };
}

/** Crowd groan on miss/save (disappointment) */
export function playCrowdGroanSound(): void {
  const ctx = getAudioCtx();
  if (ctx === null) return;
  const bufferSize = Math.floor(ctx.sampleRate * 0.6);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
  const noise = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 500;
  filter.Q.value = 0.6;
  noise.buffer = buffer;
  gain.gain.setValueAtTime(0, ctx.currentTime + 0.1);
  gain.gain.linearRampToValueAtTime(0.1, ctx.currentTime + 0.25);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.7);
  noise.connect(filter).connect(gain).connect(ctx.destination);
  noise.start(ctx.currentTime + 0.1);
  noise.onended = () => { noise.disconnect(); gain.disconnect(); filter.disconnect(); };
}

