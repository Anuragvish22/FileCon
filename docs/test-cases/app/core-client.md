# Core client (window process to core)

Test entries read: `file`: "test name". Files are under `packages/app/test/main/`.

## Shared across all platforms

- [x] A response is matched to its call by id, and ids increase. `coreClient.test.ts`: "matches a response to its call by id, with increasing ids"
- [x] Responses that arrive out of order still reach the right call. `coreClient.test.ts`: "handles responses that arrive out of order"
- [x] A core error rejects the call with that error. `coreClient.test.ts`: "rejects with the core error"
- [x] An ordinary call times out after 30 s and the late answer is dropped. `coreClient.test.ts`: "times out an ordinary call after 30 s, and drops the late answer"
- [x] `init`, `submit`, `cancel` and `shutdown` never time out. `coreClient.test.ts`: "never times out init, submit, cancel or shutdown"
- [x] `rejectAll` fails every pending call with the given error (used when core crashes). `coreClient.test.ts`: "rejectAll fails every pending call with the given error"
- [x] Events reach listeners until unsubscribed, and junk is ignored. `coreClient.test.ts`: "passes events to listeners until unsubscribed, and ignores junk"
- [ ] A call made after `rejectAll` and before the restart fails fast
- [ ] A very large reply (a 10,000-row result) arrives intact
