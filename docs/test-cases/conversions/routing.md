# Routing and targets

Test entries read: `file`: "test name". Files are under `packages/*/test/` (or `test/tooling/`).

## Shared across all platforms

### Finding a route

- [x] Happy path: a direct route is found. `route.test.ts`: "finds a direct route"
- [x] A cheap 2-hop route beats an expensive 1-hop one. `route.test.ts`: "takes a cheap 2-hop route over an expensive 1-hop one"
- [x] A route that needs 4 hops is not offered (the limit is 3). `route.test.ts`: "returns null when the only route needs 4 hops"
- [x] A dearer short prefix is kept when the cheaper one leaves no hops. `route.test.ts`: "keeps a dearer short prefix when the cheaper one leaves no hops (capped Dijkstra drops it)"
- [x] A cheaper route with more hops is found. `route.test.ts`: "finds a cheaper route with more hops"
- [x] Ties: fewer hops win at equal cost; the priority converter is kept for the same pair, else the first registered; better priority ranks win at equal cost and hops. `route.test.ts`: "prefers fewer hops at equal cost"; "keeps the priority converter for the same pair, else the first registered"; "picks the route with better priority ranks at equal cost and hops"
- [x] Self-edges: a format to itself is a 1-step route when an edge exists, `null` when not, and never inside a multi-hop route. `route.test.ts`: "is the 1-step route from a format to itself"; "gives null for a format to itself without one"; "never appears inside a multi-hop route"
- [x] Fan-out: at most one per route; a dearer route that saves its one fan-out is still found. `route.test.ts`: "allows at most one fan-out per route"; "still finds a dearer route that saves its one fan-out"
- [x] A format is never visited twice. `route.test.ts`: "never visits a format twice"
- [x] The cache starts empty when the graph is rebuilt. `route.test.ts`: "starts with an empty cache when the graph is rebuilt"

### The target list

- [x] Only formats every input can reach are offered, with lossy ids and options combined. `targets.test.ts`: "offers only formats every input reaches, with lossy and options unioned"
- [x] The route is set only for a single input format. `targets.test.ts`: "sets the route only for a single input format"
- [x] The input's own format is offered only through a self-edge. `targets.test.ts`: "offers the input's own format only through a self-edge"
- [x] A target behind a missing pack is labelled "needs pack", from the full graph, with the missing pack named. `targets.test.ts`: "labels needs-pack from the full graph, with the missing pack"
- [x] A combiner (merge) is offered when every input reaches what it accepts. `targets.test.ts`: "offers a combiner when every input reaches what it accepts"
- [x] A merge whose route fans out is marked, so a single file can merge. `targets.test.ts`: "marks a merge whose route fans out, so a single file can merge"
- [x] The pack named is the blocked input's, not one that is ready another way. `targets.test.ts`: "names the pack of the blocked input, not of one that is ready another way"
- [x] No inputs gives nothing. `targets.test.ts`: "returns nothing for no inputs"
- [x] The UI state is checked against what core really answers: two PDFs offer PDF only as a merge group; a PNG offers images and PDF as ready single-file targets; a mixed batch converts each row to its own target; a DOCX is locked while LibreOffice is missing. `ui-core-targets.test.ts`: "two pdfs offer pdf only as a merge group"; "a png offers images and pdf as ready single-file targets"; "a mixed batch converts each row to its own target"; "a docx to pdf is locked while LibreOffice is missing"
- [x] Core answers targets and plan with the real converters. `server.test.ts`: "targets and plan use the real converters"
- [ ] A route through a missing engine is shown in the UI as not possible, with the reason (the data is tested; the wording is a manual check)
- [ ] The same format as source and target is not offered unless a self-edge exists (covered by the self-edge targets test; add a UI check)
- [ ] A lossy hop is flagged on the target before Convert (the lossy ids are in the data; the UI warning has no test)
- [ ] Mixed files in one batch: the common targets are offered for all

## Windows-specific

- [ ] Uppercase extensions (`.JPG`) are recognised (detection lowercases: see detection.md)

## Linux-specific

- [ ] A file with no extension is recognised by content (see detection.md)

## Mac-specific

- [ ] Files with a resource-fork sidecar (`._name`) are ignored

# Needs manual testing

## Shared across all platforms

- [ ] The format picker is understandable to a first-time user: they find the target they want without help
- [ ] A lossy warning is noticed and understood before Convert
