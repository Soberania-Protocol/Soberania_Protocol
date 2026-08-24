# RC Artifact Evidence — `@aoc/protocol@0.2.0-rc.0` (P0-PKG-01)

**Status: NOT PUBLISHED.** No `npm publish`, no registry configuration, no git tag, no GitHub
Release, no `private: false`, no merge. `packages/protocol/package.json` remains `"private": true`.
This document records the identity of a produced release-candidate artifact; it authorizes nothing.

## Authorization boundary

The founder authorized:

- prerelease family **`rc`**;
- candidate identity **`@aoc/protocol@0.2.0-rc.0`**;
- Changesets computing and applying that identity for **internal RC validation**.

Explicitly not authorized, and not done: npm publication, registry configuration, tag creation,
GitHub Release, `private: false`, merge.

## Candidate derivation

The version was computed by Changesets, never hand-edited:

```
npx changeset pre enter rc     # .changeset/pre.json — mode "pre", tag "rc"
npx changeset version          # 19 accumulated changesets consumed
```

| Package | Before | After |
| --- | --- | --- |
| `@aoc/protocol` | 0.1.0 | **0.2.0-rc.0** (minor + rc) |
| `@aoc/audit-sdk` | 0.1.0 | 0.1.1-rc.0 |
| `@aoc/asset-protocolization` | 0.1.0 | 0.1.1-rc.0 |
| `@aoc/capability-tokens` | 0.1.0 | 0.1.1-rc.0 |
| `@aoc/consent-engine` | 0.1.0 | 0.1.1-rc.0 |
| `@aoc/scoped-access` | 0.1.0 | 0.1.1-rc.0 |

**The `0.2.0` minor is legitimately derived from pre-existing accumulated changesets, not from this
increment.** Verified by removing this increment's changeset and re-running `changeset status`: the
computed bump is still `minor → 0.2.0`, driven chiefly by `aoc-protocol-public-api-stabilization`
plus the RFC-005 contract additions, exactly as `RELEASE_CANDIDATE_READINESS.md §1` predicted at
2026-07-15. This increment contributes a `patch` (packaging and evidence only), which cannot and does
not raise the computed version. No stop condition was reached.

## Artifact identity

| Field | Value |
| --- | --- |
| Package | `@aoc/protocol` |
| Version | `0.2.0-rc.0` |
| License | Apache-2.0 (`LICENSE` + `NOTICE` shipped) |
| Artifact | `aoc-protocol-0.2.0-rc.0.tgz` — 407 files, 278,205 bytes |
| **SHA-256** | `dbe8a08f432a0324ad34eb7cb85054b6dcd23c0d9a073914edf23fccd10445e5` |
| Reproducible | Yes — two consecutive packs are byte-identical |
| Runtime dependencies | none |
| Integration contract | `aoc.cross-repository-integration@1.0.0`, `frozen`, shipped as unexported metadata |
| Contracted export paths | 15 — unchanged from `0.1.0` |

Full file list, SHA-512, npm integrity and toolchain versions:
[`aoc-protocol-0.2.0-rc.0-release-manifest.json`](aoc-protocol-0.2.0-rc.0-release-manifest.json).
SPDX SBOM: [`aoc-protocol-0.2.0-rc.0.sbom.spdx.json`](aoc-protocol-0.2.0-rc.0.sbom.spdx.json).

### Historical evidence is immutable and was not touched

[`aoc-protocol-0.1.0-release-manifest.json`](aoc-protocol-0.1.0-release-manifest.json) and
[`aoc-protocol-0.1.0.sbom.spdx.json`](aoc-protocol-0.1.0.sbom.spdx.json) are **byte-identical to
their state at the pre-candidate commit `2e89f42`** — verified by SHA-256 against the committed
blobs. Candidate evidence is written under the candidate's own identity, never over a shipped
version's record. The `0.1.0` artifact Soberanía Enterprise pinned remains exactly what it was.

## Public surface: unchanged, and measured

`npm run fingerprint:public-surface` produces four independent digests. Measured at the pre-candidate
commit `2e89f42` and at this candidate:

| Digest | Before (`0.1.0`) | After (`0.2.0-rc.0`) | Verdict |
| --- | --- | --- | --- |
| `surfaceDigest` | `01a28808465fb92f…` | `01a28808465fb92f…` | **unchanged** |
| `exportMap` (15 keys) | `a67d65b17dcb34c7…` | `a67d65b17dcb34c7…` | **unchanged** |
| `buildOutput` (402 files) | `ac456d52f3b52776…` | `ac456d52f3b52776…` | **unchanged** |
| `runtimeSymbols` (259 symbols) | `53ce2a00cb697ae6…` | `53ce2a00cb697ae6…` | **unchanged** |
| `identity` | `5cb73713d11c8df3…` | `337644fee8210b79…` | refreshed (version + `files`) |

Read directly:

- **Public export surface: unchanged.** The `exports` map is byte-identical to base — same 15 keys,
  same targets. The map is now pinned in the contract as `exportMapDigest`, and re-adding the export
  this increment previously introduced fails the gate three separate ways (negative-tested).
- **Protocol semantics: unchanged.** Every emitted declaration and JavaScript file under `dist/`
  hashes identically to base. No source file under `packages/protocol/src` was modified.
- **Runtime behavior: unchanged.** The exported runtime symbol set, resolved by requiring each
  declared export from the build output, is identical: 259 symbols across 15 export paths.
- **Package identity / evidence: refreshed.** Version `0.1.0 → 0.2.0-rc.0`, and `files` now ships
  `integration-contract.json`. These are the only intended movements, and they are isolated in a
  digest kept deliberately out of `surfaceDigest`.

## Verification performed

| Check | Result |
| --- | --- |
| `npm run protocol:rc:check` | PASS — 22/22 gates |
| Reproducible double pack | PASS — byte-identical |
| Tarball contents (`LICENSE`, `NOTICE`, `README.md`, `integration-contract.json`, `dist/`; no `src/`, tests, fixtures, secrets) | PASS |
| Contract inside the tarball is byte-identical to the tree | PASS |
| `npm run check:integration-contract` | PASS |
| Export-surface guard negative test (re-add the export → must fail) | PASS — fails on 3 independent assertions |
| Consumer fixtures — TypeScript/CJS, JavaScript/CJS, TypeScript/ESM, contract-verification | PASS (install, compile, execute) |
| All 15 contracted exports resolve from the installed package | PASS |
| Undeclared subpaths (`/src/…`, `/dist/…`, `/internal`, `/integration-contract.json`) do not resolve | PASS |
| Historical `0.1.0` evidence unmodified | PASS — SHA-256 match against `2e89f42` blobs |

## How a consumer takes delivery

`npm run protocol:rc:artifact` writes, into the git-ignored `dist-rc/`:
`aoc-protocol-0.2.0-rc.0.tgz`, a ready-to-vendor `protocol-consumer.lock.json`, `SHA256SUMS`, and the
install/verify procedure. The artifact is not committed — the bytes are a pure function of the
commit, so the commit plus the SHA-256 above is the record.

Consumer obligations and the PMFreak migration are specified in
[`../../integration/CROSS_REPO_INTEGRATION_CONTRACT.md`](../../integration/CROSS_REPO_INTEGRATION_CONTRACT.md).

## What this does not evidence

- No registry publication, dist-tag, tag, GitHub Release, `private: false`, or merge.
- No PMFreak-side or Soberanía Enterprise-side change. Neither repository was modified, and the
  `@aoc-enterprise/runtime` vs `@aoc/enterprise` question is deliberately left open for the
  Enterprise increment.
- Not the three-repository packaging proof. The Protocol third is complete; the Enterprise third is
  unevidenced here by design.
