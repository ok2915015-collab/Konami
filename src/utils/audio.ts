const SOUND_KEY = "konamix_sound_enabled";
const VOLUME_KEY = "konamix_sound_volume";

let lastPlayTime = 0;
let sharedCtx: AudioContext | null = null;

/**
 * Returns whether metallic sounds are enabled.
 * Default is TRUE (enabled by default).
 */
export const isSoundEnabled = (): boolean => {
  if (typeof window === "undefined") return true;
  try {
    const val = localStorage.getItem(SOUND_KEY);
    return val !== "false";
  } catch (e) {
    return true;
  }
};

/**
 * Saves sound enabled/disabled preference and dispatches a window event
 * so all components (Settings, etc.) update reactively.
 */
export const setSoundEnabled = (enabled: boolean): void => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SOUND_KEY, enabled ? "true" : "false");
    window.dispatchEvent(
      new CustomEvent("konamix_sound_change", { detail: { enabled } })
    );
  } catch (e) {
    console.warn("Could not save sound preference:", e);
  }
};

/**
 * Gets user configured sound volume (from 0.2 to 1.0, default 0.85).
 */
export const getSoundVolume = (): number => {
  if (typeof window === "undefined") return 0.85;
  try {
    const val = localStorage.getItem(VOLUME_KEY);
    if (!val) return 0.85;
    const num = parseFloat(val);
    return isNaN(num) ? 0.85 : Math.max(0.1, Math.min(1.0, num));
  } catch (e) {
    return 0.85;
  }
};

/**
 * Sets user configured sound volume.
 */
export const setSoundVolume = (volume: number): void => {
  if (typeof window === "undefined") return;
  try {
    const clamped = Math.max(0.1, Math.min(1.0, volume));
    localStorage.setItem(VOLUME_KEY, clamped.toString());
    window.dispatchEvent(
      new CustomEvent("konamix_volume_change", { detail: { volume: clamped } })
    );
  } catch (e) {
    console.warn("Could not save sound volume:", e);
  }
};

/**
 * Toggles sound enabled state and returns the new value.
 */
export const toggleSoundEnabled = (): boolean => {
  const current = isSoundEnabled();
  const next = !current;
  setSoundEnabled(next);
  if (next) {
    playMetallicSound();
  }
  return next;
};

/**
 * Initializes and unlocks the shared Web Audio Context.
 * Ensures the AudioContext is resumed and unlocked on user interaction.
 */
export const getAudioContext = (): AudioContext | null => {
  try {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!sharedCtx || sharedCtx.state === "closed") {
      sharedCtx = new AudioContextClass();
    }
    if (sharedCtx.state === "suspended") {
      sharedCtx.resume().catch(() => {});
    }
    return sharedCtx;
  } catch (e) {
    return null;
  }
};

// Auto-unlock audio context on user interaction
if (typeof window !== "undefined") {
  const unlockAudio = () => {
    try {
      const ctx = getAudioContext();
      if (ctx && ctx.state === "suspended") {
        ctx.resume().catch(() => {});
      }
    } catch (e) {}
  };
  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("click", unlockAudio, { passive: true });
  window.addEventListener("touchstart", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio, { passive: true });
}

/**
 * Synthesizes an authentic, loud, and crisp metallic "click / ping"
 * using multi-oscillator harmonic metal resonance with natural exponential decay.
 * Enhanced volume and resonance for clear audibility across mobile & desktop.
 */
export const playMetallicSound = (options?: {
  volume?: number;
  pitchMultiplier?: number;
  duration?: number;
}) => {
  if (!isSoundEnabled()) return;

  const now = Date.now();
  if (now - lastPlayTime < 40) return;
  lastPlayTime = now;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const masterVolSetting = getSoundVolume();
    const pitchMul = options?.pitchMultiplier ?? 1.0;
    // Louder base volume: 0.7 instead of 0.16
    const baseVol = (options?.volume ?? 0.7) * masterVolSetting;
    const duration = options?.duration ?? 0.18;

    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(baseVol, ctx.currentTime);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    masterGain.connect(ctx.destination);

    // 1. Crisp metallic strike transient (hard metal tap impact)
    const transientOsc = ctx.createOscillator();
    const transientGain = ctx.createGain();
    transientOsc.type = "triangle";
    transientOsc.frequency.setValueAtTime(3200 * pitchMul, ctx.currentTime);
    transientOsc.frequency.exponentialRampToValueAtTime(
      900 * pitchMul,
      ctx.currentTime + 0.03
    );
    transientGain.gain.setValueAtTime(0.65, ctx.currentTime);
    transientGain.gain.exponentialRampToValueAtTime(
      0.001,
      ctx.currentTime + 0.035
    );
    transientOsc.connect(transientGain);
    transientGain.connect(masterGain);
    transientOsc.start();
    transientOsc.stop(ctx.currentTime + 0.04);

    // 2. High metallic chime overtones (resonant ringing)
    const baseFrequencies = [1560, 2450, 3680, 5100, 6800];
    baseFrequencies.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();

      osc.type = idx % 2 === 0 ? "sine" : "triangle";
      const actualFreq = freq * pitchMul;
      osc.frequency.setValueAtTime(actualFreq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(
        actualFreq * 0.95,
        ctx.currentTime + duration
      );

      // Higher overtone amplitude for clear presence and volume
      const amp = 0.45 / (idx + 1);
      oscGain.gain.setValueAtTime(amp, ctx.currentTime);
      oscGain.gain.exponentialRampToValueAtTime(
        0.0001,
        ctx.currentTime + duration
      );

      osc.connect(oscGain);
      oscGain.connect(masterGain);

      osc.start();
      osc.stop(ctx.currentTime + duration);
    });
  } catch (e) {
    // Ignore audio context restrictions
  }
};

/**
 * Loud & crisp metallic navigation sound for route/page transitions.
 */
export const playMetallicNavSound = () => {
  playMetallicSound({ volume: 0.75, pitchMultiplier: 1.15, duration: 0.2 });
};

/**
 * Solid metallic button click sound with punchy tactile feedback.
 */
export const playHeavyClick = () => {
  if (!isSoundEnabled()) return;
  playMetallicSound({ volume: 0.7, pitchMultiplier: 0.92, duration: 0.16 });
};

/**
 * Plays a triumphant fanfare chime when a bet or match is won.
 */
export const playTriumphantSound = () => {
  if (!isSoundEnabled()) return;

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const masterVolSetting = getSoundVolume();
    const gainNode = ctx.createGain();
    const baseFreqs = [523.25, 659.25, 783.99, 1046.5]; // C Major arpeggio
    baseFreqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = i % 2 === 0 ? "triangle" : "sine";
      const startTime = ctx.currentTime + i * 0.09;
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, startTime + 0.35);

      osc.connect(gainNode);
      osc.start(startTime);
      osc.stop(startTime + 0.5);
    });

    gainNode.gain.setValueAtTime(0.05, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.7 * masterVolSetting, ctx.currentTime + 0.12);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.85);
    gainNode.connect(ctx.destination);
  } catch (e) {
    // Ignore
  }
};
