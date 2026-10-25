# Starting engine programs safely (spawn)

Test entries read: `file`: "test name". Files are under `packages/*/test/`.

## Shared across all platforms

- [x] Happy path: exit 0 gives the tails of stdout and stderr. `spawn.test.ts`: "exit 0 resolves with the stdout and stderr tails"
- [x] Output reaches the caller as it arrives, which is what progress is built on. `spawn.test.ts`: "onStdout receives the output as it arrives"
- [x] A non-zero exit is `ENGINE_FAILED` with the stderr tail as detail. `spawn.test.ts`: "a non-zero exit is ENGINE_FAILED with the stderr tail as detail"
- [x] A flood of stderr is cut to the last 2 KB. `spawn.test.ts`: "a stderr flood is cut to the last 2 KB"
- [x] A timeout is `TIMEOUT` and the process is gone. `spawn.test.ts`: "a timeout is TIMEOUT and the process is gone"
- [x] An abort is `CANCELLED`; an already aborted signal starts nothing. `spawn.test.ts`: "an abort is CANCELLED"; "an already aborted signal is CANCELLED without starting anything"
- [x] Abort kills a grandchild. `spawn.test.ts`: "abort kills a grandchild"
- [x] An argument with spaces and quotes arrives intact. `spawn.test.ts`: "an argument with spaces and quotes arrives intact"
- [x] Shell characters (`;`, `$()`, `&&` and the like) arrive as one literal string each, so a hostile file name cannot run a command (hard rules 3 and 10). `spawn.test.ts`: "shell metacharacters arrive as one literal string each"
- [x] A program that does not exist is `ENGINE_FAILED`. `spawn.test.ts`: "a binary that does not exist is ENGINE_FAILED"
- [x] A string command or `shell: true` does not even type-check. `spawn.test.ts`: "a string command or shell: true does not type-check"
- [ ] A file name starting with `-` is not read by the engine as an option (the converters put the input last or after `--`; no test for each converter)

## Windows-specific

- [x] The process tree is killed with `taskkill` and an argument array. `spawn.test.ts`: "spawn: Windows branch" › "kills the tree with taskkill and an argument array, not a process group"
- [ ] Names with `&`, `%` or `^` reach the engine intact (run on a real Windows machine)

## Linux-specific

- [ ] A process that ignores the terminate signal is still ended (escalation to a hard kill)

# Needs manual testing

## Windows

- [ ] `taskkill` on a real engine tree really stops all of it (Task Manager)
