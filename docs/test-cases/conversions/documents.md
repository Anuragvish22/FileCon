# Document conversions (LibreOffice)

Test entries read: `file`: "test name". Files are under `packages/*/test/`. Tests that need LibreOffice are skipped when it is missing; in CI only Ubuntu has it.

## Shared across all platforms

- [x] Happy path: every office format becomes a PDF with at least one page. `libreoffice.test.ts`: "golden: every office format becomes a pdf with at least one page"
- [x] The edges are the eight office formats to PDF at the render cost, one conversion at a time. `libreoffice.test.ts`: "are the eight M1 office formats → pdf at the render cost, one conversion at a time"
- [x] The shared converter contract passes. `libreoffice.test.ts`: "contract"
- [x] Two jobs in a row reuse the profile folder instead of recreating it. `libreoffice.test.ts`: "two jobs in a row reuse the profile dir instead of recreating it"
- [x] A timeout removes the profile and the process, and the next job works. `libreoffice.test.ts`: "a timeout is TIMEOUT, removes the profile and the process, and the next job works"
- [x] A corrupt file fails cleanly, and the next job still works. `libreoffice.test.ts`: "a corrupt file fails cleanly, and the next job still works"
- [x] A whole job through the runner leaves no temp folder. `libreoffice.test.ts`: "a whole job through the runner leaves no temp dir"
- [x] A non-zero exit is passed on and the profile is removed. `libreoffice.test.ts`: "a non-zero exit is passed on and the profile is removed"
- [x] Exit 0 without an output is `ENGINE_OUTPUT_MISSING`, with the error text as detail. `libreoffice.test.ts`: "exit 0 without an output is ENGINE_OUTPUT_MISSING with the stderr as detail, and the profile is removed"
- [x] A bigger input gets a longer limit. `libreoffice.test.ts`: "gives soffice a longer limit for a bigger input"
- [x] Without LibreOffice the converter is unavailable with `ENGINE_MISSING`. `libreoffice.test.ts`: "without LibreOffice the converter is not available and says ENGINE_MISSING"
- [x] The command is an argument array, with the profile as a file URL and the input last. `libreoffice.test.ts`: "the command is an argument array with the profile as a file URL and the input last" (runs on every OS, including Windows and macOS in CI)
- [x] A DOCX converts to PDF with LibreOffice through the whole RPC (skipped without LibreOffice). `server.test.ts`: "converts docx to pdf with LibreOffice"
- [x] A DOCX is locked in the UI while LibreOffice is missing. `ui-core-targets.test.ts`: "a docx to pdf is locked while LibreOffice is missing"
- [ ] A password-protected file fails with a clear code, not a hang
- [ ] A file with macros converts without running them
- [ ] Two LibreOffice jobs at once do not fight over one profile
- [ ] LibreOffice already open by the user does not make the job fail or hang
- [ ] A cancelled job leaves no `soffice` process behind (tested for timeout, not for cancel)

## Windows-specific

- [ ] The profile path is a proper file URL on a real Windows path (the test uses `pathToFileURL`, which handles it; not run against real LibreOffice on Windows in CI)

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
