# Routing and targets

## Shared across all platforms

- [x] The target list is built from what core really answers, including merge-only targets (covered by: `test/tooling/ui-core-targets.test.ts`)
- [ ] The cheapest route is chosen, and a tie is broken the same way every time
- [ ] A route longer than the hop limit is not offered
- [ ] A route through a missing engine is shown, marked as not possible, with the reason
- [ ] A lossy hop is flagged on the target before Convert
- [ ] No route gives a clear "not possible" state, never an empty list with no reason
- [ ] The same format as source and target is not offered
- [ ] Mixed files in one batch each get their own target list; the common targets are offered for all
- [ ] Detection by content wins over the extension, and an unknown file says unknown

## Windows-specific

- [ ] Uppercase extensions (`.JPG`) are recognised

## Linux-specific

- [ ] A file with no extension is recognised by content

## Mac-specific

- [ ] Files with a resource-fork sidecar (`._name`) are ignored

# Needs manual testing

## Shared across all platforms

- [ ] The format picker is understandable to a first-time user: they find the target they want without help
- [ ] A lossy warning is noticed and understood before Convert
