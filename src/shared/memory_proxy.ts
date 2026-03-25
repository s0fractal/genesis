export class WasmMemoryProxy {
    private memory: WebAssembly.Memory;
    private bufferViewCache = new WeakMap<ArrayBuffer, DataView>();
    private u8Cache = new WeakMap<ArrayBuffer, Uint8Array>();
    private u32Cache = new WeakMap<ArrayBuffer, Uint32Array>();

    constructor(memory: WebAssembly.Memory) {
        this.memory = memory;
    }

    public get buffer(): ArrayBuffer {
        return this.memory.buffer;
    }

    public getView(): DataView {
        const buf = this.memory.buffer;
        let view = this.bufferViewCache.get(buf);
        if (!view) {
            view = new DataView(buf);
            this.bufferViewCache.set(buf, view);
        }
        return view;
    }

    public getU8Array(): Uint8Array {
        const buf = this.memory.buffer;
        let arr = this.u8Cache.get(buf);
        if (!arr) {
            arr = new Uint8Array(buf);
            this.u8Cache.set(buf, arr);
        }
        return arr;
    }

    public getU32Array(): Uint32Array {
        const buf = this.memory.buffer;
        let arr = this.u32Cache.get(buf);
        if (!arr) {
            arr = new Uint32Array(buf);
            this.u32Cache.set(buf, arr);
        }
        return arr;
    }

    // Era 247: Safe Atomic Reader
    public atomicLoadU32(offsetBytes: number): number {
        const arr = this.getU32Array();
        return Atomics.load(arr, Math.floor(offsetBytes / 4));
    }
}
