# Test cases

A plain checklist of what must hold, written before the tests. One bullet is one test. Nothing here runs: each bullet becomes a test (in `packages/*/test/`, mirroring `src/`) when its task comes up.

## How each file is laid out

```
# <Area>
## Shared across all platforms
## Windows-specific
## Linux-specific
## Mac-specific
```

- `- [ ]` is a case with no test yet. `- [x]` has one, written as the explanation, then the test file and the test's real name: `` `spawn.test.ts`: "a timeout is TIMEOUT and the process is gone" ``. Search the name with `grep -rn "<name>" packages test` to find it.
- A case says what is true, not how to test it: "an engine installed in a custom folder is found", not "mock `exec`".
- A bug that was found gets its case added here first, then its test (CLAUDE.md: a bug fix needs a test that fails before the fix).
- Known gaps point at their parked item, for example P58 in [PARKED](../PARKED.md).

## Automated and manual

The first sections of a file are cases that can become automated tests. The last block, `# Needs manual testing`, holds cases that cannot run in CI (real installs, real viewers, screen readers, other operating systems, "looks right by eye"). A person runs those before a release, and [manual/smoke](manual/smoke.md) is the shortest pass over them.

## Areas

| Folder | Files |
|---|---|
| `engines/` | [discovery](engines/discovery.md), [health](engines/health.md) |
| `jobs/` | [runner](jobs/runner.md), [spawn](jobs/spawn.md), [cancel-cleanup](jobs/cancel-cleanup.md), [timeouts](jobs/timeouts.md), [outputs](jobs/outputs.md), [concurrency](jobs/concurrency.md), [progress](jobs/progress.md) |
| `conversions/` | [detection](conversions/detection.md), [routing](conversions/routing.md), [images](conversions/images.md), [documents](conversions/documents.md), [pdf](conversions/pdf.md) |
| `core/` | [rpc-server](core/rpc-server.md), [errors-and-types](core/errors-and-types.md) |
| `safety/` | [source-files](safety/source-files.md), [untrusted-input](safety/untrusted-input.md) |
| `app/` | [main-ipc](app/main-ipc.md), [core-client](app/core-client.md), [supervisor](app/supervisor.md), [settings](app/settings.md), [renderer](app/renderer.md), [renderer-state](app/renderer-state.md), [renderer-screens](app/renderer-screens.md) |
| `repo/` | [tooling](repo/tooling.md) |
| `manual/` | [smoke](manual/smoke.md) |
