import { walk } from "jsr:@std/fs/walk";

interface ListenerConfig {
  identity: string;
  cli_command: string;
  listen_rx: string[];
}

const LISTENERS: ListenerConfig[] = [];
const PROCESSED_FILES = new Set<string>();

async function loadListeners() {
  try {
    for await (const entry of walk("tasks/jazz/listeners", { exts: [".yaml", ".yml"] })) {
      const content = await Deno.readTextFile(entry.path);
      const identityMatch = content.match(/identity:\s*"([^"]+)"/);
      const cliCommandMatch = content.match(/cli_command:\s*'([^']+)'/);
      const listenRxMatch = content.match(/listen_rx:\n((?:\s+-\s+"[^"]+"\n?)+)/);
      
      if (identityMatch && cliCommandMatch && listenRxMatch) {
        const listen_rx = listenRxMatch[1]
          .split("\n")
          .map(line => line.trim().replace(/^-\s+"([^"]+)"$/, "$1"))
          .filter(Boolean);
        
        LISTENERS.push({
          identity: identityMatch[1],
          cli_command: cliCommandMatch[1],
          listen_rx,
        });
        console.log(`[JAZZ] Loaded listener: ${identityMatch[1]} (${listen_rx.join(", ")})`);
      }
    }
  } catch (e) {
    console.warn("[JAZZ] No listeners found or error parsing.", e);
  }
}

function parseChord(content: string) {
  const match = content.match(/---\n([\s\S]+?)\n---/);
  if (!match) return null;
  
  const frontmatter = match[1];
  const primaryMatch = frontmatter.match(/primary:\s*"([^"]+)"/);
  const energyMatch = frontmatter.match(/energy:\s*([\d.]+)/);
  
  if (primaryMatch && energyMatch) {
    return {
      primary: primaryMatch[1],
      energy: parseFloat(energyMatch[1]),
    };
  }
  return null;
}

function matchesRx(primary: string, rxList: string[]) {
  for (const rx of rxList) {
    if (rx.endsWith(".*")) {
      const prefix = rx.slice(0, -2);
      if (primary.startsWith(prefix)) return true;
    } else if (primary === rx) {
      return true;
    }
  }
  return false;
}

async function processFile(path: string) {
  if (PROCESSED_FILES.has(path)) return;
  
  try {
    const content = await Deno.readTextFile(path);
    const chord = parseChord(content);
    if (!chord) return;
    
    PROCESSED_FILES.add(path);
    console.log(`\n🎷 [JAZZ] Detected chord: ${chord.primary} | Energy: ${chord.energy} in ${path}`);
    
    if (chord.energy < 0.1) {
      console.log(`[JAZZ] 🔇 Energy ${chord.energy} is below Thermal Noise limit (0.1). Rest.`);
      return;
    }

    for (const listener of LISTENERS) {
      if (matchesRx(chord.primary, listener.listen_rx)) {
        console.log(`[JAZZ] 🎛️ Routing to ${listener.identity}`);
        const commandStr = listener.cli_command.replace("{FILE}", path);
        console.log(`[JAZZ] 🚀 Executing: ${commandStr}`);
        
        // Split command and arguments safely
        const argsMatch = commandStr.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g);
        if (argsMatch) {
          const cmd = argsMatch[0];
          const args = argsMatch.slice(1).map(arg => {
            // Remove surrounding quotes if present
            if ((arg.startsWith('"') && arg.endsWith('"')) || (arg.startsWith("'") && arg.endsWith("'"))) {
              return arg.slice(1, -1);
            }
            return arg;
          });

          // Run asynchronously so we don't block the daemon
          const process = new Deno.Command(cmd, {
            args,
            stdout: "inherit",
            stderr: "inherit",
          }).spawn();
          
          process.status.then((status) => {
             console.log(`[JAZZ] 🏁 ${listener.identity} finished with code ${status.code}`);
          });
        }
      }
    }
  } catch (e) {
    // File might be deleted or locked, ignore
  }
}

async function runDaemon() {
  await loadListeners();
  console.log("%c🌌 OMEGA-64 Jazz Daemon Started...", "color: magenta; font-weight: bold");
  
  const dirs = ["tasks/jazz/events", "tasks/jazz/responses"];
  
  // Pre-process existing files to avoid re-triggering on startup
  for (const dir of dirs) {
    try {
      for await (const entry of walk(dir, { exts: [".md"] })) {
        PROCESSED_FILES.add(entry.path);
      }
    } catch(e) {}
  }
  
  const watcher = Deno.watchFs(dirs);
  
  let debounceTimer: number | null = null;
  const pendingFiles = new Set<string>();

  for await (const event of watcher) {
    if (event.kind === "create" || event.kind === "modify") {
      for (const path of event.paths) {
        if (path.endsWith(".md")) {
          pendingFiles.add(path);
        }
      }
      
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        for (const path of pendingFiles) {
          processFile(path);
        }
        pendingFiles.clear();
      }, 500); // 500ms debounce
    }
  }
}

runDaemon();
