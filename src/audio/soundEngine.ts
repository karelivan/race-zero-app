// Authentic SNES SPC700-Style 8-Channel Procedural Audio & DSP Synthesizer for AERO-X 99
// Recreates the iconic 16-bit console sound signature: Slap Bass, Vibrato Brass/Guitar Leads,
// Jazz-Fusion Chord Pads, Gated-Reverb 16-bit Drums, SPC700 Stereo Delay Echo, and Turbine SFX.

interface SequencerTrackData {
  tempoMs: number; // 16th note duration in ms
  // 64-step (4-bar) patterns for full musical phrases
  bass: number[];
  lead: number[];
  harmony: number[];
  chords: number[][]; // 3-note voicings triggered every 4 steps
  drums: ('K' | 'S' | 'H' | 'O' | 'K+C' | 'S+H' | '.')[];
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private echoDelayL: DelayNode | null = null;
  private echoDelayR: DelayNode | null = null;

  private isEnabled = true;
  private musicVolume = 0.5;
  private sfxVolume = 0.7;

  // Continuous SNES Hovercraft Turbine Nodes
  private engineOscMain: OscillatorNode | null = null;
  private engineOscSub: OscillatorNode | null = null;
  private engineOscWhine: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private boostNoiseNode: AudioBufferSourceNode | null = null;
  private boostNoiseGain: GainNode | null = null;
  private boostNoiseFilter: BiquadFilterNode | null = null;
  private whiteNoiseBuffer: AudioBuffer | null = null;
  private engineRunning = false;

  // Low-energy alarm cooldown
  private lastAlarmTime = 0;

  // SPC700 Sequencer State
  private musicTimer: number | null = null;
  private currentStep = 0;
  private activeTheme = 0;

  // 3 Original 64-Step High-Energy 16-Bit Jazz-Fusion / Synth-Rock Tracks
  private readonly themes: SequencerTrackData[] = [
    // Theme 0: Neo-Veridia Bay (Upbeat 16-bit Jazz-Fusion / Brass Lead & Slap Bass - 142 BPM)
    {
      tempoMs: 105,
      bass: [
        // Bar 1 (E minor 9)
        40, 0, 40, 52, 0, 40, 43, 45, 47, 0, 47, 59, 0, 47, 45, 43,
        // Bar 2 (C major 7)
        36, 0, 36, 48, 0, 36, 39, 40, 43, 0, 43, 55, 0, 43, 45, 47,
        // Bar 3 (D dominant 9)
        38, 0, 38, 50, 0, 38, 42, 45, 47, 0, 45, 50, 0, 45, 42, 38,
        // Bar 4 (B7 alt turnaround)
        35, 0, 35, 47, 0, 35, 39, 42, 45, 0, 47, 51, 54, 51, 47, 42,
      ],
      lead: [
        // Bar 1
        76, 0, 79, 81, 83, 0, 81, 79, 76, 79, 83, 86, 84, 83, 79, 0,
        // Bar 2
        79, 0, 83, 84, 86, 0, 84, 83, 79, 76, 74, 76, 79, 0, 0, 0,
        // Bar 3
        74, 0, 78, 81, 83, 81, 78, 74, 78, 81, 83, 86, 88, 0, 86, 83,
        // Bar 4
        83, 84, 83, 79, 78, 0, 79, 83, 87, 0, 86, 83, 84, 0, 0, 0,
      ],
      harmony: [
        // Twin 3rd/6th harmony synth
        71, 0, 74, 76, 79, 0, 76, 74, 71, 74, 79, 81, 79, 78, 74, 0,
        74, 0, 79, 79, 81, 0, 79, 78, 74, 71, 69, 71, 74, 0, 0, 0,
        69, 0, 74, 76, 78, 76, 74, 69, 74, 76, 78, 81, 83, 0, 81, 78,
        78, 79, 78, 75, 74, 0, 75, 78, 83, 0, 81, 78, 79, 0, 0, 0,
      ],
      chords: [
        [59, 62, 66], [59, 62, 66], [59, 62, 67], [59, 62, 66],
        [55, 59, 64], [55, 59, 64], [55, 60, 64], [55, 59, 64],
        [57, 62, 66], [57, 62, 66], [57, 60, 66], [57, 62, 66],
        [54, 59, 63], [54, 59, 63], [54, 57, 63], [54, 59, 63],
      ],
      drums: [
        'K+C', 'H', 'H', 'K', 'S', 'H', 'K', 'O', 'K', 'H', 'K', 'H', 'S', 'H', 'S', 'O',
        'K', 'H', 'H', 'K', 'S', 'H', 'K', 'O', 'K', 'H', 'K', 'H', 'S', 'S', 'H', 'O',
        'K+C', 'H', 'H', 'K', 'S', 'H', 'K', 'O', 'K', 'H', 'K', 'H', 'S', 'H', 'K', 'O',
        'K', 'H', 'K', 'S', 'S', 'H', 'K', 'S', 'K', 'S', 'K', 'S', 'S', 'S', 'K+C', 'O',
      ],
    },

    // Theme 1: Helios Canyon Overdrive (High-Speed 16-bit Rock Guitar & Driving Double-Bass - 150 BPM)
    {
      tempoMs: 100,
      bass: [
        38, 38, 50, 38, 41, 38, 43, 45, 38, 38, 50, 38, 45, 43, 41, 36,
        34, 34, 46, 34, 38, 34, 41, 43, 36, 36, 48, 36, 43, 45, 48, 52,
        38, 38, 50, 38, 41, 38, 43, 45, 46, 46, 58, 46, 45, 43, 41, 38,
        36, 36, 48, 36, 37, 37, 49, 37, 38, 0, 45, 43, 41, 40, 38, 36,
      ],
      lead: [
        74, 74, 77, 74, 81, 0, 79, 77, 76, 77, 76, 72, 74, 0, 0, 0,
        70, 74, 77, 81, 82, 81, 77, 74, 72, 76, 79, 83, 84, 0, 86, 88,
        86, 0, 84, 81, 79, 81, 79, 77, 74, 77, 81, 84, 86, 0, 84, 81,
        84, 82, 81, 79, 81, 79, 77, 76, 74, 0, 81, 79, 77, 76, 74, 0,
      ],
      harmony: [
        69, 69, 72, 69, 77, 0, 76, 74, 72, 74, 72, 69, 69, 0, 0, 0,
        65, 70, 74, 77, 77, 74, 70, 69, 67, 72, 76, 79, 79, 0, 81, 84,
        81, 0, 79, 77, 76, 77, 76, 74, 70, 74, 77, 81, 81, 0, 79, 77,
        79, 77, 76, 74, 76, 74, 72, 71, 69, 0, 77, 76, 74, 72, 69, 0,
      ],
      chords: [
        [57, 62, 65], [57, 62, 65], [57, 60, 65], [57, 62, 65],
        [53, 58, 62], [53, 58, 62], [55, 60, 64], [55, 60, 64],
        [57, 62, 65], [57, 62, 65], [58, 62, 65], [58, 62, 65],
        [55, 60, 64], [55, 61, 64], [57, 62, 65], [57, 62, 65],
      ],
      drums: [
        'K+C', 'K', 'H', 'K', 'S', 'K', 'H', 'O', 'K', 'K', 'H', 'K', 'S', 'H', 'S', 'O',
        'K', 'K', 'H', 'K', 'S', 'K', 'H', 'O', 'K', 'K', 'H', 'K', 'S', 'S', 'K', 'O',
        'K+C', 'K', 'H', 'K', 'S', 'K', 'H', 'O', 'K', 'K', 'H', 'K', 'S', 'H', 'S', 'O',
        'K', 'H', 'S', 'K', 'K', 'S', 'K', 'S', 'K+C', 'H', 'S', 'S', 'S', 'S', 'K+C', 'O',
      ],
    },

    // Theme 2: Cryo-Sector Zero (158 BPM Technical Cyber-Fusion Finale)
    {
      tempoMs: 94,
      bass: [
        36, 48, 36, 48, 39, 51, 39, 51, 41, 53, 41, 53, 43, 55, 46, 43,
        36, 48, 36, 48, 44, 56, 44, 56, 46, 58, 46, 58, 48, 60, 55, 51,
        36, 48, 36, 48, 39, 51, 39, 51, 41, 53, 41, 53, 42, 54, 43, 55,
        44, 56, 44, 56, 46, 58, 46, 58, 48, 0, 48, 46, 44, 43, 39, 36,
      ],
      lead: [
        72, 75, 79, 84, 82, 79, 75, 72, 77, 80, 84, 89, 87, 86, 84, 79,
        72, 75, 79, 84, 87, 86, 84, 80, 82, 86, 89, 91, 92, 0, 91, 89,
        84, 0, 87, 86, 84, 79, 82, 0, 80, 84, 87, 91, 90, 89, 87, 86,
        87, 84, 80, 75, 86, 82, 79, 74, 84, 0, 84, 82, 80, 79, 75, 72,
      ],
      harmony: [
        67, 72, 75, 79, 79, 75, 72, 67, 72, 77, 80, 84, 84, 82, 79, 74,
        67, 72, 75, 79, 84, 82, 80, 75, 77, 82, 86, 87, 87, 0, 86, 84,
        79, 0, 84, 82, 79, 75, 79, 0, 77, 80, 84, 87, 86, 84, 82, 82,
        84, 80, 75, 72, 82, 79, 74, 70, 79, 0, 79, 77, 75, 74, 72, 67,
      ],
      chords: [
        [60, 63, 67], [60, 63, 67], [60, 65, 68], [59, 62, 67],
        [60, 63, 67], [56, 60, 63], [58, 62, 65], [60, 63, 67],
        [60, 63, 67], [60, 63, 67], [60, 65, 68], [59, 62, 67],
        [56, 60, 63], [58, 62, 65], [60, 63, 67], [60, 63, 67],
      ],
      drums: [
        'K+C', 'H', 'K', 'H', 'S', 'H', 'K', 'O', 'K', 'H', 'K', 'H', 'S', 'H', 'K', 'O',
        'K', 'H', 'K', 'H', 'S', 'H', 'K', 'O', 'K', 'H', 'S', 'K', 'S', 'S', 'K+C', 'O',
        'K+C', 'H', 'K', 'H', 'S', 'H', 'K', 'O', 'K', 'H', 'K', 'H', 'S', 'H', 'S', 'O',
        'K', 'S', 'K', 'S', 'K', 'S', 'K', 'S', 'K+C', '0' as '.', 'K', 'S', 'S', 'S', 'K+C', 'O',
      ],
    },
  ];

  private ensureContext(): AudioContext | null {
    if (!this.isEnabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        this.ctx = ctx;

        // Master Bus + SPC700-style Stereo Delay Echo Bus
        this.masterGain = ctx.createGain();
        this.masterGain.gain.value = 0.9;
        this.masterGain.connect(ctx.destination);

        this.musicBus = ctx.createGain();
        this.musicBus.gain.value = this.musicVolume;
        this.musicBus.connect(this.masterGain);

        this.sfxBus = ctx.createGain();
        this.sfxBus.gain.value = this.sfxVolume;
        this.sfxBus.connect(this.masterGain);

        // SNES SPC700 Echo DSP Simulation (Cross-feedback filtered delay)
        this.echoDelayL = ctx.createDelay(0.5);
        this.echoDelayR = ctx.createDelay(0.5);
        this.echoDelayL.delayTime.value = 0.165;
        this.echoDelayR.delayTime.value = 0.22;

        const echoFilter = ctx.createBiquadFilter();
        echoFilter.type = 'lowpass';
        echoFilter.frequency.value = 2600;

        const echoFeedback = ctx.createGain();
        echoFeedback.gain.value = 0.28;

        const echoWet = ctx.createGain();
        echoWet.gain.value = 0.24;

        this.echoDelayL.connect(echoFilter);
        echoFilter.connect(this.echoDelayR);
        this.echoDelayR.connect(echoFeedback);
        echoFeedback.connect(this.echoDelayL);

        this.echoDelayL.connect(echoWet);
        this.echoDelayR.connect(echoWet);
        echoWet.connect(this.musicBus);

        // Pre-compute white/pink noise buffer for 16-bit drums, jet boost, and barrier crash
        const bufferSize = ctx.sampleRate * 1.5;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          output[i] = Math.random() * 2 - 1;
        }
        this.whiteNoiseBuffer = noiseBuffer;
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public configure(enabled: boolean, musicVol: number, sfxVol: number) {
    this.isEnabled = enabled;
    this.musicVolume = Math.max(0, Math.min(1, musicVol));
    this.sfxVolume = Math.max(0, Math.min(1, sfxVol));

    if (this.musicBus && this.ctx) {
      this.musicBus.gain.setTargetAtTime(enabled ? this.musicVolume : 0, this.ctx.currentTime, 0.03);
    }
    if (this.sfxBus && this.ctx) {
      this.sfxBus.gain.setTargetAtTime(enabled ? this.sfxVolume : 0, this.ctx.currentTime, 0.03);
    }

    if (!enabled) {
      this.stopEngine();
      this.stopMusic();
    }
  }

  private midiToFreq(midi: number): number {
    return 440 * Math.pow(2, (midi - 69) / 12);
  }

  // ============================================================================
  // SNES MODE-7 TURBINE ENGINE & JET AFTERBURNER SYNTH
  // ============================================================================
  public startEngine() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus || this.engineRunning) return;

    try {
      this.engineOscMain = ctx.createOscillator();
      this.engineOscSub = ctx.createOscillator();
      this.engineOscWhine = ctx.createOscillator();
      this.engineFilter = ctx.createBiquadFilter();
      this.engineGain = ctx.createGain();

      // Classic SNES dual-oscillator phased turbine + high-pitched plasma whine
      this.engineOscMain.type = 'sawtooth';
      this.engineOscSub.type = 'square';
      this.engineOscWhine.type = 'triangle';

      this.engineOscMain.frequency.value = 65;
      this.engineOscSub.frequency.value = 32.5;
      this.engineOscWhine.frequency.value = 260;

      this.engineFilter.type = 'bandpass';
      this.engineFilter.frequency.value = 380;
      this.engineFilter.Q.value = 2.8;

      this.engineGain.gain.value = 0.001;

      const subGain = ctx.createGain();
      subGain.gain.value = 0.55;
      const whineGain = ctx.createGain();
      whineGain.gain.value = 0.35;

      this.engineOscMain.connect(this.engineFilter);
      this.engineOscSub.connect(subGain);
      subGain.connect(this.engineFilter);
      this.engineOscWhine.connect(whineGain);
      whineGain.connect(this.engineGain);

      this.engineFilter.connect(this.engineGain);
      this.engineGain.connect(this.sfxBus);

      this.engineOscMain.start();
      this.engineOscSub.start();
      this.engineOscWhine.start();

      // Continuous filtered noise for high-speed wind & boost jet roar
      if (this.whiteNoiseBuffer) {
        this.boostNoiseNode = ctx.createBufferSource();
        this.boostNoiseNode.buffer = this.whiteNoiseBuffer;
        this.boostNoiseNode.loop = true;

        this.boostNoiseFilter = ctx.createBiquadFilter();
        this.boostNoiseFilter.type = 'bandpass';
        this.boostNoiseFilter.frequency.value = 800;
        this.boostNoiseFilter.Q.value = 1.8;

        this.boostNoiseGain = ctx.createGain();
        this.boostNoiseGain.gain.value = 0.0001;

        this.boostNoiseNode.connect(this.boostNoiseFilter);
        this.boostNoiseFilter.connect(this.boostNoiseGain);
        this.boostNoiseGain.connect(this.sfxBus);
        this.boostNoiseNode.start();
      }

      this.engineRunning = true;
    } catch {
      this.engineRunning = false;
    }
  }

  public updateEngine(
    speedKmh: number,
    maxSpeedKmh: number,
    isBoosting: boolean,
    isAirborne: boolean,
    energy = 100
  ) {
    if (
      !this.engineRunning ||
      !this.ctx ||
      !this.engineOscMain ||
      !this.engineOscSub ||
      !this.engineOscWhine ||
      !this.engineFilter ||
      !this.engineGain
    ) {
      return;
    }
    const now = this.ctx.currentTime;
    if (!this.isEnabled) {
      this.engineGain.gain.setTargetAtTime(0.0001, now, 0.04);
      return;
    }

    const ratio = Math.max(0, Math.min(1.5, speedKmh / Math.max(1, maxSpeedKmh)));
    // Pitch rises smoothly like the SNES F-Zero turbine sample pitch-register
    const mainPitch = 58 + ratio * 195 + (isBoosting ? 58 : 0) + (isAirborne ? 28 : 0);

    this.engineOscMain.frequency.setTargetAtTime(mainPitch, now, 0.035);
    this.engineOscSub.frequency.setTargetAtTime(mainPitch * 0.502, now, 0.035);
    this.engineOscWhine.frequency.setTargetAtTime(mainPitch * 3.98, now, 0.035);

    this.engineFilter.frequency.setTargetAtTime(
      260 + ratio * 1450 + (isBoosting ? 1100 : 0),
      now,
      0.04
    );

    const targetGain = 0.055 + ratio * 0.095 + (isBoosting ? 0.045 : 0);
    this.engineGain.gain.setTargetAtTime(targetGain, now, 0.04);

    if (this.boostNoiseGain && this.boostNoiseFilter) {
      const jetGain = isBoosting ? 0.14 : Math.max(0.001, (ratio - 0.65) * 0.05);
      this.boostNoiseGain.gain.setTargetAtTime(jetGain, now, 0.05);
      this.boostNoiseFilter.frequency.setTargetAtTime(isBoosting ? 1350 : 650 + ratio * 500, now, 0.05);
    }

    // Classic SNES "BEEP-BEEP-BEEP" critical shield alarm when energy <= 22%
    if (energy > 0 && energy <= 22 && speedKmh > 50 && now - this.lastAlarmTime > 0.36) {
      this.lastAlarmTime = now;
      this.playLowShieldAlarm();
    }
  }

  public stopEngine() {
    if (!this.engineRunning) return;
    try {
      this.engineOscMain?.stop();
      this.engineOscSub?.stop();
      this.engineOscWhine?.stop();
      this.boostNoiseNode?.stop();
      this.engineGain?.disconnect();
      this.boostNoiseGain?.disconnect();
    } catch {
      // Ignore already stopped
    }
    this.engineOscMain = null;
    this.engineOscSub = null;
    this.engineOscWhine = null;
    this.engineFilter = null;
    this.engineGain = null;
    this.boostNoiseNode = null;
    this.boostNoiseGain = null;
    this.boostNoiseFilter = null;
    this.engineRunning = false;
  }

  // ============================================================================
  // SNES SPC700 8-CHANNEL MUSIC SEQUENCER
  // ============================================================================
  public startMusic(themeIndex: number) {
    this.stopMusic();
    if (!this.isEnabled || this.musicVolume <= 0.01) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    this.activeTheme = themeIndex % this.themes.length;
    this.currentStep = 0;
    const theme = this.themes[this.activeTheme];

    this.musicTimer = window.setInterval(() => {
      if (!this.isEnabled || this.musicVolume <= 0.01) return;
      this.playSequencerStep();
    }, theme.tempoMs);
  }

  private playSequencerStep() {
    const ctx = this.ensureContext();
    if (!ctx || !this.musicBus) return;

    const theme = this.themes[this.activeTheme];
    const step = this.currentStep % 64;
    const now = ctx.currentTime;
    const stepSec = theme.tempoMs / 1000;

    // 1. CHANNEL 1: SNES Slap Bass (Resonant lowpass envelope pop)
    const bassNote = theme.bass[step];
    if (bassNote > 0) {
      const osc = ctx.createOscillator();
      const sub = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      const freq = this.midiToFreq(bassNote);
      osc.type = 'sawtooth';
      sub.type = 'square';
      osc.frequency.setValueAtTime(freq, now);
      sub.frequency.setValueAtTime(freq * 0.5, now);

      filter.type = 'lowpass';
      filter.Q.value = 4.5;
      filter.frequency.setValueAtTime(1650, now);
      filter.frequency.exponentialRampToValueAtTime(260, now + stepSec * 0.85);

      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + stepSec * 1.35);

      osc.connect(filter);
      sub.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicBus);

      osc.start(now);
      sub.start(now);
      osc.stop(now + stepSec * 1.4);
      sub.stop(now + stepSec * 1.4);
    }

    // 2. CHANNEL 2 & 3: Twin Brass / Lead Guitar Synth with Vibrato & SPC700 Echo
    const leadNote = theme.lead[step];
    if (leadNote > 0) {
      this.triggerLeadVoice(this.midiToFreq(leadNote), now, stepSec * 1.85, 0.14, true);
    }
    const harmNote = theme.harmony[step];
    if (harmNote > 0) {
      this.triggerLeadVoice(this.midiToFreq(harmNote), now, stepSec * 1.75, 0.085, true);
    }

    // 3. CHANNEL 4: Jazz-Fusion Warm Synth Pad Chords (every 4 steps)
    if (step % 4 === 0) {
      const chordIdx = Math.floor(step / 4) % theme.chords.length;
      const chord = theme.chords[chordIdx];
      chord.forEach((noteMidi) => {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(this.midiToFreq(noteMidi), now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1100, now);

        const dur = stepSec * 3.8;
        gain.gain.setValueAtTime(0.005, now);
        gain.gain.linearRampToValueAtTime(0.055, now + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicBus!);
        if (this.echoDelayL) gain.connect(this.echoDelayL);

        osc.start(now);
        osc.stop(now + dur + 0.02);
      });
    }

    // 4. CHANNEL 5 & 6: 16-Bit Sample-Style Percussion (Kick, Gated Snare, Hats, Crash)
    const drumCmd = theme.drums[step];
    if (drumCmd && drumCmd !== '.') {
      if (drumCmd.includes('K')) this.trigger16BitKick(now);
      if (drumCmd.includes('S')) this.trigger16BitSnare(now);
      if (drumCmd.includes('H')) this.trigger16BitHat(now, false);
      if (drumCmd.includes('O')) this.trigger16BitHat(now, true);
      if (drumCmd.includes('C')) this.trigger16BitCrash(now);
    }

    this.currentStep++;
  }

  private triggerLeadVoice(
    freq: number,
    now: number,
    duration: number,
    volume: number,
    sendToEcho: boolean
  ) {
    if (!this.ctx || !this.musicBus) return;
    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const vibrato = this.ctx.createOscillator();
    const vibratoGain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    // Detuned pulse/saw pair for classic SNES synth-guitar / brass lead
    osc1.type = 'sawtooth';
    osc2.type = 'square';
    osc1.frequency.setValueAtTime(freq, now);
    osc2.frequency.setValueAtTime(freq * 1.004, now);

    // 6Hz Vibrato LFO
    vibrato.frequency.setValueAtTime(6.2, now);
    vibratoGain.gain.setValueAtTime(freq * 0.012, now);
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc1.frequency);
    vibratoGain.connect(osc2.frequency);

    filter.type = 'lowpass';
    filter.Q.value = 2.4;
    filter.frequency.setValueAtTime(2800, now);
    filter.frequency.exponentialRampToValueAtTime(1200, now + duration);

    gain.gain.setValueAtTime(0.002, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    if (sendToEcho && this.echoDelayL) {
      gain.connect(this.echoDelayL);
    }

    osc1.start(now);
    osc2.start(now);
    vibrato.start(now);
    osc1.stop(now + duration + 0.02);
    osc2.stop(now + duration + 0.02);
    vibrato.stop(now + duration + 0.02);
  }

  private trigger16BitKick(now: number) {
    if (!this.ctx || !this.musicBus) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.09);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);

    osc.connect(gain);
    gain.connect(this.musicBus);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  private trigger16BitSnare(now: number) {
    if (!this.ctx || !this.musicBus) return;
    // Snare body tone
    const body = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    body.type = 'triangle';
    body.frequency.setValueAtTime(210, now);
    body.frequency.exponentialRampToValueAtTime(95, now + 0.08);
    bodyGain.gain.setValueAtTime(0.22, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
    body.connect(bodyGain);
    bodyGain.connect(this.musicBus);
    body.start(now);
    body.stop(now + 0.1);

    // Gated-reverb 16-bit noise snap
    if (this.whiteNoiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.whiteNoiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1850, now);
      filter.Q.value = 1.1;

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.24, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.musicBus);
      if (this.echoDelayL) nGain.connect(this.echoDelayL);

      noise.start(now);
      noise.stop(now + 0.15);
    }
  }

  private trigger16BitHat(now: number, isOpen: boolean) {
    if (!this.ctx || !this.musicBus || !this.whiteNoiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.whiteNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(5800, now);

    const dur = isOpen ? 0.13 : 0.045;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isOpen ? 0.095 : 0.075, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    noise.start(now);
    noise.stop(now + dur + 0.01);
  }

  private trigger16BitCrash(now: number) {
    if (!this.ctx || !this.musicBus || !this.whiteNoiseBuffer) return;
    const noise = this.ctx.createBufferSource();
    noise.buffer = this.whiteNoiseBuffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(4200, now);
    filter.Q.value = 0.8;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.42);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicBus);
    if (this.echoDelayL) gain.connect(this.echoDelayL);
    noise.start(now);
    noise.stop(now + 0.45);
  }

  public stopMusic() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  // ============================================================================
  // AUTHENTIC 16-BIT ARCADE / SNES SOUND EFFECTS
  // ============================================================================
  public playCountdownTone(isGo: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    // Classic SNES two-oscillator brass countdown signal
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'square';

    const baseFreq = isGo ? 1046.5 : 523.25; // C6 on GO, C5 on 3-2-1
    osc1.frequency.setValueAtTime(baseFreq, now);
    osc2.frequency.setValueAtTime(baseFreq * 1.5, now); // Fifth interval

    const duration = isGo ? 0.48 : 0.22;
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxBus);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + duration + 0.02);
    osc2.stop(now + duration + 0.02);
  }

  public playBoostIgnite() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    // SNES Turbo Whoosh: Noise sweep + sub-bass punch + ascending pitch
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.18);
    osc.frequency.exponentialRampToValueAtTime(240, now + 0.65);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.7);

    if (this.whiteNoiseBuffer) {
      const jet = ctx.createBufferSource();
      jet.buffer = this.whiteNoiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.Q.value = 2.2;
      filter.frequency.setValueAtTime(400, now);
      filter.frequency.exponentialRampToValueAtTime(2800, now + 0.22);
      filter.frequency.exponentialRampToValueAtTime(700, now + 0.7);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.28, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.72);

      jet.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.sfxBus);
      jet.start(now);
      jet.stop(now + 0.75);
    }
  }

  public playRechargeTick(energyPercent = 50) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    // Iconic SNES Pit-Stop Rising Shimmer Pitch based on current shield %
    const baseFreq = 680 + (energyPercent / 100) * 920;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.setValueAtTime(baseFreq * 1.25, now + 0.035);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.085);
  }

  public playJumpLaunch() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    // Classic SNES Jump-Plate spring sweep
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.exponentialRampToValueAtTime(1120, now + 0.26);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.3);
  }

  public playCollisionImpact() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;

    // Iconic SNES metallic guardrail clang + noise burst
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'square';
    osc2.type = 'sawtooth';
    // Inharmonic metallic ratio
    osc1.frequency.setValueAtTime(420, now);
    osc1.frequency.exponentialRampToValueAtTime(65, now + 0.16);
    osc2.frequency.setValueAtTime(615, now);
    osc2.frequency.exponentialRampToValueAtTime(92, now + 0.16);

    gain.gain.setValueAtTime(0.24, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.17);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(this.sfxBus);
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.18);
    osc2.stop(now + 0.18);

    if (this.whiteNoiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.whiteNoiseBuffer;
      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.22, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      noise.connect(nGain);
      nGain.connect(this.sfxBus);
      noise.start(now);
      noise.stop(now + 0.13);
    }
  }

  private playLowShieldAlarm() {
    if (!this.ctx || !this.sfxBus) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1320, now);
    osc.frequency.setValueAtTime(980, now + 0.07);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  public playLapFanfare(isFinalFinish: boolean) {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const notes = isFinalFinish
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
      : [659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      const start = ctx.currentTime + idx * 0.085;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.16, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.22);
      osc.connect(gain);
      gain.connect(this.sfxBus!);
      osc.start(start);
      osc.stop(start + 0.23);
    });
  }

  public playExplosion() {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxBus) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(18, now + 0.85);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.88);
    osc.connect(gain);
    gain.connect(this.sfxBus);
    osc.start(now);
    osc.stop(now + 0.9);

    if (this.whiteNoiseBuffer) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.whiteNoiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(120, now + 0.85);

      const nGain = ctx.createGain();
      nGain.gain.setValueAtTime(0.35, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.88);
      noise.connect(filter);
      filter.connect(nGain);
      nGain.connect(this.sfxBus);
      noise.start(now);
      noise.stop(now + 0.9);
    }
  }
}

export const soundEngine = new SoundEngine();
