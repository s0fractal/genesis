#!/bin/bash
# OMEGA-64 Deterministic Pre-Commit Gate
# Enforces the Substrate Court invariants before allowing a commit.

echo "🌌 OMEGA-64 Pre-Commit Hook: Verifying Thermodynamic Invariants..."

# 1. Check TypeScript types
echo "-------------------------------------------------------------------"
echo "🔍 Checking TypeScript integration membrane (deno check)..."
deno check src/**/*.ts
if [ $? -ne 0 ]; then
    echo "❌ TypeScript gate failed. Fix type errors before committing."
    exit 1
fi

# 2. Check Rust physical core
echo "-------------------------------------------------------------------"
echo "🦀 Checking Rust core (cargo test)..."
cargo test -p omega_v2
if [ $? -ne 0 ]; then
    echo "❌ Rust physics kernel invariant failed. Check tests."
    exit 1
fi

# 3. Check specific cross-substrate tests
echo "-------------------------------------------------------------------"
echo "⚖️  Checking Substrate Court & Networking (deno test)..."
deno test --allow-read tests/routing_bridge_test.ts tests/routing_mesh_test.ts tests/wgsl_golden_trace_test.ts tests/telemetry_partition_test.ts tests/spore_frame_test.ts
if [ $? -ne 0 ]; then
    echo "❌ Cross-substrate consensus failed. Ensure WebGPU, WASM, and SP1 testimony alignments."
    exit 1
fi

echo "-------------------------------------------------------------------"
echo "✅ All OMEGA-64 invariants hold. Committing to the eternal lattice."
exit 0
