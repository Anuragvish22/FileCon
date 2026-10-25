# Progress

## Shared across all platforms

- [x] A converter that reports nothing starts as indeterminate (`fraction: null`), never 0% (covered by: `packages/core/test/jobs/runner.test.ts`)
- [x] The indeterminate bar carries its moving class and has no value (covered by: `packages/app/test/renderer/ui.test.tsx`)
- [ ] A converter that reports progress shows it rising, never going backwards
- [ ] The bar is full only when the job is done
- [ ] A multi-step job shows overall progress, not per-step jumping back to 0
- [ ] A progress report after cancel or done is ignored

## Windows-specific

- [ ] Progress text from an engine with Windows line endings (CRLF) is parsed

## Linux-specific

- [ ] Progress lines that arrive split across two reads are joined

# Needs manual testing

## Shared across all platforms

- [ ] The moving bar looks smooth, with no stop or jump at the loop point
- [ ] The elapsed time keeps counting for a whole real 2-minute job
- [ ] Reduced motion shows a still short bar, no movement
- [ ] A screen reader gives a label and no changing value for the indeterminate bar
- [ ] The bar mirrors correctly in a right-to-left language

## Mac

- [ ] The bar animation does not stutter on a high-refresh display
