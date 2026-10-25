# Document conversions (LibreOffice)

## Shared across all platforms

- [ ] Each document pair in [CONVERSIONS](../../CONVERSIONS.md) gives a parseable output (page count, type)
- [ ] A password-protected file fails with a clear code, not a hang
- [ ] A file with macros converts without running them
- [ ] A very large document is not killed too early by the timeout
- [ ] Two LibreOffice jobs at once do not fight over one profile (each gets its own, or they run in turn)
- [ ] LibreOffice already open by the user does not make the job fail or hang
- [ ] A corrupt document fails with a clear code and the engine's last error lines
- [ ] The job's profile folder is removed afterwards
- [ ] A cancelled job leaves no `soffice` process behind

## Windows-specific

- [ ] The profile path is passed as a proper file URL (spaces, drive letter)

## Linux-specific

- [ ] Works headless with no display

# Needs manual testing

## Shared across all platforms

- [ ] A real report with tables, images and unusual fonts looks right in the PDF
- [ ] A missing font changes the layout but still converts, and the UI can say fonts may differ
- [ ] Converting while the user has the same document open in LibreOffice

## Windows

- [ ] Works with the engine under `Program Files`, and with one installed per user

## Linux

- [ ] Works when installed from apt and as a Snap (the Snap sandbox can read the temp folder)

## Mac

- [ ] Works with the engine inside `LibreOffice.app`
- [ ] The first launch does not show a dialog that blocks the job
