# Cancel and clean-up

## Shared across all platforms

- [x] Cancel while queued: cancelled at once, nothing runs, nothing left (covered by: `packages/core/test/jobs/failures.test.ts`)
- [x] Cancel in step 1 of 2: the second step never runs (covered by: `packages/core/test/jobs/failures.test.ts`)
- [x] Cancel at the commit: cancelled with no output when it comes before the file is linked (covered by: `packages/core/test/jobs/failures.test.ts`)
- [x] Cancel when the converter ignores the signal (sharp) still ends the job promptly (covered by: `packages/core/test/jobs/runner.test.ts`)
- [ ] After cancel the job's temp folder is gone, whatever step it was in
- [ ] After cancel no partial file is left in the output folder
- [ ] After cancel the source file is untouched (same bytes, same modified time)
- [ ] After cancel the engine process is gone, and so are the processes it started (for example `soffice.bin`)
- [ ] After cancel the slot is free and the next queued job starts
- [ ] Cancel twice is harmless
- [ ] Cancel after done or failed does nothing and changes no state
- [ ] Cancel all stops running and queued jobs and leaves finished rows alone
- [ ] Clear is unavailable while jobs run; after cancel all it clears the list
- [ ] The row leaves the "running" state within a second of pressing X, even for a long job
- [ ] Quitting the app during a job removes its temp folders and kills engine processes
- [x] Next start removes old `filecon-*` temp folders left by a crash (covered by: `packages/core/test/jobs/tmp.test.ts`)
- [ ] Cancel during a merge removes every part file and the half-built output
- [ ] Known gap: sharp may keep using CPU after cancel because it cannot be interrupted (parked: P57)

## Windows-specific

- [ ] The temp folder is removed even when a file in it is briefly locked (retry on busy)
- [ ] The engine's child processes die with it (no orphan `soffice.bin`)

## Linux-specific

- [ ] The engine's whole process group is killed, not only its first process
- [ ] A temp folder on a full `/tmp` still gets removed on cancel

## Mac-specific

- [ ] Cleanup works with the real temp path (`/var` is a link to `/private/var`)

# Needs manual testing

## Shared across all platforms

- [ ] Real GIF to AVIF, press X at 10 s: the row stops within a second, and the system monitor shows the CPU settle (P57)
- [ ] Real DOCX to PDF, press Cancel all: no `soffice` left in the process list
- [ ] Press X, Clear and Cancel all in turn during one long batch: each does what its label says
- [ ] Sleep the computer during a job and wake it: the job finishes or fails clearly, with no stuck row
- [ ] Pull the power of a laptop (battery) during a job: no half-files after the next start

## Windows

- [ ] Task Manager shows no orphan engine process after Cancel all
- [ ] Cancelling a job whose source is on a network drive leaves the source alone

## Linux

- [ ] `ps` shows no orphan engine process after Cancel all, under WSLg and on a plain desktop

## Mac

- [ ] Killing the engine does not leave a crash-report dialog open
