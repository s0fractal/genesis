/**
 * OMEGA-64 Shared Configuration
 * Provides an isomorphic mechanism to determine the current execution environment.
 */

export function isProduction(): boolean {
    // 1. Check for explicitly injected browser global
    if (typeof globalThis !== "undefined" && (globalThis as any).__OMEGA_PROD__) {
        return true;
    }
    
    // 2. Check for Deno environment variables (Server/CLI)
    try {
        // @ts-ignore: Deno namespace is conditionally present
        if (typeof Deno !== "undefined" && Deno.env.get("OMEGA_ENV") === "production") {
            return true;
        }
    } catch { /* Ignore permissions/absence errors */ }
    
    // 3. Check for Vite injected environment variables (Browser Build)
    try {
        // @ts-ignore: import.meta.env is conditionally present via Vite
        if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.MODE === "production") {
            return true;
        }
    } catch { /* Ignore absence errors */ }
    
    return false;
}
