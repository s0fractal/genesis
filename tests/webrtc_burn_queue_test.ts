import { assertEquals } from "jsr:@std/assert";
import { WebRTCMesh } from "../src/network/webrtc_mesh.ts";
import { IATPBridge, ATPTransactionReceipt } from "../src/network/atp_bridge.ts";

// Utility to wait in async tests
const delayMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Era 0206: Mock ATP Bridge to strictly control verification latency
 */
class LatencyMockATPBridge implements IATPBridge {
    public verifyCalls: string[] = [];
    public delays: Record<string, number> = {};
    public validity: Record<string, boolean> = {};

    async mintATP(): Promise<ATPTransactionReceipt> { return { txHash: '', atpAmount: 0, confirmed: true }; }
    async burnATP(): Promise<ATPTransactionReceipt> { return { txHash: '', atpAmount: 0, confirmed: true }; }
    async getBalance(): Promise<number> { return 0; }
    subscribeToCosmicEntropy(): void {}

    async verifyBurnTx(txHash: string): Promise<boolean> {
        this.verifyCalls.push(txHash);
        const delay = this.delays[txHash] || 0;
        if (delay > 0) {
            await delayMs(delay);
        }
        return this.validity[txHash] !== false; // Default true
    }
}

/**
 * Creates a raw WebRTCMesh instance and a simulated MessagePort
 * to capture messages routed to the internal worker.
 */
function createTestHarness() {
    const channel = new MessageChannel();
    const bridge = new LatencyMockATPBridge();
    const mesh = new WebRTCMesh(channel.port1, "wss://dummy.local", bridge);

    const receivedPayloads: any[] = [];
    channel.port2.onmessage = (e) => {
        if (e.data.type === 'FOREIGN_PLASMID') {
            receivedPayloads.push(e.data.payload);
        }
    };

    // Helper to simulate an incoming DataChannel message containing a plasmid
    const injectPlasmid = (id: string, txHash: string, validProof: boolean = true) => {
        const payload = {
            proof_bytes: validProof ? "0x" + "0".repeat(64) : "0xbad",
            morphology_hash: "0xabc",
            steps_cost: "100",
            burn_tx_hash: txHash,
            _test_id: id // Custom field to track order
        };
        const packet = JSON.stringify({ type: 'FOREIGN_PLASMID', payload });
        // Use any cast to directly inject into the private async message processor
        (mesh as any).processChannelMessage({ data: packet } as MessageEvent);
    };

    const teardown = () => {
        (mesh as any).signaling.close();
        channel.port1.close();
        channel.port2.close();
    };

    return { mesh, bridge, channel, receivedPayloads, injectPlasmid, teardown };
}

Deno.test("WebRTCMesh: Burn queue concurrency prevents head-of-line blocking", async () => {
    const { bridge, receivedPayloads, injectPlasmid, teardown } = createTestHarness();

    // Setup latencies:
    // tx_slow takes 200ms
    // tx_fast_1 and tx_fast_2 take 10ms
    bridge.delays['tx_slow'] = 200;
    bridge.delays['tx_fast_1'] = 10;
    bridge.delays['tx_fast_2'] = 10;

    // Inject sequentially (synchronously calling processChannelMessage)
    injectPlasmid("p1", "tx_slow");
    injectPlasmid("p2", "tx_fast_1");
    injectPlasmid("p3", "tx_fast_2");

    // Wait enough time for the fast ones to finish, but not the slow one
    await delayMs(50);

    // p2 and p3 should have completed and been forwarded to the worker!
    assertEquals(receivedPayloads.length, 2);
    assertEquals(receivedPayloads[0]._test_id, "p2");
    assertEquals(receivedPayloads[1]._test_id, "p3");

    // Wait for the slow one to finish
    await delayMs(200);

    // Now p1 should arrive
    assertEquals(receivedPayloads.length, 3);
    assertEquals(receivedPayloads[2]._test_id, "p1");
    
    // verifyBurnTx should have been called 3 times total
    assertEquals(bridge.verifyCalls, ["tx_slow", "tx_fast_1", "tx_fast_2"]);

    teardown();
});

Deno.test("WebRTCMesh: Deduplicates concurrent verify calls for identical transaction hashes", async () => {
    const { bridge, receivedPayloads, injectPlasmid, teardown } = createTestHarness();

    // Setup latency for shared transaction hash
    bridge.delays['tx_shared'] = 100;

    // Inject 10 plasmids all claiming the same burn transaction simultaneously
    for (let i = 0; i < 10; i++) {
        injectPlasmid(`p${i}`, "tx_shared");
    }

    // At this point, the promise is pending. It should only trigger the bridge ONCE.
    assertEquals(bridge.verifyCalls, ["tx_shared"]);

    // Wait for the shared promise to resolve
    await delayMs(150);

    // All 10 packets should have successfully awaited the same promise and been forwarded
    assertEquals(receivedPayloads.length, 10);
    for (let i = 0; i < 10; i++) {
        assertEquals(receivedPayloads[i]._test_id, `p${i}`);
    }

    // Crucially, verifyBurnTx was STILL only called exactly once!
    assertEquals(bridge.verifyCalls.length, 1);

    teardown();
});

Deno.test("WebRTCMesh: Rejects invalid SP1 proofs before hitting the burn queue", async () => {
    const { bridge, receivedPayloads, injectPlasmid, teardown } = createTestHarness();

    // Inject a plasmid with a bad proof
    injectPlasmid("p_bad", "tx_test", false);

    await delayMs(20);

    // The worker should receive nothing
    assertEquals(receivedPayloads.length, 0);

    // The ATP Bridge should never have been queried, saving EVM RPC calls
    assertEquals(bridge.verifyCalls.length, 0);

    teardown();
});
