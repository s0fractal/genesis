import { SenateEvent } from "./oracle.ts";

export class SenateChatHUD {
    private container: HTMLDivElement;
    private logArea: HTMLDivElement;
    
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
            justifyContent: "space-between"
        });
        header.innerHTML = `<span>🏛️ Senate Chat</span><span style="color:#666; font-size:10px;">O-51</span>`;
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
        switch (mask.toUpperCase()) {
            case "♈ ARIES": return "#ff5555"; // Red Chaos
            case "♋ CANCER": return "#55aaff"; // Blue Preserver
            case "♎ LIBRA": return "#55ff55"; // Green Balancer
            case "♑ CAPRICORN": return "#aa55ff"; // Purple Pruner
            case "NOMOS": return "#ff5555"; // Red
            case "LOGOS": return "#55aaff"; // Blue
            case "CHRONOS": return "#55ff55"; // Green
            case "AION": return "#aa55ff"; // Purple
            case "SENATE": return "#ffc107"; // Gold for Consensus
            default: return "#ffffff";
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
}
