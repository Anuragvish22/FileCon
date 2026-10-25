# Renderer: components, theme and text

Test entries read: `file`: "test name". Files are under `packages/app/test/` (or `test/tooling/`).

## Shared across all platforms

### Components

- [x] Each primitive takes focus and has an accessible name: Button, Chip as a toggle, Checkbox, RadioGroup (one radio per option), Select. `ui.test.tsx`: "primitives take focus and have an accessible name" (five tests)
- [x] Progress, determinate and indeterminate. `ui.test.tsx`: "Progress, determinate and indeterminate"
- [x] Badge shows its status icon and text. `ui.test.tsx`: "Badge shows its status icon and text"
- [x] A popover opens from its trigger, and focus moves inside. `ui.test.tsx`: "Popover opens from its trigger, and focus moves inside"
- [x] A dialog has a title and a named close button. `ui.test.tsx`: "Dialog has a title and a named close button"
- [x] A tooltip shows its text when the trigger gets focus. `ui.test.tsx`: "Tooltip shows its text when the trigger gets focus"
- [x] An unavailable control stays focusable, ignores clicks and keeps its reason: Button, Chip that is not possible. `ui.test.tsx`: "Button stays focusable, ignores clicks and keeps its reason"; "Chip that is not possible stays focusable, ignores clicks and says why"
- [x] A locked chip still clicks, so it can open Engines. `ui.test.tsx`: "a locked Chip still clicks, so it can open Engines"
- [x] A busy button ignores clicks and says so with `aria-busy`. `ui.test.tsx`: "a busy Button ignores clicks and says so with aria-busy"

### Theme

- [x] The contrast maths matches the WCAG reference values. `tokens.test.ts`: "matches the WCAG reference values"
- [x] Every role of the table is defined, for every mode and accent. `tokens.test.ts`: "defines every role of the table, for every mode and accent"
- [x] The contrast table has the rows of section 8.4, and every pair meets its target with each of the 5 accents, in light and dark. `tokens.test.ts`: "has the rows of section 8.4"; "every pair meets its target with the %s accent"
- [x] Applying a theme sets the tokens and the html attributes; "system" follows the OS. `tokens.test.ts`: "sets the tokens and the html attributes"; "follows the OS when the theme is system"
- [x] No hex colour outside the theme tokens. `no-raw-colors.test.ts`: "no hex color outside theme/tokens.ts"

### Text

- [x] `translate()` substitutes `{param}`, picks `.one` and `.other` from the count, formats numbers for the locale, falls back to English then to the key, warns once per missing key and never throws, and leaves a missing `{param}` visible. `i18n.test.ts`: six tests under "translate()"
- [x] A core error is translated with its params. `i18n.test.ts`: "translates a core error with its params"
- [x] No literal text in JSX. `jsx-literals.test.ts`: "fails a component with a literal string and passes one that uses translate()"
- [x] `en.json` has a text for every key core can emit (see repo/tooling.md).

### Still to test

- [ ] Focus is never lost after a row is removed
- [ ] Core down dims the drop zone and says why; core back restores it
- [ ] A very long file name is shortened in the middle and shown in full on hover
- [ ] A second language: a catalog with all keys, plural rules for that language

# Needs manual testing

## Shared across all platforms

- [ ] The whole flow works by keyboard only: add, pick format, convert, cancel, open folder
- [ ] A screen reader announces a row's name, state and progress (Orca, NVDA, VoiceOver)
- [ ] Light, dark and follow-OS themes all look right; switching is instant with no flash
- [ ] Every accent looks right by eye in both themes
- [ ] Switching the OS theme while the app is open updates the app
- [ ] Reduced motion stops all movement; forced colours stay readable
- [ ] Right-to-left layout mirrors correctly
- [ ] The window at its minimum size has no clipped text or overlapping controls
- [ ] Text 200% larger still fits
- [ ] A list of 500 rows scrolls smoothly

## Windows

- [ ] High-contrast mode is readable
- [ ] Display scaling at 125%, 150% and 200% looks right
- [ ] The title bar and window buttons match the system

## Linux

- [ ] Works under WSLg, X11 and Wayland with fractional scaling
- [ ] Dark mode follows the desktop setting

## Mac

- [ ] The window controls and menu bar behave like a native app
- [ ] Command-key shortcuts work (not only Control)
