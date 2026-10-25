# Untrusted input

Test entries read: `file`: "test name". Files are under `packages/*/test/`.

## Shared across all platforms

### Names and commands

- [x] Shell characters in an argument arrive as one literal string each, never run. `spawn.test.ts`: "shell metacharacters arrive as one literal string each"
- [x] An argument with spaces and quotes arrives intact. `spawn.test.ts`: "an argument with spaces and quotes arrives intact"
- [x] A string command or `shell: true` does not type-check. `spawn.test.ts`: "a string command or shell: true does not type-check"
- [x] An unsafe output name is cleaned so it can never leave the output folder. `output.test.ts`: "cleans an unsafe stem, so a name can never leave the output dir"
- [x] Windows reserved names, bad characters and trailing dots are made safe. `output.test.ts`: "safeStem" (four tests)
- [x] A converter that writes a symlink pointing outside its folder is `ENGINE_OUTPUT_MISSING`. `failures.test.ts`: row "a converter writes a symlink that points outside its out dir"

### Paths from the window

- [x] Relative paths, `..`, non-strings, NUL bytes and over-long paths are refused. `paths.test.ts`: "refuses a relative path, a path with .. segments, and non-strings"; "refuses a NUL byte and an over-long path"
- [x] A payload that is not a list is refused. `ipc.test.ts`: "refuses a payload that is not a list"; `expand.test.ts`: "gives nothing for a payload that is not a list"
- [x] Show in folder and install guides only open what the app produced or knows. `ipc.test.ts`: "reveals only a path that a job produced"; "opens only the install guide of an engine"
- [x] Navigation and new windows are blocked; the window is isolated. `window.test.ts`: "cancels navigation and denies new windows"; "isolates the renderer (hard rule 6)"
- [x] The bridge exposes only `window.filecon`. `index.test.ts`: "exposes window.filecon and nothing else"
- [x] The page policy allows only its own files. `csp.test.ts`: "the page itself allows only its own files"

### Dropped content

- [x] Hidden entries and linked folders are skipped, so a loop of links cannot run forever; at most 1,000 files are taken. `expand.test.ts`: "skips hidden entries, linked folders and bad paths, but follows a linked file"; "stops at 1000 files and says so"
- [x] A file that lies about its type is treated as its real type or rejected: a `.jpg` that is WebP, text named `.jpg`, an SVG without `<svg`, a zip with a wrong extension. `detect.test.ts`: four tests under "detect: must also pass"
- [x] A corrupt picture or PDF fails with a clear code. `sharp/converter.test.ts`: "a corrupt file is ENGINE_FAILED and leaves no temp dir"; `merge-pdf.test.ts`: "a corrupt input is ENGINE_FAILED and names the file"
- [x] An encrypted PDF is `INPUT_ENCRYPTED`. `merge-pdf.test.ts`: "an encrypted input is INPUT_ENCRYPTED"
- [ ] A file name starting with `-` is not read by the engine as an option (per converter)
- [ ] A decompression bomb (tiny file, huge picture) fails with a clear code, not memory exhaustion
- [ ] Engine error text is shown as plain text, never as markup (React escapes it; no test)
- [ ] A FIFO or device file dropped is rejected
- [ ] A huge number of dropped files (10,000) does not freeze the app

## Windows-specific

- [ ] Names with `&`, `%` or `^` are safe
- [ ] UNC paths (`\\server\share`) are validated like any path
- [ ] Alternate data stream names (`file.txt:stream`) are rejected

## Linux-specific

- [ ] Names with newlines or invalid UTF-8 bytes are handled

## Mac-specific

- [ ] Names with decomposed Unicode letters match what the filesystem returns

# Needs manual testing

## Shared across all platforms

- [ ] Drop a real mix of odd files (huge, empty, renamed, locked, with strange names) in one go: the app stays responsive and each row says what happened
- [ ] A test file from an antivirus test suite is only converted, never opened or run

## Windows

- [ ] Antivirus quarantining a dropped file gives a clear error, not a hang
