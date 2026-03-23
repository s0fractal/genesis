# OMEGA-64 | Era 203: Holographic CRDT & Refractive Routing
*Codename: The Mycelial Prism*

## 1. Abstract
The OMEGA-64 networking layer (Era 100+) successfully implemented a decentralized P2P mesh using WebRTC `RTCDataChannel`. However, the propagation of logic matrices (Plasmids) has historically relied on naive broadcasting (Gossiping).

This specification synthesizes the robust, conflict-free state resolution of CRDTs (Audit 0046) with the quantum-optical physics of Refractive Routing (Audit 0037). By mapping WebRTC peers to geometric vectors and treating ASTs as optical waves, we abstract IP addresses out of existence. Data no longer searches for destinations; it "bends" through the thermodynamic density of the network toward resonant starvation points.

## 2. Geometry Over IP (The Spatial WebRTC Matrix)
Nodes in OMEGA-64 are not defined by IP addresses. Upon establishing an active WebRTC data connection, the peer is mapped to a geometric angle (θ) on a 2D Euclidean plane or 3D Fullerene edge.
- **Port Masking**: A node supports `N` max peers (e.g., 4 or 6).
- **Angular Assignment**: Peer 0 is mapped to `θ = 0`, Peer 1 to `θ = π/2`, Peer 2 to `θ = π`, etc.
- **The Elimination of IP**: Once the handshake completes, the physical internet ceases to exist for the simulation. The Oracle only perceives phase vectors.

## 3. The Holographic CRDT
Unlike conventional databases, OMEGA-64 does not attempt to enforce 1:1 global consistency across all 10,000 nodes.
- **Merkle DAG Foundation**: Every pure logic matrix is intrinsically hashed (`FNV-1a`). The hash serves as the immutable DNA.
- **Conflict-Free Merge**: When a node receives a foreign plasmid:
  1. If the hash is already known (Merkle match), the node simply boosts the local `attention` of that plasmid (Constructive Interference).
  2. If the hash is novel, it is injected into the local `activePlasmids` pool to fight for survival in the somatic economy.
- **There are no write conflicts in pure mathematics.** Logic that evaluates to the same graph is structurally identical worldwide.

## 4. Refractive Routing (Snell's Law of Data)
Information (a plasmid wave) enters a Node from an incoming WebRTC channel at angle $θ_{in}$. The node must determine which outgoing channel(s) to seamlessly pass the wave to.

Instead of routing tables, OMEGA-64 uses Snell's Law from Optics:
$n_1 \cdot \sin(\theta_{in}) = n_2 \cdot \sin(\theta_{out})$

### 4.1. The Refractive Index ($n$)
The "optical density" ($n$) of a Node is directly bound to its thermodynamic state:
- **$n_1$ (Incoming Medium)**: Inferred from the frequency/entropy of the signal, or the network's known baseline.
- **$n_2$ (Local Node Density)**: Calculated from the Node's Local Entropy and average ATP density.
  - A mathematically stagnant, "cold" node (low entropy) has a low refractive index. The wave passes through it undisturbed (straight across the geometric matrix).
  - A highly chaotic, "hot" node (high entropy, high computing pressure) has a high refractive index. It severely warps the passing signal, bending $\theta_{out}$ away from the expected linear path.

### 4.2 Lensing the Network
Because data "bends" predictably through dense thermodynamic areas, specific resonant math will naturally aggregate around the computational anomalies that need it most (Gravitational Lensing for Logic).

## 5. Execution Summary
1. **Geometric Pinning**: Map all `[peerId]` strings to `number (Angle Theta)`.
2. **Wave Emission**: Nodes emit a payload `[Theta, Amplitude, Hash, AST]`.
3. **Refractive Gateway**: Intercept incoming WebRTC messages, calculate $n_{local}$, perform Snell's Law to find $\theta_{out}$, and re-emit via the `peerId` closest to $\theta_{out}$.
4. **Resonance Absorption**: Attempt to merge the incoming `AST` via the Holographic CRDT logic inside the `SovereignOracle`.

This permanently severs OMEGA-64 from the physical topology of the internet, operating on pure spatial mathematical acoustics.
