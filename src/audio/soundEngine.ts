export type BgmTrackId =
  | 'hub'
  | 'forest'
  | 'fen'
  | 'ridge'
  | 'sanctuary'
  | 'wild_battle'
  | 'boss_battle';

export type SfxId =
  | 'step'
  | 'select'
  | 'gloss'
  | 'hit'
  | 'super_hit'
  | 'heal'
  | 'chime'
  | 'caught'
  | 'quest';

const TRACK_NOTES: Readonly<Record<BgmTrackId, ReadonlyArray<number>>> = {
  hub: [261.63, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66, 392.0],
  forest: [293.66, 349.23, 440.0, 523.25, 440.0, 392.0, 349.23, 329.63],
  fen: [246.94, 293.66, 369.99, 440.0, 392.0, 369.99, 293.66, 246.94],
  ridge: [220.0, 293.66, 329.63, 440.0, 392.0, 329.63, 293.66, 261.63],
  sanctuary: [329.63, 392.0, 493.88, 587.33, 659.25, 587.33, 493.88, 392.0],
  wild_battle: [329.63, 392.0, 440.0, 329.63, 493.88, 440.0, 392.0, 293.66],
  boss_battle: [293.66, 293.66, 440.0, 415.3, 392.0, 349.23, 329.63, 440.0],
};

export class SoundEngine {
  private ctx: AudioContext | null = null;
  private bgmVolume = 0.45;
  private sfxVolume = 0.65;
  private muted = false;
  private currentTrack: BgmTrackId | null = null;
  private bgmTimer: number | null = null;
  private noteIndex = 0;

  public configure(params: { bgmVolume: number; sfxVolume: number; muted: boolean }): void {
    this.bgmVolume = Math.max(0, Math.min(1, params.bgmVolume));
    this.sfxVolume = Math.max(0, Math.min(1, params.sfxVolume));
    this.muted = params.muted;
    if (this.muted || this.bgmVolume <= 0.01) {
      this.stopBgmTimerOnly();
    } else if (this.currentTrack && this.bgmTimer === null) {
      this.startBgmLoop();
    }
  }

  public unlock(): void {
    if (this.muted) return;
    const context = this.ensureContext();
    if (context && context.state === 'suspended') {
      void context.resume().catch(() => {});
    }
  }

  public playTrack(track: BgmTrackId): void {
    if (this.currentTrack === track && this.bgmTimer !== null) {
      return;
    }
    this.currentTrack = track;
    this.noteIndex = 0;
    this.stopBgmTimerOnly();
    if (!this.muted && this.bgmVolume > 0.01) {
      this.startBgmLoop();
    }
  }

  public playSfx(id: SfxId): void {
    if (this.muted || this.sfxVolume <= 0.01) return;
    const context = this.ensureContext();
    if (!context || context.state !== 'running') return;

    const now = context.currentTime;
    switch (id) {
      case 'step':
        this.tone(context, 150, 0.04, 'triangle', this.sfxVolume * 0.12, now);
        break;
      case 'select':
        this.tone(context, 520, 0.06, 'sine', this.sfxVolume * 0.22, now);
        break;
      case 'gloss':
        this.tone(context, 640, 0.05, 'sine', this.sfxVolume * 0.2, now);
        this.tone(context, 780, 0.07, 'sine', this.sfxVolume * 0.18, now + 0.05);
        break;
      case 'hit':
        this.tone(context, 190, 0.09, 'sawtooth', this.sfxVolume * 0.28, now);
        break;
      case 'super_hit':
        this.tone(context, 240, 0.08, 'square', this.sfxVolume * 0.3, now);
        this.tone(context, 360, 0.12, 'square', this.sfxVolume * 0.3, now + 0.07);
        break;
      case 'heal':
        this.tone(context, 440, 0.09, 'sine', this.sfxVolume * 0.25, now);
        this.tone(context, 554.37, 0.09, 'sine', this.sfxVolume * 0.25, now + 0.09);
        this.tone(context, 659.25, 0.14, 'sine', this.sfxVolume * 0.25, now + 0.18);
        break;
      case 'chime':
        this.tone(context, 783.99, 0.14, 'sine', this.sfxVolume * 0.26, now);
        this.tone(context, 1046.5, 0.2, 'sine', this.sfxVolume * 0.22, now + 0.1);
        break;
      case 'caught':
        this.tone(context, 523.25, 0.1, 'triangle', this.sfxVolume * 0.3, now);
        this.tone(context, 659.25, 0.1, 'triangle', this.sfxVolume * 0.3, now + 0.11);
        this.tone(context, 783.99, 0.12, 'triangle', this.sfxVolume * 0.3, now + 0.22);
        this.tone(context, 1046.5, 0.26, 'triangle', this.sfxVolume * 0.32, now + 0.35);
        break;
      case 'quest':
        this.tone(context, 587.33, 0.1, 'sine', this.sfxVolume * 0.28, now);
        this.tone(context, 880.0, 0.22, 'sine', this.sfxVolume * 0.28, now + 0.11);
        break;
    }
  }

  public speakEnglishWord(
    word: string,
    phonetic: string,
  ): { readonly spokenByVoice: boolean; readonly fallbackMessageVi: string } {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return {
        spokenByVoice: false,
        fallbackMessageVi: `Thiết bị chưa có giọng đọc. Hãy đọc theo phiên âm ${phonetic}.`,
      };
    }
    try {
      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      const englishVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(word);
      utterance.lang = englishVoice?.lang ?? 'en-US';
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      utterance.rate = 0.92;
      synth.speak(utterance);
      return {
        spokenByVoice: true,
        fallbackMessageVi:
          voices.length === 0
            ? `Đang gửi yêu cầu phát âm (${phonetic}).`
            : `Đang phát âm: ${word} ${phonetic}`,
      };
    } catch {
      return {
        spokenByVoice: false,
        fallbackMessageVi: `Không mở được giọng đọc, phiên âm chuẩn: ${phonetic}.`,
      };
    }
  }

  public speakEnglishSentence(sentenceEn: string): {
    readonly spokenByVoice: boolean;
    readonly fallbackMessageVi: string;
  } {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return {
        spokenByVoice: false,
        fallbackMessageVi:
          'Thiết bị chưa hỗ trợ đọc cả câu bằng giọng nói. Bạn có thể chạm từng từ để xem phiên âm.',
      };
    }
    try {
      const synth = window.speechSynthesis;
      const voices = synth.getVoices();
      const englishVoice = voices.find((v) => v.lang.toLowerCase().startsWith('en'));
      synth.cancel();
      const utterance = new SpeechSynthesisUtterance(sentenceEn);
      utterance.lang = englishVoice?.lang ?? 'en-US';
      if (englishVoice) {
        utterance.voice = englishVoice;
      }
      utterance.rate = 0.94;
      synth.speak(utterance);
      return {
        spokenByVoice: true,
        fallbackMessageVi: 'Đang đọc câu tiếng Anh...',
      };
    } catch {
      return {
        spokenByVoice: false,
        fallbackMessageVi: 'Trình duyệt tạm khóa giọng đọc, hãy chạm từng từ để xem phiên âm.',
      };
    }
  }

  public destroy(): void {
    this.stopBgmTimerOnly();
    if (this.ctx) {
      void this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtor) return null;
    try {
      this.ctx = new AudioCtor();
      return this.ctx;
    } catch {
      return null;
    }
  }

  private startBgmLoop(): void {
    if (typeof window === 'undefined' || !this.currentTrack) return;
    const isBattle =
      this.currentTrack === 'wild_battle' || this.currentTrack === 'boss_battle';
    const intervalMs = isBattle ? 230 : 420;
    this.bgmTimer = window.setInterval(() => {
      if (this.muted || this.bgmVolume <= 0.01 || !this.currentTrack) return;
      const context = this.ensureContext();
      if (!context || context.state !== 'running') return;
      const notes = TRACK_NOTES[this.currentTrack];
      const freq = notes[this.noteIndex % notes.length] ?? 329.63;
      this.noteIndex += 1;
      this.tone(
        context,
        freq,
        isBattle ? 0.16 : 0.32,
        isBattle ? 'triangle' : 'sine',
        this.bgmVolume * 0.11,
        context.currentTime,
      );
    }, intervalMs);
  }

  private stopBgmTimerOnly(): void {
    if (this.bgmTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
  }

  private tone(
    context: AudioContext,
    freq: number,
    durationSec: number,
    wave: OscillatorType,
    gainPeak: number,
    startTime: number,
  ): void {
    try {
      const osc = context.createOscillator();
      const gain = context.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, startTime);
      gain.gain.setValueAtTime(0.0001, startTime);
      gain.gain.linearRampToValueAtTime(Math.max(0.001, gainPeak), startTime + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);
      osc.connect(gain);
      gain.connect(context.destination);
      osc.start(startTime);
      osc.stop(startTime + durationSec + 0.02);
    } catch {
      // Ignore transient Web Audio errors on restricted devices.
    }
  }
}
