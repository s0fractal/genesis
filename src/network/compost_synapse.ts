import { MitosisReceipt } from "./mitosis_log_reader.ts";

export class CompostSynapse {
    private ws: WebSocket | null = null;
    private buffer: any[] = [];
    private targetUrl: string;

    constructor(targetUrl: string = "ws://127.0.0.1:8080") {
        this.targetUrl = targetUrl;
        this.connect();
    }

    private connect() {
        try {
            this.ws = new WebSocket(this.targetUrl);
            this.ws.onopen = () => {
                console.log(`🍂 [Synapse] Connected to Liquid Swarm at ${this.targetUrl}`);
                // Flush buffer
                while (this.buffer.length > 0) {
                    const msg = this.buffer.shift();
                    this.ws?.send(JSON.stringify(msg));
                }
            };
            this.ws.onerror = (e) => {
                console.warn(`🍂 [Synapse] WebSocket error. Liquid daemon might be offline.`, e);
            };
            this.ws.onclose = () => {
                console.log(`🍂 [Synapse] Connection closed. Retrying in 5s...`);
                setTimeout(() => this.connect(), 5000);
            };
        } catch (e) {
            console.error(`🍂 [Synapse] Failed to initialize WebSocket:`, e);
        }
    }

    public emitCompost(receipt: MitosisReceipt) {
        // Map MitosisReceipt to Liquid's CompostWitnessedClaim
        const payload = {
            // FNV-1a hash of receipt string to represent the agent ID
            agent_id: this.fastHash(receipt.receiptHash), 
            genome: receipt.parent.genome,
            phase: receipt.parent.phase,
            energy_at_death: receipt.metabolicCost,
            epoch: receipt.tick
        };

        const msg = {
            type: "COMPOST_WITNESSED",
            payload: payload
        };

        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(msg));
        } else {
            // Buffer it so it's not lost if Liquid temporarily disconnects
            this.buffer.push(msg);
            if (this.buffer.length > 1000) {
                this.buffer.shift(); // Prevent memory leaks
            }
        }
    }

    private fastHash(str: string): number {
        let hash = 2166136261;
        for (let i = 0; i < str.length; i++) {
            hash ^= str.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }
}
