# Job runner: the life of a job

Test entries read: `file`: "test name". Files are under `packages/*/test/`.

## Shared across all platforms

- [x] Happy path: one file goes queued, running, done; the outputs are committed and the temp folder is gone. `runner.test.ts`: "converts one file: queued, running, done, outputs committed, temp dir gone"
- [x] A fan-out step (a PDF into pages) feeds the next step one file at a time, in page order. `runner.test.ts`: "a fan-out step feeds the next step one file at a time, in page order"
- [x] A merge sends parts to the combiner in input order, and a PDF input is used as it is. `runner.test.ts`: "merge: parts reach the combiner in input order, a pdf input is used as it is"
- [x] A missing input is `INPUT_NOT_FOUND`. `runner.test.ts`: "a missing input is INPUT_NOT_FOUND"; `failures.test.ts`: row "the input was deleted after it was detected"
- [x] An input made unreadable after detection is `INPUT_UNREADABLE`. `failures.test.ts`: row "the input was made unreadable after it was detected" (skipped as root)
- [x] A missing engine on the only route is `ENGINE_MISSING`, and no route at all is `NO_ROUTE`. `runner.test.ts`: "ENGINE_MISSING when only the full graph has a route, NO_ROUTE when none does"
- [x] In a merge, one failing input fails the job, names that input, and writes nothing. `runner.test.ts`: "merge: one failing input fails the job, names that input, and writes nothing"
- [x] In a merge, a missing route for any input fails before any step runs. `runner.test.ts`: "merge: a missing route for any input fails before any step runs"
- [x] A bad submit (unknown combiner and the like) rejects the whole call and creates no job. `runner.test.ts`: "an unknown combiner rejects the whole call and creates no job"
- [x] The faults of the failure matrix all end the job as failed with no leftovers. `failures.test.ts`: "failure matrix: one job, one fault"
- [x] A job's source is the same after a failure. `failures.test.ts`: the matrix re-reads the source after each fault
- [ ] A job that fails in step 2 of 3 cleans step 1's temp output
- [ ] Retry after a failure runs the same request and can succeed
- [ ] A very long list of steps (fan-out of 1,800 pages) keeps memory flat

# Needs manual testing

## Shared across all platforms

- [ ] A real mixed batch (images, a DOCX, a PDF merge) in one go: every row ends in the right state
