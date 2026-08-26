# RC Artifact Evidence — `@aoc/protocol@0.2.0-rc.1` (P0-CANON-02)

**Status: NOT PUBLISHED.** No `npm publish`, no registry configuration, no dist-tag, no git tag, no
GitHub Release, no `private: false`, no merge. `packages/protocol/package.json` remains
`"private": true`. This document records the identity of a produced **internal** release-candidate
artifact; it authorizes nothing beyond the internal handover named below.

This candidate exists for one reason: **`0.2.0-rc.0` is burned.** See
[`RELEASE_CANDIDATE_READINESS.md`](../RELEASE_CANDIDATE_READINESS.md) §8–§9.

## Candidate identity — the complete chain

| Field | Value |
| --- | --- |
| **RC source commit** | `eec79cdd4019dd42e1767909c5bd4e26d04c6f0f` |
| **Final PR HEAD** | the evidence-only commit carrying this file (PR #388 head; a document cannot contain its own hash — verify with `git log -1 --format=%H`) |
| Package | `@aoc/protocol` |
| Version | `0.2.0-rc.1` |
| **Tarball filename** | `aoc-protocol-0.2.0-rc.1.tgz` |
| **SHA-256** | `dd828c3a60966a65809448bed7d5c9e5f22a6365b16d91af6610f5df28dab1a1` |
| **SHA-512** | `efa0b27e51a1f2bcdb01eebd1eef82019da60fc897f6a4697c156970f591b6870f45fccf0021d93f03a5d2638e12b06cab3fa9ac641d005f58b1236a8d619141` |
| npm integrity | `sha512-76CyflGh8rzbAe69Hu+CAZ2mD8iX9qRpfBVpcPWRtocPRfzPACHZPwOl0mOOErBsqz+prGQdAF9YsSNqjWGRQQ==` |
| **Size** | 280,169 bytes |
| **File count** | 407 |
| **Exports fingerprint** | `a67d65b17dcb34c7da84d9a07cb893e073e21e9edbbc621bcae649afa5cdeb45` (15 export keys) — **identical to rc.0** |
| Public surface digest | `8f3711c084397c7e182bbb367ff3972b14619e9a2536ee0690f5dc502f09f542` |
| **`protocolWorkspaceClean`** | **`true`** |
| **Reproducibility** | Three independent packs from the RC source commit are byte-identical |
| License | Apache-2.0 (`LICENSE` + `NOTICE` shipped) |
| Runtime dependencies | none |
| Integration contract | `aoc.cross-repository-integration@1.0.1`, `frozen`, shipped as unexported metadata |

`git show eec79cdd4019dd42e1767909c5bd4e26d04c6f0f:packages/protocol/package.json` reports
`"name": "@aoc/protocol"` and `"version": "0.2.0-rc.1"` — the recorded source commit builds the
recorded artifact.

## Why this candidate exists: rc.0 is burned

`@aoc/protocol@0.2.0-rc.0` (`sha256:dbe8a08f…d10445e5`) shipped a defect in
`canonicalizeJSON`. Trailing-zero normalization was applied to the whole rendered number rather
than the fractional part, so a number in exponential notation lost the trailing zero of its
**exponent**:

```
canonicalizeJSON(7.9e-10)   ->  "7.9e-1"
canonicalizeJSON(7.9e-100)  ->  "7.9e-1"
```

Distinct values, identical canonical bytes, identical SHA-256 material — in the substrate every
signature and content digest in this protocol is computed over. Neither form round-tripped
(`"7.9e-1"` parses as `0.79`). Found by Live Data Rail while consuming the rc.0 artifact, reported
as UG-003, repaired in `b5ced70`.

Per `PRERELEASE_POLICY.md`, a candidate that fails validation is **abandoned, not patched in
place**, and version numbers are never reused. rc.0's bytes are additionally vendored and
checksum-pinned by three internal consumers, so repacking under its identity would have silently
invalidated every downstream pin.

## rc.0 evidence is untouched

Nothing under `0.2.0-rc.0`'s identity was modified, regenerated in place, or deleted:

| File | State |
| --- | --- |
| `aoc-protocol-0.2.0-rc.0-release-manifest.json` | unmodified |
| `aoc-protocol-0.2.0-rc.0.sbom.spdx.json` | unmodified |
| `aoc-protocol-0.2.0-rc.0-consumer.lock.json` | unmodified |
| `rc-artifact-0.2.0-rc.0.md` | unmodified |

The burned candidate's recorded SHA-256 remains
`dbe8a08f432a0324ad34eb7cb85054b6dcd23c0d9a073914edf23fccd10445e5`. It is retained as the record of
what was distributed and why it was abandoned — not as something to be corrected.

## What moved, and what did not

| | rc.0 | rc.1 |
| --- | --- | --- |
| Version | `0.2.0-rc.0` | `0.2.0-rc.1` (derived by `changeset version`, never hand-edited) |
| SHA-256 | `dbe8a08f…` | `dd828c3a…` |
| Size / files | 278,205 B / 407 | 280,169 B / 407 |
| contractVersion | `1.0.0` | `1.0.1` (`editorialOrMetadataOnly` — identity moved, export set did not) |
| **Export map digest** | `a67d65b1…` | `a67d65b1…` — **unchanged** |
| **Export keys** | 15 | 15 — **unchanged** |
| Prerelease family | `rc` | `rc` — unchanged |
| `private` | `true` | `true` — unchanged |

The public surface did not widen. Only the canonicalization implementation and the identity fields
that name the candidate changed.

## The artifact itself was verified, not just the source

The packed tarball was installed into a clean-room consumer and exercised through declared exports
only:

```
canonicalizeJSON(7.9e-10)   ->  "7.9e-10"
canonicalizeJSON(7.9e-100)  ->  "7.9e-100"
outputs distinct            ->  true
digests distinct            ->  true
round-trip sweep            ->  3,770 values across every reachable decimal exponent, 0 failures
```

`@aoc/protocol/identity` and ESM consumption of `@aoc/protocol/canonical` were exercised from the
same installed artifact. `integration-contract.json` was read **by path** and reports
`aoc.cross-repository-integration@1.0.1` binding `0.2.0-rc.1`; attempting to import it as a module
specifier correctly fails with `ERR_PACKAGE_PATH_NOT_EXPORTED`, which is the contract's stated
design — it ships as unexported metadata, the same class as `LICENSE`.

The repository's own fixtures (`npm run protocol:consumer:check`) install this artifact and compile
and execute TypeScript/CJS, JavaScript/CJS, TypeScript/ESM and contract-verification consumers
against every public subpath. No consumer deep-imports.

## Provenance: re-verified after an interrupted run

This artifact was packed and evidenced before a machine power loss that interrupted the final
`validate:release`. The bytes and the candidate source commit both survived; nothing was re-cut.

The identity claims above were **re-established on the recovered tree**, not carried over: a fresh
pack from `eec79cdd…` is byte-identical to the surviving tarball, the tarball was re-installed into
a clean room and re-exercised (3,770-value round-trip sweep, zero failures), and every governance
gate was re-run to completion including `protocol:rc:check` at 22/22 and `validate:release` at
exit 0.

## Internal handover

Authorized (P0-CANON-02) for direct internal handover to `Republika-Network/live-data-rail`,
`Republika-Network/Frontera` and `Republika-Network/pmfreak`, as a checksum-pinned internal
tarball in the sense `PRERELEASE_POLICY.md` defines: built from a known commit, handed directly to a
consumer, verified by checksum, never fetched from a registry.

The artifact is written to the git-ignored `dist-rc/` directory alongside
`protocol-consumer.lock.json` and `SHA256SUMS`; the bytes are reproducible from the recorded
commit, so the commit plus this evidence is the record.

**No downstream repository has adopted it.** Repinning each consumer is a separate increment in that
repository, with its own PR and its own verification. Nothing here claims otherwise.

## What this document does not authorize

Registry publication, dist-tag creation or movement, `npm publish`, `private: false`, git tags,
GitHub Releases, a stable `0.2.0`, General Availability, or any consumer beyond the three named
above.
