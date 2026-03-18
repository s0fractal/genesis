OMEGA-64 | V2.5 Σ³ Semantic Schema (Sigma-Cubed)

Core Philosophy

Файл — це Tissue (Тканина). Система — це Self-Evolving Semantic Matter.
Кожен нейрон (Символ) — це автономний організм з історією та бюджетом.

Усе є PAIR: Input -> Expression -> Output + ΔState.

YAML Structure (The Σ³ Block)

Σ³:
  <SymbolID>: # Human-readable Alias (mutable)
    identity:
      hash: <sha256>          # Structural (io + expr + intent)
      context_hash: <sha256>  # Topological (deps + latent + fields)
      lineage_hash: <sha256>  # Historical (mutation_log + generation)

    essence:
      type: pure_fn | module | constant | substrate | observer | meta_fn
      level: 0..63
      substrate: wasm | rust | ts | as
    
    intent:
      primary: "Semantic goal"
      tags: [math, signal, etc]
      vector: [f32; 12]       # LSH embedding
    
    # Unified Interface
    io:
      in:  { port: type@field:name }
      out: { port: type@field:name }
      
    # Causality & Side Effects
    effects:
      writes: [field_name, ...]
      reads:  [field_name, ...]
      emits:  [SymbolID, ...] # Породження нових нейронів
      
    # Logic (SSoT)
    expr: "C-style math expression"
    implementation:
      rust: "..."
      ts:   "..."
    
    # Dynamics (Activation Physics)
    dynamics:
      time_model: { source: global_tick | local_clock, resolution: 1.0 }
      activation: { threshold: <expr>, decay: 0.95, noise: 0.01 }
    
    # Context (Weighted Graph Edges)
    latent:
      - { target: <id>, weight: 0.8, type: resonance | inhibition }

Migration Rules (The Step-by-Step)

Labels as Handlers: Під час міграції AliasID стає назвою функції.

Field Inference: Якщо функція читає ENERGY_OFFSET, компілятор автоматично додає в effects.reads поле energy.

Ghost History: Для першої ітерації lineage_hash встановлюється в null або хеш першого комміту.

Substrate Mapping: Всі чисті математичні функції маркуються як substrate: wasm, оркестратори — як substrate: ts.

Refined "I" Directives

Meaning over Name: Система оперує хешами, людина — аліасами.

Inhibition Support: Негативні ваги в latent дозволяють гасити сигнали (інгібіція).

Metabolic Tax: Кожна активація нейрона коштує energy пропорційно складності expr.
