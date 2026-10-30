# Renderer state (store, selectors, actions)

Test entries read: `file`: "test name". Files are under `packages/app/test/renderer/`.

## Shared across all platforms

### The whole flow

- [x] Happy path: add files, pick a target per row, the job finishes. `store.test.ts`: "add files, pick a target per row, job done (happy path)" › "walks the whole flow"
- [x] A submit is busy while the call is in flight, and the request is remembered for Retry. `actions.test.ts`: "is busy while the call is in flight, and remembers the request for Retry"
- [x] A submit that fails goes back to idle. `actions.test.ts`: "goes back to idle when the submit fails"

### A target and options per row

- [x] Targets are asked once per distinct format. `store.test.ts`: "asks targets() once per distinct format"
- [x] "Convert all to" sets only the rows that can make the format. `store.test.ts`: "Convert all to sets only the rows that can make the format"
- [x] "Options for all" skips rows that do not honour a key. `store.test.ts`: "Options for all skips rows that do not honour a key"
- [x] Only keys the route honours are sent. `store.test.ts`: "only keys the route honours are sent"
- [x] A locked target names the pack as the reason Convert is off. `store.test.ts`: "a locked target names the pack as the reason Convert is off"
- [x] A merge that needs a pack names the pack as the reason Convert is off, and the reason shows next to the button. `store.test.ts`: "a merge that needs a pack names the pack as the reason Convert is off"
- [x] A merge sends A4 unless the group picked another page size. `store.test.ts`: "a merge sends A4 unless the group picked another page size"
- [x] An invalid page range keeps the row out of the batch. `store.test.ts`: "an invalid page range keeps the row out of the batch"
- [x] Page ranges: these are accepted: empty, `1`, `2-3,7`, `10-`, `-4`, `1 - 3 , 7` (with spaces). These are rejected: `0`, `a`, `3-1`, `1,,2`, `1-2-3`, `,`. `store.test.ts`: "pagesValid" › "accepts %j"; "rejects %j"
- [x] A new file of a format starts with the last pick for that format. `store.test.ts`: "a new file of that format starts with the last pick"
- [x] A remembered target that core no longer offers is cleared. `store.test.ts`: "a target core no longer offers is cleared"

### Merge groups

- [x] Members leave the single rows, and the group gets a target and one request. `store.test.ts`: "members leave the single rows and the group gets a target and one request"
- [x] Page order is kept when a member is moved. `store.test.ts`: "keeps page order when a member is moved"
- [x] A group needs two files, and a group left with one dissolves. `store.test.ts`: "needs two files, and a group left with one dissolves"
- [x] Unmerge gives the rows back. `store.test.ts`: "Unmerge gives the rows back"
- [x] A finished group is cleared with its members. `store.test.ts`: "the finished group is cleared with its members"

### The list

- [x] Detecting rows are cleared when their results arrive. `store.test.ts`: "clears detecting rows when their results arrive"
- [x] The same file added twice gives two rows with ids `path`, `path#2`, `path#3`, each with its own target and options. `store.test.ts`: "a file added twice is two rows with their own ids, targets and options (P59)"
- [x] Merging a file with itself sends its path twice to core. `store.test.ts`: "the same file merged with itself sends its path twice"
- [x] Removing one copy keeps the other, and a second copy being detected does not make the first look busy. `store.test.ts`: "removing one copy keeps the other, and a second copy being detected does not busy the first"
- [x] Files can be reordered. `store.test.ts`: "reorders files"
- [x] Clear keeps a row whose job is still running; it forgets finished jobs so the next batch counts from zero. `store.test.ts`: "Clear keeps a row whose job is still running"; "Clear forgets the finished jobs, so the next batch counts from zero"
- [x] A job keeps its submit position when it updates. `store.test.ts`: "keeps a job in its submit position when it updates"
- [x] Waiting for detection blocks submit. `store.test.ts`: "waits for detection"

### Still to test

- [ ] Remove a row while its detection is still running: the late result is ignored
- [ ] Add 500 files: selectors stay fast (no O(n squared))
- [ ] A job update for a row that was cleared is ignored

# Needs manual testing

## Shared across all platforms

- [ ] Drop files, change your mind several times (remove, merge, unmerge, change targets), then Convert: what runs is what the screen showed
