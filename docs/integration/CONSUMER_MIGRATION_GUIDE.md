# Consumer Migration Guide: Adopting `@aoc/protocol`

> **The integration surface is now frozen.** The binding terms — package identity, the contracted
> export set, allowed and forbidden install forms, and consumer obligations — live in
> [`CROSS_REPO_INTEGRATION_CONTRACT.md`](CROSS_REPO_INTEGRATION_CONTRACT.md) and in the machine-readable
> contract shipped inside the package. Where this guide and that contract differ, the contract governs.

This document explains how Soberanía Enterprise and PMFreak should eventually consume `@aoc/protocol` as a
versioned package. **No migration is performed by this document or by the sprint that introduced it.**
Neither `enterprise/` nor any PMFreak repository is modified here.

## Current state (as audited this sprint)

- `enterprise/package.json` declares **no dependency on `@aoc/protocol`** today, despite
  `docs/architecture/protocol-enterprise-separation-report.md` and
  `docs/architecture/protocol-enterprise-boundary.test.ts` describing Enterprise as Protocol's
  consumer. This is a real gap, not an oversight in this document — verify it directly:
  `enterprise/package.json` has no `dependencies` entry for `"@aoc/protocol"`.
- Four workspace packages already do consume `@aoc/protocol` correctly, as a model for what
  Enterprise/PMFreak should replicate: `packages/audit-sdk`, `packages/capability-tokens`,
  `packages/consent-engine`, `packages/scoped-access` — each pins an **exact version**
  (`"@aoc/protocol": "0.1.0"`), not `workspace:*` or `file:`. This exact-pin pattern is enforced
  repo-wide by `scripts/check-version-graph.mjs`, which rejects the `workspace:` protocol for any
  dependency.

## Soberanía Enterprise

**From** (target state to migrate away from, once Enterprise starts depending on Protocol at all):

```text
file:../packages/protocol
workspace:*
direct source imports (../../packages/protocol/src/...)
git clone / monorepo-path dependency on this repository
```

**To**:

```json
{ "dependencies": { "@aoc/protocol": "0.1.0" } }
```

resolved either through the npm workspace (while both live in this monorepo) or, once
`docs/release/PACKAGE_DISTRIBUTION_STRATEGY.md` step 4+ is reached, through whatever registry is
chosen there.

### Version strategy

- Pin exact versions during the pre-1.0 phase (matches the pattern the four existing consumers use).
- Move to caret ranges (`^x.y.z`) only after `@aoc/protocol` reaches 1.0 and the deprecation policy in
  `docs/versioning-and-stability.md` is relied upon for compatibility.

### Lockfile behavior

- `npm ci` must resolve `@aoc/protocol` from the npm workspace link (or, post-registry-publish, from
  the registry) — never from a `file:` path outside the workspace boundary.
  `scripts/check-version-graph.mjs` fails the build if a `workspace:` or otherwise non-semver
  specifier is used.

### Upgrade procedure

1. Bump the `@aoc/protocol` version in `enterprise/package.json`'s `dependencies`.
2. Run `npm run check:version-graph` and `npm run validate:release` to confirm the boundary rules
   still hold (Enterprise may depend on Protocol; Protocol may never depend on Enterprise).
3. Run Enterprise's own test suite against the new contract shapes.
4. Only import from `@aoc/protocol`'s public subpaths (`./contracts`, `./claims`, `./errors`,
   `./adapters`, `./runtime-registry`) — never `@aoc/protocol/src/...` or `@aoc/protocol/dist/...`.

### Rollback

- Revert the version bump in `enterprise/package.json`, reinstall, and re-run
  `check:version-graph`/`validate:release`. Because dependencies are pinned to exact versions (not
  ranges), rollback is a single-line diff with no floating-range ambiguity.

### Compatibility tests

- Enterprise should add its own consumer fixture (mirroring `test-consumers/typescript-cjs` in this
  repository) once it takes a real dependency, so contract-shape regressions are caught the same way
  this sprint catches them for external consumers in general.

### Migration risks

- Enterprise currently has zero coupling to `@aoc/protocol`'s actual published shape — the separation
  reports describe an intended architecture that isn't yet wired up as a real dependency. The risk is
  that Enterprise's real usage (once wired up) reveals gaps in `adapters`/`runtime-registry` (both
  still experimental) that weren't visible from Protocol's side alone.
- Because `adapters` and `runtime-registry` are pre-1.0/experimental, Enterprise should expect
  possible breaking changes there even within `0.x` patch/minor releases until
  `docs/versioning-and-stability.md` promotes them to stable.

## PMFreak

PMFreak should consume `@aoc/protocol`:

- **directly**, only for public contracts it genuinely needs (e.g. `contracts`, `claims` shapes for
  interop/display purposes);
- **or through Enterprise**, when the functionality is Enterprise-owned (persistence, orchestration,
  billing, tenant management — none of which `@aoc/protocol` provides or ever will);
- **never** by importing Protocol internals, and **never** by copying schema/type definitions instead
  of depending on the package — copied schemas silently drift from the canonical source.

The same version-pin, lockfile, upgrade, rollback, and compatibility-test guidance above applies
identically to a PMFreak-level dependency on `@aoc/protocol`.

## What this document does not do

- It does not modify `enterprise/package.json` or any PMFreak repository.
- It does not add the missing `@aoc/protocol` dependency to Enterprise.
- It does not schedule the migration — that is the recommended next sprint (see the final deliverable
  of the packaging sprint that introduced this document).
