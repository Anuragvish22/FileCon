# Cancel and clean-up

Test entries read: `file`: "test name". Files are under `packages/*/test/`.

## Shared across all platforms

### Cancel at each stage

- [x] Cancel while queued: the job is cancelled at once, its converter never runs, nothing is left. `failures.test.ts`: "while queued: cancelled at once, nothing runs, nothing is left"; `runner.test.ts`: "cancel while queued: cancelled at once, its converter never runs"
- [x] Cancel while running: the state becomes cancelled only after the temp folder is gone, and there is no output. `runner.test.ts`: "cancel while running: cancelled only after the temp dir is gone, no output"
- [x] Cancel in step 1 of 2: the second step never runs. `failures.test.ts`: "in step 1 of 2: the second step never runs"
- [x] Cancel at the commit: if it comes before the file is linked there is no output. `failures.test.ts`: "at the commit: cancelled, with no output, when it comes before the file is linked"
- [x] Cancel when the converter ignores the signal (sharp, which cannot be interrupted): the job stops at once instead of when the work ends. This is the bug where X did nothing for 120 s. `runner.test.ts`: "cancel stops a converter that ignores the abort signal at once, not when it ends"
- [x] Cancel after done does nothing. `runner.test.ts`: "cancel after done does nothing"
- [x] Cancelling a job that does not exist, or cancelling all with nothing running, is harmless. `server.test.ts`: "cancel of an unknown job and cancelAll with nothing running are no-ops"
- [x] Cancel during a merge stops between inputs and writes nothing. `merge-pdf.test.ts`: "an abort between inputs is CANCELLED and writes nothing"

### What is left behind

- [x] A batch of 5 with no faults ends with 5 done and nothing left behind. `failures.test.ts`: "a batch of 5 with no faults ends with 5 done, and nothing left behind"
- [x] Every fault in the failure matrix (engine exits non-zero, hangs, input deleted, input unreadable, output folder read-only, disk full, symlink out of the folder) ends the job as failed with no temp folder, an empty output folder and an untouched source. `failures.test.ts`: "failure matrix: one job, one fault"
- [x] A job gets a private temp folder named after it, and it is removed with its content. `tmp.test.ts`: "makes a private dir named after the job, and removes it with its content"
- [x] Two folders of the same job get different names. `tmp.test.ts`: "gives two dirs of the same job different names"
- [x] Removing a folder that is already gone is not an error. `tmp.test.ts`: "removing a dir that is already gone is not an error"
- [x] On the next start, only old `filecon-*` folders left by a crash are removed. `tmp.test.ts`: "removes only old filecon-* dirs"
- [x] A whole LibreOffice job through the runner leaves no temp folder. `libreoffice.test.ts`: "a whole job through the runner leaves no temp dir"
- [x] A corrupt picture or PDF fails and leaves no temp folder. `sharp.test.ts`: "a corrupt file is ENGINE_FAILED and leaves no temp dir"; `pdflib.test.ts`: "a corrupt jpg is ENGINE_FAILED and leaves no temp dir"

### Processes

- [x] Abort kills a grandchild process, not only the first one. `spawn.test.ts`: "abort kills a grandchild"
- [x] A timeout kills the process, and nothing is left running. `spawn.test.ts`: "a timeout is TIMEOUT and the process is gone"
- [x] An abort is reported as `CANCELLED`, and an already aborted signal starts nothing. `spawn.test.ts`: "an abort is CANCELLED" and "an already aborted signal is CANCELLED without starting anything"
- [x] Shutdown cancels a running job, removes its temp folder, and then closes. `server.test.ts`: "shutdown cancels a running job, removes its temp dir and then closes"
- [x] A LibreOffice timeout removes its profile and its process, and the next job still works. `libreoffice.test.ts`: "a timeout is TIMEOUT, removes the profile and the process, and the next job works"
- [x] A waiting job that is aborted leaves the queue and takes no slot. `scheduler.test.ts`: "aborting while waiting rejects with CANCELLED and leaves the queue" and "an already aborted signal rejects at once and takes no slot"
- [x] A crash of core fails every queued and running job, then new calls work after the restart. `supervisor.test.ts`: "a crash mid-batch fails every active job, then new calls work after the restart"
- [x] Clear keeps a row whose job is still running, and forgets finished jobs. `store.test.ts`: "Clear keeps a row whose job is still running" and "Clear forgets the finished jobs, so the next batch counts from zero"

### Still to test

- [ ] After cancel no partial file is left in the output folder (checked for the matrix faults, not for cancel at every step)
- [ ] After cancel the source file is untouched (same bytes, same modified time)
- [ ] After cancel the engine process is gone, and so are the processes it started (for example `soffice.bin`)
- [ ] After cancel the slot is free and the next queued job starts
- [ ] Cancel twice is harmless
- [ ] Cancel all stops running and queued jobs and leaves finished rows alone
- [ ] Clear is unavailable while jobs run; after cancel all it clears the list
- [ ] The row leaves the "running" state within a second of pressing X, even for a long job
- [ ] Quitting the app during a job removes its temp folders and kills engine processes
- [ ] Cancel during a merge removes every part file and the half-built output
- [ ] Known gap: sharp may keep using CPU after cancel because it cannot be interrupted (parked: P57)

## Windows-specific

- [x] Killing a process tree uses `taskkill` with an argument array, not a process group. `spawn.test.ts`: "kills the tree with taskkill and an argument array, not a process group"
- [ ] The temp folder is removed even when a file in it is briefly locked (the code retries; no test fails without the retry)
- [ ] The engine's child processes die with it (no orphan `soffice.bin`)

## Linux-specific

- [ ] The engine's whole process group is killed, not only its first process (tested only through a grandchild)
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
