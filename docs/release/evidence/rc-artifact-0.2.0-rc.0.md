# RC Artifact Evidence — `@aoc/protocol@0.2.0-rc.0` (P0-PKG-01)

**Status: NOT PUBLISHED.** No `npm publish`, no registry configuration, no git tag, no GitHub
Release, no `private: false`, no merge, no auto-merge. `packages/protocol/package.json` remains
`"private": true`. This document records the identity of a produced release-candidate artifact; it
authorizes nothing.

## Candidate identity — the complete chain

| Field | Value |
| --- | --- |
| **RC source commit** | `dde34517d956156a0c735c18a805763a5e712879` |
| **Final PR HEAD** | the evidence-only commit carrying this file (PR #387 head; a document cannot contain its own hash — verify with `git log -1 --format=%H`) |
| Package | `@aoc/protocol` |
| Version | `0.2.0-rc.0` |
| **Tarball filename** | `aoc-protocol-0.2.0-rc.0.tgz` |
| **SHA-256** | `dbe8a08f432a0324ad34eb7cb85054b6dcd23c0d9a073914edf23fccd10445e5` |
| **SHA-512** | `f8cb8dd45bc656a2ab0ba8b01a80d6edad7291addb36088606a9ba4bf547c62333e32c137c6776ea308e25022673ecebabb6f797bfd580a22675132cdba90573` |
| npm integrity | `sha512-+MuN1FvGVqKrC6iwGoDW7a1yka3bNgiGBqm6S/VHxiMz4ywTfGd26jCOJQImc+zrq7b3l7/VgKImdRMs26kFcw==` |
| **Size** | 278,205 bytes |
| **File count** | 407 |
| **Exports fingerprint** | `a67d65b17dcb34c7da84d9a07cb893e073e21e9edbbc621bcae649afa5cdeb45` (15 export keys) |
| Public surface digest | `01a28808465fb92f3ed31f465878b3a0ad263f26533fc1cbf860e9ffa1d76e18` |
| **`protocolWorkspaceClean`** | **`true`** |
| **Reproducibility** | Two independent packs from `RC_SOURCE_COMMIT` are byte-identical |
| License | Apache-2.0 (`LICENSE` + `NOTICE` shipped) |
| Runtime dependencies | none |
| Integration contract | `aoc.cross-repository-integration@1.0.0`, `frozen`, shipped as unexported metadata |

`git show dde34517d956156a0c735c18a805763a5e712879:packages/protocol/package.json` reports
`"name": "@aoc/protocol"` and `"version": "0.2.0-rc.0"` — the recorded source commit builds the
recorded artifact.

## Release-integrity correction (this revision)

The previous revision of this evidence set was **invalid** and is superseded. Its manifest recorded:

```
source.gitCommit          = c6f2404ac02f08374c3aa83988725a0257e46899
protocolWorkspaceClean    = false
```

`packages/protocol/package.json` at `c6f2404` is still version `0.1.0`, so that commit **cannot**
produce an `@aoc/protocol@0.2.0-rc.0` tarball. The manifest had been generated from a dirty
working tree before the candidate was committed, breaking the source → artifact → checksum chain.

The chain is now closed. Every source-identity field in this evidence set points at
`RC_SOURCE_COMMIT`, and the artifact was regenerated from that commit in a clean room.

**The SHA-256 did not change** — `dbe8a08f…d10445e5` was *independently reproduced* from the clean
`RC_SOURCE_COMMIT`, confirming the previously published checksum was correct even though the commit
it was attributed to was not. No candidate-specific reference required updating.

## Clean-room reproduction procedure

Performed in a fresh `git worktree` detached at `RC_SOURCE_COMMIT`, with no uncommitted
artifact-affecting changes:

| Step | Command | Result |
| --- | --- | --- |
| Worktree state | `git status --porcelain` | empty (clean) |
| Version check | `git show <RC>:packages/protocol/package.json` | `@aoc/protocol` `0.2.0-rc.0` |
| Clean install | `npm ci` | exit 0, 376 packages |
| Build | `npm run build` | exit 0 |
| Complete RC gate | `npm run protocol:rc:check` | **PASS — 22/22** |
| Independent pack A | `npm pack ./packages/protocol` | `dbe8a08f…d10445e5` |
| Independent pack B | `npm pack ./packages/protocol` | `dbe8a08f…d10445e5` |
| Byte-identity | A == B | **identical** |
| Clean-room consumers | TS/CJS, JS/CJS, TS/ESM, contract-verification | PASS (install, compile, execute) |
| Candidate artifact | `npm run protocol:rc:artifact` | emitted with `sourceClean: true` |
| Manifest + SBOM | `npm run protocol:release:manifest` | `gitCommit` = `RC_SOURCE_COMMIT`, `protocolWorkspaceClean: true` |
| Exports fingerprint | `npm run fingerprint:public-surface` | `exportMap a67d65b1…`, unchanged |

Artifact-affecting inputs, all committed at `RC_SOURCE_COMMIT` before any of the above ran:
`packages/protocol/package.json`, `packages/protocol/README.md`,
`packages/protocol/integration-contract.json`, `packages/protocol/LICENSE`,
`packages/protocol/NOTICE`, `packages/protocol/src/**` (build input), and the packaging scripts
`scripts/build-rc-artifact.mjs`, `scripts/generate-release-manifest.mjs`,
`scripts/check-integration-contract.mjs`.

## Evidence set

| File | Source identity |
| --- | --- |
| [`aoc-protocol-0.2.0-rc.0-release-manifest.json`](aoc-protocol-0.2.0-rc.0-release-manifest.json) | `gitCommit` = `RC_SOURCE_COMMIT`, `protocolWorkspaceClean: true` |
| [`aoc-protocol-0.2.0-rc.0.sbom.spdx.json`](aoc-protocol-0.2.0-rc.0.sbom.spdx.json) | SPDX for `@aoc/protocol@0.2.0-rc.0` |
| [`aoc-protocol-0.2.0-rc.0-consumer.lock.json`](aoc-protocol-0.2.0-rc.0-consumer.lock.json) | `commit` = `RC_SOURCE_COMMIT`, `sourceClean: true` — the lock a consuming repository vendors |

The tarball itself is not committed: its bytes are a pure function of `RC_SOURCE_COMMIT`, so the
commit plus the SHA-256 above is the record, and any party can reproduce and compare.

## Evidence-only commits after RC_SOURCE_COMMIT

Everything committed after `RC_SOURCE_COMMIT` on this branch is evidence-only. No file that affects
tarball bytes, package exports, package contents, Protocol implementation, or artifact-generation
behavior is touched after that commit — see the classified `RC_SOURCE_COMMIT → HEAD` diff recorded
in PR #387.

## Historical evidence is immutable

`aoc-protocol-0.1.0-release-manifest.json` and `aoc-protocol-0.1.0.sbom.spdx.json` remain
byte-identical to their state on `main`. Candidate evidence is written under the candidate's own
identity, never over a shipped version's record.

## Public surface

Measured at the pre-candidate commit `2e89f42` and at this candidate:

| Digest | Before (`0.1.0`) | After (`0.2.0-rc.0`) | Verdict |
| --- | --- | --- | --- |
| `surfaceDigest` | `01a28808465fb92f…` | `01a28808465fb92f…` | **unchanged** |
| `exportMap` (15 keys) | `a67d65b17dcb34c7…` | `a67d65b17dcb34c7…` | **unchanged** |
| `buildOutput` (402 files) | `ac456d52f3b52776…` | `ac456d52f3b52776…` | **unchanged** |
| `runtimeSymbols` (259 symbols) | `53ce2a00cb697ae6…` | `53ce2a00cb697ae6…` | **unchanged** |
| `identity` | `5cb73713d11c8df3…` | `337644fee8210b79…` | refreshed (version, `files`) |

Public export surface, Protocol semantics and runtime behavior are unchanged; only package identity
and evidence moved.

## What this does not evidence

- No registry publication, dist-tag, tag, GitHub Release, `private: false`, merge, or auto-merge.
- No PMFreak-side or Soberanía Enterprise-side change. Neither repository was modified, and the
  `@aoc-enterprise/runtime` vs `@aoc/enterprise` question stays open for the Enterprise increment.
- Not the three-repository packaging proof. The Protocol third is complete; the Enterprise third is
  unevidenced here by design.
