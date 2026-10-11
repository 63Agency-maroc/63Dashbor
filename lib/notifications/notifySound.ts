/** Son de notification WhatsApp (Web Audio — pas de fichier externe). */

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!audioCtx) audioCtx = new AC();
  return audioCtx;
}

/** Débloque l’audio après un geste utilisateur (politique navigateurs). */
export function unlockNotifySound(): void {
  const ctx = getCtx();
  if (!ctx) return;
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(
  ctx: AudioContext,
  frequency: number,
  start: number,
  duration: number,
  gainPeak = 0.18,
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainPeak, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.02);
}

/** Double bip court (style notif message). */
export function playNotifySound(): void {
  const ctx = getCtx();
  if (!ctx) return;
  void ctx.resume().then(() => {
    const t0 = ctx.currentTime + 0.01;
    tone(ctx, 880, t0, 0.09, 0.16);
    tone(ctx, 1175, t0 + 0.11, 0.14, 0.14);
  }).catch(() => undefined);
}
