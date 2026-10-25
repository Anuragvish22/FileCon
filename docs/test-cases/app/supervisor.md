# Core supervision

## Shared across all platforms

- [ ] Core crash while idle: the banner shows, core restarts, the app recovers with no user action
- [ ] Core crash during a job: that job fails with a clear state, its temp folder is cleaned, other rows keep their state
- [ ] Repeated crashes stop restarting after a limit and show a clear failure with the log location
- [ ] Core slow to start shows a "starting" state, not an error
- [ ] Requests sent while core is down fail fast or wait, never hang forever
- [ ] Quitting waits briefly for core, then ends it
- [ ] After a restart, engine status is checked again

## Linux-specific

- [ ] No zombie core process after the app is killed

# Needs manual testing

## Shared across all platforms

- [ ] Kill the core process by hand during a real job: banner, recovery and the row state are right

## Windows

- [ ] Core and its engine processes end when the app is closed from the window or from Task Manager
- [ ] Startup is not blocked by antivirus scanning the core process

## Mac

- [ ] Quitting with Command-Q while a job runs cancels cleanly and leaves no process behind
