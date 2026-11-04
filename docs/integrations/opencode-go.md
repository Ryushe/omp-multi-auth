# OpenCode Go integration dossier

- **Status:** feature
- **Owner:** Codex
- **Branch:** `codex/opencode-go`
- **Base commit:** `421613937c01efcc7bb3b256d4efe57e004f9347`
- **Intended integration target:** `origin/main` in `Ryushe/omp-multi-auth`
- **Last updated:** 2026-11-03
- **Owning feature branch/ref:** `codex/opencode-go`
- **Latest immutable recovery checkpoint:** none yet
- **Feature implementation commit(s):** none yet
- **Inspiration / canonical references:** OpenCode Go documentation and Oh My Pi's OpenCode Go usage implementation.

## Intent

Add independently stored Go API-key accounts and accurate included-usage visibility while preserving OMP's model-specific transport and account identity.

## Implemented contract

The extension clones the bundled Go catalog, forwards each model through its canonical OMP transport, and polls the provider's five-hour, weekly, and monthly usage windows using each account's active key. A depleted included allowance does not prove that billing-backed Extra Usage is disabled. Quota snapshots do not themselves cause an account switch; configured OMP fallbacks can react to provider errors.

## Evidence and review

- Tests and commands: `npm test` passed (6 non-host suites); `node tests/run-all.mjs --host` against OMP 18.13.3 with isolated settings and dummy keys passed 11 of 12 suites. The existing Antigravity payload test fails against newer OMP prompt wording, as recorded in `BUGFIXES.md`.
- Independent review: not performed.
- Replay/cohort/fixture evidence: mocked usage and transport tests, including a real OMP host switching to account 3 after account 2 receives a mocked 429; no real account or inference request.
- Merge/ancestry evidence: pending.

## Blockers and deferred work

- **Missing test or evidence:** live OpenCode Go account usage and inference.
- **Command / fixture / environment needed:** a user-operated OMP session with a valid Go key.
- **Trigger to run it:** after installation when the user chooses to authenticate.
- **Why it blocks integration, activation, or promotion:** it limits live-service claims; publishing the fork remains possible with this limitation disclosed.
- **Next completion step / successor reference:** user verifies `/multi-auth limits` and sends a normal Go request.

## Interruption / resume handoff

- **Owning feature branch/ref:** `codex/opencode-go`
- **Latest immutable recovery checkpoint:** none yet
- **Feature implementation commit(s):** none yet
- **Exact resume point:** review the final staged diff and publish the fork; the unrelated Antigravity fixture remains deferred.
- **Working-tree state at handoff:** feature changes in progress.

## Decision gates

- **Integration gate:** focused Go tests pass; review the final diff and disclose the unrelated host-test failure.
- **Activation / cohort gate:** user controls installation and account login.
- **Promotion gate:** update only the requested fork.

## Decision record

- 2026-11-03 — created for OpenCode Go support.
