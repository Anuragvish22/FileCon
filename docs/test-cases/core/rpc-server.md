# Core host and RPC server

Test entries read: `file`: "test name". Files are under `packages/core/test/`.

## Shared across all platforms

- [x] Happy path: `init` discovers engines and emits `ready`. `server.test.ts`: "init discovers engines and emits ready"
- [x] The host serves RPC over an Electron-shaped port and exits after the shutdown reply. `host.test.ts`: "serves RPC over an Electron-shaped port and exits after the shutdown reply"
- [x] Before `init`, calls are answered `CORE_UNAVAILABLE`, but `init` and `shutdown` are still allowed. `server.test.ts`: "answers CORE_UNAVAILABLE before init, but still allows init and shutdown"
- [x] While `init` is still running, calls are `CORE_UNAVAILABLE`. `server.test.ts`: "answers CORE_UNAVAILABLE while init is still running"
- [x] A second `init` is refused. `server.test.ts`: "refuses a second init"
- [x] An unknown method is `INVALID_REQUEST`, ready or not. `server.test.ts`: "answers INVALID_REQUEST for an unknown method, ready or not"
- [x] A message that is not a request is ignored, so there is nothing to answer. `server.test.ts`: "ignores a message that is not a request, so there is nothing to answer"
- [x] Every method with malformed params gives `INVALID_REQUEST`. `server.test.ts`: "%s with malformed params gives INVALID_REQUEST"
- [x] Slow calls do not hold up fast ones. `server.test.ts`: "answers out of order: a fast call is not held up by a slow one"
- [x] A re-check of engines and a failed job are logged as codes, with the job id (P28), and not as prose. `server.test.ts`: "logs a re-probe and a failed job as codes, with the job id (P28)"
- [x] Settings apply: a re-check only when engine paths or priority changed. `server.test.ts`: "settings.apply re-probes only when engine paths or priority changed"
- [x] Shutdown cancels a running job, removes its temp folder and then closes. `server.test.ts`: "shutdown cancels a running job, removes its temp dir and then closes"
- [x] Submit is all or nothing. `server.test.ts`: "submit is all or nothing"
- [ ] A huge request (10,000 paths) is answered or refused without freezing core
- [ ] Core logs hold no file contents and no full user paths beyond what the docs allow

# Needs manual testing

## Shared across all platforms

- [ ] Run core as the packaged app does (utility process) and send a real job from the real window
