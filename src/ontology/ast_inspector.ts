import { SovereignOracle } from "./oracle.ts";
import { lambda_format_term } from "../compiler/pure_lambda.ts";

export class ASTInspector {
    private container: HTMLDivElement;
    private oracle: SovereignOracle;
    
    constructor(oracle: SovereignOracle) {
        this.oracle = oracle;
        
        this.container = document.createElement("div");
        this.container.id = "ast-inspector-hud";
        this.container.style.cssText = `
            position: fixed;
            left: 20px;
            bottom: 20px;
            width: 380px;
            max-height: 400px;
            background: rgba(5, 5, 10, 0.95);
            border: 1px solid #113311;
            border-top: 2px solid #00ff00;
            color: #00ff00;
            font-family: 'Courier New', Courier, monospace;
            font-size: 11px;
            z-index: 10000;
            padding: 15px;
            overflow-y: auto;
            opacity: 0;
            transition: opacity 0.2s ease-out;
            pointer-events: none;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.1);
            backdrop-filter: blur(4px);
        `;
        document.body.appendChild(this.container);
        
        globalThis.addEventListener('gridHover', (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (!detail || !detail.hash) {
                this.container.style.opacity = "0";
                return;
            }
            this.container.style.opacity = "1";
            this.render(detail.hash);
        });
    }
    
    private render(hash: bigint) {
        const node = this.oracle.plasmidRegistry.get(hash);
        if (!node) {
            this.container.innerHTML = `
                <div style="color: #ff3333; font-weight: bold; border-bottom: 1px solid #ff3333; padding-bottom: 5px; margin-bottom: 10px;">
                    [ 0x${hash.toString(16).padStart(16, '0').toUpperCase()} ]
                </div>
                <div style="color: #666;">VACUUM FLUCTUATION (UNREGISTERED)</div>
            `;
            return;
        }
        
        const astStr = lambda_format_term(node.ast);
        const treeHTML = this.parseStringToTree(astStr);
        
        this.container.innerHTML = `
            <div style="border-bottom: 1px double #00ff00; padding-bottom: 5px; margin-bottom: 10px;">
                <div style="font-weight: bold; letter-spacing: 1px;">[ 0x${hash.toString(16).padStart(16, '0').toUpperCase()} ]</div>
                <div style="color: #88ff88; font-size: 10px; margin-top: 4px; display: flex; justify-content: space-between;">
                    <span>ATP: <span style="color:#fff">${Math.floor(node.energy)}</span></span>
                    <span>AGE: <span style="color:#fff">${node.age}</span></span>
                    <span>MASS: <span style="color:#fff">${node.nodes}</span></span>
                </div>
            </div>
            <div style="margin-left: 2px;">
                ${treeHTML}
            </div>
        `;
    }
    
    private parseStringToTree(str: string): string {
        // Linear token-based simulated hierarchy for simple visual breakdown
        let html = '';
        let depth = 0;
        
        const tokens = str.replace(/\(/g, " ( ").replace(/\)/g, " ) ").split(" ").filter(t => t.trim().length > 0);
        
        for (const token of tokens) {
            if (token === "(") {
                depth++;
                html += `<div style="margin-left:${depth * 10}px; border-left: 1px dashed #2a5a2a; padding-left: 6px; margin-top: 2px; margin-bottom: 2px;">`;
            } else if (token === ")") {
                depth = Math.max(0, depth - 1);
                html += `</div>`;
            } else {
                let color = "#aaa";
                if (['S', 'K', 'I', 'Y', 'B', 'C', 'W'].includes(token)) color = "#fff";
                html += `<div style="color: ${color}; font-weight: bold; margin-left: ${token.includes('λ') ? 0 : 4}px;">${token}</div>`;
            }
        }
        return html;
    }
}
