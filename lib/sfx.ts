// Synthesized cracker sounds (Web Audio). No asset files.
type Sound = "pop" | "fizz" | "chime" | "rocket";

let ctx: AudioContext | null = null;
const KEY = "dw-muted";

export const isMuted = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};
export const setMuted = (m: boolean) => {
  try { localStorage.setItem(KEY, m ? "1" : "0"); } catch {}
};

function ac() {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function noise(a: AudioContext, dur: number, freq: number, gain: number, at = 0, type: BiquadFilterType = "bandpass") {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(f).connect(g).connect(a.destination);
  src.start(a.currentTime + at);
}

function tone(a: AudioContext, from: number, to: number, dur: number, gain: number, at = 0, type: OscillatorType = "sine") {
  const o = a.createOscillator();
  const g = a.createGain();
  const t = a.currentTime + at;
  o.type = type;
  o.frequency.setValueAtTime(from, t);
  o.frequency.exponentialRampToValueAtTime(to, t + dur);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur);
}

export function play(s: Sound) {
  if (typeof window === "undefined" || isMuted()) return;
  try {
    const a = ac();
    if (s === "pop") { noise(a, 0.18, 1800, 0.9); tone(a, 220, 60, 0.12, 0.4); }
    if (s === "fizz") noise(a, 0.35, 5000, 0.25, 0, "highpass");
    if (s === "chime") [880, 1320, 1760].forEach((f, i) => tone(a, f, f * 1.01, 0.5, 0.15, i * 0.08, "triangle"));
    if (s === "rocket") {
      tone(a, 600, 2400, 0.9, 0.12, 0, "sine");
      noise(a, 0.9, 3000, 0.15, 0, "highpass");
      noise(a, 0.6, 400, 1.2, 0.95, "lowpass");
      noise(a, 0.8, 6000, 0.3, 1.05, "highpass");
    }
  } catch {}
}
