# fileCon — UI/UX Design

Status: draft v0 · Related: [PRD](PRD.md) · [TRD](TRD.md) · [Architecture](ARCHITECTURE.md) · [Index](INDEX.md)

The UI talks to the system only through `window.filecon` ([CONTRACTS section 7](CONTRACTS.md#7-ipc-renderer--main)).

## 1. Principles

1. **First conversion with zero config.** Drop, pick, convert. No settings needed.
2. **No surprises.** Lossy routes, missing packs and format mismatches show up **before** the user clicks Convert.
3. **Show everything, mark what's not possible.** The format list shows every format. One that needs a pack is marked with a lock, and one the file can't be converted to is dimmed with its reason. Nothing is hidden.
4. **Originals are sacred.** The UI never offers an "overwrite" option.
5. **Keyboard-first and accessible.** Everything can be reached with Tab, Enter, Space and the arrow keys ([section 7](#7-accessibility)).
6. **Follows the OS by default.** Theme follows `prefers-color-scheme`, language follows the OS locale, and system fonts are used. Theme (system, light, dark), accent color and language can each be overridden in Settings.
7. **No hard-coded text or colors.** Every string comes from `translate()` and the locale file, and every color from a theme token ([CONTRACTS section 10](CONTRACTS.md#10-text-and-themes)). Layout uses CSS logical properties so right-to-left languages work later without a redesign. The colors, type and contrast rules are in [section 8](#8-design-system).

## 2. Screens

| Screen | Purpose | Entry |
|---|---|---|
| **Files** | The one working screen: drop files, pick a format and options per file, convert, and see progress and results in the same rows | App start, the "Files" tab |
| **Engines** | Pack status, paths, versions, install links | The "Engines" tab, or a locked chip |
| **Settings** | Output folder, concurrency, engine priority and path overrides, theme, accent, language | The "Settings" tab |

The nav names pages, so **"Convert" only ever labels the button**. There is no separate jobs panel: a file's row shows its progress and result, so nothing happens out of sight.

## 3. Wireframes

Icons in brackets (`[image]`, `[ok]`, `[x]`) stand for named lucide icons ([section 8.6](#86-space-shape-and-size)), never emoji. `[opts]` is the row's options button, and `[opts•]` marks custom values.

**Files, empty**
```
┌ fileCon ────────────────────────────────────── Files  Engines  Settings ┐
│                                                                          │
│   ┌ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┐          │
│   │                                                           │          │
│   │        [upload]  Drop files or a folder here              │          │
│   │                  [ Choose files ]                         │          │
│   │                                                           │          │
│   └ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ┘          │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Files, loaded (ready).** Every row has the same columns: drag handle, icon, name over size, detected type, an arrow, the format select, the options button and remove. A file still being detected shows a spinner where the type goes. The info line under a row holds that row's route notes (lossy, format mismatch, fonts). The bar at the bottom stays in view.
```
┌ fileCon ────────────────────────────────────── Files  Engines  Settings ┐
│ ┌ ─ ─ + Drop more files here, or [ Choose files ] ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐ │
│ 4 files   Convert all to: [ PNG ▾ ] [opts]       [ Merge… ]   [ Clear ]  │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ ⠿ [image] holiday.jpg                    JPG ─▶ [ PNG ▾ ] [opts•]  ✕ │ │
│ │           2.1 MB                                                     │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ ⠿ [image] scan.jpg                   [!] WEBP ─▶ [ PNG ▾ ] [opts]  ✕ │ │
│ │           840 KB · named .jpg, really WebP                           │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ ⠿ [doc]   report.docx                    DOCX ─▶ [ PDF ▾ ] [opts]  ✕ │ │
│ │           48 KB · [i] layout approximate · fonts may show as boxes   │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ ⠿ [spin]  notes.odt                                    detecting…  ✕ │ │
│ │           31 KB                                                      │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ ⠿ [file]  broken.png                     [x] Format not supported  ✕ │ │
│ │           0 B                                                        │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│ Save to  (•) Same folder  ( ) Folder…                      [ Convert 3 ] │
└──────────────────────────────────────────────────────────────────────────┘
```
Row 5 has no select because its format is not supported. Notes appear only when they apply: the fonts note is shown on rows whose route starts from a document (office to PDF), and a lone row with no possible target says why on one reason line instead of a select.

**Running.** The row's second line becomes the progress bar with its percent. Convert only starts the rows that are ready, so more files can be added while others run.
```
┌ fileCon ────────────────────────────────────── Files  Engines  Settings ┐
│ 3 running                                                                │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ ⠿ [image] holiday.jpg ─▶ PNG                                       ✕ │ │
│ │    [██████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░]       48 %         │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ ⠿ [doc]   report.docx ─▶ PDF                                       ✕ │ │
│ │    [░░▒▒▓▓░░▒▒▓▓░░▒▒▓▓░░]  working…                                  │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ ⠿ [image] scan.jpg ─▶ PNG                                 queued   ✕ │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│ Save to  (•) Same folder  ( ) Folder…                        [ Convert ] │
└──────────────────────────────────────────────────────────────────────────┘
```
The cross cancels while running or queued (the engine process tree is killed, [FLOWS F8](FLOWS.md#f8-cancel)). A null `fraction` shows the indeterminate bar with "working…".

**Done, failed, cancelled.** The same row now shows the converted name, its size and the status. A summary line counts the outcomes, and Clear finished removes the ended rows.
```
┌ fileCon ────────────────────────────────────── Files  Engines  Settings ┐
│ 2 done · 1 failed · 1 cancelled                       [ Clear finished ] │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ [image] holiday.png   1.6 MB            [ok] Done   [Show in folder] │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ [doc]   report.pdf    210 KB            [ok] Done   [Show in folder] │ │
│ │        [i] Text in some scripts may show as boxes                    │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ [file]  scan.jpg   [x] libvips could not read scan.jpg               │ │
│ │                                                   [Details]  [Retry] │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ [image] big.tiff                             [-] Cancelled   [Retry] │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│ Save to  (•) Same folder  ( ) Folder…                        [ Convert ] │
└──────────────────────────────────────────────────────────────────────────┘
```
Retry makes a new job from the same request, so the failed row stays until cleared ([FLOWS F9](FLOWS.md#f9-failure-and-retry)). Details shows the raw engine output.

**Format select (opens a popover).** Search on top, categories on the left, format chips on the right. **Every format is listed**, and one the file can't be converted to is dimmed, never hidden.
```
 ┌───────────────────────────────────────────────┐
 │ [search] Search format                         │
 ├──────────────────┬────────────────────────────┤
 │ Image          > │ [ AVIF ] [ BMP  ] [ GIF  ] │
 │ Document         │ [ JPG  ] [ PNG* ] [ TIFF ] │
 │ Presentation     │ [ WEBP ] [ SVG  ] [ ICO  ] │
 │ Spreadsheet      │                            │
 │ Ebook            │ * selected = accent fill   │
 │ Vector           │ [lock] ODT   needs Office  │
 │ Cad              │ [!]    DOCX  lossy         │
 │                  │ dimmed SVG   can't convert │
 └──────────────────┴────────────────────────────┘
```
Chip states (the same in the search results):
- **Available:** a normal chip. A lossy route adds a warning icon and a tooltip with `lossy.<id>`.
- **Needs a pack:** a lock icon and the pack name. It stays clickable and opens Engines.
- **Not possible for this file:** dimmed and dashed with `aria-disabled` ([section 8.9](#89-rules), rule 5), not hidden. It stays reachable by keyboard and says why ("JPG can't be converted to SVG", text `picker.unavailable` with `from` and `to`). Picking it does nothing.

All categories always show. The chip list comes from the format registry (`@filecon/core/formats`), and each chip's state from that row's `targets()` answer: present and `ready` is available, `needs-pack` is locked, absent is not possible. Typing in the search shows one flat grid across all categories, available chips first and dimmed ones last. Keys: type to search, arrows move, Enter picks, Esc closes.

**Row options (opens from `[opts]`).** Only the keys this row's route honours (`TargetOption.options`) are shown.
```
 ┌ holiday.jpg → PNG ─────────────────────────────┐
 │ Quality     [────●─────────]  90                │
 │ Width (px)  [      ]   Height (px)  [      ]    │
 │ [ ] Grayscale        [ ] Keep photo info        │
 │                                                 │
 │            [ Reset ]  [ Apply to all rows ]     │
 └─────────────────────────────────────────────────┘
```
Validation shows as you type with the same messages as today (`invalid.<what>`, red outline plus text). "Apply to all rows" copies these values to every row that honours each key. A row with no options for its route has an `aria-disabled` button whose tooltip says so. The header's own `[opts]` next to "Convert all to" does the same for the whole batch.

**Merge.** "Merge…" turns the ready rows into one group (M1: all of them, a per-row choice is parked as P55) with a single target, one options button and one output name. Members keep the drag handle (their order is the page order) and remove. Unmerge returns them to single rows.
```
┌ fileCon ────────────────────────────────────── Files  Engines  Settings ┐
│ ┌ ─ ─ + Drop more files here, or [ Choose files ] ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─┐ │
│ 5 files   Convert all to: [ PNG ▾ ] [opts]       [ Merge… ]   [ Clear ]  │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ Merge ▸ [ PDF ▾ ] [opts]   "photo merged.pdf"            [ Unmerge ] │ │
│ ├──────────────────────────────────────────────────────────────────────┤ │
│ │ ⠿ [image] photo.jpg    2.1 MB                                 JPG  ✕ │ │
│ │ ⠿ [image] scan.png     840 KB                                 PNG  ✕ │ │
│ │ ⠿ [doc]   report.docx  48 KB                                 DOCX  ✕ │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────────────────────────────────┐ │
│ │ ⠿ [image] logo.svg                        SVG ─▶ [ PNG ▾ ] [opts]  ✕ │ │
│ │           12 KB                                                      │ │
│ └──────────────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────────────┤
│ Save to  (•) Same folder  ( ) Folder…                      [ Convert 2 ] │
└──────────────────────────────────────────────────────────────────────────┘
```
While it runs, the group header carries one bar ("step 2 of 4", from `progress.unit` and `total` = inputs + 1) and each member shows done, current or waiting from `unit`, so no per-input events are needed. When it ends, the group collapses to one result row.
```
┌──────────────────────────────────────────────────────────────────────┐
│ Merge ▸ PDF   [████████████░░░░░░░░░░░░]  step 2 of 4  50 %        ✕ │
├──────────────────────────────────────────────────────────────────────┤
│ [ok] photo.jpg      [spin] scan.png      [  ] report.docx            │
└──────────────────────────────────────────────────────────────────────┘
```
```
┌──────────────────────────────────────────────────────────────────────┐
│ [pdf] photo merged.pdf   3.4 MB         [ok] Done   [Show in folder] │
│       ▸ 3 files                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Extract and fan-out (M1.1).** A PDF row's select also offers the actions "Extract images" and "Split into pages". One input gives many outputs, so the result row is a folder. "Nothing found" is an info row, not an error.
```
┌──────────────────────────────────────────────────────────────────────┐
│ [folder] report (images)/  12 files · 5.2 MB [ok] Done  [Open folder] │
├──────────────────────────────────────────────────────────────────────┤
│ [file]   scan.pdf                       [i] No embedded images found │
└──────────────────────────────────────────────────────────────────────┘
```

**Engines**
```
 Pack      Engine        Status        Path / Version
 builtin   sharp         [ok] ready    bundled · 0.33
 builtin   pdf-lib       [ok] ready    bundled · 1.17
 office    LibreOffice   [x] not found [Set path…] [How to install]
 media     FFmpeg        [ok] ready    /usr/bin/ffmpeg · 6.1
 pdf       Poppler       [x] not found [Install (43.7 MB)] [Set path…]   ← Windows
 pdf       Poppler       [x] not found [How to install] [Re-check]       ← macOS / Linux
```

**Install assistant**
```
 ┌ Install Poppler (PDF pack) ─────────────────────────────┐   Windows
 │ Downloads Poppler 26.09.0 (43.7 MB) from github.com.    │
 │ Verified by checksum before use.                         │
 │ ███████████░░░░░░  27.1 / 43.7 MB · downloading          │
 │                                    [Cancel]  [Install]   │
 └──────────────────────────────────────────────────────────┘
 ┌ Install Poppler (PDF pack) ─────────────────────────────┐   macOS / Linux
 │ Run one of these in a terminal, then press Re-check:     │
 │   brew install poppler                       [Copy]      │
 │   sudo apt install poppler-utils             [Copy]      │
 │                                    [Close]  [Re-check]   │
 └──────────────────────────────────────────────────────────┘
```

## 4. Flows

| Flow | Steps | Notes |
|---|---|---|
| Single convert | drop → rows appear and are detected → pick a format on the row → Convert → the row shows progress, then the result → Show in folder | A row's select defaults to the last-used target if it is available for that file |
| Batch | drop N → each row picks its own format, or "Convert all to" sets them → Convert → N jobs | Mixed files work: a jpg and a docx each get their own target. One failure doesn't block the rest |
| Merge to PDF | choose rows → Merge… → target PDF → reorder → Convert → 1 job and one result row | Merge… needs at least 2 rows and a target every member can reach |
| One long image | choose rows (or a PDF) → Merge… → target PNG with "One long image" → Convert → 1 job | Offered when `targets().merge` has `stack-png`: a single file only when its route fans out |
| Missing engine | pick a locked chip → dialog: "Needs Office pack (LibreOffice)" with [Install guide] [Set path] | After a path is set, the chips refresh |
| PDF to images | PDF row → PNG, JPG or TIFF → options Pages and DPI → Convert → "report (png)/" | Pages are validated as you type |
| Extract images | PDF row → "Extract images" → optional Pages → 1 job per PDF → "report (images)/" | "No embedded images found" shows as an info row, not an error |
| Install engine | locked chip or Extract on a missing Poppler → Install assistant ([FLOWS F16](FLOWS.md#f16-install-an-engine)) | On success the lock disappears with no restart |
| Mismatch | The warning badge is on the row. The conversion uses the **detected** format | Tooltip explains what was detected |
| Lossy | The info line under the row lists that row's lossy notes | Shown, not blocking. Losses found while running (`Job.notes`, e.g. downscaled) show on the done row the same way |
| Cancel | The cross on a running or queued row → `cancelled` within 2 s | No partial output is left behind |
| Failure | The row turns to a failed row with a short reason, [Details] (engine stderr) and [Retry] | Retry resubmits the same request as a new job |

## 5. States

**Row lifecycle (one file).** `detecting` → `ready` (or `unsupported`) → `queued` → `running` → `done` | `failed` | `cancelled`. A merge group has the same states for the whole group, with its members listed under it.

**State matrix.** Each cell says what shows. "hidden" means the element is not on screen.

| Element | empty | detecting | ready | busy (submitting) | running | done | partial | failed | cancelled | locked | core unavailable |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Drop zone | full size, "Drop files or a folder here" | slim strip | slim strip | slim strip | slim strip | slim strip | slim strip | slim strip | slim strip | slim strip | dimmed, `aria-disabled` |
| Header line | hidden | "N files" | "N files", Convert all to, Merge…, Clear | same, buttons `aria-busy` | "N running" | "N done", Clear finished | "N done · M failed · K cancelled", Clear finished | counts with the failures first | counts | unchanged | counts, banner above |
| Row, first line | n/a | handle, icon, name, spinner in place of type, remove | handle, icon, name, type, arrow, select, options, remove | same, controls `aria-disabled` | name → target, cross | converted name, size | per row, see its state | name, danger icon | name, "Cancelled" | name, type, lock on the chip | name, controls `aria-disabled` |
| Row, second line | size | size | size, info notes (mismatch, lossy, fonts) | same | progress bar and percent, or "working…", "queued" | size and notes | per row | short reason | hidden | size, "Needs Office pack" | size |
| Row select | n/a | hidden | shows the chosen format or "Choose format" | `aria-disabled` | hidden (shows "→ PNG") | hidden | hidden | hidden (Retry instead) | hidden (Retry instead) | shows the locked chip | `aria-disabled` |
| Format popover | n/a | opens, chips dimmed until `targets()` answers | all states per chip (available, locked, not possible) | closed | n/a | n/a | n/a | n/a | n/a | locked chip opens Engines | closed |
| Options button | n/a | hidden | enabled, or `aria-disabled` when the route has no options, dot when custom | `aria-disabled` | hidden | hidden | hidden | hidden | hidden | enabled | `aria-disabled` |
| Merge group | n/a | n/a | header, members, Unmerge | header `aria-busy` | one bar, step n of N, members done, current, waiting | collapsed result row | collapsed result row or failed row | failed row | cancelled row | header shows the lock | `aria-disabled` |
| Result row (done) | n/a | n/a | n/a | n/a | n/a | name, size, Done, Show in folder (Open folder for many outputs), info notes | per row | n/a | n/a | n/a | n/a |
| Failed row | n/a | n/a | n/a | n/a | n/a | n/a | one per failed row | text from `translate("error.<code>", params)`, Details = `detail`, Retry only if retryable | n/a | n/a | n/a |
| Bottom bar: Save to | hidden | hidden | enabled | `aria-disabled` | enabled | enabled | enabled | enabled | enabled | enabled | `aria-disabled` |
| Bottom bar: Convert | hidden | `aria-disabled`, "waiting for detection" | enabled, "Convert N" (N = ready rows) | `aria-busy`, "Converting…" | `aria-disabled` when no row is ready, else enabled | `aria-disabled`, nothing ready | enabled if rows are ready | enabled if rows are ready | enabled if rows are ready | `aria-disabled`, reason "Needs Office pack" | `aria-disabled`, reason "Converter unavailable" |
| Options for all | hidden | hidden | enabled | `aria-disabled` | hidden | hidden | hidden | hidden | hidden | enabled | `aria-disabled` |
| Core banner | hidden | hidden | hidden | hidden | hidden (restarting shows "Converter restarting…", running rows fail with `CORE_CRASHED`) | hidden | hidden | hidden | hidden | hidden | "Converter unavailable, restart fileCon" with Quit |
| Toast | folder drop: "Added N files, skipped M hidden" (or "Added the first 1000 files") | same | same | none | none | none | none | none | none | none | none |

**Other elements**

| Element | States |
|---|---|
| Engines row | ready · not found · checking (spinner) · error (found but `--version` failed, text from `engine.error.<code>`) |
| Install assistant | download: confirm → downloading (bytes) → verifying → unpacking → done / failed (message + Retry) · command: list with Copy → Re-check → found / still missing |
| Extract action | hidden (not a PDF row) · ready · locked (needs PDF pack). "Split into pages" sits next to "Extract images" and never needs a pack |

## 6. Components

`AppShell` (nav, CoreBanner) · `DropZone` (full or slim) · `FileList` · `FileRow` (the morphing row: ready, running, result) · `FormatPopover` (search, categories, chips) · `RowSelect` (the button that opens it) · `RowOptions` (the options popover) · `MergeGroup` · `ResultRow` · `HeaderBar` (counts, Convert all to, Options for all, Merge…, Clear, Clear finished) · `ActionBar` (sticky: Save to and Convert) · `EnginesTable` · `InstallDialog` · `SettingsForm` · `Toast`

- State lives in one store (React context + reducer). Its slices and event wiring are in [ARCHITECTURE section 13](ARCHITECTURE.md#13-renderer-architecture), and the flows are in [FLOWS](FLOWS.md). The store keeps a **target and options per file** (not one for the batch) and asks `targets()` per row.
- Primitives (Button, Badge, Chip, Select, Checkbox, RadioGroup, Progress, Tooltip, Popover, Dialog) are copied into `renderer/components/ui/` in shadcn style on Radix, styled with Tailwind v4 reading the tokens of [section 8](#8-design-system). Icons come from `lucide-react`. This replaces the earlier "no UI library" plan (decided at the M1-F review).
- Settings shows Theme as a 3-way choice (System, Light, Dark), Accent as swatches with text names (not color alone), and Language as a list of shipped locales plus "System". Each applies instantly, without a reload.

## 7. Accessibility

- [ ] The drop zone is also a button that opens the file dialog (Enter or Space).
- [ ] The file list can be reordered with the keyboard (Alt+↑ / Alt+↓) as well as by drag.
- [ ] Job progress is announced through an `aria-live="polite"` region, with throttled updates.
- [ ] Every icon-only control has an `aria-label`. Badges have text equivalents (⚠ → "format mismatch").
- [ ] Contrast meets the targets of [section 8.4](#84-contrast-enforced-by-test) in both modes for **every accent**, and focus rings are always visible.
- [ ] Nothing relies on color alone. Each state has an icon and text.
- [ ] The format popover is a combobox: a search input, a listbox of chips, `aria-activedescendant`, focus back to its button on close. A chip that is not possible uses `aria-disabled` and keeps its reason in `aria-describedby`.
- [ ] The options popover is a labeled dialog with a focus trap, Esc closes, focus returns to its button, and each error is tied to its field with `aria-describedby`.
- [ ] Unavailable controls use `aria-disabled` and CSS, never the native `disabled` ([section 8.9](#89-rules), rule 5).
- [ ] The rows are a list, and each row's status text is in an `aria-live="polite"` region that updates at most 10 times a second.
- [ ] The bottom bar is reachable by Tab in a fixed order (Save to, then Convert), and the header controls come before the list.

## 8. Design system

The rules every screen follows. The tokens live in `renderer/theme/tokens.ts` (built in M1-F6), and a test enforces the contrast table below. Colors have two tiers: **ramps** (raw colors, only here and in `tokens.ts`) and **roles** (what components use). Components only ever see roles, as CSS variables.

### 8.1 Direction

Calm and neutral, like a tool: cool-gray surfaces, one accent (blue by default), thin borders, almost no shadow, 6 to 8 px corners and the system font. Information first, decoration never.

### 8.2 Ramps

Eleven steps per ramp, from 50 (lightest) to 950 (darkest). Success uses the green ramp, warning amber, info sky and danger red.

| Ramp | 50 | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 | 950 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| neutral | `#f6f7f9` | `#eceef2` | `#dde0e7` | `#c4c9d4` | `#9aa1b0` | `#717889` | `#565d6e` | `#3f4552` | `#2a2e38` | `#1c1f26` | `#12141a` |
| blue | `#eff6ff` | `#dbeafe` | `#bfdbfe` | `#93c5fd` | `#60a5fa` | `#3b82f6` | `#2563eb` | `#1d4ed8` | `#1e40af` | `#1e3a8a` | `#172554` |
| green | `#f0fdf4` | `#dcfce7` | `#bbf7d0` | `#86efac` | `#4ade80` | `#22c55e` | `#16a34a` | `#15803d` | `#166534` | `#14532d` | `#052e16` |
| purple | `#faf5ff` | `#f3e8ff` | `#e9d5ff` | `#d8b4fe` | `#c084fc` | `#a855f7` | `#9333ea` | `#7e22ce` | `#6b21a8` | `#581c87` | `#3b0764` |
| orange | `#fff7ed` | `#ffedd5` | `#fed7aa` | `#fdba74` | `#fb923c` | `#f97316` | `#ea580c` | `#c2410c` | `#9a3412` | `#7c2d12` | `#431407` |
| amber | `#fffbeb` | `#fef3c7` | `#fde68a` | `#fcd34d` | `#fbbf24` | `#f59e0b` | `#d97706` | `#b45309` | `#92400e` | `#78350f` | `#451a03` |
| sky | `#f0f9ff` | `#e0f2fe` | `#bae6fd` | `#7dd3fc` | `#38bdf8` | `#0ea5e9` | `#0284c7` | `#0369a1` | `#075985` | `#0c4a6e` | `#082f49` |
| red | `#fef2f2` | `#fee2e2` | `#fecaca` | `#fca5a5` | `#f87171` | `#ef4444` | `#dc2626` | `#b91c1c` | `#991b1b` | `#7f1d1d` | `#450a0a` |

### 8.3 Roles

Each role points at a ramp step per mode. `X` is the chosen accent ramp (blue, green, purple or orange).

| Role (CSS variable) | Light | Dark | Used for |
|---|---|---|---|
| `--bg` | white | neutral 950 | Page background |
| `--surface` | neutral 50 | neutral 900 | Bars, panels, rows |
| `--surface-raised` | white | neutral 800 | Popovers, dialogs, menus |
| `--border` | neutral 300 | neutral 700 | Dividers and card edges (decorative) |
| `--border-strong` | neutral 500 | neutral 500 | Edges of inputs, chips and checkboxes (a part you need to see) |
| `--fg` | neutral 900 | neutral 50 | Primary text |
| `--muted` | neutral 600 | neutral 300 | Secondary text: sizes, hints, labels |
| `--fg-disabled` | neutral 500 | neutral 500 | Disabled controls. WCAG exempts them, but they stay readable |
| `--accent` | X 700 | X 400 | Links, selected state, primary button fill, progress fill |
| `--accent-hover` | X 800 | X 300 | Hover and pressed on accent |
| `--accent-subtle` | X 50 | X 950 | Selected row or chip background |
| `--accent-fg` | white | neutral 950 | Text and icons on an accent fill |
| `--focus-ring` | X 700 | X 400 | Keyboard focus outline |
| `--success`, `--warning`, `--info`, `--danger` | green, amber, sky, red 700 | same ramps 300 | Status text and icons |
| `--<status>-subtle` | ramp 50 | ramp 950 | Status background (alert, row, badge) |
| `--<status>-border` | ramp 300 | ramp 800 | Status edge (decorative) |
| `--overlay` | neutral 950 at 50% | black at 60% | Dialog backdrop |
| `--shadow` | neutral 950 at 16% | black at 50% | The one popover and dialog shadow |

`--bg --surface --fg --muted --border --danger --accent --accent-fg` keep their names from M1-7a, so M1-F6 only adds roles.

### 8.4 Contrast (enforced by test)

The targets are WCAG 2.2: **7:1** (AAA) for primary text, **4.5:1** (AA) for all other text, and **3:1** for the parts you need to see (input edges, the focus ring and disabled text). The test runs every row below in both modes and for every accent, and fails on the first pair that drops under its target. The ranges show the spread across the four accents. These numbers come from the palette above.

| Pair (text or part on background) | Target | Light | Dark |
|---|---|---|---|
| `fg` on `bg` | 7:1 | 16.5 | 17.2 |
| `muted` on `bg` | 4.5:1 | 6.6 | 11.1 |
| `accent` on `bg` | 4.5:1 | 5.0 to 7.0 | 7.0 to 10.6 |
| `border-strong` on `bg` | 3:1 | 4.4 | 4.2 |
| `focus-ring` on `bg` | 3:1 | 5.0 to 7.0 | 7.0 to 10.6 |
| `fg-disabled` on `bg` | 3:1 | 4.4 | 4.2 |
| `fg` on `surface` | 7:1 | 15.4 | 15.4 |
| `muted` on `surface` | 4.5:1 | 6.1 | 9.9 |
| `accent` on `surface` | 4.5:1 | 4.7 to 6.5 | 6.2 to 9.5 |
| `border-strong` on `surface` | 3:1 | 4.1 | 3.7 |
| `focus-ring` on `surface` | 3:1 | 4.7 to 6.5 | 6.2 to 9.5 |
| `fg-disabled` on `surface` | 3:1 | 4.1 | 3.7 |
| `fg` on `surface-raised` | 7:1 | 16.5 | 12.7 |
| `muted` on `surface-raised` | 4.5:1 | 6.6 | 8.2 |
| `accent` on `surface-raised` | 4.5:1 | 5.0 to 7.0 | 5.1 to 7.8 |
| `border-strong` on `surface-raised` | 3:1 | 4.4 | 3.1 |
| `focus-ring` on `surface-raised` | 3:1 | 5.0 to 7.0 | 5.1 to 7.8 |
| `fg-disabled` on `surface-raised` | 3:1 | 4.4 | 3.1 |
| `fg` on `accent-subtle` | 7:1 | 15.2 to 15.8 | 13.7 to 14.6 |
| `accent` on `accent-subtle` | 4.5:1 | 4.8 to 6.5 | 5.7 to 8.6 |
| `focus-ring` on `accent-subtle` | 3:1 | 4.8 to 6.5 | 5.7 to 8.6 |
| `accent-fg` on `accent` | 4.5:1 | 5.0 to 7.0 | 7.0 to 10.6 |
| `accent-fg` on `accent-hover` | 4.5:1 | 7.1 to 8.7 | 10.2 to 13.1 |
| `success` on `bg` | 4.5:1 | 5.0 | 13.1 |
| `success` on `surface` | 4.5:1 | 4.7 | 11.7 |
| `success` on `surface-raised` | 4.5:1 | 5.0 | 9.7 |
| `success` on `success-subtle` | 4.5:1 | 4.8 | 10.6 |
| `fg` on `success-subtle` | 7:1 | 15.8 | 13.9 |
| `warning` on `bg` | 4.5:1 | 5.0 | 12.8 |
| `warning` on `surface` | 4.5:1 | 4.7 | 11.4 |
| `warning` on `surface-raised` | 4.5:1 | 5.0 | 9.4 |
| `warning` on `warning-subtle` | 4.5:1 | 4.8 | 10.4 |
| `fg` on `warning-subtle` | 7:1 | 15.9 | 14.0 |
| `info` on `bg` | 4.5:1 | 5.9 | 11.0 |
| `info` on `surface` | 4.5:1 | 5.5 | 9.9 |
| `info` on `surface-raised` | 4.5:1 | 5.9 | 8.1 |
| `info` on `info-subtle` | 4.5:1 | 5.6 | 8.3 |
| `fg` on `info-subtle` | 7:1 | 15.5 | 12.9 |
| `danger` on `bg` | 4.5:1 | 6.5 | 9.7 |
| `danger` on `surface` | 4.5:1 | 6.0 | 8.7 |
| `danger` on `surface-raised` | 4.5:1 | 6.5 | 7.2 |
| `danger` on `danger-subtle` | 4.5:1 | 5.9 | 8.5 |
| `fg` on `danger-subtle` | 7:1 | 15.1 | 15.1 |


`--border`, `--<status>-border`, `--overlay` and `--shadow` are decorative and are not tested. Status colors are checked as text on the page, the surfaces and their own subtle background, so an icon and its label can sit anywhere.

### 8.5 Type

System font stack: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`, and `ui-monospace, Menlo, Consolas, monospace` for paths and engine output. Weights 400, 500 and 600 only.

| Token | Size / line height | Weight | Used for |
|---|---|---|---|
| `text-xs` | 0.75rem / 1rem | 400 | File sizes, hints, badges |
| `text-sm` | 0.875rem / 1.25rem | 400 and 500 | Row text, controls, buttons (the default) |
| `text-base` | 1rem / 1.5rem | 500 | File names in a row, dialog text |
| `text-lg` | 1.25rem / 1.75rem | 600 | Page and dialog titles |
| `text-xl` | 1.5rem / 2rem | 600 | Empty-state headline |

Sizes are `rem`, so the OS font scale and browser zoom work. Nothing is set in `px` except borders and focus rings.

### 8.6 Space, shape and size

- **Spacing:** a 4 px base, steps of 4, 8, 12, 16, 24 and 32 px. Rows use 12 px of padding, groups 16 px apart.
- **Radius:** 6 px for controls, chips and badges, 8 px for cards, popovers and dialogs. Status badges may be pill shaped.
- **Elevation:** borders first. Only popovers and dialogs get `--shadow` (0 8px 24px).
- **Sizes:** controls are 32 px high (28 px in a dense row), and no target is smaller than 24 by 24 px (WCAG 2.2). A file row is at least 56 px high (two lines).
- **Icons:** `lucide-react`, 16 px beside text and 20 px alone, stroke 1.75, `aria-hidden` when a label is next to them and `aria-label` when they stand alone.

### 8.7 Motion and focus

- Motion is 150 ms ease-out for hover, popovers and chips, and the progress fill eases over 100 ms. Under `prefers-reduced-motion: reduce` every transition and animation is off, and the indeterminate bar becomes a static striped bar.
- Focus is always visible: `outline: 2px solid var(--focus-ring)` with a 2 px offset, on every focusable element, never removed. The ring must hold 3:1 against whatever it touches (the rows above check the surfaces and `--accent-subtle`).
- Hover and pressed never rely on color alone: they also change the fill step (`--accent-hover`) or add an underline.

### 8.8 Status and state, never by color alone

Every status shows an **icon plus text**, in its status color on its subtle background: success (check, "Done"), warning (triangle, "Lossy" or "Format mismatch"), info (circle-i, route and font notes), danger (x-circle, the error text) and locked (lock, "Needs Office pack"). A selected chip also shows a check, and a disabled chip is dashed and dimmed, with its reason as text.

### 8.9 Rules

1. Components use roles through `var(--…)` (or the Tailwind theme that reads them), never a ramp step or a hex value. `no-raw-colors` already refuses hex outside `tokens.ts`.
2. Text comes from `translate()`, and layout uses logical properties only, so a right-to-left language needs no redesign.
3. `forced-colors: active` (Windows high contrast): borders, focus and status icons fall back to system colors (`CanvasText`, `Highlight`, `GrayText`), and no meaning is carried by a background alone.
4. The page follows the OS theme by default, and Settings can force light or dark and pick one of the four accents. Both modes and all four accents must pass section 8.4.
5. **Unavailable is `aria-disabled`, not `disabled`.** The native `disabled` attribute takes a control out of the tab order and hides it from screen readers, so nobody learns why it is off. A control that is unavailable (a format the file can't convert to, Convert with nothing to do, an options button with no options) keeps `aria-disabled="true"`, stays focusable, is dimmed and dashed by CSS (`[aria-disabled='true']`), ignores activation, and names its reason in `aria-describedby` (also shown as a tooltip). A busy control (Convert while submitting) uses `aria-busy` the same way. Native `disabled` is kept for controls whose state nobody needs explained. Tailwind variant: `aria-disabled:`.

### 8.10 Changing it later

- **A color looks off:** move the role to another step of its ramp in `tokens.ts`. The test names every pair that no longer passes.
- **A different brand color:** replace one ramp. Its roles stay as they are.
- **A new accent:** add one ramp and one entry in `ACCENTS`. The test covers it automatically, because it loops over `ACCENTS`.
- **A new status or role:** add the role to the table above and to `tokens.ts`, and add its pairs to the contrast table.
