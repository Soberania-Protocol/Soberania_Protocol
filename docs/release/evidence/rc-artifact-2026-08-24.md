# RC Artifact Evidence — `@aoc/protocol@0.1.0` (P0-PKG-01)

**Status: NOT PUBLISHED.** No `npm publish`, GitHub Packages publish, GitHub Release, or git tag was
performed. `packages/protocol/package.json` remains `"private": true`. This document records the
identity of a produced artifact; it authorizes nothing.

## What was produced

`npm run protocol:rc:artifact` was run against commit `1b26d97b5b48a7fbd81847a29df0cda8c3b5d6d1`,
with the frozen cross-repository integration contract in place. The manifest and SBOM beside this
document were regenerated from that same clean commit.

| Field | Value |
| --- | --- |
| Package | `@aoc/protocol` |
| Version | `0.1.0` (pre-1.0; Changesets computes `0.2.0` at the next version cut — none was run) |
| License | Apache-2.0 (`LICENSE` + `NOTICE` shipped) |
| Source commit | `1b26d97b5b48a7fbd81847a29df0cda8c3b5d6d1` (`packages/protocol` clean) |
| Artifact | `aoc-protocol-0.1.0.tgz` (407 files) |
| **SHA-256** | `a404ba9c84be4f8b63a259fe6643e98c409ee060a4ec1396c344ce0b22ec97c3` |
| Reproducible | Yes — two consecutive packs of the tree are byte-identical |
| Runtime dependencies | none |
| Integration contract | `aoc.cross-repository-integration@1.0.0`, `frozen`, shipped inside the tarball |
| Contracted export paths | 16 |

Full file list, SHA-512, npm integrity, file count and toolchain versions:
[`aoc-protocol-0.1.0-release-manifest.json`](aoc-protocol-0.1.0-release-manifest.json). SPDX SBOM:
[`aoc-protocol-0.1.0.sbom.spdx.json`](aoc-protocol-0.1.0.sbom.spdx.json).

### Artifact identity history

This hash supersedes `2485edd0…6556`, the pre-P0-PKG-01 RC identity recorded in
[`RELEASE_CANDIDATE_READINESS.md`](RELEASE_CANDIDATE_READINESS.md). The transition has exactly one
cause: the tarball now additionally ships `integration-contract.json`, and `README.md` gained a
section describing it. No `dist/` output, no license text and no other packaged file changed. The
earlier hashes in that document's identity history remain what they were; none of them is the
current candidate.

## Verification performed

| Check | Result |
| --- | --- |
| `npm run protocol:rc:check` (22 gates — 21 pre-existing plus the new contract gate) | PASS — 22/22, 3078 tests across 298 suites |
| Reproducible double pack | PASS — byte-identical |
| Tarball contents (`LICENSE`, `NOTICE`, `README.md`, `integration-contract.json`, `dist/`; no `src/`, tests, fixtures, secrets) | PASS |
| Contract inside the tarball is byte-identical to `packages/protocol/integration-contract.json` | PASS |
| `npm run check:integration-contract` | PASS |
| Consumer fixtures — TypeScript/CJS, JavaScript/CJS, TypeScript/ESM, contract-verification | PASS (install, compile, execute) |
| All 16 contracted exports resolve from the installed package | PASS |
| Undeclared subpaths (`/src/…`, `/dist/…`, `/internal`) do not resolve | PASS |

## How a consumer takes delivery

`npm run protocol:rc:artifact` writes, into the git-ignored `dist-rc/`:

- `aoc-protocol-0.1.0.tgz` — the installable candidate;
- `protocol-consumer.lock.json` — the lock to vendor (repository, commit, version, SHA-256/SHA-512,
  npm integrity, file count, contract version, verified export list);
- `SHA256SUMS` and a `README.md` with the install/verify procedure.

The artifact is not committed: the bytes are a pure function of the commit, so the commit plus the
SHA-256 above is the record. Any consumer can reproduce it from the pinned commit and compare.

Consumer-side obligations and the PMFreak migration are specified in
[`../../integration/CROSS_REPO_INTEGRATION_CONTRACT.md`](../../integration/CROSS_REPO_INTEGRATION_CONTRACT.md).

## What this does not evidence

- No registry publication, dist-tag, version cut, or `private: false` flip.
- No PMFreak-side or Soberanía Enterprise-side change. Neither repository was modified.
- Not the three-repository packaging proof. The Protocol third is complete; the Enterprise third is
  blocked on an unresolved identifier — this repository does not build, own, or publish
  `@aoc-enterprise/runtime`, and holds no evidence that Soberanía Enterprise does. See the
  "Unresolved" section of the contract document.
