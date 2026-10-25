# Engine discovery

## Shared across all platforms

- [x] A bundled engine is found without looking anywhere (covered by: `packages/core/test/engines/discovery.test.ts`)
- [x] A valid user override is used first, with its version (covered by: `packages/core/test/engines/discovery.test.ts`)
- [x] An invalid override does not fall through to PATH (covered by: `packages/core/test/engines/discovery.test.ts`)
- [x] PATH is searched in order and the first hit wins (covered by: `packages/core/test/engines/discovery.test.ts`)
- [x] A known path with a glob finds the newest matching folder (covered by: `packages/core/test/engines/discovery.test.ts`)
- [x] Nothing found gives `found: false` and no error (covered by: `packages/core/test/engines/discovery.test.ts`)
- [ ] An engine already installed is found wherever it lives: default folder, custom folder, a folder with spaces, a folder with non-ASCII letters
- [ ] An engine reached through a symlink is found and runs
- [ ] A saved path that no longer exists falls back to searching instead of reporting missing
- [ ] Two versions installed: the one the app supports is chosen, not just the first
- [ ] A file that is there but not executable is reported as broken, not missing
- [ ] An engine installed while the app is open is found on the next check, with no restart
- [ ] An engine removed while the app is open turns to missing, and a job that needs it says so before Convert
- [ ] The version probe hanging does not freeze discovery (it times out, the engine shows as unknown version)
- [ ] The version text with extra lines or a different language still parses

## Windows-specific

- [x] PATHEXT lets `soffice` be found as `soffice.EXE` (covered by: `packages/core/test/engines/discovery.test.ts`)
- [ ] Found under `Program Files` and `Program Files (x86)`
- [ ] Found under a per-user folder in `AppData`
- [ ] A path with backslashes and a drive letter is accepted as an override
- [ ] The engine name shown in the UI has no `.exe`
- [ ] A shortcut (`.lnk`) is not mistaken for the program

## Linux-specific

- [ ] Found when installed by apt (`/usr/bin`)
- [x] A binary under `/mnt/c` is skipped on WSL and the next one is used (covered by: `packages/core/test/engines/discovery.test.ts`)
- [x] The override under `/mnt/c` is kept on WSL because the user chose it (covered by: `packages/core/test/engines/discovery.test.ts`)

## Mac-specific

- [ ] Found inside `/Applications/LibreOffice.app/Contents/MacOS`
- [ ] Found when installed by Homebrew on Apple silicon (`/opt/homebrew/bin`) and on Intel (`/usr/local/bin`)
- [ ] An app launched from Finder (a short PATH) still finds Homebrew engines

# Needs manual testing

## Shared across all platforms

- [ ] A real LibreOffice installed the normal way is found with no setting changed
- [ ] The Engines page matches what is really installed, after installing and after uninstalling

## Windows

- [ ] The Windows installer of LibreOffice, with default options, is found

## Linux

- [ ] Found when installed as a Snap, a Flatpak, or an AppImage the user points to
- [ ] Found under WSLg when LibreOffice is only installed on the Windows side (skipped on purpose, with a hint)

## Mac

- [ ] A binary blocked by the quarantine flag is reported as broken with a hint, not as missing
- [ ] Dragging LibreOffice.app into /Applications and starting fileCon at once finds it
