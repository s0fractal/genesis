
import { SovereignOracle } from "../../ontology/oracle.ts";
import { PhaseNetwork } from "../../shared/phase_network.ts";
import { PhaseComputeEngine } from "../../lens/phase_compute.ts";
import { SenateChatHUD } from "../../ontology/senate_hud.ts";

export class OracleNetworkSubsystem implements ISubsystem {
    public network: PhaseNetwork;
    public senateChat: SenateChatHUD;

    constructor(
        public oracle: SovereignOracle,
        public engine: PhaseComputeEngine
    ) {
        this.senateChat = new SenateChatHUD();
        
        this.network = new PhaseNetwork((plasmid) => {
            const hash = BigInt(plasmid.hash);
            
            // Era 203: Holographic CRDT Resonance (Constructive Interference)
            if (this.oracle.plasmidRegistry.has(hash)) {
                const node = this.oracle.plasmidRegistry.get(hash)!;
                node.attention += Math.max(10, Math.floor(plasmid.energy / 100)); // Optical resonance
                node.energy += Math.min(1000, plasmid.energy); // Inject arriving amplitude
                this.oracle.activePlasmids.add(hash); // Re-awaken standard metabolism
                console.log(`🌈 [Holo-CRDT] Constructive Interference! Amplified existing node: ${plasmid.hash.substring(0, 8)}`);
                return;
            }

            // Novel logic branch. Attempt to merge into local WebGPU Phase Lattice
            console.log(
                `🍄 [Mycelium] Holographic DAG Merge: Absorbing Novel Plasmid ${
                    plasmid.hash.substring(0, 8)
                }... into Bucket #${plasmid.targetBucket}`
            );
            try {
                this.engine.injectPlasmidIntoBucket(
                    plasmid.targetBucket,
                    hash,
                );
            } catch (_e) {
                // Ignore exogenous off-grid WebRTC packets if buckets are full
            }
        });

        this.oracle.bindNetwork((hash, targetBucket) => {
            // O-48: Genesis Override
            this.network.broadcastPlasmid(hash.toString(), targetBucket, 1500, 300);
        });

        this.oracle.onSenateEvent = (event) => {
            this.senateChat.handleEvent(event);
        };
        
        this.oracle.onVision = (base64: string) => {
            const debugImg = document.getElementById("oracle-debug-vision") as HTMLImageElement;
            if (debugImg) {
                debugImg.style.display = "block";
                debugImg.src = "data:image/png;base64," + base64;
            }
        };
    }

    init() {
        console.log("[TRACE] oracleSys.init() START");
        this.oracle.boot();
        console.log("[TRACE] oracleSys.init() SUCCESS");
    }

    tick() {
        this.oracle.sync();
        // Era 203: Snell's Law thermodynamic coupling
        this.network.localRefractiveIndex = Math.max(0.1, this.oracle.lastEntropy);
    }
}
