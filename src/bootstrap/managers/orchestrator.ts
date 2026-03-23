export interface ISubsystem {
    init(): Promise<void> | void;
    tick(nowLocal: number): void;
}

export class SubstrateOrchestrator {
    private subsystems: ISubsystem[] = [];
    private isRunning = false;
    private rafId: number = 0;

    public register(subsystem: ISubsystem) {
        this.subsystems.push(subsystem);
    }

    public async boot() {
        for (const sys of this.subsystems) {
            await sys.init();
        }
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
        this.rafId = requestAnimationFrame(loop);
    }

    public stop() {
        this.isRunning = false;
        cancelAnimationFrame(this.rafId);
    }
}
