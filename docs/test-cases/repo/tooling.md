# Repo rules checked by tests

Test entries read: `file`: "test name". Files are under `test/tooling/`.

## Shared across all platforms

### Docs

- [x] The real docs and README have no broken link or anchor. `check-docs.test.ts`: "passes on the real docs and the README"
- [x] The checker itself is right: resolves links against the file's own folder; passes valid same-file and cross-file anchors; fails on a broken anchor; fails on a missing file; ignores links in code and external links; slugs like GitHub, including duplicates and symbols. `check-docs.test.ts`: six more tests under "docs:check"

### Text and keys

- [x] `en.json` has `error.<code>` for every error code. `i18n-keys.test.ts`: "error.<code> for every error code"
- [x] It has `format.<id>` and `category.<category>` for every format. `i18n-keys.test.ts`: "format.<id> and category.<category> for every format"
- [x] It has `pack.<id>` for every pack an engine or converter belongs to. `i18n-keys.test.ts`: "pack.<id> for every pack that an engine or converter belongs to"
- [x] It has `lossy.<id>` for every lossy edge. `i18n-keys.test.ts`: "lossy.<id> for every lossy edge"
- [x] It has `invalid.<what>` for every `INVALID_REQUEST` reason. `i18n-keys.test.ts`: "invalid.<what> for every INVALID_REQUEST reason"
- [x] It has no key that nothing refers to (a typo guard). `i18n-keys.test.ts`: "has no key that nothing refers to (a typo guard)"
- [x] A component with a literal string fails; one that uses `translate()` passes. `jsx-literals.test.ts`: "fails a component with a literal string and passes one that uses translate()"

### Lint rules

- [x] Core may not import `electron` (hard rule 1); the app may. `lint-rules.test.ts`: "core may not import electron"; "app may import electron"
- [x] One-letter names, bare boolean arguments, magic numbers and 4 positional parameters are rejected; named fields and named constants pass. `lint-rules.test.ts`: "naming rule" (four tests)
- [x] Physical CSS classes (`ml-2`, `pl-3`, `left-0`, `text-right`, `border-l`, `rounded-r-md` and more) are rejected; logical ones (`ms-2`, `ps-3`, `start-0`, `text-start`, `border-s`, `rounded-e-md`) pass; template strings are checked too. `lint-rules.test.ts`: "logical properties only" (three tests)
- [x] No hex colour outside the theme tokens. `no-raw-colors.test.ts`: "no hex color outside theme/tokens.ts"

### Layout and contracts

- [x] No test files under `packages/*/src`. `layout.test.ts`: "has no test files under packages/*/src"
- [x] The IPC channel list agrees with the code and with CONTRACTS. `ipc-channels.test.ts`: three tests
- [x] Core and the app agree on settings validation (P29). `settings-agree.test.ts`: "both accept the defaults"; "both reject: %s"; "main rejects: %s"
- [x] The renderer's page policy is strict. `csp.test.ts`: two tests
- [x] The bundled sharp worker is built under the name the converter spawns (it was missing as `worker.js` in the built app). `bundle-worker.test.ts`: "is built as out/main/worker.js, the file the converter spawns when bundled"
- [ ] Hard rule 3 (no `shell: true`, no string commands) is enforced by a lint rule, not only by the type check in `spawn.test.ts`
- [ ] No network call exists in the code (hard rule 8): a lint or grep test for `fetch`, `http`, `net` outside the engine download
- [ ] No `eval`, `new Function` or dynamic `require` with input content (hard rule 10)
- [ ] The renderer cannot import from `electron` or `node:` (hard rule 6)
- [ ] The list of cases in `docs/test-cases` names only test files that exist (a small checker, like docs:check)

# Needs manual testing

## Shared across all platforms

- [ ] The CI matrix (Ubuntu, Windows, macOS) is green on the latest commit before a release
