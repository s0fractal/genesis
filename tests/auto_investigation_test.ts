// Era 1210: Auto-Investigation Proposals tests.
import { assertEquals, assert } from "jsr:@std/assert";
import {
    AutoInvestigator,
    buildInvestigationReason,
    relayIdFromName,
    shouldDropFrameFromOrigin,
} from "../src/network/auto_investigation.ts";
import { PartitionAlarm } from "../src/network/peer_snapshot_monitor.ts";
import { computeProposalHash } from "../src/network/warrant_issuance.ts";
import { ACTION_RELOCATE } from "../src/network/codeicide_law.ts";

const NOW = 100_000;

function alarm(
    relay_id: number,
    diff_q16 = 10_000,
    observed_at_ms = NOW,
): PartitionAlarm {
    return {
        relay_id: relay_id >>> 0,
        self_rate_q16: 39322,
        peer_rate_q16: 39322 - diff_q16,
        diff_q16,
        diff_percent: ((diff_q16 / 65536) * 100).toFixed(2) + "%",
        observed_at_ms,
    };
}

Deno.test("investigator: raises proposal from alarm", () => {
    const inv = new AutoInvestigator();
    const rec = inv.raiseFromAlarm(alarm(0xAAAA));
    assert(rec !== null);
    assertEquals(rec!.target_relay_id, 0xAAAA);
    assertEquals(rec!.status, "open");
    assert(rec!.proposal_hash !== 0);
});

Deno.test("investigator: proposal hash is deterministic for same alarm", () => {
    const inv = new AutoInvestigator();
    const a = alarm(0xCAFE_BABE >>> 0);
    const rec = inv.raiseFromAlarm(a);
    assert(rec !== null);
    const reason = buildInvestigationReason(a);
    const expected = computeProposalHash(a.relay_id, ACTION_RELOCATE, reason);
    assertEquals(rec!.proposal_hash, expected);
});

Deno.test("investigator: cooldown blocks duplicate raise", () => {
    const inv = new AutoInvestigator({ cooldown_ms: 60_000 });
    const a = alarm(0xAAAA, 10_000, NOW);
    const r1 = inv.raiseFromAlarm(a);
    assert(r1 !== null);
    // Second alarm 30s later — within cooldown, blocked.
    const a2 = alarm(0xAAAA, 12_000, NOW + 30_000);
    assertEquals(inv.raiseFromAlarm(a2), null);
});

Deno.test("investigator: cooldown elapses → second raise allowed", () => {
    const inv = new AutoInvestigator({ cooldown_ms: 60_000 });
    inv.raiseFromAlarm(alarm(0xAAAA, 10_000, NOW));
    const r2 = inv.raiseFromAlarm(alarm(0xAAAA, 12_000, NOW + 70_000));
    assert(r2 !== null);
});

Deno.test("investigator: different targets don't share cooldown", () => {
    const inv = new AutoInvestigator({ cooldown_ms: 60_000 });
    const r1 = inv.raiseFromAlarm(alarm(0xAAAA, 10_000, NOW));
    const r2 = inv.raiseFromAlarm(alarm(0xBBBB, 10_000, NOW + 1_000));
    assert(r1 !== null && r2 !== null);
    assert(r1!.proposal_hash !== r2!.proposal_hash);
});

Deno.test("investigator: markWarranted quarantines the target", () => {
    const inv = new AutoInvestigator();
    const rec = inv.raiseFromAlarm(alarm(0xAAAA))!;
    assertEquals(inv.isQuarantined(0xAAAA), false);
    inv.markWarranted(rec.proposal_hash);
    assertEquals(inv.isQuarantined(0xAAAA), true);
    assertEquals(rec.status, "warranted");
});

Deno.test("investigator: markCleared removes quarantine", () => {
    const inv = new AutoInvestigator();
    const rec = inv.raiseFromAlarm(alarm(0xAAAA))!;
    inv.markWarranted(rec.proposal_hash);
    inv.markCleared(rec.proposal_hash);
    assertEquals(inv.isQuarantined(0xAAAA), false);
    assertEquals(rec.status, "cleared");
});

Deno.test("investigator: callbacks fire", () => {
    let raised = 0, warranted = 0;
    const inv = new AutoInvestigator({
        on_proposal_raised: () => { raised++; },
        on_warrant_issued: () => { warranted++; },
    });
    const rec = inv.raiseFromAlarm(alarm(0xAAAA))!;
    assertEquals(raised, 1);
    inv.markWarranted(rec.proposal_hash);
    assertEquals(warranted, 1);
});

Deno.test("investigator: sweepStale auto-clears old open investigations", () => {
    const inv = new AutoInvestigator({ open_window_ms: 5 * 60_000 });
    inv.raiseFromAlarm(alarm(0xAAAA, 10_000, NOW));
    // 6 minutes later — past open window.
    const cleared = inv.sweepStale(NOW + 6 * 60_000);
    assertEquals(cleared, 1);
    assertEquals(inv.listByStatus("cleared").length, 1);
});

Deno.test("investigator: sweepStale doesn't touch warranted records", () => {
    const inv = new AutoInvestigator({ open_window_ms: 5 * 60_000 });
    const rec = inv.raiseFromAlarm(alarm(0xAAAA, 10_000, NOW))!;
    inv.markWarranted(rec.proposal_hash);
    const cleared = inv.sweepStale(NOW + 6 * 60_000);
    assertEquals(cleared, 0);
    assertEquals(inv.isQuarantined(0xAAAA), true);
});

Deno.test("investigator: shouldDropFrameFromOrigin honors quarantine", () => {
    const inv = new AutoInvestigator();
    assertEquals(shouldDropFrameFromOrigin(inv, 0xAAAA), false);
    const rec = inv.raiseFromAlarm(alarm(0xAAAA))!;
    inv.markWarranted(rec.proposal_hash);
    assertEquals(shouldDropFrameFromOrigin(inv, 0xAAAA), true);
    // Other relays unaffected.
    assertEquals(shouldDropFrameFromOrigin(inv, 0xBBBB), false);
});

Deno.test("investigator: list sorts newest-first", () => {
    const inv = new AutoInvestigator({ cooldown_ms: 0 });
    inv.raiseFromAlarm(alarm(0x1, 10_000, NOW));
    inv.raiseFromAlarm(alarm(0x2, 10_000, NOW + 100));
    inv.raiseFromAlarm(alarm(0x3, 10_000, NOW + 200));
    const list = inv.list();
    assertEquals(list[0].target_relay_id, 0x3);
    assertEquals(list[2].target_relay_id, 0x1);
});

Deno.test("investigator: listByStatus filters correctly", () => {
    const inv = new AutoInvestigator({ cooldown_ms: 0 });
    const r1 = inv.raiseFromAlarm(alarm(0x1, 10_000, NOW))!;
    const r2 = inv.raiseFromAlarm(alarm(0x2, 10_000, NOW + 100))!;
    inv.raiseFromAlarm(alarm(0x3, 10_000, NOW + 200));
    inv.markWarranted(r1.proposal_hash);
    inv.markCleared(r2.proposal_hash);
    assertEquals(inv.listByStatus("warranted").length, 1);
    assertEquals(inv.listByStatus("cleared").length, 1);
    assertEquals(inv.listByStatus("open").length, 1);
});

Deno.test("investigator: quarantinedRelays returns sorted IDs", () => {
    const inv = new AutoInvestigator({ cooldown_ms: 0 });
    for (const id of [0x300, 0x100, 0x200]) {
        const rec = inv.raiseFromAlarm(alarm(id, 10_000, NOW))!;
        inv.markWarranted(rec.proposal_hash);
    }
    assertEquals(inv.quarantinedRelays(), [0x100, 0x200, 0x300]);
});

Deno.test("investigator: clear empties everything", () => {
    const inv = new AutoInvestigator();
    const rec = inv.raiseFromAlarm(alarm(0xAAAA))!;
    inv.markWarranted(rec.proposal_hash);
    inv.clear();
    assertEquals(inv.list().length, 0);
    assertEquals(inv.quarantinedRelays(), []);
});

Deno.test("investigator: relayIdFromName is deterministic", () => {
    assertEquals(relayIdFromName("relay-1"), relayIdFromName("relay-1"));
    assert(relayIdFromName("relay-1") !== relayIdFromName("relay-2"));
});

Deno.test("investigator: buildInvestigationReason is reproducible", () => {
    const a1 = alarm(0xCAFE >>> 0, 12345, NOW);
    const a2 = alarm(0xCAFE >>> 0, 12345, NOW); // identical
    assertEquals(buildInvestigationReason(a1), buildInvestigationReason(a2));
});

Deno.test("investigator: marking unknown hash is a no-op", () => {
    const inv = new AutoInvestigator();
    inv.markWarranted(0xDEAD_BEEF);
    inv.markCleared(0xDEAD_BEEF);
    // No errors; no quarantine.
    assertEquals(inv.quarantinedRelays(), []);
});
