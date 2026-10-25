# Source files are never touched

Test entries read: `file`: "test name". Files are under `packages/*/test/`.

## Shared across all platforms

- [x] After commits that fall back to copying, the source's bytes, size and modified time are the same. `output.test.ts`: "its bytes, size and mtime are the same after commits that fall back to copying"
- [x] After every fault in the failure matrix, the source is read back and is the same. `failures.test.ts`: "failure matrix: one job, one fault" (the test re-reads the input after each row)
- [x] A source already in the output folder is never the destination. `output.test.ts`: "a source that is already in the output dir is never the destination"
- [x] Two jobs for the same name never replace an existing file. `output.test.ts`: "numbers the name on conflict and never touches the existing file"; "the no-link fallback still never replaces an existing file"
- [x] Rollback never deletes a folder it did not create. `output.test.ts`: "rollback never deletes a folder it did not create"
- [x] Removing a temp folder only touches the job's own folder and old `filecon-*` folders. `tmp.test.ts`: "removes only old filecon-* dirs"
- [x] A same-format JPG to JPG gets a new name ("stem (1).jpg"), so the source is not overwritten. `sharp/converter.test.ts`: "jpg → jpg at quality 40 is a valid, smaller jpg named \"<stem> (1).jpg\""
- [x] Reveal in folder only works for a path a job produced. `ipc.test.ts`: "reveals only a path that a job produced"
- [x] A symlink to a file is followed for reading. `detect.test.ts`: "a symlink to a file is followed"; `expand.test.ts`: "skips hidden entries, linked folders and bad paths, but follows a linked file"
- [ ] After success, cancel and timeout in the real runner, the source has the same bytes and modified time
- [ ] A read-only source converts (we only read it)
- [ ] Removing a row from the list never deletes the file (no code path deletes; a test would lock that in)
- [ ] The app never moves a source into the temp folder; it reads in place or copies

## Windows-specific

- [ ] A source open in another program (shared read) converts, or fails with a clear code, and is not changed
- [ ] A source can be deleted by the user right after the job ends (the sharp and pdf-lib cache settings; no Linux test fails without them)

## Linux-specific

- [ ] A source that is a symlink is read, and the link and its target are not changed

# Needs manual testing

## Shared across all platforms

- [ ] Compare checksums of a real folder of files before and after a full batch, including cancelled jobs

## Mac

- [ ] A source in iCloud (not downloaded) fails clearly or is downloaded by the OS, and is not changed
