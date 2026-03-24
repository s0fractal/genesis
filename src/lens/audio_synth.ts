// OMEGA-64 Ontology 161: The Choir (Biological Sonification)

export class BioAcousticChoir {
    private ctx: AudioContext | null = null;
    private masterGain!: GainNode;
    private panner!: PannerNode; // Era 204: Spatial Audio Node
    private filter!: BiquadFilterNode;
    private delay!: DelayNode;
    private delayFeedback!: GainNode;
    private oscillators: OscillatorNode[] = [];
    private isInitialized = false;

    constructor() {}

    public init() {
        if (this.isInitialized) return;
        
        // Native WebAudio Ignition
        const AudioContextCls = globalThis.AudioContext || (globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!AudioContextCls) return;
        
        this.ctx = new AudioContextCls();
        
        // Master Gain (Energy Modulation)
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 0.0; // Start absolutely silent
        
        // Era 204: 3D Spatial Mycelium
        this.panner = this.ctx.createPanner();
        this.panner.panningModel = "HRTF";
        this.panner.distanceModel = "inverse";
        this.panner.refDistance = 1;
        this.panner.maxDistance = 10000;
        this.panner.rolloffFactor = 1;
        
        this.masterGain.connect(this.panner);
        this.panner.connect(this.ctx.destination);

        // Mathematical BiquadFilter (Lock Correlation)
        this.filter = this.ctx.createBiquadFilter();
        this.filter.type = "lowpass";
        this.filter.frequency.value = 400; // Muffled base
        this.filter.Q.value = 2.0;

        // Entanglement Spatial Echo (Reverb/Delay network)
        this.delay = this.ctx.createDelay(3.0);
        this.delay.delayTime.value = 0.7; // 700ms spatial echo
        
        this.delayFeedback = this.ctx.createGain();
        this.delayFeedback.gain.value = 0.3; // 30% baseline feedback

        // Topological Routing 
        this.filter.connect(this.masterGain);
        
        // Wet FX chain
        this.filter.connect(this.delay);
        this.delay.connect(this.delayFeedback);
        this.delayFeedback.connect(this.delay);
        this.delay.connect(this.masterGain);

        // Era 226: 432Hz Bio-Acoustic Harmonic Scale (Tuned to Sub-Hum octave: 432 / 8 = 54Hz)
        const HARMONIC_432_SUB = [ 54.0, 66.0, 79.875 ]; // Derived directly from 432, 528, 639

        for (const freq of HARMONIC_432_SUB) {
            const osc = this.ctx.createOscillator();
            osc.type = freq === 54.0 ? "sine" : "triangle"; // Warm 54Hz sub-bass, dimensional overtones
            osc.frequency.value = freq;
            
            const oscGain = this.ctx.createGain();
            oscGain.gain.value = 1.0 / HARMONIC_432_SUB.length; // Prevent clipping
            
            osc.connect(oscGain);
            oscGain.connect(this.filter);
            osc.start();
            this.oscillators.push(osc);
        }

        this.isInitialized = true;
        console.log("🔊 [CHOIR] Ontological Audio Matrix Initialized.");
    }

    public async resume() {
        if (this.ctx && this.ctx.state === "suspended") {
            try {
                await this.ctx.resume();
                console.log("🔊 [CHOIR] Audio Context Resumed.");
            } catch (_err) {
                console.warn("🔇 [CHOIR] Safari AudioContext auto-play blocked bounds.");
            }
        }
    }

    // Mathematical Mapping:
    // Energy (0.0 -> 1.0) => Master Gain (Absolute Volume)
    // Lock (0.0 -> 1.0) => Filter Cutoff (High Lock = Open Harmonic Ringing)
    // Entanglement (0.0 -> 1.0) => Delay Feedback (Infinite Spatial Vastness)
    // Theta (0.0 -> 1.0) => Pitch LFO Detune
    public modulateParams(energyNorm: number, lockNorm: number, entanglementNorm: number, thetaNorm: number) {
        if (!this.isInitialized || !this.ctx) return;

        // 100ms algorithmic glide to prevent snapping/clicking audio artifacts
        const time = this.ctx.currentTime + 0.1;

        // 1. Energy 
        // We square root the energy so small energy spikes are audible, but it doesn't clip.
        const targetVol = Math.max(0, Math.min(0.6, Math.sqrt(energyNorm) * 0.8));
        this.masterGain.gain.linearRampToValueAtTime(targetVol, time);

        // 2. Lock
        const minCutoff = 150;
        const maxCutoff = 5000;
        // Exponential scale to match perceptual hearing ranges
        const targetCutoff = minCutoff * Math.pow(maxCutoff / minCutoff, lockNorm);
        this.filter.frequency.exponentialRampToValueAtTime(targetCutoff, time);

        // 3. Entanglement
        // Max feedback = 0.85 (massive ambient echo cave)
        const targetFeedback = 0.1 + (entanglementNorm * 0.75);
        this.delayFeedback.gain.linearRampToValueAtTime(targetFeedback, time);

        // 4. Theta (Phase offsets)
        if (this.oscillators.length >= 3) {
             const detuneAmount = (thetaNorm - 0.5) * 35; // -17.5 to +17.5 cents beating
             this.oscillators[1].detune.linearRampToValueAtTime(detuneAmount, time);
             this.oscillators[2].detune.linearRampToValueAtTime(-detuneAmount, time);
        }

        // 5. Era 204: True 3D Spatial coordinates
        const radius = 10.0;
        const x = Math.cos(thetaNorm * Math.PI * 2) * radius;
        const z = Math.sin(thetaNorm * Math.PI * 2) * radius;
        const y = (energyNorm - 0.5) * 5.0; // Massive energy calculations hover above the listener

        try {
            this.panner.positionX.linearRampToValueAtTime(x, time);
            this.panner.positionY.linearRampToValueAtTime(y, time);
            this.panner.positionZ.linearRampToValueAtTime(z, time);
        } catch (_e) {
            // Safari fallback for older SpatialAudio specs
            this.panner.setPosition(x, y, z);
        }
    }
}
