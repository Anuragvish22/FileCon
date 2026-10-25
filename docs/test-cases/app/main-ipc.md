# Main process and IPC

## Shared across all platforms

- [x] Every IPC channel in CONTRACTS exists and is handled (covered by: `test/tooling/ipc-channels.test.ts`)
- [x] The content security policy is strict (covered by: `test/tooling/csp.test.ts`)
- [x] Navigation and new windows are blocked (covered by: `packages/app/test/main/window.test.ts`)
- [ ] Show in folder opens the folder exactly once per click
- [ ] Show in folder on a file that was moved or deleted tells the user, instead of failing silently
- [ ] Choosing an output folder that does not exist or is not writable is refused with a reason
- [ ] Main validates every path the renderer sends, including ones that look like drops
- [ ] Settings file that is corrupt or from a newer version falls back to defaults and keeps a copy
- [ ] The log file is written, rotated, and holds no file contents
- [ ] Only one app window opens when the app is launched twice (the second focuses the first)

## Windows-specific

- [ ] Paths with backslashes, drive letters and UNC are accepted

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
