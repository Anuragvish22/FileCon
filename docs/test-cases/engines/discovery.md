# Engine discovery

Test entries read: `file`: "test name". Files are under `packages/*/test/`.

## Shared across all platforms

- [x] Happy path: an engine that ships inside the app is found with no search at all. `discovery.test.ts`: "a bundled engine is found without looking anywhere"
- [x] A path the user set in settings is tried first and its version is read. `discovery.test.ts`: "a valid override is used first, with its version"
- [x] A wrong user path does not silently fall back to another install, so the user learns it is wrong. `discovery.test.ts`: "an invalid override does not fall through to PATH"
- [x] A user path that points at a folder is "not found", with an error. `discovery.test.ts`: "an override that is a directory is not found, with an error"
- [x] PATH entries are searched in order and the first hit wins. `discovery.test.ts`: "PATH is searched in order and the first hit wins"
- [x] A known install location is used when PATH has nothing. `discovery.test.ts`: "a plain known path is used when PATH has nothing"
- [x] A known location with a wildcard (versioned folders) picks the newest match. `discovery.test.ts`: "a known path with a glob finds the newest matching directory"
- [x] The version number is read from the first capture of the engine's pattern. `discovery.test.ts`: "the version comes from the first capture of the pattern"
- [x] On Windows the version is read from `soffice.com`, because `soffice.exe --version` opens its own window and waits for Enter. `discovery.test.ts`: "on win32 the version is read from soffice.com, because soffice.exe prints to its own window"
- [x] A found engine with no version command is accepted without running it. `discovery.test.ts`: "a spec without a version command is found without probing"
- [x] A missing engine carries its install link, and the install method for this platform when there is one. `discovery.test.ts`: "carries the install link, and the install method for this platform when there is one"
- [x] Nothing found gives `found: false` and no error. `discovery.test.ts`: "nothing found gives found: false and no error"
- [x] Checking all engines gives one result per engine, in order, each with its own override applied. `discovery.test.ts`: "discoverAll returns one result per spec, in spec order, applying each override"
- [x] The real file checks work on real files: a folder and a non-executable file are not engines, an executable is. `discovery.test.ts`: "isExecutable: a directory is not, a plain file is not, an executable file is"
- [x] The real runner returns a real binary's output. `discovery.test.ts`: "exec runs a real binary and returns its output"
- [x] Listing a folder gives its entries, and `[]` for a missing folder. `discovery.test.ts`: "listDir lists a directory and gives [] for a missing one"
- [x] Reading a missing text file gives `undefined`, not a crash. `discovery.test.ts`: "readText gives undefined for a missing file"
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

- [x] `soffice` is found as `soffice.EXE` through PATHEXT. `discovery.test.ts`: "on win32 PATHEXT lets soffice be found as soffice.EXE"
- [ ] Found under `Program Files` and `Program Files (x86)`
- [ ] Found under a per-user folder in `AppData`
- [ ] A path with backslashes and a drive letter is accepted as an override
- [ ] The engine name shown in the UI has no `.exe` (the code strips it in `spawn.ts`; the check is in `failures.test.ts` for the timeout params, not for the UI)
- [ ] A shortcut (`.lnk`) is not mistaken for the program

## Linux-specific

- [x] On WSL a binary under `/mnt/c` is skipped, because it is a slow Windows program, and the next one is used. `discovery.test.ts`: "on WSL a binary under /mnt/c is skipped and the next one is used"
- [x] Off WSL the same path is a normal path. `discovery.test.ts`: "off WSL a /mnt/c path is a normal path"
- [x] On WSL a `/mnt/c` path the user chose themselves is kept. `discovery.test.ts`: "on WSL, an override under /mnt/c is the user's explicit choice and is kept"
- [ ] Found when installed by apt (`/usr/bin`)

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
