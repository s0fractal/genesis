class PhylogenyVault {
  private db: IDBDatabase | null = null;

  init() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("OmegaPhylogenyVault", 1);
      req.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains("lineage")) {
          // Use t (timestamp) as the chronological index
          db.createObjectStore("lineage", { keyPath: "hash" });
        }
      };
      req.onsuccess = (e) => {
        this.db = (e.target as IDBOpenDBRequest).result;
        resolve(true);
      };
      req.onerror = reject;
    });
  }

  getAll(): Promise<PhylogenyRecord[]> {
    if (!this.db) return Promise.resolve([]);
    return new Promise((resolve) => {
      const tx = this.db!.transaction("lineage", "readonly");
      const store = tx.objectStore("lineage");
      const req = store.getAll();
      req.onsuccess = () => {
        // Return sorted chronologically
        const res = (req.result as PhylogenyRecord[]).sort((a, b) => a.t - b.t);
        resolve(res);
      };
    });
  }

  putNode(node: PhylogenyRecord) {
    if (!this.db) return Promise.resolve(false);
    return new Promise((resolve) => {
      const tx = this.db!.transaction("lineage", "readwrite");
      const store = tx.objectStore("lineage");
      store.put(node); // Overwrites silently if hash already exists
      tx.oncomplete = () => resolve(true);
    });
  }
}

export class PhylogeneticCanvas {
  private container: HTMLElement;
  private vault: PhylogenyVault;

  constructor() {
    this.container = document.createElement("div");
    this.container.id = "phylogeny-ui";
    this.container.style.position = "absolute";
    this.container.style.bottom = "80px";
    this.container.style.left = "40px";
    this.container.style.color = "rgba(0, 255, 128, 0.8)";
    this.container.style.fontFamily = "monospace";
    this.container.style.fontSize = "12px";
    this.container.style.pointerEvents = "none";
    this.container.style.textShadow = "0 0 5px rgba(0, 255, 128, 0.5)";
    document.body.appendChild(this.container);

    this.vault = new PhylogenyVault();
    this.vault.init().then(() => this.tick(true)); // Initial render from local vault memory
  }

  async tick(_forceRender = false) {
    try {
      const res = await fetch("/lineage.jsonl", { cache: "no-store" });
      if (res.ok) {
        const text = await res.text();
        const lines = text.split("\n").filter((l) => l.trim().length > 0);
        const nodes: PhylogenyRecord[] = lines.map((l) => JSON.parse(l));

        // Push fresh network mutations into the local IndexedDB Vault
        for (const n of nodes) {
          await this.vault.putNode(n);
        }
      }
    } catch (_e) {
      // Server might be down or file entirely wiped, but we have the Vault!
    }

    // Always render exclusively from the pure local historical dataset
    const holisticMemory = await this.vault.getAll();
    if (holisticMemory.length > 0) {
      this.render(holisticMemory);
    }
  }

  private render(nodes: PhylogenyRecord[]) {
    const recent = nodes.slice(-12);
    let html =
      "<div style='border-bottom: 1px solid rgba(0,255,128,0.3); margin-bottom: 5px; padding-bottom: 2px;'><b>🧬 O-44 PHYLOGENETIC DAG (Tree of Life)</b></div>";
    for (const n of recent) {
      const p = n.parents.length > 0
        ? n.parents[0].substring(0, 8)
        : "GENESIS_";
      // Render a minimalistic tree vector
      html += `└─► [${p}] ─> <span style="color: #fff"><b>[${
        n.hash.substring(0, 8)
      }]</b></span> | ATP: ${n.energy} | STAB: ${
        Math.round(n.stability * 100)
      }%<br/>`;
    }
    this.container.innerHTML = html;
  }
}
