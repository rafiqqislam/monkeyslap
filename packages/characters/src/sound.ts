let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** A short, punchy "smack": a burst of filtered noise on top of a low thump. */
function synthSlap(intensity: number) {
  const ac = audio();
  if (!ac) return;
  const now = ac.currentTime;
  const gainScale = 0.55 + intensity * 0.15;

  // Crack: white noise through a band-pass filter, very fast decay.
  const len = Math.floor(ac.sampleRate * 0.18);
  const buffer = ac.createBuffer(1, len, ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4);
  const noise = ac.createBufferSource();
  noise.buffer = buffer;
  const band = ac.createBiquadFilter();
  band.type = "bandpass";
  band.frequency.value = 1800;
  band.Q.value = 0.8;
  const crackGain = ac.createGain();
  crackGain.gain.setValueAtTime(gainScale, now);
  crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  noise.connect(band).connect(crackGain).connect(ac.destination);
  noise.start(now);

  // Thump: a sine dropping quickly in pitch.
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.setValueAtTime(180, now);
  osc.frequency.exponentialRampToValueAtTime(50, now + 0.12);
  const thumpGain = ac.createGain();
  thumpGain.gain.setValueAtTime(gainScale * 0.9, now);
  thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
  osc.connect(thumpGain).connect(ac.destination);
  osc.start(now);
  osc.stop(now + 0.16);
}

const SYNTHS: Record<string, (intensity: number) => void> = { slap: synthSlap };

/**
 * Plays a sound named in a character manifest: "synth:<name>" for a built-in
 * sound, or a URL to an audio file. Failures (e.g. the browser blocking audio
 * before the user has clicked on the page) are silent.
 */
export function playSound(ref: string | undefined, intensity = 1): void {
  if (!ref) return;
  try {
    if (ref.startsWith("synth:")) {
      SYNTHS[ref.slice(6)]?.(intensity);
    } else {
      const el = new Audio(ref);
      el.volume = Math.min(1, 0.6 + intensity * 0.13);
      void el.play().catch(() => {});
    }
  } catch {
    // Sound is a bonus; never let it break the slap.
  }
}
