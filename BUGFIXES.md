# Known issues

- `tests/antigravity-payload-check.mjs`: the host test expects an older OMP system-prompt sentence. With OMP 18.13.3 the prompt wording differs, so the assertion fails even though the test reaches the payload capture. Update the fixture separately from the OpenCode Go integration.
