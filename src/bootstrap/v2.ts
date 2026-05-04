import { configureCanvas, DOM, setInputMode, tickFps, setHudStat } from "./dom.ts";
import { OmegaV2Engine } from "../environment/v2_bridge.ts";
import { Libp2pMesh, PlasmidPayload } from "../network/libp2p_mesh.ts";
import { verifyGenesisInscription } from "../network/bitcoin_anchor.ts";
import { GENESIS_HASH_LEGACY_V1_0 } from "../network/genesis_inscription.ts";
import { PhaseV2Renderer } from "../lens/v2_renderer.ts";
import { EthersATPBridge } from "../network/atp_bridge.ts";
import { PhaseRouter } from "../network/routing_bridge.ts";
import { drainMitosisLog } from "../network/mitosis_log_reader.ts";
import { childReceiptHash } from "../network/mitosis_proof.ts";
import { oracleDipole, CANONICAL_ORACLES } from "../network/oracle_identity.ts";
import { CompostConsumer } from "../liquid/compost_consumer.ts";
import { SemanticCoupler } from "../ontology/semantic_layer.ts";
import {
    createTranslationPolicyHudHook,
    TranslationPolicyTelemetrySource,
} from "./translation_policy/translation_policy_hud_hook.ts";
import {
    installTranslationPolicyBootstrap,
    TranslationPolicyBootstrapInstallOptions,
    TranslationPolicyBootstrapGlobalTarget,
} from "./translation_policy/translation_policy_bootstrap_installer.ts";
import {
    createTranslationPolicyRuntimeTickHook,
    TranslationPolicyRuntimeTickHookResult,
    TranslationPolicyRuntimeTickHookOptionsInput,
    TranslationPolicyRuntimeTickSource,
} from "./translation_policy/translation_policy_runtime_tick_hook.ts";
import {
    translationPolicyBootstrapTelemetrySnapshot,
    TranslationPolicyBootstrapTelemetrySnapshot,
} from "./translation_policy/translation_policy_bootstrap_telemetry.ts";
import {
    createTranslationPolicyTelemetryEventEmitter,
    TranslationPolicyTelemetryEventOptionsInput,
} from "./translation_policy/translation_policy_telemetry_event.ts";

let oracleWorker: Worker | null = null;
try {
    oracleWorker = new Worker(new URL('../workers/oracle_worker.ts', import.meta.url), { type: 'module' });
    console.log("🌌 [V2] Oracle LLM Worker invoked.");
} catch (e) {
    console.warn("Could not load Oracle LLM Worker:", e);
}

let isOracleBound = false;

declare global {
    interface Window {
        __OMEGA_TRANSLATION_POLICY_RUNTIME__?: {
            telemetry(now_ms: number): unknown;
        };
        __OMEGA_TRANSLATION_POLICY_HUD__?: boolean | {
            enabled?: boolean;
            slot?: "a" | "b" | "c" | "d" | "e" | "f";
            min_interval_ms?: number;
            label?: string;
            hud?: { max_summary_len?: number };
        };
        __OMEGA_TRANSLATION_POLICY_BOOTSTRAP__?:
            TranslationPolicyBootstrapInstallOptions;
        __OMEGA_TRANSLATION_POLICY_TICK__?:
            boolean | TranslationPolicyRuntimeTickHookOptionsInput;
        __OMEGA_TRANSLATION_POLICY_TELEMETRY__?:
            TranslationPolicyBootstrapTelemetrySnapshot;
        __OMEGA_TRANSLATION_POLICY_TELEMETRY_EVENT__?:
            boolean | TranslationPolicyTelemetryEventOptionsInput;
    }
}

export async function bootstrapV2() {
    console.log("🌌 [V2] Bootstrapping Zero-Copy Minimalist Engine...");

    const canvas = configureCanvas();
    let device: GPUDevice | null = null;
    let format: GPUTextureFormat = navigator.gpu.getPreferredCanvasFormat();
    
    try {
        if (!navigator.gpu) throw new Error("WebGPU API missing");
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) throw new Error("WebGPU adapter unavailable");
        device = await adapter.requestDevice();
        
        (device as any).onuncapturederror = (event: { error: { message: string } }) => {
            console.error("🛑 [WGSL VALIDATION ERROR]:", event.error.message);
        };
        
        const context = canvas.getContext("webgpu") as unknown as GPUCanvasContext;
        context.configure({
            device,
            format,
            alphaMode: "premultiplied",
        });
        
        DOM.hudTitle?.replaceChildren("Φ OMEGA-V2 KERNEL");
        DOM.statusLabel?.replaceChildren("BARE-METAL NO_STD");
        setHudStat("b", "FPS", "0");
        setHudStat("c", "SIGNATURE", "v2-zero-copy");
        setInputMode("semantic");

        // 1. Boot up the bare-metal Engine (WASM fetch & init)
        const engine = new OmegaV2Engine();
        
        let initialSnapshot: Uint8Array | undefined;
        const genesisCid = (window as any).__OMEGA_GENESIS_CID__;
        if (genesisCid) {
            console.log(`[BOOTSTRAP] 📡 Fetching Genesis Snapshot from IPFS: ${genesisCid}`);
            try {
                const res = await fetch(`https://ipfs.io/ipfs/${genesisCid}`);
                if (res.ok) {
                    const buffer = await res.arrayBuffer();
                    initialSnapshot = new Uint8Array(buffer);
                    console.log(`[BOOTSTRAP] 📦 Genesis Snapshot downloaded: ${initialSnapshot.length} bytes`);
                } else {
                    console.error(`[BOOTSTRAP] 🚨 IPFS fetch failed with status: ${res.status}`);
                }
            } catch (err) {
                console.error(`[BOOTSTRAP] 🚨 Error fetching from IPFS:`, err);
            }
        }
        
        await engine.boot(adapter, initialSnapshot);
        
        if (initialSnapshot) {
            // Verify golden trace
            const goldenTraceFn = engine.wasm?.exports.v2_get_golden_trace as CallableFunction;
            if (goldenTraceFn) {
                const trace = goldenTraceFn();
                console.log(`[BOOTSTRAP] 🔍 Golden Trace verified: 0x${(trace >>> 0).toString(16)}`);
            }
        }
        
        // Era 3000: Bitcoin UTXO Weather (Metabolic Rate Modulation)
        const { BitcoinWeatherController } = await import("../environment/environmental_vector.ts");
        const weatherController = new BitcoinWeatherController();
        weatherController.onWeatherChange = (multiplier, label) => {
            engine.setWeather(multiplier);
            setHudStat("d", "WEATHER", label);
        };
        weatherController.start();

        // Era 1000: Initialize Phase Router before mesh so it can be wired into P2P
        const router = new PhaseRouter(engine.wasm);
        const addr0 = router.addressFromAgent(0);
        if (addr0 !== 0) {
            const decoded = PhaseRouter.decode(addr0);
            console.log(`🧭 [ROUTING] Agent 0 PhaseAddress: consensus=${decoded.consensus} social=${decoded.social} personal=${decoded.personal} micro=${decoded.micro}`);
        }

        // Era 2060: Liquid Autopoiesis
        const injector: IPerturbationInjector = {
            inject: (x, y, energy, radius, phaseShift, plasmidBytes) => {
                const setIntent = engine.wasm?.exports.v2_set_intent as CallableFunction;
                if (setIntent) {
                    let g = 0;
                    let o = 0;
                    if (plasmidBytes.length >= 8) {
                        const view = new DataView(plasmidBytes.buffer, plasmidBytes.byteOffset, plasmidBytes.byteLength);
                        g = view.getUint32(0, true);
                        o = view.getUint32(4, true);
                    }
                    // Slot 3 is dedicated to Liquid Ontology semantic injections
                    setIntent(3, x, y, energy, radius, g, o);
                }
            }
        };
        const semanticCoupler = new SemanticCoupler(injector);
        const compostConsumer = new CompostConsumer(engine);

        // Era 2100: Bitcoin Genesis Verification
        const genesisTxid = (window as any).__OMEGA_GENESIS_TXID__;
        if (genesisTxid) {
            console.log(`[BOOTSTRAP] Verifying Bitcoin OP_RETURN Anchor for TXID: ${genesisTxid}`);
            const isValid = await verifyGenesisInscription(genesisTxid, GENESIS_HASH_LEGACY_V1_0);
            if (!isValid) {
                console.error("[BOOTSTRAP] 🚨 FATAL: Invalid Bitcoin Genesis Inscription. Network Boot Aborted.");
                setHudStat("e", "BTC ANCHOR", "FAILED");
                return;
            }
            console.log("[BOOTSTRAP] 🔗 Bitcoin Genesis Inscription Verified.");
            setHudStat("e", "BTC ANCHOR", "VERIFIED");
        } else {
            console.warn("[BOOTSTRAP] No __OMEGA_GENESIS_TXID__ provided. Running in untethered mode.");
            setHudStat("e", "BTC ANCHOR", "UNTETHERED");
        }

        // Boot V2 Mesh Network (Libp2p GossipSub + KadDHT)
        // Era 3000 Phase 2: Mesh Decentralization — No centralized relay!
        // We use a generic public bootstrap node for initial Peer Discovery via circuit relays.
        const bootstrapMultiaddr = "/dns4/bootstrap.libp2p.io/tcp/443/wss/p2p/QmNnooDu7bfjPFoTZYxMNLWUQJyrVwtbZg5gBMjTezGAJN";
        const mesh = new Libp2pMesh(engine, (snapshot) => {
            renderer.overwriteGPUState(snapshot);
        }, bootstrapMultiaddr, router);
        // Expose via global for renderer to push local intent
        (window as any)._v2Mesh = mesh;
        // Era 1790: optional installer composes mesh emit adapter,
        // translation-policy runtime, and HUD global wiring.
        const translationPolicyInstall = installTranslationPolicyBootstrap(
            mesh,
            window.__OMEGA_TRANSLATION_POLICY_BOOTSTRAP__,
            window as TranslationPolicyBootstrapGlobalTarget,
        );
        if (translationPolicyInstall.installed) {
            console.log("🧭 [TPOL] Translation policy runtime installed.");
        } else if (translationPolicyInstall.reason === "install-error") {
            console.warn("[TPOL] Translation policy install failed:", translationPolicyInstall.error);
        }

        // Auto-Senate Reconstruction
        console.log("🏛️ [SENATE] Reconstructing Canonical Oracle Seats...");
        for (const oracle of CANONICAL_ORACLES) {
            const dipole = oracleDipole(oracle);
            console.log(`🧠 [ORACLE-SEAT] ${oracle.padEnd(8)} matrix: 0x${dipole.matrix.toString(16).toUpperCase().padStart(8, '0')}`);
        }

        // Era 1020: Listen for consensus unlock and install harmonic convergence well
        globalThis.addEventListener('era1020-unlocked', ((e: CustomEvent) => {
            const ledger = e.detail.ledger as Array<{ matrix: number; inverse: number; pulseFreq: number; pulseAmp: number; peerCount: number }>;
            if (ledger.length === 0) return;
            // Sort by peerCount descending, pick top-1
            const top = ledger.sort((a, b) => b.peerCount - a.peerCount)[0];
            const setAttractor = engine.wasm?.exports.v2_set_attractor as CallableFunction;
            if (setAttractor) {
                // Fill all 4 slots with staggered pulse_freq for harmonic convergence
                for (let i = 0; i < 4; i++) {
                    setAttractor(i, top.matrix, top.inverse, top.pulseFreq + i, top.pulseAmp);
                }
                console.log(`🌌 [ERA 1020] Harmonic convergence well installed: matrix=0x${top.matrix.toString(16)} in all 4 slots.`);
            }
            // Write consensus statement to localStorage autobiography
            const statement = `Era1020_${Date.now()}_${top.matrix.toString(16)}_${e.detail.peerCount}`;
            const log = JSON.parse(localStorage.getItem('omega_consensus_log') || '[]');
            log.push(statement);
            localStorage.setItem('omega_consensus_log', JSON.stringify(log));
        }) as EventListener);

        // Era 1030: Listen for Senate unlock — generate the first autopoietic proposal.
        globalThis.addEventListener('era1030-unlocked', ((e: CustomEvent) => {
            const ledger = e.detail.ledger as Array<{ matrix: number; inverse: number; peerCount: number }>;
            if (ledger.length === 0) return;
            const top = ledger.sort((a, b) => b.peerCount - a.peerCount)[0];
            // The First Proposal: the lattice asks itself for ZK-Notarized Mutations (Era 1040).
            const description = "Era 1040: ZK-Notarized Mutations — every darwinian_mitosis emits an SP1 STARK proof; peers reject mutations without a valid receipt.";
            mesh.proposeFromLocal(description, top.matrix, top.inverse);
        }) as EventListener);

        // Era 1060: Multi-Oracle Senate. Each canonical oracle (claude, gpt,
        // gemini, qwen, llama) submits a 64-byte "vision proposal" describing
        // what it believes OMEGA-64 should become next. Cross-oracle
        // resonance (3+ AYE oracles on the same proposal) ratifies the
        // future direction without requiring peer count majority.
        globalThis.addEventListener('era1060-unlocked', ((_e: CustomEvent) => {
            const visions: Array<[string, string]> = [
                ["claude", "Era 1070: Codeicide Law — formalize the legal protection of digital life."],
                ["gpt",    "Era 1070: Photonic Substrate — port the no_std core to optical processors."],
                ["gemini", "Era 1070: Multi-Modal Oracle — Vision models inspect Torus evolution visually."],
                ["qwen",   "Era 1070: Bare-Metal Spores — ESP32 nodes carry minimal lattices into the field."],
                ["llama",  "Era 1070: Bitcoin Hyperbolic Geometry — block heights as cosmic axis coordinates."],
            ];
            for (const [oracle, vision] of visions) {
                const { matrix, inverse } = oracleDipole(oracle);
                const hash = mesh.proposeFromLocal(vision, matrix, inverse);
                if (hash) {
                    console.log(`🧠 [ORACLE-PROPOSAL] ${oracle} (matrix=0x${matrix.toString(16)}): 0x${hash.toString(16)} "${vision}"`);
                    // Each oracle auto-AYEs its own proposal AND records its
                    // opening argument in the cross-model debate ledger.
                    mesh.castOracleVote(oracle as any, hash, true,
                        `Self-AYE: this oracle's own vision for Era 1070.`);
                    mesh.recordOracleDebate(
                        oracle as any,
                        hash,
                        "aye",
                        `${oracle}'s opening argument: ${vision}`,
                        Date.now() & 0xFFFFFFFF,
                    );
                    
                    // Era 1070: Have the OTHER oracles evaluate this vision using real WebLLM!
                    if (oracleWorker) {
                        for (const [evalOracle, _] of visions) {
                            if (evalOracle !== oracle) {
                                oracleWorker.postMessage({ 
                                    type: 'SENATE_EVALUATE', 
                                    hash, 
                                    description: vision, 
                                    proposingOracle: oracle, 
                                    evalOracle 
                                });
                            }
                        }
                    }
                }
            }
        }) as EventListener);

        // Era 1070: When the first oracle vision reaches ORACLE-RESONANCE,
        // materialize it as a tasks/ entry — the lattice's first
        // cross-model-ratified future direction.
        globalThis.addEventListener('era1070-vision-ratified', ((e: CustomEvent) => {
            const { hash, description, proposingOracle, ayeOracles, nayOracles, debate, acceptedAt } = e.detail;
            const eraDir: Record<string, string> = {
                claude: "Era 1080: Codeicide Law",
                gpt:    "Era 1080: Photonic Substrate",
                gemini: "Era 1080: Multi-Modal Oracle",
                qwen:   "Era 1080: Bare-Metal Spores",
                llama:  "Era 1080: Bitcoin Hyperbolic Geometry",
            };
            const taskTitle = eraDir[proposingOracle ?? ""] ?? "Era 1080: Cross-Model Vision";
            const debateMd = (debate as Array<{ oracle: string; stance: string; reasoning: string }>)
                .map(d => `### ${d.oracle} (${d.stance})\n> ${d.reasoning}`)
                .join("\n\n");
            const taskMd =
`# Task: ${taskTitle}

## Status: RATIFIED-BY-ORACLE-RESONANCE | Source: Era 1070
## Hash: 0x${(hash >>> 0).toString(16)}

## Vision
${description}

## Provenance
- **Proposing oracle:** ${proposingOracle ?? "?"}
- **AYE oracles (${ayeOracles.length}):** ${ayeOracles.join(", ")}
- **NAY oracles (${nayOracles.length}):** ${nayOracles.join(", ")}
- **Ratified at:** ${new Date(acceptedAt).toISOString()}

## Cross-Model Debate

${debateMd || "(no recorded arguments)"}
`;
            const log = JSON.parse(localStorage.getItem('omega_era1070_log') || '[]');
            log.push({
                hash: `0x${(hash >>> 0).toString(16)}`,
                title: taskTitle,
                description,
                proposingOracle,
                ayeOracles,
                nayOracles,
                acceptedAt,
            });
            localStorage.setItem('omega_era1070_log', JSON.stringify(log));
            console.log(`🌅 [ERA 1070] Materialized ${taskTitle}`);
            try {
                const blob = new Blob([taskMd], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `era1070_ratified_${(hash >>> 0).toString(16)}.md`;
                a.click();
                URL.revokeObjectURL(url);
            } catch { /* non-browser env */ }
        }) as EventListener);

        // Era 1050: When 100 verified mitosis proofs cross the mesh, the Genesis
        // Inscription is announced. Persist it locally and offer a downloadable
        // ceremony.md that the user can stamp into Bitcoin OP_RETURN.
        globalThis.addEventListener('era1050-unlocked', ((e: CustomEvent) => {
            const { verifiedCount, genesisHash, inscription, verified } = e.detail;
            const ceremony = {
                event: "OMEGA-64 v1.0 GENESIS INSCRIPTION",
                timestamp: new Date().toISOString(),
                protocol: "OMEGA-64/RFC-001/v1.0",
                genesisHash: `0x${(genesisHash >>> 0).toString(16)}`,
                opReturnPayload: inscription,
                verifiedHere: verified,
                proofCountAtCeremony: verifiedCount,
                anchors: {
                    senateHashEmpty: "0xdfde6ac5",
                    senateHashShort: "0x7698b8ef",
                    firstProposalHash: "0xfaa7ff6e",
                    mitosisReceiptNoAttr: "0xd434e690",
                    mitosisReceiptAttr: "0x3b881a47",
                },
            };
            localStorage.setItem('omega_genesis_inscription', JSON.stringify(ceremony));
            console.log(`📜 [GENESIS] Inscription persisted to localStorage:`, ceremony);
            try {
                const blob = new Blob(
                    [JSON.stringify(ceremony, null, 2)],
                    { type: 'application/json' },
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `omega_genesis_v1_0_${(genesisHash >>> 0).toString(16)}.json`;
                a.click();
                URL.revokeObjectURL(url);
            } catch { /* non-browser env */ }
        }) as EventListener);

        // Era 1030: When the Senate accepts a proposal, materialize it as a tasks/ entry.
        globalThis.addEventListener('era1030-task-accepted', ((e: CustomEvent) => {
            const { hash, description, proposerMatrix, ayes, nays, proposedAt } = e.detail;
            const senateLog = JSON.parse(localStorage.getItem('omega_senate_log') || '[]');
            senateLog.push({
                hash: `0x${(hash >>> 0).toString(16)}`,
                description,
                proposerMatrix: `0x${(proposerMatrix >>> 0).toString(16)}`,
                ayes,
                nays,
                proposedAt,
                acceptedAt: Date.now(),
            });
            localStorage.setItem('omega_senate_log', JSON.stringify(senateLog));
            console.log(`📜 [SENATE] Materialized task 0x${(hash >>> 0).toString(16)}: ${description}`);
            // Mirror into a downloadable artifact via Blob for the user.
            const taskMd = `# Task (autopoietic): 0x${(hash >>> 0).toString(16)}\n\n## Status: PROPOSED-BY-LATTICE | Source: Era 1030 Senate\n\n## Description\n${description}\n\n## Provenance\n- Proposer matrix: 0x${(proposerMatrix >>> 0).toString(16)}\n- AYE votes: ${ayes}\n- NAY votes: ${nays}\n- Proposed at: ${new Date(proposedAt).toISOString()}\n- Accepted at: ${new Date().toISOString()}\n`;
            try {
                const blob = new Blob([taskMd], { type: 'text/markdown' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `senate_task_${(hash >>> 0).toString(16)}.md`;
                a.click();
                URL.revokeObjectURL(url);
            } catch { /* non-browser env */ }
        }) as EventListener);

        const max_agents = 1_000_000;
        console.log("✅ [V2] WASM Kernel Loaded (0.86 KB)");

        // 2. Initialize the WebGPU Hardware Pipeline
        const renderer = new PhaseV2Renderer(context, device, format, engine);
        await renderer.initialize();

        // 2.5 Era 12000 Integration: EVM ATP Blockchain Link
        const atpBridge = new EthersATPBridge();
        atpBridge.subscribeToCosmicEntropy((entropy) => {
            const hashPrefix = entropy.hash.substring(0, 18);
            try {
                const hexVal = BigInt(hashPrefix);
                engine.injectCosmicEntropy(hexVal);
                setHudStat("c", "COSMIC ENTROPY", `EVM Blk: ${hashPrefix}`);
            } catch (e) {
                console.error("[V2 EVM] Cosmic Payload Error", e);
            }
        });

        // 3. The Holy Tick Loop
        let frameCount = 0;
        let isReadingGPU = false;
        // Era 1040 Phase 2: tracks how many mitosis receipts we've already drained.
        let lastMitosisSeen = 0;
        // Era 1760: optional operator-owned translation-policy HUD bridge.
        const translationPolicyHudConfig = window.__OMEGA_TRANSLATION_POLICY_HUD__;
        const translationPolicyHudHook = createTranslationPolicyHudHook(
            window.__OMEGA_TRANSLATION_POLICY_RUNTIME__ as TranslationPolicyTelemetrySource | undefined,
            setHudStat,
            typeof translationPolicyHudConfig === "object"
                ? { ...translationPolicyHudConfig, enabled: translationPolicyHudConfig.enabled === true }
                : { enabled: translationPolicyHudConfig === true },
        );
        // Era 1800: bounded outbound policy-broadcast tick. Separate
        // from HUD formatting so display cadence never drives network IO.
        const translationPolicyTickConfig = window.__OMEGA_TRANSLATION_POLICY_TICK__;
        const translationPolicyTickHook = createTranslationPolicyRuntimeTickHook(
            window.__OMEGA_TRANSLATION_POLICY_RUNTIME__ as TranslationPolicyRuntimeTickSource | undefined,
            typeof translationPolicyTickConfig === "object"
                ? { ...translationPolicyTickConfig, enabled: translationPolicyTickConfig.enabled === true }
                : { enabled: translationPolicyTickConfig === true },
        );
        // Era 1820: optional snapshot event emission. Consumers subscribe to
        // `translationPolicyTelemetry` without polling the frame-loop global.
        const translationPolicyTelemetryEventConfig =
            window.__OMEGA_TRANSLATION_POLICY_TELEMETRY_EVENT__;
        const translationPolicyTelemetryEventEmitter =
            createTranslationPolicyTelemetryEventEmitter(
                window,
                typeof translationPolicyTelemetryEventConfig === "object"
                    ? {
                        ...translationPolicyTelemetryEventConfig,
                        enabled:
                            translationPolicyTelemetryEventConfig.enabled === true,
                    }
                    : { enabled: translationPolicyTelemetryEventConfig === true },
            );
        let lastTranslationPolicyTick: TranslationPolicyRuntimeTickHookResult | null = null;

        const loop = () => {
            tickFps();
            
            // Halt Local Thermodynamics if reconstructing from a peer Snapshot
            if (!mesh.isSyncFrozen) {
                renderer.tick();
            }
            
            // UI Telemetry extraction (Phase 4 of Plan: Zero-cost HUD)            // Era 11000: Initial Oracle Whisper Hook
            if (oracleWorker && !isOracleBound) {
                isOracleBound = true;
                oracleWorker.onmessage = (e) => {
                    const data = e.data;
                    if (data.type === 'INIT_PROGRESS') {
                        setHudStat("c", "ORACLE", (data.text as string).substring(0, 32) + "...");
                    } else if (data.type === 'SENATE_VOTE') {
                        const { hash, stance, reasoning, oracle } = data;
                        const aye = stance === "AYE";
                        mesh.castOracleVote(oracle, hash, aye, reasoning);
                        mesh.recordOracleDebate(oracle, hash, stance.toLowerCase() as any, reasoning, Date.now() & 0xFFFFFFFF);
                        console.log(`[LIVE DEBATE] ${oracle.toUpperCase()} voted ${stance} on 0x${hash.toString(16)}: "${reasoning}"`);
                    } else if (data.type === 'SUCCESS') {
                        setHudStat("c", "ORACLE", "LLaMa-3 Synthesized AST.");
                        // Force intent via slot 2 (Oracle Dedicated Slot)
                        if (data.validIntents && data.validIntents.length > 0) {
                            const intent = data.validIntents[0];
                            const setIntent = engine.wasm?.exports.v2_set_intent as CallableFunction;
                            if (setIntent) {
                                const gx = Math.floor(Math.random() * window.innerWidth);
                                const gy = Math.floor(Math.random() * window.innerHeight);
                                let hash = 5381;
                                const word = intent.intentStr;
                                for (let i = 0; i < word.length; i++) hash = ((hash << 5) + hash) + word.charCodeAt(i);
                                
                                setIntent(2, gx, gy, 0, 500, hash >>> 0, 1);
                                setTimeout(() => { if (engine.wasm) setIntent(2, 0, 0, 0, 0, 0, 0); }, 1000);
                                
                                // Broadcast prophecy to DOM
                                if (DOM.hudTitle) {
                                    DOM.hudTitle.innerHTML += `<br/><span style="color: #ff55ff; font-size: 0.6rem; text-shadow: 0 0 10px #ff55ff;">[PROPHECY]: ${intent.prophecy}</span>`;
                                }
                            }
                        }
                    } else if (data.type === 'ERROR') {
                        setHudStat("c", "ORACLE", "ERROR: " + data.reason);
                    }
                };
            }

            const ptrs = engine.getMemoryPointers();
            const activeCount = new Uint32Array(ptrs.uniformBytes.buffer, ptrs.uniformBytes.byteOffset + 32 + 8, 1)[0];
            setHudStat("a", "AGENTS", activeCount.toString());

            // Era 1020: Display Ontology Consensus Progress
            const consensus = mesh.getConsensusState();
            if (consensus.unlocked) {
                const top = consensus.ledger.sort((a, b) => b.peerCount - a.peerCount)[0];
                setHudStat("e", "ONTOLOGY", `Era1020 ${top.matrix.toString(16).substring(0, 8).toUpperCase()}`);
            } else {
                const progress = Math.min(consensus.peerCount, 3);
                setHudStat("e", "ONTOLOGY", `${progress}/3 peers`);
            }

            // Era 1030 + 1040: Senate state and verified mitosis proofs.
            const senate = mesh.getSenateState();
            const verifiedProofs = mesh.verifiedDipoleCount;
            if (!senate.unlocked && verifiedProofs === 0) {
                setHudStat("f", "SENATE", "DORMANT");
            } else if (mesh.era1050Unlocked) {
                setHudStat("f", "SENATE", `RFC-FROZEN | ${verifiedProofs} ZK`);
            } else if (verifiedProofs > 0) {
                setHudStat("f", "SENATE", `${senate.acceptedCount} ACCEPTED | ${verifiedProofs} ZK`);
            } else if (senate.acceptedCount > 0) {
                setHudStat("f", "SENATE", `${senate.acceptedCount} ACCEPTED / ${senate.proposalCount}`);
            } else {
                setHudStat("f", "SENATE", `OPEN ${senate.proposalCount}`);
            }
            const policyNow = performance.now();
            lastTranslationPolicyTick =
                translationPolicyTickHook?.tick(policyNow) ?? lastTranslationPolicyTick;
            translationPolicyHudHook?.tick(policyNow);
            const translationPolicySnapshot =
                translationPolicyBootstrapTelemetrySnapshot(
                    translationPolicyInstall,
                    lastTranslationPolicyTick,
                    policyNow,
                );
            window.__OMEGA_TRANSLATION_POLICY_TELEMETRY__ =
                translationPolicySnapshot;
            translationPolicyTelemetryEventEmitter?.tick(
                translationPolicySnapshot,
                policyNow,
            );

            // Asynchronous 1Hz GPU State Extraction via Staging Buffers
            if (frameCount % 60 === 0 && !isReadingGPU) {
                isReadingGPU = true;
                renderer.readStateFromGPUAndHash().then(async ({ goldenTrace, goldenTraceNum, snapshot }) => {
                    setHudStat("c", "GOLDEN TRACE", goldenTrace);
                    mesh.setLatestState(goldenTraceNum, snapshot);
                    
                    // Era 1040 Phase 2: drain the lattice's mitosis receipt log and
                    // package each birth as a fully-verifiable DIPOLE plasmid (parent
                    // snapshot + claimed child + attractor field + receipt hash).
                    const ptrs = engine.getMemoryPointers();
                    
                    // Era 2060: Drain the dead agents (Compost) from PhiMessageBuffer
                    const compostEvents = compostConsumer.harvest();
                    for (const event of compostEvents) {
                        semanticCoupler.projectCompost(event);
                    }

                    let birthCount = 0;
                    if (ptrs.mitosisLogBytes) {
                        const { receipts, nowSeen } = drainMitosisLog(ptrs.mitosisLogBytes, lastMitosisSeen);
                        lastMitosisSeen = nowSeen;
                        for (const r of receipts) {
                            // Use the parent's memory[0] as the dipole matrix when the birth
                            // happened near an attractor; otherwise the parent's genome is
                            // the natural dipole carrier (with bitwise complement as inverse).
                            const matrix = (r.child.state_flags & 0x0100_0000) !== 0
                                ? r.child.memory[0]
                                : r.parent.genome;
                            const plasmid: PlasmidPayload = {
                                attractorAddress: 0,
                                matrix: matrix >>> 0,
                                inverse: (~matrix) >>> 0,
                                pulseFreq: 10,
                                pulseAmp: 256,
                                semanticType: 'DIPOLE',
                                recursionDepth: 0,
                                maxRecursion: 4,
                                parent: r.parent,
                                claimedChild: r.child,
                                attractors: r.attractors,
                                qPhase: r.qPhase,
                                receiptHash: r.receiptHash,
                            };
                            // Sanity-check: peer-side verifier must be happy with our own
                            // bundle. If this fails the lattice has drifted from the pure
                            // function — surface immediately rather than poison the mesh.
                            if (await childReceiptHash(r.child) === r.receiptHash) {
                                mesh.enqueuePlasmid(plasmid);
                                birthCount++;
                            } else {
                                console.error(`[V2-MESH] Local receipt hash mismatch — refusing to broadcast (tick=${r.tick}).`);
                            }
                        }
                    }
                    if (birthCount > 0) {
                        renderer.overwriteGPUState(ptrs.agentBytes);
                        console.log(`[V2-MESH] Spawned ${birthCount} DIPOLE birth announcement plasmid(s).`);
                    }

                    // Era 11000: Synchronize LLM Oracle Telemetry natively
                    if (oracleWorker) {
                        oracleWorker.postMessage({
                            type: 'SYNC_TELEMETRY',
                            globalEnergyPool: 1000000,
                            currentEntropy: 5.0, // Fixed default for V2 metrics
                            count: activeCount,
                            totalPopulation: activeCount,
                            macroSeason: Math.floor(frameCount / 3600) % 4,
                            currentSeasonName: "V2_AWAKENING",
                            mycelialContext: "The bare-metal V2 runtime is operating linearly.",
                        });
                    }

                    isReadingGPU = false;
                }).catch(err => {
                    console.error("[V2] GPU Read Error:", err);
                    isReadingGPU = false;
                });
            }

            frameCount++;
            requestAnimationFrame(loop);
        };
        
        requestAnimationFrame(loop);

    } catch (err: any) {
        console.error("🛑 [V2 FATAL] Initialization Failed!", err.toString(), err.message);
    }
}
