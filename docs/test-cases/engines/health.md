# Engine health

## Shared across all platforms

- [x] An engine that exits non-zero is passed on as a failure, with its error text, and its profile is removed. `libreoffice.test.ts`: "a non-zero exit is passed on and the profile is removed"
- [x] An engine that exits 0 but writes no output is `ENGINE_OUTPUT_MISSING`, with its error text as detail. `libreoffice.test.ts`: "exit 0 without an output is ENGINE_OUTPUT_MISSING with the stderr as detail, and the profile is removed"
- [x] The same fault at job level: an engine exiting non-zero ends the job as `ENGINE_FAILED`, with no temp folder and no output. `failures.test.ts`: "failure matrix: one job, one fault" row "the engine exits non-zero"
- [x] A converter that writes a symlink pointing outside its folder gives `ENGINE_OUTPUT_MISSING`, so it cannot smuggle a file in. `failures.test.ts`: row "a converter writes a symlink that points outside its out dir"
- [x] A program that does not exist is `ENGINE_FAILED`, not an uncaught crash. `spawn.test.ts`: "a binary that does not exist is ENGINE_FAILED"
- [x] Without LibreOffice the converter says it is unavailable, with `ENGINE_MISSING`. `libreoffice.test.ts`: "without LibreOffice the converter is not available and says ENGINE_MISSING"
- [x] A job whose route exists only through a missing engine says `ENGINE_MISSING`, and a job with no route at all says `NO_ROUTE`. `runner.test.ts`: "ENGINE_MISSING when only the full graph has a route, NO_ROUTE when none does"
- [x] Installing an engine is refused while no engine has a download install. `server.test.ts`: "engines.install is refused while no engine has a download install"
- [x] The engine list is returned, and a re-check emits `engines.changed`. `server.test.ts`: "engines.list returns the discovered engines, refresh re-probes and emits engines.changed"
- [x] Settings that change engine paths or priority trigger a re-check, other settings do not. `server.test.ts`: "settings.apply re-probes only when engine paths or priority changed"
- [x] The engines page lists each engine with its status; a missing one offers Set path and an install guide. `panels.test.tsx`: "lists engines with status, and a missing one offers Set path and an install guide"
- [x] Only the install guide of a real engine can be opened from the UI. `ipc.test.ts`: "opens only the install guide of an engine"
- [x] An engine download asks first, naming engine, size and host, and nothing is sent when the user says no. `ipc.test.ts`: "asks first, naming engine, size and host, then relays" and "rejects with CANCELLED and relays nothing when declined"
- [ ] An engine that starts but exits with an error shows as broken on the Engines page, with the last lines of its error output
- [ ] The version check has a timeout, and a timeout shows as broken, not as a frozen screen
- [ ] A conversion that needs a broken engine says broken, not missing
- [ ] An engine killed from outside (task manager, OOM) gives a clear failed state, with the temp folder cleaned
- [ ] The first run after install works with no first-run dialog from the engine blocking it
- [ ] A read-only home or profile folder gives a clear error, not a hang

## Windows-specific

- [ ] A missing runtime library (DLL) shows as broken with the error text

## Linux-specific

- [ ] A missing shared library (`error while loading shared libraries`) shows as broken with the error text
- [ ] No display available (headless) does not stop LibreOffice from converting

## Mac-specific

- [ ] A binary of the wrong CPU type shows as broken

# Needs manual testing

## Shared across all platforms

- [ ] Kill the engine from the system monitor in the middle of a real conversion: the row fails and the app stays usable

## Windows

- [ ] Antivirus holding the engine file open does not crash the check

## Linux

- [ ] A real minimal install (no desktop libraries) gives a readable message, not a crash

## Mac

- [ ] Intel engine on Apple silicon without Rosetta shows as broken, with the reason
- [ ] A quarantined or unsigned binary shows as broken with the reason
