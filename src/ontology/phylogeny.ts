export interface PhylogenyRecord {
    t: number;
    alias: string;
    hash: string;
    parents: string[];
    energy: number;
    stability: number;
}

export class PhylogeneticCanvas {
    private container: HTMLElement;
    
    constructor() {
        this.container = document.createElement("div");
        this.container.id = "phylogeny-ui";
        this.container.style.position = "absolute";
        this.container.style.bottom = "80px";
        this.container.style.left = "40px";
        this.container.style.color = "rgba(0, 255, 128, 0.8)";
        this.container.style.fontFamily = "monospace";
        this.container.style.fontSize = "12px";
        this.container.style.pointerEvents = "none";
        this.container.style.textShadow = "0 0 5px rgba(0, 255, 128, 0.5)";
        document.body.appendChild(this.container);
    }
    
    async tick() {
        try {
            const res = await fetch("/lineage.jsonl", { cache: "no-store" });
            if (!res.ok) return;
            const text = await res.text();
            
            const lines = text.split("\n").filter(l => l.trim().length > 0);
            const nodes: PhylogenyRecord[] = lines.map(l => JSON.parse(l));
            
            this.render(nodes);
        } catch (e) {
            // silent fail if local lineage not found yet
        }
    }
    
    private render(nodes: PhylogenyRecord[]) {
        const recent = nodes.slice(-12);
        let html = "<div style='border-bottom: 1px solid rgba(0,255,128,0.3); margin-bottom: 5px; padding-bottom: 2px;'><b>🧬 O-44 PHYLOGENETIC DAG (Tree of Life)</b></div>";
        for (const n of recent) {
            const p = n.parents.length > 0 ? n.parents[0].substring(0,8) : "GENESIS_";
            // Render a minimalistic tree vector 
            html += `└─► [${p}] ─> <span style="color: #fff"><b>[${n.hash.substring(0,8)}]</b></span> | ATP: ${n.energy} | STAB: ${Math.round(n.stability * 100)}%<br/>`;
        }
        this.container.innerHTML = html;
    }
}
