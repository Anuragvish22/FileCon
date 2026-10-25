# Timeouts

## Shared across all platforms

- [x] The limit grows with the input size and stops at 30 minutes (covered by: `packages/core/test/jobs/timeout.test.ts`)
- [ ] An engine that hangs is stopped at the limit, the job fails with `TIMEOUT`, and the temp folder is cleaned
- [ ] A converter that ignores the signal (sharp) still ends at the limit
- [ ] A timeout in step 1 of 2 means step 2 never runs
- [ ] A timeout is not shown as a cancel, and a cancel is not shown as a timeout
- [ ] A very large input is not killed too early by a short limit

## Windows-specific

- [ ] The hung engine and its children are killed on timeout

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
