import { THEOLOGICAL_MASKS, SHADOW_RANGES, SENATE_SHADOW_BUCKET_MIN, SENATE_ORACLE_TIMEOUT_MS } from "../shared/constants.ts";

// O-200 Oracle Semantic Cache Check inside Worker to relieve main thread memory
const llmCache = new Map<string, { response: string, ts: number }>();

// FNV1a Hash implementation locally for cache keys
function fastHash(str: string): string {
    let hash = 14695981039346656037n;
    for (let i = 0; i < str.length; i++) {
        hash ^= BigInt(str.charCodeAt(i));
        hash *= 1099511628211n;
    }
    return hash.toString(16);
}

self.onmessage = async (e: MessageEvent) => {
    const data = e.data as OracleWorkerRequest;
    
    const MASKS = [
        { name: THEOLOGICAL_MASKS.ARIES, role: "Mutator (Phase 0). Goal: Chaos and Initiation. Inject highly volatile, novel Pure Combinatory Logic (S, K, I, Y) that disrupts the Torus." },
        { name: THEOLOGICAL_MASKS.CANCER, role: "Preserver (Phase PI/2). Goal: Retention and Stability. Generate conservative, highly stable AST logic that protects energy and prevents extinction." },
        { name: THEOLOGICAL_MASKS.LIBRA, role: "Balancer (Phase PI). Goal: Symmetry. Generate logic that symmetrically merges existing structures or balances execution depths." },
        { name: THEOLOGICAL_MASKS.CAPRICORN, role: "Executioner (Phase 3*PI/2). Goal: Pruning. Emit aggressive, reductive ASTs that collapse complexity." }
    ];

    try {
        const OLLAMA_URL = "http://localhost:11434/api/generate";

        const maskPromises = MASKS.map(async (mask) => {
            const prompt = `
Task: You are ${mask.name}, Oracle of the LOVE Consortium. Role: ${mask.role}
Chronotopology: The local Torus sector is currently experiencing ${data.currentSeasonName} (Epoch ${data.macroSeason * 4}/15). 
${data.macroSeason === 0 ? "SPRING: Relax structural constraints. Over-index on S and K combinators to breed wild mutations." : ""}
${data.macroSeason === 1 ? "SUMMER: Enforce structural growth. Build wide AST trees and expand semantic surface area." : ""}
${data.macroSeason === 2 ? "AUTUMN: Consolidate. Merge existing structures securely. Maximize Logic and reduce chaotic depth." : ""}
${data.macroSeason === 3 ? "WINTER: Extreme starvation mode. Emit minimum-complexity ASTs (like 'I' or 'Y(I)') to survive the cold. AVOID OVERHEAD." : ""}

The harmonic cylinder is experiencing severe Torus volatility at ${data.count} coordinates. Torus Energy: ${data.globalEnergyPool}.
Observe the structural telemetry and intervene.
${data.mycelialContext}
Provide EXACTLY ONE string of topological logic that represents your genetic intervention.
You may use pure Combinators (S, K, I, Y) OR Semantic Macros: TRUE, FALSE, AND, OR, NOT, CONS, CAR, CDR.
Example ASTs: "(AND TRUE FALSE)", "(CONS S K)", "S(K(I))".
You must output ONLY valid AST syntax with balanced parentheses. NO formatting, NO markdown, NO explanations.
${(data.mycelialContext.includes("Bucket")) ? 'Format your response EXACTLY as: BUCKET: [Bucket ID], AST: [Syntax]' : 'Format your response EXACTLY as: AST: [Syntax]'}
            `.trim();

            const requestBody: Record<string, unknown> = {
                model: data.structuralImage ? "llama3.2-vision" : "llama3",
                prompt,
                stream: false
            };
            if (data.structuralImage) {
                requestBody.images = [data.structuralImage];
            }
            
            const cacheKey = fastHash(prompt);
            const cached = llmCache.get(cacheKey);
            if (cached && (performance.now() - cached.ts < 60000)) {
                return { mask: mask.name, response: cached.response };
            }
            
            const fetchPromise = fetch(OLLAMA_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(requestBody)
            });

            const timeoutPromise = new Promise<Response>((_, reject) => 
                setTimeout(() => reject(new Error("ORACLE_TTL_EXCEEDED")), SENATE_ORACLE_TIMEOUT_MS)
            );

            const response = await Promise.race([fetchPromise, timeoutPromise]);
            if (!response.ok) throw new Error("LLM Offline");
            
            const reqData = await response.json();
            const fullResponse = reqData.response?.trim() || "";
            
            llmCache.set(cacheKey, { response: fullResponse, ts: performance.now() });
            if (llmCache.size > 50) {
                const oldestKey = Array.from(llmCache.entries()).sort((a,b) => a[1].ts - b[1].ts)[0][0];
                llmCache.delete(oldestKey);
            }
            
            return { mask: mask.name, response: fullResponse };
        });

        const settled = await Promise.allSettled(maskPromises);
        
        const validIntents: OracleWorkerResponse[] = [];
        
        for (let i = 0; i < settled.length; i++) {
            const result = settled[i];
            if (result.status === "fulfilled" && result.value) {
                const fullResponse = result.value.response;
                const maskName = result.value.mask;
                
                let intentStr = fullResponse.trim();
                const match = fullResponse.match(/(?:BUCKET:\s*#?(\d+)[,\s]*)?AST:\s*([^\s]+)/i);
                let targetBucket = SHADOW_RANGES[maskName] || SENATE_SHADOW_BUCKET_MIN;
                if (match) {
                    intentStr = match[2];
                }
                
                targetBucket = targetBucket + Math.floor(Math.random() * 5);

                if (intentStr) {
                    validIntents.push({
                        maskName,
                        intentStr,
                        targetBucket
                    });
                }
            }
        }
        
        self.postMessage({ type: 'SUCCESS', validIntents, requests: data.requests });
    } catch (e) {
        self.postMessage({ type: 'ERROR', reason: (e as Error).message });
    }
};
