# Concurrency and batches

## Shared across all platforms

- [x] A batch of 5 with no faults ends with 5 done and nothing left behind (covered by: `packages/core/test/jobs/failures.test.ts`)
- [ ] No more jobs run at once than the concurrency setting
- [ ] Raising or lowering the setting while jobs run takes effect for the next job
- [ ] One failed job in a batch does not stop the others
- [ ] 200 files queued: memory stays flat, the list stays responsive
- [ ] Jobs run in the order added unless the setting says otherwise
- [ ] Two jobs on the same source file (converted to two formats) do not clash
- [ ] The same file added twice is two rows, not one
- [ ] Removing a queued row never starts it
- [ ] Heavy engines (LibreOffice) do not run twice at once on the same profile

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
