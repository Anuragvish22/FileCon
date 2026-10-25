# Settings and the log file

Test entries read: `file`: "test name". Files are under `packages/app/test/main/` (or `test/tooling/`).

## Shared across all platforms

### Settings

- [x] With no file, the defaults are used, and a save round-trips. `settings.test.ts`: "gives the defaults when there is no file, and round-trips a save"
- [x] A corrupt file is moved to `settings.bad.json` and the defaults are used. `settings.test.ts`: "moves a corrupt file to settings.bad.json and uses the defaults"
- [x] A file with invalid values (for example an unknown accent) is moved aside too. `settings.test.ts`: "moves a file with invalid values (unknown accent) aside too"
- [x] A file from a newer version uses the defaults and is left alone, so a downgrade cannot destroy it. `settings.test.ts`: "uses the defaults for a newer version and leaves the file alone"
- [x] The defaults are accepted and unknown keys are dropped. `settings.test.ts`: "accepts the defaults and drops unknown keys"
- [x] `output.dir` is kept only for custom mode. `settings.test.ts`: "keeps output.dir only for custom mode"
- [x] A partial patch is merged one level deep. `settings.test.ts`: "merges a partial patch one level deep"
- [x] A patch that makes the result invalid, and a non-object patch, are rejected. `settings.test.ts`: "rejects a patch that makes the result invalid, and a non-object patch"
- [x] Core and the app agree on what is valid: both accept the defaults, both reject the same broken settings, and the app alone rejects a few more. `settings-agree.test.ts`: "both accept the defaults"; "both reject: %s"; "main rejects: %s"
- [ ] Two quick changes in a row are both saved, in order
- [ ] A settings folder that cannot be written keeps the app running with the settings in memory, and says so
- [ ] A settings file edited by hand to a valid but odd value (concurrency 1000) is capped

### The log file

- [x] Lines are appended in call order. `log.test.ts`: "appends lines in call order"
- [x] A file over the size limit is kept as `.1` and a new one is started. `log.test.ts`: "keeps the previous file as .1 when it is over the size limit"
- [x] The file rotates mid-session when it grows past the limit. `log.test.ts`: "rotates mid-session when the file grows past the limit"
- [x] A log that cannot be written never throws. `log.test.ts`: "never throws when the file cannot be written"
- [ ] The log holds no file contents and no engine output beyond the last lines (checked by reading, not by a test)

## Windows-specific

- [ ] The settings and log folders are under the user's app data and survive an update

## Mac-specific

- [ ] The settings and log folders are under `~/Library/Application Support`

# Needs manual testing

## Shared across all platforms

- [ ] Change theme, accent, language, output folder and concurrency, restart: everything is kept
- [ ] Delete the settings file while the app is closed: the app starts with defaults
