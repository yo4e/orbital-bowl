// ORBITAL BOWL audio — soft synthesized cues preserve a self-contained static build.
export class Soundscape {
  private context: AudioContext | null = null;
  public enabled = true;

  unlock() {
    if (!this.enabled) return;
    if (!this.context) this.context = new AudioContext();
    if (this.context.state === "suspended") void this.context.resume();
  }

  tone(frequency: number, duration: number, volume = 0.035, slide = 1) {
    if (!this.enabled || !this.context) return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, frequency * slide), now + duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + Math.min(0.035, duration * 0.3));
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.03);
  }

  launch() { this.tone(220, 0.34, 0.045, 1.9); }
  hit() { this.tone(500, 0.16, 0.032, 0.65); }
  strike() { this.tone(392, 0.5, 0.04, 2); }
}
