# Progress

Test entries read: `file`: "test name". Files are under `packages/*/test/`.

## Shared across all platforms

- [x] The first update goes out at once. `progress.test.ts`: "sends the first update at once"
- [x] A burst of updates is throttled, then the last value is flushed after the interval. `progress.test.ts`: "throttles a burst, then flushes the last value after the interval"
- [x] The fraction never goes backwards. `progress.test.ts`: "never sends the fraction backwards"; `runner.test.ts`: "the overall fraction never decreases, even when a step reports a lower value"
- [x] An unknown fraction (`null`) stays as it is. `progress.test.ts`: "keeps an unknown fraction (null) as it is"
- [x] Nothing is sent when nothing changed. `progress.test.ts`: "sends nothing when nothing changed"
- [x] A state change goes out at once and cancels the pending flush. `progress.test.ts`: "a state change goes out at once and cancels the pending flush"; `runner.test.ts`: "progress updates are throttled, state changes are not"
- [x] A note is recorded once, and a snapshot is sent, not the live job. `progress.test.ts`: "records a note once and sends a snapshot, not the live job"; `runner.test.ts`: "ctx.note ends up in Job.notes, deduped and in order"
- [x] A converter that never reports progress shows as indeterminate, not stuck at 0%. This is the bug where a 67 s GIF stayed at 0%. `runner.test.ts`: "a converter that never reports progress shows as indeterminate, not stuck at 0%"
- [x] A step that reports `null` makes the overall fraction `null`, and the unit still advances. `runner.test.ts`: "a step that reports null makes the overall fraction null, and the unit still advances"
- [x] A merge reaches 1 after the last input. `merge-pdf.test.ts`: "progress reaches 1 after the last input"
- [x] The bar, determinate and indeterminate, has the right accessible value and class. `ui.test.tsx`: "Progress, determinate and indeterminate"
- [x] An indeterminate job says "working" in the row. `convert.test.tsx`: "an indeterminate job says working"
- [x] Three files: progress, then done with Show in folder. `convert.test.tsx`: "drop 3 files, pick a format on each, Convert: progress, then done with Show in folder"
- [ ] A converter that reports progress shows it rising in the real UI
- [ ] The bar is full only when the job is done
- [ ] A progress report after cancel or done is ignored

## Windows-specific

- [ ] Progress text from an engine with Windows line endings (CRLF) is parsed

## Linux-specific

- [ ] Progress lines that arrive split across two reads are joined (the spawn test checks output arrives as it comes: `spawn.test.ts`: "onStdout receives the output as it arrives")

# Needs manual testing

## Shared across all platforms

- [ ] The moving bar looks smooth, with no stop or jump at the loop point
- [ ] The elapsed time keeps counting for a whole real 2-minute job
- [ ] Reduced motion shows a still short bar, no movement
- [ ] A screen reader gives a label and no changing value for the indeterminate bar
- [ ] The bar mirrors correctly in a right-to-left language

## Mac

- [ ] The bar animation does not stutter on a high-refresh display
