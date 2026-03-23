import { ISubsystem } from "./orchestrator.ts";
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
            console.log(
                `🍄 [Mycelium] Horizontal Gene Transfer: Absorbing Exogenous Plasmid ${
                    plasmid.hash.substring(0, 8)
                }... into Bucket #${plasmid.targetBucket}`
            );
            try {
                this.engine.injectPlasmidIntoBucket(
                    plasmid.targetBucket,
                    BigInt(plasmid.hash),
                );
            } catch (_e) {
                // Ignore exogenous off-grid WebRTC packets
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
        this.oracle.boot();
    }

    tick() {
        this.oracle.sync();
    }
}
