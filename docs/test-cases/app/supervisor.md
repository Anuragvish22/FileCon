# Core supervision

Test entries read: `file`: "test name". Files are under `packages/app/test/`.

## Shared across all platforms

### Start

- [x] Happy path: core is forked, sent `init` with settings and data folder, and reaches ready. `supervisor.test.ts`: "forks, sends init with settings and data dir, and reaches ready"
- [x] Calls before ready are refused with `CORE_UNAVAILABLE`, then relayed once ready. `supervisor.test.ts`: "refuses calls with CORE_UNAVAILABLE until ready, then relays them"
- [x] Host events are forwarded, and core's log events and output go to the log. `supervisor.test.ts`: "forwards host events, and writes core log events and output to the log"
- [x] A failed `init` is treated as a crash. `supervisor.test.ts`: "treats a failed init as a crash"
- [x] Core not ready within 15 s is killed and restarted; the timer does not fire once ready arrived. `supervisor.test.ts`: "kills the host and restarts when ready does not come within 15 s"; "does not fire once ready arrived in time"
- [x] Nothing is sent to core before it is ready: a drop while starting is queued and processed once ready. `actions.test.ts`: "P35: nothing is sent before core is ready" › "queues a drop while starting, then processes it on startup once ready"; `store.test.ts`: "queues paths dropped before core is ready"; "nothing can be submitted until core is ready"

### Crash and restart (flow F12)

- [x] A crash rejects pending calls with `CORE_CRASHED`. `supervisor.test.ts`: "rejects pending calls with CORE_CRASHED"
- [x] Failed updates are synthesized for queued and running jobs only. `supervisor.test.ts`: "synthesizes failed updates for queued and running jobs only"
- [x] A crash mid-batch fails every active job, then new calls work after the restart. `supervisor.test.ts`: "a crash mid-batch fails every active job, then new calls work after the restart"
- [x] Restarts happen after 1 s, then 2 s, and report restarting then ready. `supervisor.test.ts`: "restarts after 1 s, then 2 s, and reports restarting then ready"
- [x] After 3 restarts in 60 s it gives up: unavailable, and calls fail fast. `supervisor.test.ts`: "gives up after 3 restarts in 60 s: unavailable, and calls fail fast"
- [x] Restarts older than 60 s are forgotten. `supervisor.test.ts`: "forgets restarts older than 60 s"
- [x] Late events from a host that was already replaced are ignored. `supervisor.test.ts`: "ignores late events from a host that was already replaced"

### Quit (flow F13)

- [x] Quit asks the host to shut down, then kills it, and does not restart. `supervisor.test.ts`: "asks the host to shut down, then kills it, and does not restart"
- [x] A host that exits while shutdown is in flight is not restarted. `supervisor.test.ts`: "does not restart when the host exits while shutdown is in flight"
- [x] A host that does not answer within 5 s is killed. `supervisor.test.ts`: "kills the host when it does not answer within 5 s"
- [x] A pending restart is cancelled by quitting. `supervisor.test.ts`: "cancels a pending restart"

### The screen

- [x] When core is unavailable, Convert says why. `convert.test.tsx`: "core unavailable: Convert says why"
- [x] A failed call shows the core error as a notice. `actions.test.ts`: "shows the core error as a notice when a call fails"
- [ ] The banner shows "starting", "restarting" and "unavailable" with the right words (the state is tested; the wording is a manual check)
- [ ] After a restart, engine status is checked again
- [ ] Repeated crashes show a clear failure with the log location

## Windows-specific

- [ ] Core and its engine processes end when the app is closed from the window or Task Manager

## Linux-specific

- [ ] No zombie core process after the app is killed

# Needs manual testing

## Shared across all platforms

- [ ] Kill the core process by hand during a real job: banner, recovery and the row state are right

## Windows

- [ ] Startup is not blocked by antivirus scanning the core process

## Mac

- [ ] Quitting with Command-Q while a job runs cancels cleanly and leaves no process behind
