export function createAudioReactor() {
  return {
    context: null,
    analyser: null,
    source: null,
    outputGain: null,
    stream: null,
    data: null,
    bars: new Array(72).fill(0),
    enabled: false,
    level: 0,
    bass: 0,
    mid: 0,
    treble: 0,
    beat: 0,
    kick: 0,
    peak: 0,
    smoothed: 0,
    bassFloor: 0,
    levelFloor: 0,
    previousBass: 0,
    previousLowMid: 0,
    previousLevel: 0,
    onset: 0,
  };
}

export async function useMicrophone(reactor) {
  await ensureContext(reactor);
  stopAudioSource(reactor);
  reactor.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
  reactor.source = reactor.context.createMediaStreamSource(reactor.stream);
  reactor.source.connect(reactor.analyser);
  reactor.enabled = true;
}

export async function useAudioFile(reactor, file) {
  await ensureContext(reactor);
  stopAudioSource(reactor);

  const audio = new Audio(URL.createObjectURL(file));
  audio.loop = true;
  audio.crossOrigin = "anonymous";
  audio.volume = 0.24;
  reactor.source = reactor.context.createMediaElementSource(audio);
  reactor.source.connect(reactor.analyser);
  reactor.analyser.connect(reactor.outputGain);
  await audio.play();
  reactor.audioElement = audio;
  reactor.enabled = true;
}

export function stopAudioSource(reactor) {
  reactor.enabled = false;
  reactor.level = 0;
  reactor.beat = 0;
  reactor.kick = 0;
  reactor.peak = 0;
  reactor.levelFloor = 0;
  reactor.bassFloor = 0;
  reactor.smoothed = 0;
  reactor.previousBass = 0;
  reactor.previousLowMid = 0;
  reactor.previousLevel = 0;
  reactor.onset = 0;

  if (reactor.source?.disconnect) {
    reactor.source.disconnect();
  }
  if (reactor.analyser?.disconnect) {
    reactor.analyser.disconnect();
  }
  if (reactor.audioElement) {
    reactor.audioElement.pause();
    URL.revokeObjectURL(reactor.audioElement.src);
    reactor.audioElement = null;
  }
  if (reactor.stream) {
    for (const track of reactor.stream.getTracks()) {
      track.stop();
    }
    reactor.stream = null;
  }
  reactor.source = null;
}

export function updateAudioReactor(reactor) {
  if (!reactor.enabled || !reactor.analyser) {
    decayAudio(reactor);
    return snapshot(reactor, false);
  }

  reactor.analyser.getByteFrequencyData(reactor.data);
  updateBars(reactor);

  const bass = compressBand(readBand(reactor, 24, 150), 1.02);
  const lowMid = compressBand(readBand(reactor, 150, 420), 0.98);
  const mid = compressBand(readBand(reactor, 420, 2200), 1.08);
  const treble = compressBand(readBand(reactor, 2200, 9200), 1.22);
  const rawLevel = clamp(bass * 0.42 + lowMid * 0.2 + mid * 0.24 + treble * 0.14, 0, 1);
  const visualLevel = clamp((rawLevel - reactor.levelFloor * 0.72 - 0.018) * 1.55 + rawLevel * 0.28, 0, 1);
  const bassTransient = Math.max(0, bass - Math.max(reactor.bassFloor * 1.02, reactor.previousBass * 0.82) - 0.018);
  const lowMidTransient = Math.max(0, lowMid - Math.max(reactor.previousLowMid * 0.86, reactor.levelFloor * 0.42) - 0.014);
  const flux = Math.max(0, rawLevel - Math.max(reactor.smoothed * 0.96, reactor.previousLevel * 0.84) - 0.01);
  const onset = clamp(bassTransient * 8.8 + lowMidTransient * 5.2 + flux * 5.8, 0, 1);

  reactor.bassFloor = reactor.bassFloor * 0.952 + bass * 0.048;
  reactor.levelFloor = reactor.levelFloor * 0.99 + rawLevel * 0.01;
  reactor.smoothed = reactor.smoothed * 0.88 + rawLevel * 0.12;
  reactor.bass = reactor.bass * 0.58 + bass * 0.42;
  reactor.mid = reactor.mid * 0.58 + mid * 0.42;
  reactor.treble = reactor.treble * 0.5 + treble * 0.5;
  reactor.level = reactor.level * 0.68 + visualLevel * 0.32;
  reactor.onset = Math.max(reactor.onset * 0.5, onset);
  reactor.kick = Math.max(reactor.kick * 0.46, clamp(bassTransient * 9.2 + onset * 0.55, 0, 1));
  reactor.beat = Math.max(reactor.beat * 0.5, reactor.kick * 0.86, onset, clamp(flux * 5.4, 0, 1));
  reactor.peak = Math.max(reactor.peak * 0.78, reactor.beat, reactor.level * 0.48);
  reactor.previousBass = bass;
  reactor.previousLowMid = lowMid;
  reactor.previousLevel = rawLevel;

  return snapshot(reactor, true);
}

async function ensureContext(reactor) {
  if (!reactor.context) {
    reactor.context = new AudioContext();
    reactor.analyser = reactor.context.createAnalyser();
    reactor.analyser.fftSize = 1024;
    reactor.analyser.smoothingTimeConstant = 0.52;
    reactor.outputGain = reactor.context.createGain();
    reactor.outputGain.gain.value = 0.52;
    reactor.outputGain.connect(reactor.context.destination);
    reactor.data = new Uint8Array(reactor.analyser.frequencyBinCount);
  }

  if (reactor.context.state === "suspended") {
    await reactor.context.resume();
  }
}

function readBand(reactor, fromHz, toHz) {
  const nyquist = reactor.context.sampleRate / 2;
  const start = Math.max(1, Math.floor((fromHz / nyquist) * reactor.data.length));
  const end = Math.min(reactor.data.length, Math.ceil((toHz / nyquist) * reactor.data.length));
  let total = 0;
  let count = 0;

  for (let i = start; i < end; i += 1) {
    total += reactor.data[i];
    count += 1;
  }

  return count > 0 ? total / count / 255 : 0;
}

function updateBars(reactor) {
  const barCount = reactor.bars.length;
  const length = reactor.data.length;
  for (let i = 0; i < barCount; i += 1) {
    const start = Math.floor(((i / barCount) ** 1.72) * length);
    const end = Math.max(start + 1, Math.floor((((i + 1) / barCount) ** 1.72) * length));
    let total = 0;
    for (let j = start; j < end; j += 1) {
      total += reactor.data[j] ?? 0;
    }
    const raw = total / (end - start) / 255;
    const shaped = Math.pow(clamp(raw * 1.08, 0, 1), 0.92);
    reactor.bars[i] = reactor.bars[i] * 0.58 + shaped * 0.42;
  }
}

function decayAudio(reactor) {
  reactor.level *= 0.86;
  reactor.bass *= 0.82;
  reactor.mid *= 0.82;
  reactor.treble *= 0.82;
  reactor.beat *= 0.74;
  reactor.kick *= 0.68;
  reactor.peak *= 0.82;
  reactor.onset *= 0.62;
  for (let i = 0; i < reactor.bars.length; i += 1) {
    reactor.bars[i] *= 0.82;
  }
}

function snapshot(reactor, enabled) {
  return {
    enabled,
    level: reactor.level,
    bass: reactor.bass,
    mid: reactor.mid,
    treble: reactor.treble,
    beat: reactor.beat,
    kick: reactor.kick,
    peak: reactor.peak,
    onset: reactor.onset,
    bars: reactor.bars,
  };
}

function compressBand(value, gain) {
  return Math.pow(clamp(value * gain, 0, 1), 0.82);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
