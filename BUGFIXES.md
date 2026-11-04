# Known issues

- `tests/antigravity-payload-check.mjs`: the host test expects an older OMP system-prompt sentence. With OMP 18.13.3 the prompt wording differs, so the assertion fails even though the test reaches the payload capture. Update the fixture separately from the OpenCode Go integration.
- OpenCode Go `beam-free` on OMP 18.13.3: a live fallback with thinking off first sent `reasoning_effort: minimal` and received a 400 indicating unsupported reasoning; OMP retried with `low` and succeeded. Check the model catalog and transport compatibility to avoid the extra failed request.
