# OpenCode Go native key-pool integration dossier

- **Status:** feature
- **Owner:** Codex
- **Branch:** `codex/go-native-pool`
- **Base commit:** `ed309214604a0cdc200474fc5effb3b82260dc99`
- **Intended integration target:** `origin/main` in `Ryushe/omp-multi-auth`
- **Last updated:** 2026-11-03
- **Owning feature branch/ref:** `codex/go-native-pool`
- **Latest immutable recovery checkpoint:** `3aa552a648be50198d84a9d2770167f470e61de1`
- **Feature implementation commit(s):** `3aa552a648be50198d84a9d2770167f470e61de1`
- **Inspiration / canonical references:** OMP's native API-key pool and OpenCode Go's reported usage windows.

## Intent

Show separate usage snapshots for multiple enabled Go keys already stored under one OMP provider, without changing how OMP selects request credentials.

## Implemented contract

The limits list checks each distinct enabled saved key independently, gives it a unique selection identity, and does not claim that any particular key is currently active. The status line labels its pool summary as the best snapshot. Explicit runtime/config/environment overrides retain the existing single-key behavior, and project provider restrictions remain in effect.

## Evidence and review

- Tests and commands: `npm test` passed; the isolated OMP host regression passed; the live Hoster two-key status-line verification passed.
- Independent review: not performed.
- Replay/cohort/fixture evidence: fixtures cover differing quotas, invalid and disabled keys, selection identity, and runtime overrides. A user-authorized Hoster check verified two independent live quota snapshots and the pool status line.
- Merge/ancestry evidence: based on fork `main` at `ed309214604a0cdc200474fc5effb3b82260dc99`; pending publication.

## Blockers and deferred work

- **Missing test or evidence:** none required for this bounded change.
- **Command / fixture / environment needed:** not applicable.
- **Trigger to run it:** not applicable.
- **Why it blocks integration, activation, or promotion:** not applicable.
- **Next completion step / successor reference:** publish the reviewed fix to the fork.

## Interruption / resume handoff

- **Owning feature branch/ref:** `codex/go-native-pool`
- **Latest immutable recovery checkpoint:** `3aa552a648be50198d84a9d2770167f470e61de1`
- **Feature implementation commit(s):** `3aa552a648be50198d84a9d2770167f470e61de1`
- **Exact resume point:** publish the verified feature to the fork.
- **Working-tree state at handoff:** the checkpoint contains the implementation and tests; this dossier-only update follows it.

## Decision gates

- **Integration gate:** tests pass and the live two-key status line is verified.
- **Activation / cohort gate:** user controls installation and saved credentials.
- **Promotion gate:** update only the requested fork.

## Decision record

- 2026-11-03 — created after a user-authorized Hoster test found two Go keys under one native provider.
- 2026-11-03 — isolated tests and the live two-key Hoster status-line check passed; publish to the fork.
