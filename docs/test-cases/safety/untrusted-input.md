# Untrusted input

## Shared across all platforms

- [ ] A file name with quotes, spaces, `;`, `$()` or a leading `-` is passed as an argument, never run as a command
- [ ] A file name starting with `-` is not read by the engine as an option
- [ ] A path with `..` is rejected by main before it reaches core
- [ ] The renderer cannot ask main to read or write any path it was not given by a drop or a dialog
- [ ] A folder dropped is expanded, and a loop of links does not run forever
- [ ] A huge number of dropped files (10,000) does not freeze the app
- [ ] A file that lies about its type (a script named `.png`) is handled as its real type or rejected
- [ ] A decompression bomb (tiny file, huge picture) fails with a clear code, not memory exhaustion
- [ ] Engine error text is shown as plain text, never as markup
- [ ] Opening a link or file from the UI goes only to allowed destinations (navigation lock)

## Windows-specific

- [ ] Names with `&`, `%` or `^` are safe
- [ ] UNC paths (`\\server\share`) are validated like any path
- [ ] Alternate data stream names (`file.txt:stream`) are rejected

## Linux-specific

- [ ] Names with newlines or invalid UTF-8 bytes are handled
- [ ] A FIFO or device file dropped is rejected

## Mac-specific

- [ ] Names with decomposed Unicode letters match what the filesystem returns

# Needs manual testing

## Shared across all platforms

- [ ] Drop a real mix of odd files (huge, empty, renamed, locked, with strange names) in one go: the app stays responsive and each row says what happened
- [ ] Files downloaded from the internet (a real malicious-looking test file from an AV test suite) are only converted, never opened or run

## Windows

- [ ] Antivirus quarantining a dropped file gives a clear error, not a hang
