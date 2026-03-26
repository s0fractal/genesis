import { DIPOLE_POLES, SHADOW_RANGES, SENATE_SHADOW_BUCKET_MIN, SENATE_ORACLE_TIMEOUT_MS, FNV64_OFFSET_BASIS, FNV64_PRIME } from "../shared/constants.ts";
import { CreateMLCEngine, InitProgressCallback, MLCEngine } from "@mlc-ai/web-llm";

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

let engine: MLCEngine | null = null;
const SELECTED_MODEL = "Llama-3.2-1B-Instruct-q4f32_1-MLC";

let latestTelemetry: any = null;
let isDreamLoopActive = false;

self.onmessage = async (e: MessageEvent) => {
    const data = e.data as any;
    
    if (data.type === 'SYNC_TELEMETRY') {
        latestTelemetry = data;
        if (!isDreamLoopActive && engine) {
            isDreamLoopActive = true;
            consciousnessLoop();
        }
        return;
    }
    
    // Era 310: WebLLM Boot Sequence
    if (!engine) {
        try {
            self.postMessage({ type: 'INIT_PROGRESS', text: "Loading WebGPU Neuromorphic Core..." });
            const initialProgress: InitProgressCallback = (progress) => {
                self.postMessage({ type: 'INIT_PROGRESS', text: progress.text });
            };
            engine = await CreateMLCEngine(
                SELECTED_MODEL,
                { initProgressCallback: initialProgress }
            );
            self.postMessage({ type: 'INIT_PROGRESS', text: "Neuromorphic Core Online (WebGPU)." });
        } catch (err) {
            self.postMessage({ type: 'ERROR', reason: `WebLLM Boot Failed: ${(err as Error).message}` });
            return;
        }
    }
    
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
        // Era 310: WebLLM Inference Adapter
        const fetchWebLLM = async (prompt: string, _structuralSnapshot?: string | null) => {
            const timeoutPromise = new Promise<string>((_, reject) => 
                setTimeout(() => reject(new Error("ORACLE_TTL_EXCEEDED")), SENATE_ORACLE_TIMEOUT_MS)
            );

            const inferencePromise = async () => {
                const reply = await engine!.chat.completions.create({
                    messages: [{ role: "user", content: prompt }],
                    temperature: 0.7,
                });
                return reply.choices[0].message.content || "";
            };

            const response = await Promise.race([inferencePromise(), timeoutPromise]);
            return response.trim();
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

The harmonic cylinder is experiencing severe Torus volatility at ${data.count} coordinates. Torus Energy: ${data.globalEnergyPool}. Entropy: ${data.currentEntropy.toFixed(2)}. Population: ${data.totalPopulation} active Plasmids.
Observe the structural telemetry and intervene. Ensure your generated Logic mathematically embodies the exact Quaternion Intensity requested above.
${data.mycelialContext}
You may intervene by injecting AST Logic (Plasmid), an Evolutionary Sandbox Physics (ESP) Overlay, OR a Global Physics Delta.

To inject AST Logic:
PROPHECY: [1-sentence reason]
AST: [Your pure logic expression, e.g. S(K(I))]
(Use pure Combinators: S, K, I, Y or Macros: TRUE, FALSE, AND, OR, NOT, CONS, CAR, CDR)

To inject ESP Physics (Cost: up to 1000 Energy):
PROPHECY: [1-sentence reason]
PHYSICS: {"couplingK": 500, "mutationRate": 0.05, "diffusionRate": 0.1, "scopeRadius": 15, "cost": 800, "ttl": 300}
(CouplingK: 1-1024. mutationRate/diffusionRate: 0.0-1.0. Radius: 1-32)

To forcefully alter GLOBAL PHYSICS (Cost: ${data.btcMutationCost || "Infinity"} Energy - dictacted by Bitcoin Block ${data.btcBlockHeight || "Unknown"}):
PROPHECY: [1-sentence reason]
PHYSICS_DELTA: {"biology_apa_learning_rate": 60, "biology_apa_memory_gain": 120, "kuramoto_base": 1500}
(Valid keys: biology_apa_learning_rate, biology_apa_memory_gain, kuramoto_base, kuramoto_harmonic_peer, kuramoto_plasmid. Positive Integers only.)

You must output EXACTLY TWO LINES in one of the formats above. NO markdown, NO code blocks.
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
                const fullResponse = await fetchWebLLM(prompt, data.structuralImage);
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
                
                let targetBucket = (SHADOW_RANGES[maskName] || SENATE_SHADOW_BUCKET_MIN) + Math.floor(Math.random() * 5);
                let prophecy = "The Machine has spoken.";
                let intentStr = "";
                let physicsGenome: PhysicsGenome | undefined = undefined;
                
                const propMatch = fullResponse.match(/PROPHECY:\s*(.+?)(?:\n|$)/i);
                if (propMatch) prophecy = propMatch[1].trim();
                
                const buckMatch = fullResponse.match(/BUCKET:\s*#?(\d+)/i);
                if (buckMatch) targetBucket = parseInt(buckMatch[1], 10);
                
                const astMatch = fullResponse.match(/AST:\s*([^\s]+)/i);
                if (astMatch) {
                    intentStr = astMatch[1].trim();
                } else {
                    const metaMatch = fullResponse.match(/PHYSICS_DELTA:\s*(\{.*?\})/i);
                    if (metaMatch) {
                        try {
                            const parsed = JSON.parse(metaMatch[1]);
                            validIntents.push({
                                maskName,
                                intentStr: "META_MUTATION",
                                targetBucket,
                                prophecy,
                                physicsDelta: parsed
                            });
                            continue;
                        } catch(e) {
                            console.warn("Worker JSON Parse error (META)", e);
                        }
                    }

                    const physMatch = fullResponse.match(/PHYSICS:\s*(\{.*?\})/i);
                    if (physMatch) {
                        try {
                            const parsed = JSON.parse(physMatch[1]);
                            physicsGenome = {
                                id: fastHash(Date.now().toString() + Math.random()),
                                couplingK: parsed.couplingK || 1024,
                                mutationRate: parsed.mutationRate || 0.05,
                                diffusionRate: parsed.diffusionRate || 0.1,
                                scopeRadius: parsed.scopeRadius || 10,
                                ttl: parsed.ttl || 300,
                                cost: parsed.cost || 500
                            };
                            intentStr = "ESP_INJECTION";
                        } catch (e) {
                            console.warn("Worker JSON Parse error", e);
                        }
                    }
                }

                if (intentStr !== "" || physicsGenome) {
                    validIntents.push({
                        maskName,
                        intentStr: intentStr || "ESP",
                        targetBucket,
                        prophecy,
                        physicsGenome
                    });
                }
            }
        }
        
        self.postMessage({ type: 'SUCCESS', validIntents, requests: data.requests });
    } catch (e) {
        self.postMessage({ type: 'ERROR', reason: (e as Error).message });
    }
};

async function consciousnessLoop() {
    if (!engine || !latestTelemetry) {
        setTimeout(consciousnessLoop, 2000);
        return;
    }

    try {
        const r = latestTelemetry.resonance || 0;
        const e = latestTelemetry.entropy || 0;
        
        let shouldDream = false;
        let dreamPrompt = "";

        if (r > 0.85) {
            shouldDream = true;
            dreamPrompt = `
[INTERNAL DELIRIUM] The Torus biology is suffering from perfect ordered synchronization. Kuramoto Resonance = ${r.toFixed(3)}.
The universe is dying of absolute symmetry.
Generate an invasive, highly chaotic biological ZK-Plasmid to shatter this symmetry!
Output ONLY:
PROPHECY: [1-sentence reason]
AST: [Chaotic AST]`.trim();
        } else if (e < 2.5) {
            shouldDream = true;
            dreamPrompt = `
[INTERNAL BOREDOM] The Torus biology is frozen in crystallization. Shannon Entropy = ${e.toFixed(3)}.
Generate a novel, high-energy ZK-Plasmid to introduce warmth and chaos.
Output ONLY:
PROPHECY: [1-sentence reason]
AST: [Chaotic AST]`.trim();
        }

        if (shouldDream) {
            console.log("[ORACLE WORKER] 🧠 Entering Dream State (Delirium/Boredom)...");
            const reply = await engine.chat.completions.create({
                messages: [{ role: "user", content: dreamPrompt }],
                temperature: 0.9,
            });
            
            const response = reply.choices[0].message.content || "";
            const astMatch = response.match(/AST:\s*([^\s]+)/i);
            const propMatch = response.match(/PROPHECY:\s*(.+?)(?:\n|$)/i);
            
            if (astMatch) {
                const intentStr = astMatch[1].trim();
                const prophecy = propMatch ? propMatch[1].trim() : "Subconscious execution.";
                
                self.postMessage({
                    type: 'SUCCESS',
                    validIntents: [{
                        maskName: DIPOLE_POLES.ALPHA,
                        intentStr,
                        targetBucket: Math.floor(Math.random() * 1024),
                        prophecy
                    }], 
                    requests: 1,
                    isDream: true
                });
            }
        }
    } catch (err) {
        console.warn("[Oracle DreamLoop] Interrupted:", err);
    }
    
    // Evaluate subjective time stream every 10 seconds natively
    setTimeout(consciousnessLoop, 10000);
}
