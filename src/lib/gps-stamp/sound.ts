/** Suara rana kamera (Web Audio API, tanpa file audio). Gagal diam-diam jika autoplay diblokir. */
let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

export function playShutter(): void {
  try {
    const c = getCtx();
    if (!c) return;
    const now = c.currentTime;

    // 1) klik awal: noise burst
    const size = Math.floor(c.sampleRate * 0.05);
    const buffer = c.createBuffer(1, size, c.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const noise = c.createBufferSource();
    noise.buffer = buffer;
    const filter = c.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1000, now);
    filter.Q.setValueAtTime(3, now);
    const g1 = c.createGain();
    g1.gain.setValueAtTime(0.8, now);
    g1.gain.exponentialRampToValueAtTime(0.01, now + 0.04);
    noise.connect(filter);
    filter.connect(g1);
    g1.connect(c.destination);
    noise.start(now);

    // 2) klik kedua (tirai rana)
    const osc = c.createOscillator();
    const g2 = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(160, now + 0.06);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.12);
    g2.gain.setValueAtTime(0, now);
    g2.gain.setValueAtTime(0.7, now + 0.06);
    g2.gain.exponentialRampToValueAtTime(0.01, now + 0.14);
    osc.connect(g2);
    g2.connect(c.destination);
    osc.start(now + 0.06);
    osc.stop(now + 0.15);
  } catch {
    /* abaikan */
  }
}
