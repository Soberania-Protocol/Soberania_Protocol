# Cross-Repository Integration Contract

**Status: FROZEN.** Contract `aoc.cross-repository-integration@1.0.0`, frozen 2026-08-24 by
P0-PKG-01.

This document is the normative prose for the machine-readable contract at
[`packages/protocol/integration-contract.json`](../../packages/protocol/integration-contract.json),
which ships **inside** the `@aoc/protocol` tarball. A consumer can therefore read the contract out
of `node_modules/@aoc/protocol/integration-contract.json` and check, offline, that what it installed
is the surface it agreed to depend on.

It authorizes nothing. No registry publication, no version cut, no `private: false` flip, and no
deployment follows from this document — those remain founder decisions governed by
[`../release/RELEASE_AUTHORITY.md`](../release/RELEASE_AUTHORITY.md) and
[`../release/PRERELEASE_POLICY.md`](../release/PRERELEASE_POLICY.md).

## Why this exists

PMFreak's authenticated two-tenant Founder journey (P2-14, PMFreak PR #583) is functionally verified
— but it is verified against **repository-local source copies**:

```json
"@aoc/protocol": "file:src/aoc/protocol",
"@aoc-enterprise/runtime": "file:src/aoc/enterprise"
```

A `file:` specifier pointing at a source tree is not a packaged dependency. It resolves whatever
happens to be in the working copy, carries no version identity, no checksum, and no export
discipline — a deep import into internals resolves exactly as happily as a contracted one. So the
green PMFreak journey proves that the *code* composes. It does not prove that PMFreak, Soberanía
Enterprise and Soberanía Protocol compose **as independently packaged repositories**, which is the
claim the product actually needs.

Closing that gap needs two things from this repository, and this sprint delivers both:

1. **An installable release candidate** — a real, reproducible, checksum-identified artifact a
   foreign repository can install (`npm run protocol:rc:artifact`).
2. **A frozen integration surface** — a contract that says exactly what may be depended on, in what
   form, and what changing it costs, enforced so it cannot drift silently
   (`npm run check:integration-contract`).

## Parties

| Role | Repository | Produces | Consumes |
| --- | --- | --- | --- |
| Protocol | `Soberania-Protocol/Soberania_Protocol` (this repository) | `@aoc/protocol` | nothing — Protocol depends on no sibling layer |
| Enterprise | `Architects-of-Change-Protocol/AOC-Enterprise` | the Assurance/runtime layer PMFreak declares as `@aoc-enterprise/runtime` — **see the unresolved item below** | `@aoc/protocol` |
| PMFreak | not evidenced in this repository | the vertical PM product | `@aoc/protocol`, and the Enterprise runtime |

Protocol may never depend on Enterprise or PMFreak. That direction is enforced here by
`__tests__/architecture/protocol-purity.test.ts`, `scripts/check-version-graph.mjs`, and the
boundary battery in `npm run check:aoc-boundaries` — not by this document.

## What `@aoc/protocol` promises

Identity, as frozen in the contract file and re-asserted on every build against
`packages/protocol/package.json`:

| Field | Value |
| --- | --- |
| Package | `@aoc/protocol` |
| Version | `0.1.0` (pre-1.0; `private: true` — no registry publication has occurred) |
| License | Apache-2.0 (`LICENSE` + `NOTICE` ship in the tarball) |
| Node | `>=20` |
| Module format | CommonJS. ESM consumers work through Node's CommonJS named-export analysis; this is **not** a dual package |
| Runtime dependencies | none |
| Reproducibility | two consecutive packs of one commit are byte-identical |

### The contracted export set

These sixteen keys are the entire supported surface. Nothing else in the installed package may be
imported, including anything that happens to resolve.

| Export | Stability | Kind |
| --- | --- | --- |
| `@aoc/protocol` (root) | stable | type-only |
| `@aoc/protocol/contracts` | stable | type-only |
| `@aoc/protocol/errors` | stable | type-only |
| `@aoc/protocol/claims` | stable | mixed |
| `@aoc/protocol/adapters` | experimental | type-only |
| `@aoc/protocol/runtime-registry` | experimental | runtime |
| `@aoc/protocol/canonical` | stable, expanding | runtime |
| `@aoc/protocol/identity` | stable, expanding | mixed |
| `@aoc/protocol/manifest` | stable, expanding | mixed |
| `@aoc/protocol/portability` | stable | mixed |
| `@aoc/protocol/interoperability` | stable | mixed |
| `@aoc/protocol/licensing` | stable | mixed |
| `@aoc/protocol/governance-compatibility` | stable | mixed |
| `@aoc/protocol/sovereignty-capabilities` | stable | mixed |
| `@aoc/protocol/package.json` | metadata | json |
| `@aoc/protocol/integration-contract.json` | metadata | json |

Stability classes carry the meanings defined in
[`../versioning-and-stability.md`](../versioning-and-stability.md); the symbol-level table is
[`../protocol/PUBLIC_API.md`](../protocol/PUBLIC_API.md). `check:integration-contract` fails if any
contracted code export is missing from that table, so the two cannot disagree.

**Forbidden import forms** — `@aoc/protocol/src/*`, `@aoc/protocol/dist/*`,
`@aoc/protocol/internal/*`, and any path that is not a declared export key. These are verified
non-resolving by `scripts/assert-invalid-imports.mjs`.

## How the artifact is obtained

```bash
npm run protocol:rc:artifact
```

writes, into the git-ignored `dist-rc/`:

| File | What it is |
| --- | --- |
| `aoc-protocol-<version>.tgz` | the installable release candidate |
| `protocol-consumer.lock.json` | the lock a consuming repository vendors: repository, commit, version, SHA-256/SHA-512, npm integrity, file count, contract version, verified export list |
| `SHA256SUMS` | the checksum line, for a one-command `sha256sum -c` |
| `README.md` | the artifact's identity and the consumer install/verify procedure |

The script builds, validates the frozen contract, packs twice and refuses to emit anything unless
both packs are byte-identical, asserts the tarball's contents (no `src/`, tests, fixtures or
secrets; `LICENSE`, `NOTICE`, `README.md` and `integration-contract.json` present), and verifies
that the contract *inside* the tarball is byte-identical to the one in the tree. It never packs a
tree it has not just built, and it never publishes.

Artifacts are deliberately not committed: the bytes are a pure function of the commit, so the commit
plus the recorded checksum is the record. The human-readable identity of each produced candidate
lives in [`../release/evidence/`](../release/evidence/).

## Allowed and forbidden install forms

**Allowed**

1. The packed tarball, pinned by SHA-256 — the current state, and what Soberanía Enterprise already
   does (`"@aoc/protocol": "file:./vendor/aoc-protocol-0.1.0.tgz"`, see
   [`../release/REFERENCE_CONSUMER_EVIDENCE.md`](../release/REFERENCE_CONSUMER_EVIDENCE.md)).
2. An exact semver version from an authorized registry — **only after** a founder publication
   decision. No registry is configured today.

**Forbidden**

- `workspace:` specifiers (rejected repo-wide by `scripts/check-version-graph.mjs`).
- `file:` specifiers pointing at a **source tree** rather than a packed tarball — this is exactly
  what PMFreak's `file:src/aoc/protocol` is.
- `git+` and `link:` specifiers.
- Copied or vendored source, ambient type shims, hand-maintained duplicates of protocol shapes.
  Enterprise deleted two such shims when it adopted the real package; PMFreak must not reintroduce
  the pattern.

## What a consumer owes

Every consuming repository must:

1. **Install the packed artifact**, never a path into a source tree.
2. **Vendor a lock file** recording repository, commit, version and SHA-256 of what it installed —
   `dist-rc/protocol-consumer.lock.json` is generated ready to copy.
3. **Verify the shipped contract**: read `node_modules/@aoc/protocol/integration-contract.json` and
   assert its `contractVersion` is the one the consumer was built against.
4. **Import only through declared export keys.**
5. **Run a blocking CI job** that reinstalls the pinned artifact, re-checks the checksum against the
   lock, and re-runs its own battery against the real package — no `continue-on-error`.

Enterprise's `protocol-tarball-consumption` job is the working reference implementation of (5).

### PMFreak's migration

| From | To |
| --- | --- |
| `"@aoc/protocol": "file:src/aoc/protocol"` | `"@aoc/protocol": "file:./vendor/aoc-protocol-0.1.0.tgz"` (then an exact registry version once publication is authorized) |
| `"@aoc-enterprise/runtime": "file:src/aoc/enterprise"` | the packaged form Soberanía Enterprise distributes — blocked on the unresolved item below |
| `src/aoc/protocol/**` source copy | deleted; the package is the only source of those shapes |

Migration steps, PMFreak-side:

1. `npm run protocol:rc:artifact` in this repository; copy `dist-rc/aoc-protocol-<version>.tgz` into
   PMFreak's `vendor/` and `dist-rc/protocol-consumer.lock.json` into PMFreak's root.
2. `npm install --save-exact file:./vendor/aoc-protocol-<version>.tgz`.
3. Delete `src/aoc/protocol` and any shim, ambient declaration or `paths` alias that pointed at it.
4. Re-point imports at declared export keys only; `tsc --traceResolution` must resolve every
   `@aoc/protocol` import into `node_modules/@aoc/protocol/dist/...`.
5. Add the blocking CI job from (5) above.
6. Rollback is a one-line revert of the dependency specifier — the pin is exact, so there is no
   floating-range ambiguity.

Nothing in the PMFreak or Enterprise repositories is modified by this sprint. This repository cannot
and does not perform those migrations; it produces the artifact they consume and states the terms.

## Unresolved: the Enterprise runtime identifier

PMFreak declares `@aoc-enterprise/runtime`. This repository:

- **does not** build, own, or publish any artifact under that name;
- **does** build an Assurance workspace named `@aoc/enterprise` under `enterprise/`, whose eight
  approved export surfaces are enforced by `scripts/check-enterprise-package-boundary.mjs`;
- **holds no evidence** that Soberanía Enterprise publishes an artifact named
  `@aoc-enterprise/runtime`.

So `@aoc/enterprise` (here) and `@aoc-enterprise/runtime` (as PMFreak declares it) are two names
whose relationship is not established by anything in this repository. Until an Enterprise-side fact
settles which repository owns that identifier and in what packaged form it is distributed, the
three-repository packaging proof **cannot close** — the Protocol third of it is complete and the
Enterprise third is unevidenced. The contract records this as
`enterprise.producesForPmfreak.status: "unresolved"`, and `check:integration-contract` requires the
slot to carry a written note for as long as it stays unresolved. Resolving it is Enterprise-side
work, not Protocol-side work.

## Change control

Frozen means the export set, package identity, install forms and consumer obligations cannot change
silently. Any change requires editing `packages/protocol/integration-contract.json`, bumping
`contractVersion`, and a Changeset:

| Change | Changeset | `contractVersion` |
| --- | --- | --- |
| Remove or rename a stable export | major | major |
| Add an export | minor | minor |
| Editorial / metadata only | patch | patch |

Enforced by `npm run check:integration-contract`, which runs inside `npm run protocol:rc:check`,
`npm run protocol:release:check` and `npm run validate:release`, and therefore in the RC Validation,
Publishability and Release Validation workflows. The check fails if the package's export keys and
the contract's declared export set differ in either direction, if identity drifts, if a contracted
export is missing from the governed public-API table, or if the contract stops being shipped.

## What this document does not do

- It does not publish, tag, version, or authorize publication of anything.
- It does not modify, or claim to speak for, the PMFreak or Soberanía Enterprise repositories.
- It does not assert that the three-repository integration is proven. It states precisely which
  third is delivered here and what remains open.
