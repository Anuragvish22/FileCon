# Output saving

## Shared across all platforms

- [x] Output goes to a temp folder first, then is linked exclusively into the destination (covered by: `packages/core/test/jobs/output.test.ts`)
- [ ] An existing file with the same name is never overwritten; the new file gets a free name
- [ ] Two jobs finishing at once with the same name get two different names
- [ ] A read-only output folder fails with a clear code, the temp folder is cleaned, nothing is half written
- [ ] A full disk fails with a clear code and leaves no partial file
- [ ] An output folder deleted during the job fails with a clear code
- [ ] A name with spaces, dots, non-ASCII letters or emoji is kept as it is
- [ ] A very long name is shortened, not failed
- [ ] The output folder chosen next to the source, or elsewhere, is used as chosen
- [ ] Fan-out (one source, many outputs) names every output and commits all or reports which failed

## Windows-specific

- [ ] A reserved name (`CON`, `NUL`, `AUX`) and trailing dots or spaces are made safe
- [ ] Names that differ only by case count as the same name
- [ ] A path over 260 characters works or fails clearly
- [ ] Hard links are not available on the target drive (FAT/exFAT): falls back or fails clearly

## Linux-specific

- [ ] A destination on another filesystem (a mounted drive) still commits without overwriting
- [ ] A destination on a filesystem without hard links fails clearly or falls back

## Mac-specific

- [ ] Names are compared the way the filesystem does (case-insensitive, normalised letters)

# Needs manual testing

## Shared across all platforms

- [ ] Save to a USB stick and pull it out in the middle of a job: a clear failure, no half file left on the stick
- [ ] Save to a cloud-synced folder (OneDrive, Dropbox, iCloud Drive): the output appears once and is not duplicated
- [ ] Save to a real network share

## Windows

- [ ] A destination on a FAT or exFAT drive works

## Mac

- [ ] A destination on an external exFAT drive works
