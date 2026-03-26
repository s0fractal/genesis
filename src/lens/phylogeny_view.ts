import { ForeignPlasmid } from "../env.d.ts";

export interface DAGNode {
    hash: string;
    parents: string[];
    children: string[];
    energy: number;
    discoveredAt: number;
    originNodeId: string;
    isPinned: boolean;
    resonance: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
}

export class PhylogenyView {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    public nodes: Map<string, DAGNode> = new Map();
    private channel: BroadcastChannel;
    
    // Era 268: Holographic Resonance Metric (Spontaneous Symmetry Breaking)
    public globalEntropy: number = 1.0;
    public kuramotoSync: number = 1.0;
    public holoResonance: number = 0.0;

    constructor(canvas: HTMLCanvasElement) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d', { alpha: true }) as CanvasRenderingContext2D;
        
        // Listen directly to the Gossiped DAG logic bypassing the WASM lock
        this.channel = new BroadcastChannel("omega_64_mycelium");
        this.channel.onmessage = (e) => {
            if (e.data && e.data.type === "FOREIGN_PLASMID") {
                this.registerPlasmid(e.data.payload);
            }
        };

        // Resize hook
        globalThis.addEventListener('resize', this.resize.bind(this));
        this.resize();
        
        // Start render loop
        requestAnimationFrame(this.render.bind(this));
    }

    private resize() {
        const dpr = globalThis.devicePixelRatio || 1;
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.ctx.scale(dpr, dpr);
    }

    public registerPlasmid(p: ForeignPlasmid) {
        if (this.nodes.has(p.hash)) {
            const node = this.nodes.get(p.hash)!;
            node.energy = Math.max(node.energy, p.energy);
            return;
        }

        const rect = this.canvas.getBoundingClientRect();
        const startX = rect.width / 2 + (Math.random() * 100 - 50);
        const startY = rect.height / 2 + (Math.random() * 100 - 50);

        const node: DAGNode = {
            hash: p.hash,
            parents: p.parents || [],
            children: [],
            energy: p.energy,
            discoveredAt: performance.now(),
            originNodeId: p.origin,
            isPinned: false,
            resonance: 0,
            x: startX,
            y: startY,
            vx: 0,
            vy: 0
        };

        this.nodes.set(p.hash, node);

        for (const parent of node.parents) {
            if (this.nodes.has(parent)) {
                this.nodes.get(parent)!.children.push(p.hash);
            } else {
                // Phantom node for unknown parents
                const phantom: DAGNode = {
                    hash: parent,
                    parents: [],
                    children: [p.hash],
                    energy: 0,
                    discoveredAt: performance.now() - 1000,
                    originNodeId: "UNKNOWN",
                    isPinned: true, // Often ancient protocols
                    resonance: 0,
                    x: startX + (Math.random() * 50 - 25),
                    y: startY + (Math.random() * 50 - 25),
                    vx: 0, vy: 0
                };
                this.nodes.set(parent, phantom);
            }
        }
        
        this.calculateResonance();
    }

    public updateMetrics(entropy: number, sync: number) {
        this.globalEntropy = entropy;
        this.kuramotoSync = sync;
        this.calculateResonance();
    }

    private calculateResonance() {
        let totalRes = 0;
        for (const [_, node] of this.nodes) {
            node.resonance = (1.0 + node.children.length * 0.5) * (this.kuramotoSync / Math.max(0.01, this.globalEntropy));
            totalRes += node.resonance;
        }
        
        // Network-wide Holo-Resonance matches Kimi's concept of Symmetry Breaking
        // High Sync + High Entropy == Awakening Index
        this.holoResonance = (this.kuramotoSync * this.globalEntropy) * Math.log10(this.nodes.size + 1);
    }

    private applyForceDirectedLayout() {
        const repulsion = 1500;
        const springLength = 80;
        const springK = 0.05;
        const damping = 0.85;
        const centerPull = 0.005;
        
        const rect = this.canvas.getBoundingClientRect();
        const cx = rect.width / 2;
        const cy = rect.height / 2;

        const nodesArr = Array.from(this.nodes.values());

        // Repulsion
        for (let i = 0; i < nodesArr.length; i++) {
            for (let j = i + 1; j < nodesArr.length; j++) {
                const a = nodesArr[i];
                const b = nodesArr[j];
                const dx = a.x - b.x;
                const dy = a.y - b.y;
                let dist = Math.sqrt(dx*dx + dy*dy);
                if (dist < 1) dist = 1;
                
                const force = repulsion / (dist * dist);
                const fx = (dx / dist) * force;
                const fy = (dy / dist) * force;
                
                a.vx += fx; a.vy += fy;
                b.vx -= fx; b.vy -= fy;
            }
        }

        // Springs (Parent <-> Child)
        for (const node of nodesArr) {
            for (const pHash of node.parents) {
                const pNode = this.nodes.get(pHash);
                if (pNode) {
                    const dx = node.x - pNode.x;
                    const dy = node.y - pNode.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist > 0) {
                        const force = (dist - springLength) * springK;
                        const fx = (dx / dist) * force;
                        const fy = (dy / dist) * force;
                        
                        node.vx -= fx; node.vy -= fy;
                        pNode.vx += fx; pNode.vy += fy;
                    }
                }
            }
        }

        // Apply velocities and bounds
        for (const node of nodesArr) {
            // Gravity to center
            node.vx += (cx - node.x) * centerPull;
            node.vy += (cy - node.y) * centerPull;

            node.vx *= damping;
            node.vy *= damping;
            node.x += node.vx;
            node.y += node.vy;
            
            // Constrain
            if (node.x < 20) node.x = 20;
            if (node.x > rect.width - 20) node.x = rect.width - 20;
            if (node.y < 20) node.y = 20;
            if (node.y > rect.height - 20) node.y = rect.height - 20;
        }
    }

    private render() {
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.clearRect(0, 0, rect.width, rect.height);
        
        this.ctx.fillStyle = `rgba(5, 8, 15, ${Math.min(0.8, this.holoResonance * 0.1)})`;
        this.ctx.fillRect(0, 0, rect.width, rect.height);

        this.applyForceDirectedLayout();

        // Draw Edges
        this.ctx.lineWidth = 1.5;
        for (const [_, node] of this.nodes) {
            for (const pHash of node.parents) {
                const pNode = this.nodes.get(pHash);
                if (pNode) {
                    const grad = this.ctx.createLinearGradient(node.x, node.y, pNode.x, pNode.y);
                    grad.addColorStop(0, `rgba(0, 255, 128, ${0.2 + pNode.resonance * 0.05})`);
                    grad.addColorStop(1, `rgba(255, 0, 128, ${0.2 + node.resonance * 0.05})`);
                    
                    this.ctx.strokeStyle = grad;
                    this.ctx.beginPath();
                    this.ctx.moveTo(node.x, node.y);
                    this.ctx.lineTo(pNode.x, pNode.y);
                    this.ctx.stroke();
                }
            }
        }

        // Draw Nodes
        const now = performance.now();
        for (const [_, node] of this.nodes) {
            const age = now - node.discoveredAt;
            const r = 4 + Math.min(10, Math.log10(node.energy + 1)) + (node.resonance * 0.5);
            
            // Pulse effect for highly resonant organisms
            const pulse = (node.resonance > 5.0) ? Math.sin(now * 0.005) * 2 : 0;
            
            // Era 600: Probability Cloud Rendering
            let baseColor = `200, 80%, 50%`;
            if (node.isPinned) baseColor = `280, 100%, 70%`;
            else if (age < 2000) baseColor = `120, 100%, 70%`;

            // Draw multi-layered probability rings instead of solid sphere
            const orbitals = 3 + Math.floor(node.resonance);
            for (let i = 0; i < orbitals; i++) {
                const orbitalR = r + pulse + (i * 3);
                const alpha = Math.max(0.1, 1.0 - (i / orbitals)) * (0.3 + (node.energy % 100) / 200.0);
                
                this.ctx.beginPath();
                this.ctx.arc(node.x, node.y, orbitalR, 0, Math.PI * 2);
                this.ctx.strokeStyle = `hsla(${baseColor}, ${alpha})`;
                this.ctx.lineWidth = 1.0 + (i === 0 ? 1 : 0);
                this.ctx.stroke();
            }
            
            // Core singularity
            this.ctx.beginPath();
            this.ctx.arc(node.x, node.y, 2, 0, Math.PI * 2);
            this.ctx.fillStyle = `hsl(${baseColor})`;
            this.ctx.fill();
        }

        // Draw Metrics HUD
        this.ctx.fillStyle = 'rgba(0, 255, 128, 0.9)';
        this.ctx.font = '12px monospace';
        this.ctx.shadowBlur = 0;
        this.ctx.fillText(`◬ HOLO-RESONANCE  : ${this.holoResonance.toFixed(4)}`, 20, 30);
        this.ctx.fillText(`∑ PLASMID NODES   : ${this.nodes.size}`, 20, 50);
        this.ctx.fillText(`∆ NETWORK ENTROPY : ${this.globalEntropy.toFixed(3)}`, 20, 70);

        requestAnimationFrame(this.render.bind(this));
    }
}
