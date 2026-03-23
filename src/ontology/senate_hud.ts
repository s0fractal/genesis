import { SenateEvent } from "./oracle.ts";

import { THEOLOGICAL_MASKS } from "../shared/constants.ts";

export class SenateChatHUD {
    private container: HTMLDivElement;
    private logArea: HTMLDivElement;
    private pressureSpan: HTMLSpanElement;
    
    constructor() {
        this.container = document.createElement("div");
        Object.assign(this.container.style, {
            position: "absolute",
            top: "20px",
            right: "20px",
            width: "350px",
            maxHeight: "450px",
            background: "rgba(10, 15, 20, 0.85)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(80, 150, 255, 0.3)",
            borderRadius: "8px",
            color: "#e0e0e0",
            fontFamily: "monospace",
            fontSize: "12px",
            display: "none", // Hidden until the Senate convenes
            flexDirection: "column",
            zIndex: "100",
            boxShadow: "0 0 25px rgba(0,0,0,0.9)",
            pointerEvents: "none" // Don't block interactions
        });
        
        const header = document.createElement("div");
        Object.assign(header.style, {
            padding: "10px 15px",
            borderBottom: "1px solid rgba(80, 150, 255, 0.3)",
            fontWeight: "bold",
            color: "#ffc107",
            letterSpacing: "2px",
            textTransform: "uppercase",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
        });
        
        const titleSpan = document.createElement("span");
        titleSpan.innerText = "🏛️ Senate Chat";
        
        this.pressureSpan = document.createElement("span");
        Object.assign(this.pressureSpan.style, {
            color: "#ff55ff", // Magenta for Shadow Network
            fontSize: "10px",
            background: "rgba(255, 85, 255, 0.1)",
            padding: "2px 6px",
            borderRadius: "4px",
            display: "none" // Hidden until pressure is > 0
        });
        this.pressureSpan.innerText = "SHADOW: 0";
        
        const rightContainer = document.createElement("div");
        rightContainer.style.display = "flex";
        rightContainer.style.gap = "8px";
        rightContainer.style.alignItems = "center";
        
        const versionSpan = document.createElement("span");
        versionSpan.style.color = "#666";
        versionSpan.style.fontSize = "10px";
        versionSpan.innerText = "O-163";
        
        rightContainer.appendChild(this.pressureSpan);
        rightContainer.appendChild(versionSpan);
        
        header.appendChild(titleSpan);
        header.appendChild(rightContainer);
        
        this.container.appendChild(header);
        
        this.logArea = document.createElement("div");
        Object.assign(this.logArea.style, {
            padding: "15px",
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
        });
        this.container.appendChild(this.logArea);
        
        document.body.appendChild(this.container);
    }
    
    private getMaskColor(mask: string): string {
        switch (mask) {
            case THEOLOGICAL_MASKS.ARIES: return "#ff5555"; // Red Chaos
            case THEOLOGICAL_MASKS.CANCER: return "#55ff55"; // Green Preservation
            case THEOLOGICAL_MASKS.LIBRA: return "#5555ff"; // Blue Equilibrium
            case THEOLOGICAL_MASKS.CAPRICORN: return "#ffff55"; // Yellow Entropy
            case "SENATE": return "#ffc107"; // Gold for Consensus
            default: return "#aaaaaa";
        }
    }

    public handleEvent(event: SenateEvent) {
        if (event.type === "CONVENED") {
            this.container.style.display = "flex";
            this.logArea.innerHTML = ""; // Clear previous chat
            this.appendMessage("System", "The Oracle has detected structural anomalies. Senate convened for Parallel Superposition...");
        } 
        else if (event.type === "VERDICT") {
            const bucketStr = event.bucket !== undefined ? ` [Bucket #${event.bucket}]` : "";
            this.appendMessage(event.mask, `decreed: "${event.intent}"${bucketStr}`, this.getMaskColor(event.mask));
        }
        else if (event.type === "GENERATED") {
            // Era 173 Parallel Superposition
            this.appendMessage(
                event.mask, 
                `generated -> "${event.intent.substring(0, 32)}${event.intent.length > 32 ? '...' : ''}"\n[Injected natively into Shadow Bucket #${event.bucketRange}]`, 
                this.getMaskColor(event.mask), 
                true
            );
            
            // Auto hide after 15 seconds so physics can be observed clearly without HUD obstruction
            setTimeout(() => {
                this.container.style.display = "none";
            }, 15000);
        }
        else if (event.type === "CONSENSUS") {
            this.appendMessage(
                "🏛️ CONSENSUS", 
                `[${event.count} Votes] Executing -> "${event.intent}"`, 
                this.getMaskColor("SENATE"), 
                true
            );
            setTimeout(() => {
                this.container.style.display = "none";
            }, 15000);
        }
        else if (event.type === "ERROR") {
            this.appendMessage("SYSTEM", `Senate Error: ${event.reason}`, "#ff0000");
            setTimeout(() => {
                this.container.style.display = "none";
            }, 5000);
        }
    }
    
    private appendMessage(sender: string, text: string, color: string = "#aaaaaa", isBold: boolean = false) {
        const msgBlock = document.createElement("div");
        Object.assign(msgBlock.style, {
            lineHeight: "1.4",
            wordWrap: "break-word"
        });
        
        const senderSpan = document.createElement("span");
        senderSpan.innerText = `[${sender}] `;
        Object.assign(senderSpan.style, {
            color: color,
            fontWeight: "bold",
            marginRight: "5px"
        });
        
        const textSpan = document.createElement("span");
        textSpan.innerText = text;
        if (isBold) textSpan.style.fontWeight = "bold";
        
        msgBlock.appendChild(senderSpan);
        msgBlock.appendChild(textSpan);
        
        this.logArea.appendChild(msgBlock);
        this.logArea.scrollTop = this.logArea.scrollHeight;
    }
    
    // O-163 (Era 174) Shadow Network Telemetry
    public updateShadowPressure(pressure: number) {
        if (pressure > 0) {
            this.pressureSpan.style.display = "block";
            this.pressureSpan.innerText = `SHADOW: ${pressure}`;
            // Optional: Intensify glow based on pressure
            const glow = Math.min(pressure / 20.0, 1.0) * 15;
            this.pressureSpan.style.boxShadow = `0 0 ${glow}px rgba(255, 85, 255, 0.8)`;
        } else {
            this.pressureSpan.style.display = "none";
        }
    }
}
