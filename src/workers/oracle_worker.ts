import { THEOLOGICAL_MASKS, SHADOW_RANGES, SENATE_SHADOW_BUCKET_MIN, SENATE_ORACLE_TIMEOUT_MS } from "../shared/constants.ts";

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
        const req = store.put({ hash, response, ts });
        
        // Era 245.1: Bounded GC eviction
        const _req = store.count();
        _req.onsuccess = (e) => {
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
You must output EXACTLY TWO LINES. Focus on mathematical beauty and topological survival:
PROPHECY: [A short, cryptic 1-sentence reason for the mutation]
NO markdown, NO code blocks, NO formatting.
            `.trim();
            
            const cacheKey = fastHash(prompt);
            try {
                const cached = await getCachedResponse(cacheKey);
                if (cached && (performance.now() - cached.ts < 3600000)) { // 1 hour survival
                    return { mask: mask.name, response: cached.response };
                }
            } catch (_e) { /* Ignore cache errors and fetch */ }
            
            try {
                const fullResponse = await fetchOllama(prompt, data.structuralImage);
                
                await setCachedResponse(cacheKey, fullResponse, performance.now()).catch(() => {});
                
                return { mask: mask.name, response: fullResponse };
            } catch (_err) {
                // Era 241: Math Nomos Fallback (Degraded Autonomous Mode)
                let fallbackAST = "I";
                
                // Procedural generation aligned with the Mask's structural intent
                switch (mask.name) {
                    case THEOLOGICAL_MASKS.ARIES: 
                        fallbackAST = "S(K(K))(I)"; // High Chaos Combinatory Logic
                        break;
                    case THEOLOGICAL_MASKS.CANCER:
                        fallbackAST = "CONS(I)(TRUE)"; // Strict Preservation
                        break;
                    case THEOLOGICAL_MASKS.LIBRA:
                        fallbackAST = "CONS(S)(K)"; // Binary Balance
                        break;
                    case THEOLOGICAL_MASKS.CAPRICORN:
                        fallbackAST = "Y(I)"; // Pruning / Self-Evaluation Entropy
                        break;
                }
                
                // Construct a deterministic response that mimics the LLM output regex 
                // so the Regex parser at the bottom successfully slices the AST bucket.
                const fallbackResponse = `PROPHECY: The void is silent. Math Nomos deterministic failover engaged.\nAST: ${fallbackAST}`;
                return { mask: mask.name, response: fallbackResponse };
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
