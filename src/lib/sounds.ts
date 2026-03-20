/**
 * Scanner sound feedback via Web Audio API.
 *
 * Three distinct tones for scan results:
 *   valid     — bright ascending double-beep (C5→E5), positive & quick
 *   duplicate — two warning tones (A4→A4), attention-grabbing but not alarming
 *   invalid   — low descending buzz (E4→C4), unmistakably an error
 *
 * Design:
 *   - Singleton AudioContext (created once, resumed on user gesture)
 *   - Gain envelope on every tone to avoid click artifacts
 *   - Zero external files — works fully offline
 *   - Graceful degradation — no-op if Web Audio is unavailable
 */

import type { ScanResultType } from '../App';

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (ctx) return ctx;
  try {
    ctx = new AudioContext();
  } catch {
    // Web Audio not supported — degrade silently
  }
  return ctx;
}

/**
 * Must be called from a user-gesture handler (e.g. button click)
 * to unblock AudioContext on iOS Safari.
 */
export function unlockAudio(): void {
  const c = getCtx();
  if (c?.state === 'suspended') {
    c.resume().catch(() => {});
  }
}

function beep(frequency: number, duration: number, type: OscillatorType = 'sine', gain = 0.35): void {
  const c = getCtx();
  if (!c) return;
  // Attempt resume in case still suspended
  if (c.state === 'suspended') c.resume().catch(() => {});

  const osc = c.createOscillator();
  const vol = c.createGain();

  osc.type = type;
  osc.frequency.value = frequency;
  vol.gain.value = gain;

  osc.connect(vol);
  vol.connect(c.destination);

  const now = c.currentTime;
  osc.start(now);
  // Smooth fade-out to avoid click at stop
  vol.gain.setValueAtTime(gain, now + duration - 0.05);
  vol.gain.exponentialRampToValueAtTime(0.001, now + duration);
  osc.stop(now + duration);
}

function playValid(): void {
  // Bright ascending double-beep: C5 then E5
  beep(523, 0.12, 'sine', 0.4);    // C5
  setTimeout(() => {
    beep(659, 0.15, 'sine', 0.4);  // E5
  }, 130);
}

function playDuplicate(): void {
  // Two identical warning tones: A4, A4
  beep(440, 0.15, 'triangle', 0.35);
  setTimeout(() => {
    beep(440, 0.15, 'triangle', 0.35);
  }, 200);
}

function playInvalid(): void {
  // Low descending buzz: E4 → C4
  beep(330, 0.18, 'square', 0.25);   // E4
  setTimeout(() => {
    beep(262, 0.25, 'square', 0.25); // C4
  }, 200);
}

export function playScanSound(type: ScanResultType): void {
  switch (type) {
    case 'valid':
      playValid();
      break;
    case 'duplicate':
      playDuplicate();
      break;
    case 'invalid':
      playInvalid();
      break;
  }
}
