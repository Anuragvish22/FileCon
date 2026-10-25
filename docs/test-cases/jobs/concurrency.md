# Concurrency and batches

Test entries read: `file`: "test name". Files are under `packages/*/test/`.

## Shared across all platforms

- [x] Slots are granted first come, first served as they free up. `scheduler.test.ts`: "grants slots in FIFO order as they free up"
- [x] No more slots are held than the limit. `scheduler.test.ts`: "never holds more slots than the limit"
- [x] A converter limited to one at a time serializes its steps; other converters are unaffected. `scheduler.test.ts`: "a converter with max 1 serializes its steps, others are unaffected"
- [x] Releasing a slot twice frees only one. `scheduler.test.ts`: "releasing twice frees only one slot"
- [x] Raising the limit wakes waiting jobs now. `scheduler.test.ts`: "setConcurrency up wakes waiters now"; `runner.test.ts`: "setConcurrency lets waiting jobs start at once"
- [x] Lowering the limit keeps running jobs and holds new ones until slots free. `scheduler.test.ts`: "setConcurrency down keeps running jobs and holds new ones until slots free"
- [x] The runner never runs more jobs than the limit. `runner.test.ts`: "never runs more jobs than the slot limit"
- [x] A converter with `maxConcurrent` 1 runs one step at a time, whatever the slots. `runner.test.ts`: "a converter with maxConcurrent 1 runs one step at a time, whatever the slots"
- [x] Jobs start in the order they were submitted. `runner.test.ts`: "starts jobs in submit order"
- [x] A failing job does not affect its siblings. `runner.test.ts`: "a failing job does not affect its siblings"
- [x] A batch of 5 with no faults ends with 5 done. `failures.test.ts`: "a batch of 5 with no faults ends with 5 done, and nothing left behind"
- [x] A submit with a bad request rejects the whole call and queues nothing. `server.test.ts`: "submit is all or nothing" › "%s rejects the whole call and queues nothing"
- [x] An unknown combiner rejects the whole call and creates no job. `runner.test.ts`: "an unknown combiner rejects the whole call and creates no job"
- [x] A fast call is not held up by a slow one (answers out of order). `server.test.ts`: "answers out of order: a fast call is not held up by a slow one"; `coreClient.test.ts`: "handles responses that arrive out of order"
- [x] A job keeps its submit position in the list when it updates. `store.test.ts`: "keeps a job in its submit position when it updates"
- [x] The same file added twice gives two rows, each with its own id, target and options, so one JPG can be merged with itself into a PDF. `store.test.ts`: "a file added twice is two rows with their own ids, targets and options (P59)"; `convert.test.tsx`: "the same file twice is two rows, and merging them sends its path twice (P59)"
- [ ] 200 files queued: memory stays flat, the list stays responsive
- [ ] Two jobs on the same source file (converted to two formats) do not clash
- [ ] Removing a queued row never starts it
- [ ] Heavy engines (LibreOffice) do not run twice at once on the same profile (the profile reuse is tested; two at once is not)

## Windows-specific

- [ ] Many open files at once do not hit the handle limit

## Linux-specific

- [ ] Many open files at once do not hit `ulimit -n`

# Needs manual testing

## Shared across all platforms

- [ ] A real batch of 500 photos finishes, and the computer stays usable meanwhile
- [ ] Concurrency 1, 4 and 8 on a real machine: the speed difference is real and nothing breaks

## Mac

- [ ] A laptop on battery still finishes a batch without stalling
