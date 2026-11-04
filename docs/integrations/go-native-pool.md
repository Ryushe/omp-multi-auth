# OpenCode Go native key-pool integration dossier

- **Status:** feature
- **Owner:** Codex
- **Branch:** `codex/go-native-pool`
- **Base commit:** `ed309214604a0cdc200474fc5effb3b82260dc99`
- **Intended integration target:** `origin/main` in `Ryushe/omp-multi-auth`
- **Last updated:** 2026-11-03
- **Owning feature branch/ref:** `codex/go-native-pool`
- **Latest immutable recovery checkpoint:** none yet
- **Feature implementation commit(s):** none yet
- **Inspiration / canonical references:** OMP's native API-key pool and OpenCode Go's reported usage windows.

## Intent

Show separate usage snapshots for multiple enabled Go keys already stored under one OMP provider, without changing how OMP selects request credentials.

## Implemented contract

The limits list checks each distinct enabled saved key independently, gives it a unique selection identity, and does not claim that any particular key is currently active. The status line labels its pool summary as the best snapshot. Explicit runtime/config/environment overrides retain the existing single-key behavior, and project provider restrictions remain in effect.

## Evidence and review

- Tests and commands: `npm test`; isolated OMP host regression; live Hoster verification pending.
- Independent review: not performed.
- Replay/cohort/fixture evidence: fixtures cover differing quotas, invalid and disabled keys, selection identity, and runtime overrides.
- Merge/ancestry evidence: pending publication.

## Blockers and deferred work

- **Missing test or evidence:** live Hoster status-line verification for the two-key pool.
- **Command / fixture / environment needed:** user-authorized OMP process with the feature branch loaded and no model request.
- **Trigger to run it:** after publishing the temporary feature ref for the bounded test.
- **Why it blocks integration, activation, or promotion:** it verifies the real OMP auth-storage shape and user-visible status against live quota data.
- **Next completion step / successor reference:** finish the live check and publish the reviewed fix to the fork.

## Interruption / resume handoff

- **Owning feature branch/ref:** `codex/go-native-pool`
- **Latest immutable recovery checkpoint:** none yet
- **Feature implementation commit(s):** none yet
- **Exact resume point:** finish tests, checkpoint, and run the Hoster status-line check.
- **Working-tree state at handoff:** feature in progress.

## Decision gates

- **Integration gate:** tests pass and the live two-key status line is verified.
- **Activation / cohort gate:** user controls installation and saved credentials.
- **Promotion gate:** update only the requested fork.

## Decision record

- 2026-11-03 — created after a user-authorized Hoster test found two Go keys under one native provider.
