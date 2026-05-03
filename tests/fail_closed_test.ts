import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/testing/asserts.ts";
import { MockATPBridge } from "../src/network/atp_bridge.ts";
import { NomosGate } from "../src/ontology/nomos_gate.ts";
import { WebRTCMesh } from "../src/network/webrtc_mesh.ts";

Deno.test("Era 0207: Production Configuration strictly rejects mocked ATP Bridge", () => {
    // 1. Temporarily mutate environment into production
    Deno.env.set("OMEGA_ENV", "production");
    
    // 2. Assert MockATPBridge throws upon instantiation
    assertThrows(() => {
        new MockATPBridge();
    }, Error, "[MockATPBridge] FATAL: Cannot instantiate MockATPBridge in production mode.");
    
    // 3. Assert WebRTCMesh throws if instantiated without EthersATPBridge
    // A MessagePort mock is needed for WebRTCMesh
    const channel = new MessageChannel();
    assertThrows(() => {
        new WebRTCMesh(channel.port1, "wss://dummy.local/");
    }, Error, "[WebRTCMesh] FATAL: Production mode requires a strict EthersATPBridge. Failing closed.");
    
    channel.port1.close();
    channel.port2.close();
    
    // Cleanup
    Deno.env.delete("OMEGA_ENV");
});

Deno.test("Era 0207: Production Configuration strictly rejects STARK stub validation", () => {
    Deno.env.set("OMEGA_ENV", "production");
    
    // Even if we provide a 64-byte mock proof that development mode would accept,
    // Production MUST return valid: false because we don't have real WASM bindings attached.
    const mock_proof = "A".repeat(64);
    const result = NomosGate.verify_sp1_receipt(mock_proof, { morphology: "test", steps: 100 });
    
    assertEquals(result.valid, false, "Production mode must fail-closed on STARK verification");
    
    Deno.env.delete("OMEGA_ENV");
});
