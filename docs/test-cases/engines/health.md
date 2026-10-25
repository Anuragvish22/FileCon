# Engine health

## Shared across all platforms

- [ ] An engine that starts but exits with an error shows as broken, with the last lines of its error output
- [ ] An engine that prints nothing and exits 0 on the version check is still usable
- [ ] The version check has a timeout, and a timeout shows as broken, not as a frozen screen
- [ ] A conversion that needs a missing engine is blocked before Convert, with the install link
- [ ] A conversion that needs a broken engine says broken, not missing
- [ ] An engine that dies half way through a job fails that job only; other jobs go on
- [ ] An engine killed from outside (task manager, OOM) gives a clear failed state, with the temp folder cleaned
- [ ] The first run after install works with no first-run dialog from the engine blocking it (LibreOffice profile)
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
