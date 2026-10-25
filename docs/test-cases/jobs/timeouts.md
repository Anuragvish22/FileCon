# Timeouts

Test entries read: `file`: "test name". Files are under `packages/*/test/`.

## Shared across all platforms

- [x] A small input keeps its base limit, so tests with short limits stay short. `timeout.test.ts`: "keeps the base for a small input, so tests with short limits stay short"
- [x] The limit grows with the input size. `timeout.test.ts`: "grows with the input size"
- [x] The limit stops at 30 minutes however big the input is. `timeout.test.ts`: "stops at 30 minutes however big the input is"
- [x] A base limit that is already above the ceiling is never lowered. `timeout.test.ts`: "never lowers a base that is already above the ceiling"
- [x] A step over its limit fails as `TIMEOUT`. `runner.test.ts`: "a step over its timeout is TIMEOUT"
- [x] A big input gets a longer limit, so a slow step that would have timed out still finishes. `runner.test.ts`: "a big input gets a longer limit, so a slow step that would have timed out still finishes"
- [x] A combiner that hangs is `TIMEOUT` after the default limit, and its temp folder is removed. `runner.test.ts`: "a combiner that hangs" › "is TIMEOUT after the default limit, and the temp dir is removed"
- [x] An engine that hangs at the job level ends as failed `TIMEOUT` with the engine named, no temp folder and no output. `failures.test.ts`: row "the engine hangs past its timeout"
- [x] A process that runs too long is stopped and reported as `TIMEOUT`. `spawn.test.ts`: "a timeout is TIMEOUT and the process is gone"
- [x] LibreOffice gets a longer limit for a bigger input. `libreoffice.test.ts`: "gives soffice a longer limit for a bigger input"
- [x] A LibreOffice timeout removes its profile and process, and the next job works. `libreoffice.test.ts`: "a timeout is TIMEOUT, removes the profile and the process, and the next job works"
- [x] A call from the window to core times out after 30 s and the late answer is dropped, except init, submit, cancel and shutdown, which never time out. `coreClient.test.ts`: "times out an ordinary call after 30 s, and drops the late answer" and "never times out init, submit, cancel or shutdown"
- [x] Core that does not become ready within 15 s is killed and restarted. `supervisor.test.ts`: "kills the host and restarts when ready does not come within 15 s"; "does not fire once ready arrived in time"
- [x] Core that does not answer shutdown within 5 s is killed. `supervisor.test.ts`: "kills the host when it does not answer within 5 s"
- [ ] A converter that ignores the signal (sharp) still ends at the limit
- [ ] A timeout in step 1 of 2 means step 2 never runs
- [ ] A timeout is not shown as a cancel, and a cancel is not shown as a timeout (in the UI)

## Windows-specific

- [x] The hung engine and its tree are killed on timeout (the `taskkill` branch). `spawn.test.ts`: "kills the tree with taskkill and an argument array, not a process group"

## Linux-specific

- [ ] A stopped (not killed) engine process is still ended at the limit

# Needs manual testing

## Shared across all platforms

- [ ] A real 4 GB file on a slow disk converts, or times out with a clear message and no leftovers
- [ ] The limit feels right for a normal photo, a 300-page document and a 1,800-page PDF on an old laptop

## Windows

- [ ] Slow disks and slow process start (antivirus scanning) do not trip a normal job

## Mac

- [ ] A first launch that is slow because of a security scan does not count against the limit
