/// <reference types="@webgpu/types" />

export class EvolutionPipeline {
    private device: GPUDevice;
    
    private simulatePipeline!: GPUComputePipeline;
    private reducePipeline!: GPUComputePipeline;
    private applyPipeline!: GPUComputePipeline;
    
    private fieldBuffer: GPUBuffer;
    private mutationsBuffer: GPUBuffer;
    private scoresBuffer: GPUBuffer;
    private reduceBuffer: GPUBuffer;

    constructor(device: GPUDevice, fieldBuffer: GPUBuffer) {
        this.device = device;
        this.fieldBuffer = fieldBuffer;
        
        // Setup internal tournament memory space
        this.mutationsBuffer = this.device.createBuffer({
            size: 1024 * 8, // 1024 candidate mutations (phaseShift: i32, amplitude: i32)
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        });
        
        this.scoresBuffer = this.device.createBuffer({
            size: 1024 * 4,
            usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        });

        this.reduceBuffer = this.device.createBuffer({
            size: 8, // Final best Pair {score, index}
            usage: GPUBufferUsage.STORAGE
        });
    }

    async init() {
        const simulateShader = this.device.createShaderModule({ 
            code: await fetch('/shaders/compute_simulate.wgsl').then(r => r.text()) 
        });
        const reduceShader = this.device.createShaderModule({ 
            code: await fetch('/shaders/compute_reduce.wgsl').then(r => r.text()) 
        });
        const applyShader = this.device.createShaderModule({ 
            code: await fetch('/shaders/compute_apply.wgsl').then(r => r.text()) 
        });

        this.simulatePipeline = this.device.createComputePipeline({ layout: 'auto', compute: { module: simulateShader, entryPoint: 'main' }});
        this.reducePipeline = this.device.createComputePipeline({ layout: 'auto', compute: { module: reduceShader, entryPoint: 'main' }});
        this.applyPipeline = this.device.createComputePipeline({ layout: 'auto', compute: { module: applyShader, entryPoint: 'main' }});
    }

    tick() {
        const encoder = this.device.createCommandEncoder();
        
        // Compute A: Superposition Variance Generation (1024 unique variant realities)
        const simPass = encoder.beginComputePass();
        simPass.setPipeline(this.simulatePipeline);
        // bind(0): fieldBuffer, bind(1): lut, bind(2): mutationsBuffer, bind(3): scoresBuffer
        simPass.dispatchWorkgroups(1024); 
        simPass.end();

        // Compute B: Parallel Log(N) Reduction (O(1) CPU time)
        const reducePass = encoder.beginComputePass();
        reducePass.setPipeline(this.reducePipeline);
        // bind(0): scoresBuffer, bind(1): reduceBuffer
        reducePass.dispatchWorkgroups(1); 
        reducePass.end();

        // Compute C: Deterministic Physical Matrix Collapse
        const applyPass = encoder.beginComputePass();
        applyPass.setPipeline(this.applyPipeline);
        // bind(0): reduceBuffer, bind(1): mutationsBuffer, bind(2): fieldBuffer, bind(3): lut
        // Evolving the raw spatial elements irreversibly
        applyPass.dispatchWorkgroups(Math.ceil((256 * 256) / 64)); 
        applyPass.end();

        this.device.queue.submit([encoder.finish()]);
    }
}
