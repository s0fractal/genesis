// 🌌 OMEGA-64: ZK Prover Bridge
// Asynchronously generates STARK proofs for new Mitosis receipts using omega_zk_host.

import { drainMitosisLog, MitosisReceipt } from "./mitosis_log_reader.ts";

export interface ZKProofBundle {
  kind: string;
  receiptHash: string;
  parentGenome: string;
  verified: boolean;
  proofBytes: string | null;
  publicValues: string | null;
  note: string | null;
}

export type ZKProofCallback = (
  receipt: MitosisReceipt,
  bundle: ZKProofBundle,
) => void;

export class ZKProverBridge {
  private lastSeen: number = 0;
  private logBytes: Uint8Array | null = null;
  private isProving: boolean = false;
  private queue: MitosisReceipt[] = [];
  private onProofGenerated: ZKProofCallback | null = null;
  /**
   * In-flight latch for `generateTickRollup`. The mitosis path is serialized by
   * `isProving`, but the rollup path is called on a fixed frame cadence
   * (`frameCount % 100` in bootstrap/v2.ts) as fire-and-forget — and a rollup
   * takes minutes, not 1.6 seconds. Without this latch each cadence tick spawns
   * ANOTHER `cargo run --release`, so the prover processes accumulate without
   * bound and starve the machine the simulation is running on.
   */
  private isRollingUp: boolean = false;
  /** Rollup cadence ticks skipped because a proof was still running. */
  private rollupsSkipped: number = 0;

  constructor() {}

  /** How many rollup requests were dropped for overlap (observability). */
  public get skippedRollups(): number {
    return this.rollupsSkipped;
  }

  public bindLogBytes(bytes: Uint8Array) {
    this.logBytes = bytes;
  }

  public onProof(callback: ZKProofCallback) {
    this.onProofGenerated = callback;
  }

  public tick() {
    if (!this.logBytes) return;

    const { receipts, nowSeen } = drainMitosisLog(this.logBytes, this.lastSeen);
    this.lastSeen = nowSeen;

    for (const receipt of receipts) {
      this.queue.push(receipt);
    }

    this.processQueue();
  }

  private async processQueue() {
    if (this.isProving || this.queue.length === 0) return;

    this.isProving = true;
    const receipt = this.queue.shift()!;

    try {
      console.log(
        `[zk_prover_bridge] Triggering STARK generation for Mitosis (parent: 0x${
          (receipt.parent.genome >>> 0).toString(16)
        })`,
      );

      // @ts-ignore: Deno is only available in backend/CLI contexts
      if (typeof Deno === "undefined") {
        console.warn(
          `[zk_prover_bridge] Cannot generate STARK proof in browser context. Skipping.`,
        );
        this.isProving = false;
        if (this.queue.length > 0) setTimeout(() => this.processQueue(), 100);
        return;
      }

      // Invoke omega_zk_host in the background
      // @ts-ignore
      const cmd = new Deno.Command("cargo", {
        args: [
          "run",
          "--release",
          "--manifest-path",
          "omega_zk_host/Cargo.toml",
        ],
        stdin: "piped",
        stdout: "piped",
        stderr: "inherit", // Inherit so SP1 output can be seen in terminal
      });
      const child = cmd.spawn();

      const writer = child.stdin.getWriter();
      const encoder = new TextEncoder();

      // Convert to JSON with exact casing omega_zk_host expects
      const payload = {
        parent: receipt.parent,
        child: receipt.child,
        attractors: receipt.attractors,
        qPhase: receipt.qPhase,
        receiptHash: receipt.receiptHash,
        tick: receipt.tick,
      };

      await writer.write(encoder.encode(JSON.stringify(payload)));
      await writer.close();

      const output = await child.output();
      if (output.success) {
        const decoder = new TextDecoder();
        const outStr = decoder.decode(output.stdout);

        // Since the output is pretty-printed, each line is not a valid JSON.
        let parsed: any = null;
        try {
          // Extract just the JSON part (it should be the only thing on stdout, since logs are stderr)
          parsed = JSON.parse(outStr);
        } catch (e) {
          console.error(
            "[zk_prover_bridge] Failed to parse Mitosis JSON output:",
            e,
          );
        }

        if (parsed) {
          const bundle: ZKProofBundle = {
            kind: parsed.kind,
            receiptHash: parsed.receipt_hash,
            parentGenome: parsed.parent_genome,
            verified: parsed.verified,
            proofBytes: parsed.proof_bytes,
            publicValues: parsed.public_values,
            note: parsed.note,
          };

          if (this.onProofGenerated) {
            this.onProofGenerated(receipt, bundle);
          }
        }
      } else {
        console.error(
          `[zk_prover_bridge] SP1 STARK generation failed with code ${output.code}`,
        );
      }
    } catch (e) {
      console.error(`[zk_prover_bridge] Error running omega_zk_host:`, e);
    } finally {
      this.isProving = false;
      // Continue processing if there's more in the queue
      if (this.queue.length > 0) {
        setTimeout(() => this.processQueue(), 100);
      }
    }
  }

  public async verifyExternalProof(bundle: ZKProofBundle): Promise<boolean> {
    // @ts-ignore
    if (typeof Deno === "undefined") {
      // AUDIT A5 — fail CLOSED. A browser cannot run SP1 STARK verification, and a
      // fail-OPEN return here let a peer's UNVERIFIED physics rollup be applied
      // (bootstrap/v2.ts overwriteGPUState on `valid`). An unverifiable proof is
      // NOT valid; reject it and require relay-side verification instead.
      console.warn(
        `[zk_prover_bridge] Cannot verify STARK proof in browser (no SP1 host) — rejecting (fail-closed). Verify relay-side.`,
      );
      return false;
    }

    try {
      // @ts-ignore
      const cmd = new Deno.Command("cargo", {
        args: [
          "run",
          "--release",
          "--manifest-path",
          "omega_zk_host/Cargo.toml",
          "--",
          "--verify-only",
        ],
        stdin: "piped",
        stdout: "piped",
        stderr: "inherit",
      });
      const child = cmd.spawn();

      const writer = child.stdin.getWriter();
      const encoder = new TextEncoder();

      // omega_zk_host expects snake_case
      const payload = {
        kind: bundle.kind,
        receipt_hash: bundle.receiptHash.replace("0x", ""),
        parent_genome: bundle.parentGenome,
        verified: bundle.verified,
        proof_bytes: bundle.proofBytes,
        public_values: bundle.publicValues,
        note: bundle.note,
      };

      await writer.write(encoder.encode(JSON.stringify(payload)));
      await writer.close();

      const output = await child.output();
      return output.success;
    } catch (e) {
      console.error(`[zk_prover_bridge] Verification error:`, e);
      return false;
    }
  }

  public async generateTickRollup(
    agentBytes: Uint8Array,
    attractorBytes: Uint8Array,
    activeCount: number,
    qPhase: number,
  ): Promise<ZKProofBundle | null> {
    // @ts-ignore
    if (typeof Deno === "undefined") {
      console.warn(
        `[zk_prover_bridge] Cannot generate STARK proof in browser context. Skipping Rollup.`,
      );
      return null;
    }

    // Drop this cadence tick rather than stack a second prover on top of the
    // one still running. Dropping is correct here: a rollup is a snapshot of
    // current lattice state, so the next tick's rollup strictly supersedes the
    // one we skipped — there is nothing to queue.
    if (this.isRollingUp) {
      this.rollupsSkipped++;
      if (this.rollupsSkipped % 10 === 1) {
        console.warn(
          `[zk_prover_bridge] Rollup still in flight — skipped ${this.rollupsSkipped} cadence tick(s). Proving is slower than the 100-frame cadence.`,
        );
      }
      return null;
    }
    this.isRollingUp = true;

    try {
      console.log(
        `[zk_prover_bridge] Triggering ZK Physics Rollup for ${activeCount} agents...`,
      );

      // ZK Rollup Bitmap Compression
      // Only send agents that have mutated, accompanied by a sparse bitmap and Merkle root.
      const changed_indices = [];
      const changed_agents = [];
      const agentView = new DataView(
        agentBytes.buffer,
        agentBytes.byteOffset,
        agentBytes.byteLength,
      );
      for (let i = 0; i < activeCount; i++) {
        const offset = i * 32;
        const state_flags = agentView.getUint32(offset + 12, true);

        // Simulate sparse extraction (in production, compare against previous root)
        if ((state_flags & 0x01) !== 0 || i % 16 === 0) {
          changed_indices.push(i);
          changed_agents.push({
            phase: agentView.getUint32(offset + 0, true),
            energy: agentView.getUint32(offset + 4, true),
            base_freq: agentView.getInt32(offset + 8, true),
            state_flags: state_flags,
            genome: agentView.getUint32(offset + 16, true),
            memory: [
              agentView.getUint32(offset + 20, true),
              agentView.getUint32(offset + 24, true),
              agentView.getUint32(offset + 28, true),
            ],
          });
        }
      }

      const attractors = [];
      const attractorView = new DataView(
        attractorBytes.buffer,
        attractorBytes.byteOffset,
        attractorBytes.byteLength,
      );
      const count = attractorView.getUint32(0, true);
      for (let i = 0; i < Math.min(count, 4); i++) {
        const offset = 16 + (i * 16);
        attractors.push({
          matrix: attractorView.getUint32(offset + 0, true),
          inverse: attractorView.getUint32(offset + 4, true),
          pulse_freq: attractorView.getUint32(offset + 8, true),
          pulse_amp: attractorView.getUint32(offset + 12, true),
        });
      }

      const rollup = {
        q_phase: qPhase,
        q_sectors: 1,
        q_radial: 1,
        q_math: 0,
        weather_multiplier: 1,
        active_count: activeCount,
        bitmap: changed_indices,
        changed_agents: changed_agents,
        merkle_root:
          "0x0000000000000000000000000000000000000000000000000000000000000000",
        attractors,
      };

      // @ts-ignore
      const cmd = new Deno.Command("cargo", {
        args: [
          "run",
          "--release",
          "--manifest-path",
          "omega_zk_host/Cargo.toml",
          "--",
          "--rollup",
        ],
        stdin: "piped",
        stdout: "piped",
        stderr: "inherit",
      });
      const child = cmd.spawn();

      const writer = child.stdin.getWriter();
      const encoder = new TextEncoder();

      await writer.write(encoder.encode(JSON.stringify(rollup)));
      await writer.close();

      const output = await child.output();
      if (output.success) {
        const decoder = new TextDecoder();
        const outStr = decoder.decode(output.stdout);

        const lines = outStr.trim().split("\n");
        let parsed: any = null;
        // Since the output is pretty-printed, each line is not a valid JSON.
        // We should parse the entire outStr!
        try {
          parsed = JSON.parse(outStr);
        } catch (e) {
          console.error(
            "Failed to parse whole JSON. Attempting line by line fallback...",
            e,
          );
          for (let i = lines.length - 1; i >= 0; i--) {
            try {
              parsed = JSON.parse(lines[i]);
              break;
            } catch (e) {}
          }
        }

        if (parsed) {
          return {
            kind: parsed.kind,
            receiptHash: parsed.receipt_hash,
            parentGenome: parsed.parent_genome,
            verified: parsed.verified,
            proofBytes: parsed.proof_bytes,
            publicValues: parsed.public_values,
            note: parsed.note,
          };
        }
      } else {
        console.error(
          `[zk_prover_bridge] Rollup STARK generation failed with code ${output.code}`,
        );
      }
    } catch (e) {
      console.error(`[zk_prover_bridge] Rollup generation error:`, e);
    } finally {
      this.isRollingUp = false;
    }
    return null;
  }
}
