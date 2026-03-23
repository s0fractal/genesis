import { ISubsystem } from "./orchestrator.ts";
import { 
    PhaseLatticeField, 
    phase_lattice_shannon_entropy,
    phase_lattice_omega_span,
    phase_lattice_signature,
    phase_lattice_total_amplitude
} from "@wasm";
import { PhaseWebGPUObserver } from "../../lens/phase_webgpu.ts";
import { SovereignOracle } from "../../ontology/oracle.ts";
import { PhylogeneticCanvas } from "../../ontology/phylogeny.ts";
import {
  DOM,
  frames,
  setHudStat,
  setInputMode,
  tickFps,
  updateHomeostasisHUD,
} from "../dom.ts";
import {
  KURAMOTO_COUPLING_BASE,
  MUTATION_BASE_COST,
} from "../../shared/constants.ts";
import { TOPOS_DICTIONARY } from "../../shared/topos_dictionary.ts";

export class UISubsystem implements ISubsystem {
    public phylogenyHUD: PhylogeneticCanvas;
    private lastPhylogenyCheck = performance.now();

    constructor(
        public field: PhaseLatticeField,
        public oracle: SovereignOracle,
        public observer: PhaseWebGPUObserver
    ) {
        this.phylogenyHUD = new PhylogeneticCanvas();
    }

    init() {
        DOM.hudTitle?.replaceChildren("Φ Phase Lattice");
        DOM.statusLabel?.replaceChildren("PHASE MODE ACTIVE");
        setHudStat("a", "SECTORS", "64x10x3");
        setHudStat("b", "FPS", "0");
        setHudStat("c", "SIGNATURE", "warming");
        setInputMode("semantic");

        globalThis.addEventListener("keydown", (e) => {
            if (e.key === "h" || e.key === "H") {
                this.observer.heatmapEnabled = !this.observer.heatmapEnabled;
                console.log(
                    `[OS] Tension Heatmap explicitly ${
                    this.observer.heatmapEnabled ? "ENABLED" : "DISABLED"
                    }!`
                );
            }
        });
    }

    tick(nowLocal: number) {
        if (nowLocal - this.lastPhylogenyCheck > 1000) {
            this.lastPhylogenyCheck = nowLocal;
            this.phylogenyHUD.tick();
        }

        const entropy = phase_lattice_shannon_entropy(this.field);

        // Era 172: Live Bio-Acoustic Sonification Parametrics
        this.observer.choir.modulateParams(
            this.oracle.getGlobalEnergy() / 100000.0,
            Math.max(0, 1.0 - (this.oracle.getQueueSize() / 20.0)),
            Math.max(0, 1.0 - (entropy / 6.0)),
            (nowLocal % 5000) / 5000.0
        );

        tickFps();

        if (frames === 0) {
            setHudStat(
                "a",
                "AMPLITUDE",
                phase_lattice_total_amplitude(this.field).toString()
            );
            setHudStat(
                "c",
                "SIGNATURE",
                phase_lattice_signature(this.field).slice(0, 12)
            );
            DOM.statusLabel?.replaceChildren(
                `ENT ${entropy.toFixed(2)} | Ω ${
                phase_lattice_omega_span(this.field)
                } | Q ${this.oracle.getQueueSize()}`
            );

            const topos = this.oracle.getTopSectors();
            const toposData = topos.map(t => ({
                name: TOPOS_DICTIONARY[t.topId]?.name || "Unknown",
                heat: t.topHeat
            }));

            updateHomeostasisHUD(
                entropy,
                this.oracle.getGlobalEnergy(),
                KURAMOTO_COUPLING_BASE,
                MUTATION_BASE_COST,
                toposData
            );
        }
    }
}
