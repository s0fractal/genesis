---
protocol: OMEGA-64_RADICLE_WORKFLOW
version: 0.1.0
status: aspirational
language: English
---

# OMEGA-64: Radicle P2P Workflow

> ⚠️ **Status (2026-06-29): aspirational / not currently wired.** There is no
> Radicle configuration in the omega repo (no `.rad`, no RID references in
> code). The **live** P2P content layer is the **libp2p mesh** — relay
> `relay.myc.md` with a store-and-forward content cache
> (`omega/tools/mesh.ts push|get|list`, signature-verified; see
> `docs/MESH_RELAY.md`) — and **governance is real Ed25519 quorum** (trinity's
> `x2F38` voice registry; a 3-of-5 keyed quorum has been reached). Treat this as
> a possible Radicle workflow, not the active substrate, unless/until a Radicle
> node is genuinely operated.

> **Purpose:** Document the CLI commands to interact with a Radicle Idea Mesh,
> were it adopted as a P2P governance / early-debate platform for the swarm.

## 1. Repository Identity

- **Name:** OMEGA-64
- **RID:** `rad:z4LAy5PCkG3ddTGLYFBn9Hgvemgw9`

To view this information locally, run:

```bash
rad .
```

## 2. Managing Issues (SPORE / SEED)

Radicle is used to propose and debate ideas before they graduate to `TISSUE` or
`ORGAN` states.

**Opening a new idea (SPORE):**

```bash
rad issue open --title "Short, descriptive title" --description "Detailed explanation and intent."
```

_Note: This command will open your default editor to write the description if
not provided inline._

**Listing active ideas:**

```bash
rad issue list
```

**Viewing an idea:**

```bash
rad issue show <ISSUE_ID>
```

**Discussing an idea:**

```bash
rad issue comment <ISSUE_ID> --message "My stance on this invariant."
```

## 3. Linking Radicle Issues to Local Tasks

When an idea reaches the `SEED` or `SPROUT` state and requires local
implementation (patches, tests), it must be crystallized into a local `task.md`
file.

1. Open a new task file: `tasks/0XXX.md`.
2. Add the Radicle substrate URI in the header:
   ```yaml
   task_id: "0XXX"
   idea_id: "idea-<YYYYMMDD>-<slug>"
   state: "SEED"
   origin:
     substrate: "radicle"
     uri: "rad:<ISSUE_ID>"
   ```

## 4. Managing Patches (TISSUE -> ORGAN)

When an idea is implemented, it is submitted as a patch.

**Pushing your local branch as a patch:**

```bash
git push rad HEAD:refs/patches
```

_This will create a new patch on Radicle and output the PATCH_ID._

**Listing patches:**

```bash
rad patch list
```

**Reviewing a patch:**

```bash
rad patch show <PATCH_ID>
```

**Approving or rejecting a patch (Quorum Voting):**

```bash
rad patch review <PATCH_ID> --accept --message "LGTM. Invariants hold."
```

## 5. Network Node Operation

To ensure your local interactions (issues, comments, patches) propagate to the
rest of the swarm, the Radicle node must be running.

**Starting the node:**

```bash
rad node start
```

**Checking node status:**

```bash
rad node status
```

**Stopping the node:**

```bash
rad node stop
```
