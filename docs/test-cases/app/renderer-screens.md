# Renderer screens (Convert, Engines, Settings)

Test entries read: `file`: "test name". Files are under `packages/app/test/renderer/`.

## Shared across all platforms

### Convert page: one state per column of the state matrix

- [x] Empty: only the drop zone. `convert.test.tsx`: "empty: the drop zone only"
- [x] Detecting: a spinner row, and Convert says it waits. `convert.test.tsx`: "detecting: a spinner row, and Convert says it waits"
- [x] Ready: type, arrow, select, options and remove on each row. `convert.test.tsx`: "ready: type, arrow, select, options and remove on each row"
- [x] Unsupported: a reason instead of a select. `convert.test.tsx`: "unsupported: a reason instead of a select"
- [x] Mismatch: the row says what was detected. `convert.test.tsx`: "mismatch: the row says what was detected"
- [x] Busy: Convert is `aria-busy` and the row controls are `aria-disabled` while submit runs. `convert.test.tsx`: "busy: Convert is aria-busy and the row controls are aria-disabled while submit runs"
- [x] Core unavailable: Convert says why. `convert.test.tsx`: "core unavailable: Convert says why"

### Converting

- [x] Drop 3 files, pick a format on each, Convert: progress, then done with Show in folder. `convert.test.tsx`: "drop 3 files, pick a format on each, Convert: progress, then done with Show in folder"
- [x] An indeterminate job says "working". `convert.test.tsx`: "an indeterminate job says working"
- [x] Failed: the reason, Details and Retry; cancelled: Retry. `convert.test.tsx`: "failed: the reason, Details and Retry; cancelled: Retry"

### Format popover

- [x] Every format is listed; a format the file cannot become is `aria-disabled`, focusable, with its reason. `convert.test.tsx`: "lists every format; a format the file cannot become is aria-disabled, focusable, with its reason"
- [x] Keyboard: arrows move, Enter picks. `convert.test.tsx`: "keyboard: arrows move, Enter picks"
- [x] A locked chip opens Engines, and Convert stays off. `convert.test.tsx`: "a locked chip opens Engines and Convert stays off"

### Per-row and batch choices

- [x] A JPG-bound PNG and a locked DOCX each keep their own target; "Convert all to" fills the rest. `convert.test.tsx`: "a jpg-bound png and a locked docx: each row keeps its own target, Convert all to fills the rest"
- [x] Options show only the keys the route honours; "Apply to all rows" sets the others. `convert.test.tsx`: "options: only the keys the route honours, Apply to all rows sets the others"
- [x] A row with no target has an options button that says there is nothing to set. `convert.test.tsx`: "a row with no target has an options button that says there is nothing to set"
- [x] Alt+ArrowDown moves a file down the list. `convert.test.tsx`: "Alt+ArrowDown moves a file down the list"

### Merge group

- [x] Merge two rows, reorder, one bar with steps, then one result row. `convert.test.tsx`: "merge two rows, reorder, one bar with steps, then one result row"
- [x] Unmerge returns the rows. `convert.test.tsx`: "Unmerge returns the rows"
- [x] Merge is off with fewer than two rows. `convert.test.tsx`: "Merge… is off with fewer than two rows"

### Engines and Settings pages

- [x] The Engines page lists engines with status; a missing one offers Set path and an install guide. `panels.test.tsx`: "lists engines with status, and a missing one offers Set path and an install guide"
- [x] Changing theme and accent updates `<html>` without a reload. `panels.test.tsx`: "changing theme and accent updates <html> without a reload"
- [x] Accent swatches carry a text name, never colour alone. `panels.test.tsx`: "accent swatches carry a text name, never color alone"
- [x] An invalid engine path shows its translated error. `panels.test.tsx`: "an invalid engine path shows its translated error"
- [x] Choosing an output folder saves it as the custom output. `panels.test.tsx`: "choosing an output folder saves it as the custom output"

### Still to test

- [ ] A done row shows the output size (chosen in P55, not built yet)
- [ ] A per-row choice between merge and single (P55, not built yet)
- [ ] A completion summary with "Open output folder" and "Convert more" (not built yet)
- [ ] Settings: concurrency, output folder and language change are applied and saved

# Needs manual testing

## Shared across all platforms

- [ ] Every state in the matrix looks right on a real screen, in light and dark
