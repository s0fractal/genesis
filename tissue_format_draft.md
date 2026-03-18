# Ontology 6.0: Visual Semantics / The Spatio-Logical Graph

If we elevate the geometry to be the *actual source of truth* (rather than just UI over a JSON payload), `I.md` evolves into an infinite, pan-and-zoom 2D spatial canvas (`<svg>`). 

The AI and the human look at the *exact same visual properties* to understand the system.

## The Semantic Mapping (Draft 1)

Every geometric attribute in the SVG directly translates to a Sigma3 property:

### 1. Shape = Node Type (Essence)
- **Circle (`<circle>`)**: `pure_fn` (Mathematical, stateless, symmetric, pure).
- **Square/Rectangle (`<rect>`)**: `meta_fn` або `module` (Stateful, side-effects, container, blocky and mutable).
- **Triangle (`<polygon>`)**: `data` / Constants (Immutable definitions pointing in one direction).

### 2. Color (Fill/Stroke) = Substrate & Purity
- **Blue tones (Fill)**: TypeScript (`substrate: ts`).
- **Rust/Orange tones (Fill)**: Rust/WASM (`substrate: rust`).
- **Stroke (Border)**: If stroke is dashed `stroke-dasharray`, the node is marked as "dirty" or "mutating". If solid, it is stable.

### 3. Size (Radius or Width) = Complexity / Energy
- The geometric area of the shape represents `physics.energy_cost` or the AST complexity.
- A massive circle means a computationally heavy pure function. A tiny dot is a fast inline helper (`fast_abs`).

### 4. Lines (Edges) = IO (Data Flow)
Paths (`<path>` or `<line>`) physically connect nodes.
- **Direction**: From `<source>` to `<target>`.
- **Line Thickness (`stroke-width`)**: Data bandwidth (i32 vs complex JSON objects).
- **Line Color**: Matches the data type field. Math links are green, biological links are red, etc.

### 5. Position (x, y) = The Latent Space (Topology)
- Nodes aren't just listed downwards. They have absolute `(x, y)` coordinates.
- Nodes that interact tightly are clustered together. If the AI refactors the code to decouple a module, it physically moves the `<rect>` farther away on the canvas!
- **Distance == Coupling**.

### 6. The Code Itself (AST)
If we remove JSON, how do we encode `expr`?
- **Nested SVG Elements (The Fractal)**: An AST is just a tree.
- Inside a big `<circle>` (`fast_abs`), you have two smaller geometries: a `<text>` node (variable `v`) and a `<rect>` node (constant `16`), connected by an internal multiplication edge.
- The Node **IS** the AST. Zooming into the SVG reveals the math!

## Example: A fully visual `fast_abs` (No JSON required)

```xml
<svg viewBox="0 0 1000 1000">
  <!-- The Tissue Canvas -->
  
  <!-- A Pure TS Function (Blue Circle), Cost 3 (radius 30) -->
  <g id="fast_abs" transform="translate(500, 500)" data-hash="dd0c9438...">
    <circle r="30" fill="#4a90e2" stroke="#fff" stroke-width="2" />
    <text y="-40" text-anchor="middle" fill="#fff">fast_abs</text>

    <!-- The Internal AST (Zoom level 2) -->
    <!-- Op: mul (represented by a central '*' text or shape) -->
    <text y="5" text-anchor="middle" font-weight="bold" fill="#fff">*</text>
    
    <!-- Inputs arriving into the circle -->
    <!-- Variable 'v' -->
    <path d="M -100 0 L -30 0" stroke="#a5d6ff" stroke-width="2" marker-end="url(#arrow)" />
    <text x="-120" y="5" fill="#a5d6ff">in: v (i32)</text>
    
    <!-- Constant '16' embedded in the geometry -->
    <rect x="-10" y="15" width="20" height="15" fill="#333" />
    <text x="0" y="26" text-anchor="middle" fill="#fff" font-size="10">16</text>
    
    <!-- Output leaving the circle -->
    <path d="M 30 0 L 100 0" stroke="#4caf50" stroke-width="2" marker-end="url(#arrow)" />
    <text x="120" y="5" fill="#4caf50">out: i32</text>
  </g>

</svg>
```

In this paradigm, `quine.ts` parses the DOM tree. If it sees a `<circle>`, it instantiates a `pure_fn`. If it sees an incoming path from `v` and a `<rect>` containing `16` pointing to a `*`, it builds the multiplication AST branch. 
The Code is the Picture. The Picture is the Code.
