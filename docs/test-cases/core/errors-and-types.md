# Errors, options and the registry

Test entries read: `file`: "test name". Files are under `packages/core/test/`.

## Shared across all platforms

### Errors

- [x] A core error is built from a code and params. `errors.test.ts`: "builds a CoreError from code and params"
- [x] Detail is kept when given. `errors.test.ts`: "keeps detail when given"
- [x] The list of error codes matches the CONTRACTS table exactly, in order. `errors.test.ts`: "ERROR_CODES matches the CONTRACTS table exactly, in order"
- [x] An error survives a JSON round trip unchanged, so it can cross the process boundary. `errors.test.ts`: "survives a JSON round trip unchanged"
- [x] Only the allowed param names are accepted. `errors.test.ts`: "accepts only the allowed param names"
- [x] `CoreFailure` is a real Error whose `.error` is the plain error. `errors.test.ts`: "CoreFailure is a real Error whose .error is the plain CoreError"
- [x] A `CoreFailure` gives its plain error; `ENOSPC` becomes `DISK_FULL`; a plain Error becomes `ENGINE_FAILED` with its stack as detail; a non-Error value becomes `ENGINE_FAILED` with the value as text. `errors.test.ts`: "toCoreError" (four tests)

### Options

- [x] Empty options and every boundary value are accepted. `options.test.ts`: "accepts empty options and every value on the boundary"
- [x] An unknown page size or TIFF compression is `INVALID_REQUEST`. `options.test.ts`: "an unknown pageSize or tiffCompression is INVALID_REQUEST"

### Registry

- [x] Registration order is kept, and kinds are separate. `registry.test.ts`: "keeps registration order and separates the kinds"
- [x] A duplicate id throws, across kinds too. `registry.test.ts`: "throws on a duplicate id, across kinds too"
- [x] Lookup returns the registered object, or `undefined`. `registry.test.ts`: "returns the registered object, or undefined for an unknown id"

### Still to test

- [ ] Every error code has a text in `en.json` (covered in repo/tooling.md)
- [ ] An error from an engine with a huge stderr is cut before it crosses the process boundary (spawn cuts it to 2 KB: see jobs/spawn.md)
- [ ] A registered converter with a bad edge (negative cost, unknown format) is refused when registered
