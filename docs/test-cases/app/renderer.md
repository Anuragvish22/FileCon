# Renderer

## Shared across all platforms

- [x] Text contrast meets the table for all 5 accents in light and dark (covered by: `packages/app/test/renderer/tokens.test.ts`)
- [x] No text literals in JSX (covered by: `test/tooling/jsx-literals.test.ts`)
- [x] Every text key exists in `en.json` (covered by: `test/tooling/i18n-keys.test.ts`)
- [ ] Core down dims the drop zone and says why; core back restores it
- [ ] Empty, one-file, many-file, error and done states all render
- [ ] A very long file name is shortened in the middle and shown in full on hover
- [ ] Focus is never lost after a row is removed

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
