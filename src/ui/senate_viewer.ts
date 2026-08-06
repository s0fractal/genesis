import { PhiClient } from "../sdk/phi_client.ts";
import { senateAcceptance } from "../network/senate_acceptance.ts";

const SIGNALING_URL = "wss://omega-federation.deno.dev";

interface PlasmidPayload {
  semanticType: string;
  proposalHash?: number;
  proposalDescription?: string;
  voteAye?: boolean;
  oracleName?: string;
  oracleReasoning?: string;
}

interface SenateProposalRecord {
  hash: number;
  description: string;
  oracleAyes: Set<string>;
  oracleNays: Set<string>;
  oracleReasoning: Record<string, { aye: boolean; text: string }>;
  accepted: boolean;
}

class SenateViewer {
  private client: PhiClient;
  private proposals: Map<number, SenateProposalRecord> = new Map();
  private container: HTMLElement;

  constructor() {
    this.container = document.getElementById("debate-container") as HTMLElement;
    this.client = new PhiClient();

    // Listen to plasmids via PhiClient
    this.client.onFrame("plasmid", (type, payload: PlasmidPayload) => {
      this.handlePlasmid(payload);
    });

    this.connect();
  }

  private async connect() {
    await this.client.connect(SIGNALING_URL, "senate-viewer-passive");
    console.log("[SenateViewer] Connected to passive mesh via PhiClient.");
  }

  private handlePlasmid(p: PlasmidPayload) {
    if (
      p.semanticType === "PROPOSAL" && p.proposalHash && p.proposalDescription
    ) {
      if (!this.proposals.has(p.proposalHash)) {
        this.proposals.set(p.proposalHash, {
          hash: p.proposalHash,
          description: p.proposalDescription,
          oracleAyes: new Set(),
          oracleNays: new Set(),
          oracleReasoning: {},
          accepted: false,
        });
        this.render();
      }
    }

    if (p.semanticType === "VOTE" && p.proposalHash && p.oracleName) {
      const prop = this.proposals.get(p.proposalHash);
      if (prop) {
        if (p.voteAye) prop.oracleAyes.add(p.oracleName);
        else prop.oracleNays.add(p.oracleName);

        if (p.oracleReasoning) {
          prop.oracleReasoning[p.oracleName] = {
            aye: p.voteAye || false,
            text: p.oracleReasoning,
          };
        }

        // The viewer must render the SAME rule the mesh enforces. It used to
        // carry its own copy — `oracleAyes.size >= 3` with no majority
        // condition — so a proposal with 3 AYE and 5 NAY oracles displayed as
        // ACCEPTED while the mesh rejected it. An operator's window onto
        // governance that disagrees with governance is worse than no window.
        prop.accepted = senateAcceptance(prop).accepted;

        this.render();
      }
    }
  }

  private render() {
    if (this.proposals.size === 0) {
      this.container.innerHTML =
        `<div class="empty-state">Listening for OMEGA-64 network packets... (Awaiting Senate Plasmids)</div>`;
      return;
    }

    this.container.innerHTML = "";

    const sortedProposals = Array.from(this.proposals.values()).reverse(); // Newest first

    for (const prop of sortedProposals) {
      const totalVotes = prop.oracleAyes.size + prop.oracleNays.size;
      const statusClass = prop.accepted ? "status-ratified" : "status-pending";
      const statusText = prop.accepted ? "Ratified" : "Debating";

      const card = document.createElement("div");
      card.className = "proposal-card";

      let votesHtml = "";
      for (const [oracle, vote] of Object.entries(prop.oracleReasoning)) {
        const voteClass = vote.aye ? "aye" : "nay";
        const voteText = vote.aye ? "AYE" : "NAY";
        votesHtml += `
                    <div class="vote-item ${voteClass}">
                        <div class="vote-header">
                            <span class="oracle-name">${oracle.toUpperCase()}</span>
                            <span class="vote-decision ${voteClass}">VOTED ${voteText}</span>
                        </div>
                        <p class="vote-reasoning">${vote.text}</p>
                    </div>
                `;
      }

      card.innerHTML = `
                <div class="proposal-header">
                    <div>
                        <h3 class="proposal-title">${prop.description}</h3>
                        <span class="proposal-meta">Hash: 0x${
        prop.hash.toString(16).toUpperCase()
      } • Votes: ${totalVotes}</span>
                    </div>
                    <span class="status-badge ${statusClass}">${statusText}</span>
                </div>
                <div class="votes-list">
                    ${
        votesHtml ||
        '<span style="color:var(--text-dim);font-size:0.9rem;font-style:italic">Awaiting Oracles...</span>'
      }
                </div>
            `;

      this.container.appendChild(card);
    }
  }

  // For manual testing, you can inject a mock plasmid
  public injectMock(p: PlasmidPayload) {
    this.handlePlasmid(p);
  }
}

// Initialize on DOM load
document.addEventListener("DOMContentLoaded", () => {
  (window as any).senateViewer = new SenateViewer();
});
