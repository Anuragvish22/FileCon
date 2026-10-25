# Release smoke check

Everything here is manual. Run by hand on a fresh install of the packaged app, before each release (BUILD-PLAN section 3 has the full M1 checklist).

## Shared across all platforms

- [ ] The app starts with no setup and shows the empty drop zone
- [ ] A JPG converts to PNG, WebP and AVIF; outputs open in a viewer
- [ ] Three images merge to one PDF in the chosen order
- [ ] A DOCX converts to PDF when LibreOffice is installed, and says what is missing when it is not
- [ ] A long conversion can be cancelled with X, Clear and Cancel all
- [ ] Output never overwrites an existing file
- [ ] Source files are unchanged
- [ ] No network traffic while converting
- [ ] Settings (theme, accent, language, output folder) survive a restart
- [ ] Uninstall removes the app and leaves no temp folders

## Windows-specific

- [ ] The installer runs, and the app starts from the Start menu
- [ ] SmartScreen and antivirus behaviour is noted
- [ ] Works on a path with spaces and non-ASCII letters

## Linux-specific

- [ ] The AppImage or package starts on a current Ubuntu
- [ ] Works on both X11 and Wayland

## Mac-specific

- [ ] The app opens after download (Gatekeeper, signing, notarisation)
- [ ] Works on Apple silicon and on Intel
