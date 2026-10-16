# fileCon — UI/UX Design

Status: draft v0 · Related: [PRD](PRD.md) · [TRD](TRD.md) · [Architecture](ARCHITECTURE.md) · [Index](INDEX.md)

The UI talks to the system only through `window.filecon` ([ARCH section 8](ARCHITECTURE.md#8-ipc-contract)).

## 1. Principles

1. **First conversion with zero config.** Drop, pick, convert. No settings needed.
2. **No surprises.** Lossy routes, missing packs and format mismatches show up **before** the user clicks Convert.
3. **Show only what's possible.** The target list contains reachable formats only. Pack-gated formats are clearly marked.
4. **Originals are sacred.** The UI never offers an "overwrite" option.
5. **Keyboard-first and accessible.** Everything can be reached with Tab, Enter, Space and the arrow keys ([section 7](#7-accessibility)).
6. **Follows the OS.** Light and dark theme come from `prefers-color-scheme`, and system fonts are used.

## 2. Screens

| Screen | Purpose | Entry |
|---|---|---|
| **Main** | Drop files, see detection, pick target, convert | App start |
| **Jobs panel** | Progress, cancel, open output, errors | Docked at the bottom of Main. It expands when jobs exist |
| **Engines** | Pack status, paths, versions, install links | Sidebar or top-nav tab |
| **Settings** | Output folder, concurrency, engine priority and path overrides | Sidebar or top-nav tab |

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
└──────────────────────────────────────────────────────────────────────┘
```

**Target picker (open)**
```
 ┌ Convert to ───────────────┐
 │ Images                    │
 │   PNG   WEBP   AVIF  TIFF │
 │ Documents                 │
 │   PDF                     │
 │   DOCX  ⚠ lossy           │   ← tooltip: "layout approximate"
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
```

## 4. Flows

| Flow | Steps | Notes |
|---|---|---|
| Single convert | drop → auto-detect → pick target → Convert → job done → Show in folder | Target defaults to the last-used target if it's valid |
| Batch | drop N → common targets shown → Convert → N jobs | One failure doesn't block the rest |
| Merge to PDF | drop N → target PDF → tick Merge → reorder → Convert → 1 job | The Merge toggle shows only for N ≥ 2 and target = pdf |
| Missing engine | pick a 🔒 target → dialog: "Needs Office pack (LibreOffice)" with [Install guide] [Set path] | After a path is set, the target list refreshes |
| Mismatch | ⚠ badge on the file row. The conversion uses the **detected** format | Tooltip explains what was detected |
| Lossy | ⓘ line under the picker lists the route's lossy notes | Shown, not blocking |
| Cancel | [Cancel] → state `cancelled` within 2 s | No partial output is left behind |
| Failure | ✗ row with a short reason, plus [Details] (engine stderr) and [Retry] | Retry resubmits the same job |

## 5. States

| Element | States |
|---|---|
| Drop zone | empty · drag-over (highlighted) · files loaded (collapses into the file list) |
| File row | detecting (spinner) · ready · mismatch ⚠ · unsupported (no targets) ✗ |
| Target picker | disabled (no files) · options · no common target ("These files share no output format") |
| Convert button | disabled (no target) · enabled · busy while submitting |
| Job row | queued · running (step i/n + %) · done ✓ · failed ✗ · cancelled ⊘ |
| Engines row | ready ✓ · not found ✗ · checking ⟳ · error (found but `--version` failed) |

## 6. Components

`AppShell` (nav) · `DropZone` · `FileList` / `FileRow` (drag handle, badge, remove) · `TargetPicker` (grouped, with lossy and pack badges) · `RouteHint` · `OutputChooser` · `ConvertButton` · `JobsPanel` / `JobRow` · `EnginesTable` · `SettingsForm` · `Toast`

- State lives in one small store (React context + reducer). It's fed by `job:progress` events.
- No UI library is planned for v1: plain CSS with CSS variables for theme tokens. This gets revisited if it becomes painful.

## 7. Accessibility

- [ ] The drop zone is also a button that opens the file dialog (Enter or Space).
- [ ] The file list can be reordered with the keyboard (Alt+↑ / Alt+↓) as well as by drag.
- [ ] The target picker is a proper listbox (`role="listbox"`, arrow keys, typeahead).
- [ ] Job progress is announced through an `aria-live="polite"` region, with throttled updates.
- [ ] Every icon-only control has an `aria-label`. Badges have text equivalents (⚠ → "format mismatch").
- [ ] Contrast is ≥ 4.5:1 in both themes, and focus rings are always visible.
- [ ] Nothing relies on color alone. Each state has an icon and text.
