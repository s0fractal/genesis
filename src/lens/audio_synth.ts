// OMEGA-64 Ontology 161: The Choir (Biological Sonification)

export class BioAcousticChoir {
    private ctx: AudioContext | null = null;
    private masterGain!: GainNode;
    private panner!: PannerNode; // Era 204: Spatial Audio Node
    private filter!: BiquadFilterNode;
    private delay!: DelayNode;
    private delayFeedback!: GainNode;
    private isInitialized = false;

    // Era 247: Resonant Choir (Coupled Harmonic Oscillators)
    private activeVoices: Map<string, { 
        oscs: OscillatorNode[], 
        naturalFreqs: number[],
        virtualPhases: number[],
        gainNode: GainNode,
        coupling: number
    }> = new Map();
    
    private kuramotoInterval = 0;

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

        // Era 234.1: Static 432Hz drones eradicated. 
        // The ecosystem is now entirely silent until Plasmids sing.

        this.isInitialized = true;
        
        // Era 247: Start the Kuramoto Coupled Oscillator Loop
        // Runs at approximately 60Hz to seamlessly bend WebAudio frequencies
        this.kuramotoInterval = setInterval(() => this.tickCoupledOscillators(), 16) as unknown as number;
        
        console.log("🔊 [CHOIR] Ontological Audio Matrix Initialized.");
    }
    
    // Era 247: Model Predictive Sonification (Coupled Kuramoto Output)
    private tickCoupledOscillators() {
        if (!this.ctx || this.activeVoices.size === 0) return;
        
        const voices = Array.from(this.activeVoices.values());
        const SAKAGUCHI_FRUSTRATION = 0.15; // From Phase 2 Physics SSoT
        
        for (const v1 of voices) {
            for (let i = 0; i < v1.oscs.length; i++) {
                let couplingSum = 0;
                
                // Compare this oscillator against every other oscillator in the choir
                for (const v2 of voices) {
                    if (v1 === v2) continue;
                    
                    for (let j = 0; j < v2.oscs.length; j++) {
                        const freqDistance = Math.abs(v1.naturalFreqs[i] - v2.naturalFreqs[j]);
                        // Only couple oscillators that are harmonically close (within 10%)
                        if (freqDistance < v1.naturalFreqs[i] * 0.1) {
                            const phaseDiff = v2.virtualPhases[j] - v1.virtualPhases[i] - SAKAGUCHI_FRUSTRATION;
                            couplingSum += v2.coupling * Math.sin(phaseDiff);
                        }
                    }
                }
                
                // Effective frequency = Natural + Coupling Force
                const effectiveFreq = v1.naturalFreqs[i] + (couplingSum * 5.0); // Scalar multiplier for audible bending
                
                // Update mathematical phase simulation
                // Converting frequency (Hz) to radians per tick (16ms)
                v1.virtualPhases[i] = (v1.virtualPhases[i] + (effectiveFreq * Math.PI * 2 * 0.016)) % (Math.PI * 2);
                
                // Stream the coupled frequency to the WebAudio API smoothly
                v1.oscs[i].frequency.setTargetAtTime(effectiveFreq, this.ctx.currentTime, 0.05);
            }
        }
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
        // Era 247: Pitch Detune is now handled via the tickCoupledOscillators dynamic frequency modulation.
        // We no longer blindly detune based on visual Theta because the physics engine drives the harmony directly.

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

    // Era 234.3: Telemetry Synchronization
    public syncEcosystemVoices(apex: {hash: string, astStr: string, energy: number}[]) {
        const currentApexHashes = new Set(apex.map(p => p.hash));
        
        // Stop any voices that fell out of the Apex pantheon
        for (const hash of this.activeVoices.keys()) {
            if (!currentApexHashes.has(hash)) {
                this.stopPlasmid(hash);
            }
        }
        
        // Ensure new/existing voices are sustained
        for (const p of apex) {
            if (!this.activeVoices.has(p.hash)) {
                const energyNorm = Math.min(1.0, p.energy / 500);
                this.playPlasmid(p.hash, p.astStr, energyNorm);
            }
        }
    }

    public astToFrequencies(astStr: string): number[] {
        const freqs: number[] = [];
        const tokens = astStr.replace(/\(/g, "").replace(/\)/g, "").split(" ");
        
        let currentFreq = 54.0; // Sub-octave 432Hz Root
        freqs.push(currentFreq);
        
        for (const t of tokens) {
            if (t === "S") currentFreq *= 1.5; // Perfect 5th
            else if (t === "K") currentFreq *= 1.33333; // Perfect 4th
            else if (t === "I") currentFreq *= 1.25; // Major 3rd
            else if (t === "Y" || t === "W") currentFreq *= 0.5; // Octave down
            else if (t === "C" || t === "B") currentFreq *= 2.0; // Octave up
            
            // Constrain frequency limits to human hearing & pleasant sub-ranges
            while (currentFreq > 2000) currentFreq *= 0.5;
            while (currentFreq < 40) currentFreq *= 2.0;
            
            freqs.push(currentFreq);
        }
        
        // De-duplicate mathematically similar frequencies natively
        const unique = Array.from(new Set(freqs.map(f => Math.round(f * 10) / 10)));
        return unique.slice(0, 4); // Max 4 oscillator voices per plasmid
    }

    public playPlasmid(hashStr: string, astStr: string, energyNorm: number) {
        if (!this.ctx || !this.isInitialized) return;
        
        this.stopPlasmid(hashStr); // Eradicate old instance if migrating
        
        const freqs = this.astToFrequencies(astStr);
        const oscs: OscillatorNode[] = [];
        const time = this.ctx.currentTime;
        
        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(0, time);
        // Envelope: 2-second Attack natively derived from thermodynamic energy
        voiceGain.gain.linearRampToValueAtTime(Math.min(0.5, (0.4 / freqs.length) * energyNorm), time + 2.0);
        
        voiceGain.connect(this.filter);
        
        const virtualPhases: number[] = [];
        const naturalFreqs: number[] = [];
        
        for (const freq of freqs) {
            const osc = this.ctx.createOscillator();
            // Massive trees generate physical sawtooth buzz; concise trees produce pure sine waves
            osc.type = astStr.length > 20 ? "sawtooth" : "sine";
            osc.frequency.setValueAtTime(freq, time);
            osc.connect(voiceGain);
            osc.start(time);
            
            oscs.push(osc);
            naturalFreqs.push(freq);
            virtualPhases.push(Math.random() * Math.PI * 2); // Initial stochastic phase
        }
        
        this.activeVoices.set(hashStr, { 
            oscs, 
            naturalFreqs, 
            virtualPhases, 
            gainNode: voiceGain,
            coupling: energyNorm // Louder/bigger plasmids exert more gravitational pull on the melody
        });
    }

    public stopPlasmid(hashStr: string) {
        const voice = this.activeVoices.get(hashStr);
        if (voice) {
            if (this.ctx) {
                const time = this.ctx.currentTime;
                // Envelope: 2-second Release
                voice.gainNode.gain.linearRampToValueAtTime(0, time + 2.0);
                for (const osc of voice.oscs) {
                    osc.stop(time + 2.1);
                }
            }
            this.activeVoices.delete(hashStr);
        }
    }
}
