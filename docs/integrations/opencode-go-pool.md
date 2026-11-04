# OpenCode Go credential-pool integration dossier

- **Status:** feature
- **Owner:** Codex
- **Branch:** `codex/opencode-go-pool`
- **Base commit:** `3d8f2bd7b4a17f178a0f4239ce68ad4a686d650b`
- **Intended integration target:** `origin/main` in `Ryushe/omp-multi-auth`
- **Last updated:** 2026-11-03
- **Owning feature branch/ref:** `codex/opencode-go-pool`
- **Latest immutable recovery checkpoint:** none yet
- **Feature implementation commit(s):** none yet
- **Inspiration / canonical references:** OMP's stored API-key pool and OpenCode Go's usage endpoint.

## Intent

Keep Go quota checks useful when a native OMP provider has multiple saved keys and its selected stored key has been rejected.

## Implemented contract

After a selected stored API key receives HTTP 401, the checker tries other enabled keys saved under the same provider, subject to its existing timeout. A successful alternate is explicitly marked; the checker does not change OMP's request credential. Explicit runtime/config/environment overrides and non-401 responses do not trigger this fallback.

## Evidence and review

- Tests and commands: `npm test` passed; the isolated OMP 18.13.3 host suite passed 11 of 12 tests. The unrelated existing Antigravity prompt assertion fails as documented in `BUGFIXES.md`.
- Independent review: not performed.
- Replay/cohort/fixture evidence: mocked rejected, disabled, working, overridden, forbidden, and all-rejected keys; a live user-authorized Go usage check, status-line check, and zero-cost model request.
- Merge/ancestry evidence: pending publication.

## Blockers and deferred work

- **Missing test or evidence:** none required for this bounded fix.
- **Command / fixture / environment needed:** not applicable.
- **Trigger to run it:** not applicable.
- **Why it blocks integration, activation, or promotion:** not applicable.
- **Next completion step / successor reference:** publish the fix to the requested fork.

## Interruption / resume handoff

- **Owning feature branch/ref:** `codex/opencode-go-pool`
- **Latest immutable recovery checkpoint:** none yet
- **Feature implementation commit(s):** none yet
- **Exact resume point:** review the staged diff, commit, and publish the fork.
- **Working-tree state at handoff:** fix in progress.

## Decision gates

- **Integration gate:** unit and isolated host checks pass; live behavior verified without printing credentials.
- **Activation / cohort gate:** the user controls installation and stored credentials.
- **Promotion gate:** update only the requested fork.

## Decision record

- 2026-11-03 — created after a live Go authentication check exposed a rejected-first-key case.
