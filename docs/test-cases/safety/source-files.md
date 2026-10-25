# Source files are never touched

## Shared across all platforms

- [ ] After success, the source has the same bytes and modified time
- [ ] After failure, cancel and timeout, the source has the same bytes and modified time
- [ ] The output folder equal to the source folder never overwrites the source, even when the format is the same
- [ ] A read-only source converts (we only read it)
- [ ] A source on read-only media converts to another folder
- [ ] Removing a row from the list never deletes the file
- [ ] The app never moves a source into the temp folder; it reads in place or copies

## Windows-specific

- [ ] A source open in another program (shared read) converts, or fails with a clear code, and is not changed
- [ ] A source can be deleted by the user right after the job ends

## Linux-specific

- [ ] A source that is a symlink is read, and the link and its target are not changed

# Needs manual testing

## Shared across all platforms

- [ ] Compare checksums of a real folder of files before and after a full batch, including cancelled jobs

## Mac

- [ ] A source in iCloud (not downloaded) fails clearly or is downloaded by the OS, and is not changed
