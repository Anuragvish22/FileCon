# fileCon — UI/UX Design

Status: draft v0 · Related: [PRD](PRD.md) · [TRD](TRD.md) · [Architecture](ARCHITECTURE.md) · [Index](INDEX.md)

The UI talks to the system only through `window.filecon` ([CONTRACTS section 7](CONTRACTS.md#7-ipc-renderer--main)).

## 1. Principles

1. **First conversion with zero config.** Drop, pick, convert. No settings needed.
2. **No surprises.** Lossy routes, missing packs and format mismatches show up **before** the user clicks Convert.
3. **Show only what's possible.** The target list contains reachable formats only. Pack-gated formats are clearly marked.
4. **Originals are sacred.** The UI never offers an "overwrite" option.
5. **Keyboard-first and accessible.** Everything can be reached with Tab, Enter, Space and the arrow keys ([section 7](#7-accessibility)).
6. **Follows the OS by default.** Theme follows `prefers-color-scheme`, language follows the OS locale, and system fonts are used. Theme (system, light, dark), accent color and language can each be overridden in Settings.
7. **No hard-coded text or colors.** Every string comes from `t()` and the locale file, and every color from a theme token ([CONTRACTS section 10](CONTRACTS.md#10-text-and-themes)). Layout uses CSS logical properties so right-to-left languages work later without a redesign.

## 2. Screens

| Screen | Purpose | Entry |
|---|---|---|
| **Main** | Drop files, see detection, pick target, convert | App start |
| **Jobs panel** | Progress, cancel, open output, errors | Docked at the bottom of Main. It expands when jobs exist |
| **Engines** | Pack status, paths, versions, install links | Sidebar or top-nav tab |
| **Settings** | Output folder, concurrency, engine priority and path overrides, theme, accent, language | Sidebar or top-nav tab |

## 3. Wireframes

**Main, empty**
```
┌ fileCon ───────────────────────────── [Convert] [Engines] [Settings] ┐
│                                                                      │
│        ┌──────────────────────────────────────────────┐             │
│        │      Drop files here  ·  or  [Choose files]   │             │
│        └──────────────────────────────────────────────┘             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

**Main, files loaded**
```
┌ fileCon ───────────────────────────── [Convert] [Engines] [Settings] ┐
│ Files (3)                                              [+ Add] [Clear]│
│  ≡ photo.jpg     JPG   2.1 MB                                    [×] │
│  ≡ scan.jpg      WEBP ⚠ extension says JPG                       [×] │
│  ≡ report.docx   DOCX  48 KB                                     [×] │
│                                                                      │
│ Convert to: [ PDF ▾ ]   ☑ Merge into one PDF (drag ≡ to reorder)    │
│   ⓘ report.docx → PDF via LibreOffice                                │
│ Save to:  ◉ Same folder as source  ○ [Choose folder…]                │
│                                                         [ Convert ] │
├─ Jobs ───────────────────────────────────────────────────────────────┤
│  ✓ photo.png        done                       [Show in folder]     │
│  ⟳ merged.pdf       step 2/3  ██████░░░  64%   [Cancel]             │
│  ⟳ report.pdf       step 1/1  ░▒▓░░░ working…  [Cancel]             │
└──────────────────────────────────────────────────────────────────────┘
```

**Target picker (open)**
```
 ┌ Convert to ───────────────┐
 │ Images                    │
 │   PNG   WEBP   AVIF  TIFF │
 │ Documents                 │
 │   PDF                     │
 │   DOCX  ⚠ lossy           │   ← tooltip: t("lossy.layout-approx")
 │ Unavailable               │
 │   ODT   🔒 needs Office   │   ← click → Engines page
 └───────────────────────────┘
```

**Engines**
```
 Pack      Engine        Status        Path / Version                 
 builtin   sharp         ✓ ready       bundled · 0.33                 
 builtin   pdf-lib       ✓ ready       bundled · 1.17                 
 office    LibreOffice   ✗ not found   [Set path…] [How to install ↗] 
 media     FFmpeg        ✓ ready       /usr/bin/ffmpeg · 6.1          
 pdf       Poppler       ✗ not found   [Install (43.7 MB)] [Set path…]  ← Windows
 pdf       Poppler       ✗ not found   [How to install] [Re-check]      ← macOS / Linux
```

**PDF row selected (M1.1)**
```
 Convert to: [ PNG ▾ ]      or   [ Extract images ]
 Pages: [ 2-3,7      ]  (empty = all)    DPI: [ 150 ▾ ]
   ⓘ report.pdf → one PNG per page, saved in "report (png)/"
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
| Single convert | drop → auto-detect → pick target → Convert → job done → Show in folder | Target defaults to the last-used target if it's valid |
| Batch | drop N → common targets shown → Convert → N jobs | One failure doesn't block the rest |
| Merge to PDF | drop N → target PDF → tick Merge → reorder → Convert → 1 job | The Merge toggle shows only for N ≥ 2 and target = pdf |
| Missing engine | pick a 🔒 target → dialog: "Needs Office pack (LibreOffice)" with [Install guide] [Set path] | After a path is set, the target list refreshes |
| PDF to images | PDF row → target PNG/JPG/TIFF → optional Pages and DPI → Convert → "report (png)/" | Pages are validated as you type (red outline + message on bad syntax) |
| Extract images | PDF row → [Extract images] → optional Pages → 1 job per PDF → "report (images)/" | "No embedded images found" shows as an info row, not an error |
| Install engine | 🔒 target or Extract on a missing Poppler → Install assistant ([FLOWS F16](FLOWS.md#f16-install-an-engine)) | On success the 🔒 disappears with no restart |
| Mismatch | ⚠ badge on the file row. The conversion uses the **detected** format | Tooltip explains what was detected |
| Lossy | ⓘ line under the picker lists the route's lossy notes | Shown, not blocking. Losses found while running (`Job.notes`, e.g. downscaled) show on the done row the same way |
| Cancel | [Cancel] → state `cancelled` within 2 s | No partial output is left behind |
| Failure | ✗ row with a short reason, plus [Details] (engine stderr) and [Retry] | Retry resubmits the same job |

## 5. States

| Element | States |
|---|---|
| Drop zone | empty · drag-over (highlighted) · files loaded (collapses into the file list) |
| File row | detecting (spinner) · ready · mismatch ⚠ · unsupported (no targets) ✗ |
| Target picker | disabled (no files) · options · no common target ("These files share no output format") |
| Convert button | disabled (no target) · enabled · busy while submitting |
| Job row | queued · running (step i/n + %, or an indeterminate bar with "working…" when `fraction` is null) · done ✓ ("Show in folder", or "Open folder" for multi-output) · failed ✗ (`t("error.<code>", params)` from [CONTRACTS section 5](CONTRACTS.md#5-errors), Details = `detail`, Retry only if retryable) · cancelled ⊘ |
| OptionsBar | hidden (route has no options) · shows only the keys in `TargetOption.options`: Quality slider 1–100, Page size auto/A4/Letter, DPI, Pages text field (`2-3,7`, invalid = red outline + "Use numbers and ranges like 1-3,7") |
| Extract action | hidden (not all rows are PDF) · ready · 🔒 needs PDF pack |
| Install assistant | download: confirm → downloading (bytes) → verifying → unpacking → done / failed (message + Retry) · command: list with Copy → Re-check → found / still missing |
| Core banner | hidden (`ready`) · "Starting…" (`starting`) · "Converter restarting…" (`restarting`) · "Converter unavailable, restart fileCon" with a Quit button (`unavailable`) |
| Folder drop | toast "Added N files, skipped M hidden". When capped: "Added the first 1000 files" |
| Engines row | ready ✓ · not found ✗ · checking ⟳ · error (found but `--version` failed) |

## 6. Components

`AppShell` (nav, CoreBanner) · `DropZone` · `FileList` / `FileRow` (drag handle, badge, remove) · `TargetPicker` (grouped, with lossy and pack badges) · `OptionsBar` · `ExtractButton` · `RouteHint` · `OutputChooser` · `ConvertButton` · `JobsPanel` / `JobRow` · `EnginesTable` · `InstallDialog` · `SettingsForm` · `Toast`

- State lives in one store (React context + reducer). Its slices and event wiring are in [ARCHITECTURE section 13](ARCHITECTURE.md#13-renderer-architecture), and the flows are in [FLOWS](FLOWS.md).
- No UI library is planned for v1: plain CSS with CSS variables for theme tokens. This gets revisited if it becomes painful.
- Settings shows Theme as a 3-way choice (System, Light, Dark), Accent as swatches with text names (not color alone), and Language as a list of shipped locales plus "System". Each applies instantly, without a reload.

## 7. Accessibility

- [ ] The drop zone is also a button that opens the file dialog (Enter or Space).
- [ ] The file list can be reordered with the keyboard (Alt+↑ / Alt+↓) as well as by drag.
- [ ] The target picker is a proper listbox (`role="listbox"`, arrow keys, typeahead).
- [ ] Job progress is announced through an `aria-live="polite"` region, with throttled updates.
- [ ] Every icon-only control has an `aria-label`. Badges have text equivalents (⚠ → "format mismatch").
- [ ] Contrast is ≥ 4.5:1 in both modes for **every accent**, and focus rings are always visible.
- [ ] Nothing relies on color alone. Each state has an icon and text.
