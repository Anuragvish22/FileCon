# Main process and IPC

Test entries read: `file`: "test name". Files are under `packages/app/test/` (or `test/tooling/`).

## Shared across all platforms

### Handlers

- [x] The latest core status is answered, for a window that missed the push. `ipc.test.ts`: "core:getStatus" › "answers the latest status, for a renderer that missed the push"
- [x] Valid paths are relayed resolved; a bad path is answered alone, without calling core for it. `ipc.test.ts`: "relays valid paths resolved, and answers a bad path alone without calling core for it"
- [x] A payload that is not a list is refused. `ipc.test.ts`: "refuses a payload that is not a list"
- [x] Submitting sends the resolved input and output folder. `ipc.test.ts`: "sends the resolved input and outDir"
- [x] Show in folder reveals only a path that a job produced. `ipc.test.ts`: "reveals only a path that a job produced"
- [x] Only the install guide of an engine can be opened. `ipc.test.ts`: "opens only the install guide of an engine"
- [x] An engine download asks first, naming engine, size and host, then relays; if declined it rejects with `CANCELLED` and relays nothing. `ipc.test.ts`: "asks first, naming engine, size and host, then relays"; "rejects with CANCELLED and relays nothing when declined"
- [x] Settings: validated, saved, then core is told; an invalid patch is refused without saving; saved settings are kept when core is down. `ipc.test.ts`: "validates, saves, then tells core"; "refuses an invalid patch without saving"; "keeps the saved settings when core is down"
- [x] Payloads are turned into the RPC params core expects. `ipc.test.ts`: "turns payloads into the RPC params core expects"
- [x] Every IPC channel in CONTRACTS has a handler and no extra ones exist; every `window.filecon` method is exposed; every method and channel is documented. `ipc-channels.test.ts`: "has an ipc.ts handler for every channel, and no extra ones"; "exposes every window.filecon method, plus on() and pathForFile()"; "documents every method and channel in CONTRACTS section 7"

### Paths (the only gate between the window and the disk)

- [x] An absolute file path is accepted; a directory is accepted when wanted, and either kind when not specified. `paths.test.ts`: "accepts an absolute file path"; "accepts a directory when one is wanted, and either kind"
- [x] A symlink returns its resolved path. `paths.test.ts`: "returns the resolved path of a symlink"
- [x] A relative path, a path with `..`, and non-strings are refused. `paths.test.ts`: "refuses a relative path, a path with .. segments, and non-strings"
- [x] A NUL byte and an over-long path are refused. `paths.test.ts`: "refuses a NUL byte and an over-long path"
- [x] A missing path is `INPUT_NOT_FOUND`, naming the file; the wrong kind is `INPUT_UNREADABLE`. `paths.test.ts`: "gives INPUT_NOT_FOUND for a missing path, naming the file"; "gives INPUT_UNREADABLE for the wrong kind"

### Expanding dropped folders

- [x] Folders are walked in name order and a plain file stays as it is. `expand.test.ts`: "walks folders in name order and keeps a plain file as it is"
- [x] Hidden entries, linked folders and bad paths are skipped, but a linked file is followed. `expand.test.ts`: "skips hidden entries, linked folders and bad paths, but follows a linked file"
- [x] It stops at 1,000 files and says so. `expand.test.ts`: "stops at 1000 files and says so"
- [x] A payload that is not a list gives nothing. `expand.test.ts`: "gives nothing for a payload that is not a list"

### The window and the bridge

- [x] The window is isolated (context isolation on, node off, sandbox on): hard rule 6. `window.test.ts`: "isolates the renderer (hard rule 6)"
- [x] Navigation is cancelled and new windows are denied. `window.test.ts`: "cancels navigation and denies new windows"
- [x] The bridge unwraps a successful reply, rejects with the plain error of a failed reply, sends each call on its own channel, and subscribes only to push channels (and returns the unsubscribe). `api.test.ts`: "unwraps a successful reply"; "rejects with the plain CoreError of a failed reply"; "sends each call on its channel with its payload"; "subscribes only to push channels and returns the unsubscribe"
- [x] The preload exposes `window.filecon` and nothing else. `index.test.ts`: "exposes window.filecon and nothing else"
- [x] The page allows only its own files; only the dev server relaxes the policy. `csp.test.ts`: "the page itself allows only its own files"; "only the dev server relaxes it"

### Still to test

- [ ] Show in folder opens the folder exactly once per click (the double-open bug; cause unconfirmed on Linux)
- [ ] Show in folder on a file that was moved or deleted tells the user, instead of failing silently
- [ ] Choosing an output folder that does not exist or is not writable is refused with a reason
- [ ] Only one app window opens when the app is launched twice (the second focuses the first)

## Windows-specific

- [ ] Paths with backslashes, drive letters and UNC are accepted (the path tests use the real temp folder; no UNC test)

## Linux-specific

- [ ] Show in folder works with and without a file manager over D-Bus, and opens only once

# Needs manual testing

## Shared across all platforms

- [ ] Click Show in folder on a done row: one window opens, once, and the file is visible
- [ ] Drag a file from the file manager into the window, and from the window to the desktop

## Windows

- [ ] Show in folder selects the file in Explorer

## Linux

- [ ] Drag and drop works under X11, Wayland and WSLg

## Mac

- [ ] Show in folder reveals the file in Finder
- [ ] Closing the window keeps the app in the dock, and reopening shows a working window
- [ ] Dropping a file on the dock icon adds it
