
export class SubstrateOrchestrator {
    private subsystems: ISubsystem[] = [];
    private isRunning = false;
    private rafId: number = 0;

    public register(subsystem: ISubsystem) {
        this.subsystems.push(subsystem);
    }

    public async boot() {
        console.log(`[TRACE] Orchestrator booting ${this.subsystems.length} subsystems...`);
        for (let i = 0; i < this.subsystems.length; i++) {
            const sys = this.subsystems[i];
            console.log(`[TRACE] Awaiting subsystem #${i} init...`);
            await sys.init();
            console.log(`[TRACE] Subsystem #${i} resolved!`);
        }
        console.log("[TRACE] Orchestrator boot complete.");
    }

    public start() {
        if (this.isRunning) return;
        this.isRunning = true;
        const loop = () => {
            if (!this.isRunning) return;
            const nowLocal = performance.now();
            for (const sys of this.subsystems) {
                sys.tick(nowLocal);
            }
            this.rafId = requestAnimationFrame(loop);
        };
        loop();
    }

    public stop() {
        this.isRunning = false;
        cancelAnimationFrame(this.rafId);
    }
}
