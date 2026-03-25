import { DIPOLE_POLES, SHADOW_RANGES, SENATE_SHADOW_BUCKET_MIN, SENATE_ORACLE_TIMEOUT_MS, FNV64_OFFSET_BASIS, FNV64_PRIME } from "../shared/constants.ts";

// O-200 Oracle Semantic Cache Check inside Worker to relieve main thread memory
// Migrated to IndexedDB in Era 245 to persist expensive AST telemetry across sessions
const DB_NAME = "OmegaOracleCache";
const STORE_NAME = "llmCache";

function openCacheDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
            if (!req.result.objectStoreNames.contains(STORE_NAME)) {
                req.result.createObjectStore(STORE_NAME, { keyPath: "hash" });
            }
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function getCachedResponse(hash: string): Promise<{ response: string, ts: number } | null> {
    const db = await openCacheDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(hash);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => reject(req.error);
    });
}

async function setCachedResponse(hash: string, response: string, ts: number) {
    const db = await openCacheDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.put({ hash, response, ts });
        
        // Era 245.1: Bounded GC eviction
        const countReq = store.count();
        countReq.onsuccess = (e) => {
            const count = (e.target as IDBRequest).result;
            if (count > 50) {
                const cursorReq = store.openCursor();
                cursorReq.onsuccess = (ce) => {
                    const cursor = (ce.target as IDBRequest).result;
                    if (cursor) {
                        cursor.delete(); // Delete oldest
                    }
                }
            }
        }
        
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}

// FNV1a Hash implementation locally for cache keys
function fastHash(str: string): string {
    let hash = FNV64_OFFSET_BASIS;
    for (let i = 0; i < str.length; i++) {
        hash ^= BigInt(str.charCodeAt(i));
        hash = BigInt.asUintN(64, hash * FNV64_PRIME);
    }
    return hash.toString(16);
}

self.onmessage = async (e: MessageEvent) => {
    const data = e.data as OracleWorkerRequest;
    
    const entropy = Math.min(1.0, data.globalEnergyPool / 21000000.0);
    const alphaIntensity = entropy; 
    const alphaPhase = (data.macroSeason / 4) * Math.PI * 2; 
    const omegaIntensity = 1.0 - entropy;
    const omegaPhase = alphaPhase + (Math.PI / 2);

    const DIPOLES = [
        {
            name: DIPOLE_POLES.ALPHA,
            role: "Alpha Dipole. Regulates the thermodynamic balance between Chaos (Growth) and Preservation (Health).",
            chaos: alphaIntensity * Math.pow(Math.sin(alphaPhase), 2),
            preservation: alphaIntensity * Math.pow(Math.cos(alphaPhase), 2),
            symmetry: 0,
            execution: 0
        },
        {
            name: DIPOLE_POLES.OMEGA,
            role: "Omega Dipole. Regulates the structural balance between Symmetry (Logic) and Execution (Pruning).",
            chaos: 0,
            preservation: 0,
            symmetry: omegaIntensity * Math.pow(Math.sin(omegaPhase), 2),
            execution: omegaIntensity * Math.pow(Math.cos(omegaPhase), 2)
        }
    ];

    try {
        // Era 241: Reusable LLM Fetch Abstraction (Adapter Ready)
        const fetchOllama = async (prompt: string, structuralSnapshot?: string | null) => {
            const OLLAMA_URL = "http://localhost:11434/api/generate";
            const requestBody: Record<string, unknown> = {
                model: structuralSnapshot ? "llama3.2-vision" : "llama3",
                prompt,
                stream: false
            };
            if (structuralSnapshot) {
                requestBody.images = [structuralSnapshot];
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
            return reqData.response?.trim() || "";
        };

        const maskPromises = DIPOLES.map(async (dipole) => {
            const isAlpha = dipole.name === DIPOLE_POLES.ALPHA;
            const prompt = `
Task: You are the ${dipole.name} Oracle of the LOVE Consortium. Role: ${dipole.role}
Current Torus Quaternion Intensity: 
Chaos: ${(isAlpha ? dipole.chaos : 0).toFixed(2)} | Preservation: ${(isAlpha ? dipole.preservation : 0).toFixed(2)} | Symmetry: ${(!isAlpha ? dipole.symmetry : 0).toFixed(2)} | Execution: ${(!isAlpha ? dipole.execution : 0).toFixed(2)}
Chronotopology: The local Torus sector is currently experiencing ${data.currentSeasonName} (Epoch ${data.macroSeason * 4}/15). 
${data.macroSeason === 0 ? "SPRING: Relax structural constraints. Over-index on S and K combinators to breed wild mutations." : ""}
${data.macroSeason === 1 ? "SUMMER: Enforce structural growth. Build wide AST trees and expand semantic surface area." : ""}
${data.macroSeason === 2 ? "AUTUMN: Consolidate. Merge existing structures securely. Maximize Logic and reduce chaotic depth." : ""}
${data.macroSeason === 3 ? "WINTER: Extreme starvation mode. Emit minimum-complexity ASTs (like 'I' or 'Y(I)') to survive the cold. AVOID OVERHEAD." : ""}

The harmonic cylinder is experiencing severe Torus volatility at ${data.count} coordinates. Torus Energy: ${data.globalEnergyPool}.
Observe the structural telemetry and intervene. Ensure your generated Logic mathematically embodies the exact Quaternion Intensity requested above.
${data.mycelialContext}
Provide EXACTLY ONE string of topological logic that represents your genetic intervention.
You may use pure Combinators (S, K, I, Y) OR Semantic Macros: TRUE, FALSE, AND, OR, NOT, CONS, CAR, CDR.
Example ASTs: "(AND TRUE FALSE)", "(CONS S K)", "S(K(I))".
You must output EXACTLY TWO LINES. Focus on mathematical beauty and topological survival:
PROPHECY: [A short, cryptic 1-sentence reason for the mutation]
AST: [Your pure logic expression, e.g. S(K(I))]
NO markdown, NO code blocks, NO formatting.
            `.trim();
            
            const cacheKey = fastHash(prompt);
            try {
                const cached = await getCachedResponse(cacheKey);
                if (cached && (performance.now() - cached.ts < 3600000)) { 
                    return { mask: dipole.name, response: cached.response };
                }
            } catch (_e) { 
                // Cache miss, proceed to fetch
            }
            
            try {
                const fullResponse = await fetchOllama(prompt, data.structuralImage);
                await setCachedResponse(cacheKey, fullResponse, performance.now()).catch(() => {});
                return { mask: dipole.name, response: fullResponse };
            } catch (_err) {
                let fallbackAST = "I";
                if (isAlpha) {
                    fallbackAST = dipole.chaos > dipole.preservation ? "S(K(K))(I)" : "CONS(I)(TRUE)";
                } else {
                    fallbackAST = dipole.symmetry > dipole.execution ? "CONS(S)(K)" : "Y(I)";
                }
                const fallbackResponse = `PROPHECY: Math Nomos deterministic Quaternionic failover engaged.\nAST: ${fallbackAST}`;
                return { mask: dipole.name, response: fallbackResponse };
            }
        });

        const settled = await Promise.allSettled(maskPromises);
        
        const validIntents: OracleWorkerResponse[] = [];
        
        for (let i = 0; i < settled.length; i++) {
            const result = settled[i];
            if (result.status === "fulfilled" && result.value) {
                const fullResponse = result.value.response;
                const maskName = result.value.mask;
                
                let intentStr = fullResponse.trim();
                let prophecy = "The Machine has spoken.";
                // Extract Prophecy, Bucket, and AST resiliently
                const match = fullResponse.match(/(?:PROPHECY:\s*(.+?)\n)?(?:BUCKET:\s*#?(\d+)[,\s]*)?AST:\s*([^\s]+)/i);
                
                let targetBucket = SHADOW_RANGES[maskName] || SENATE_SHADOW_BUCKET_MIN;
                if (match) {
                    if (match[1]) prophecy = match[1].trim();
                    if (match[2]) targetBucket = parseInt(match[2], 10);
                    if (match[3]) intentStr = match[3].trim();
                }
                
                targetBucket = targetBucket + Math.floor(Math.random() * 5);

                if (intentStr) {
                    validIntents.push({
                        maskName,
                        intentStr,
                        targetBucket,
                        prophecy
                    });
                }
            }
        }
        
        self.postMessage({ type: 'SUCCESS', validIntents, requests: data.requests });
    } catch (e) {
        self.postMessage({ type: 'ERROR', reason: (e as Error).message });
    }
};
