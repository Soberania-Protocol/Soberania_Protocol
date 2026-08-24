# @aoc/protocol 0.2.0 — Release Notes

**Status: Draft — not published.**

> **Candidate cut (2026-08-24).** `@aoc/protocol@0.2.0-rc.0` exists as an internal release
> candidate: Changesets pre mode, tag `rc`, founder-authorized for RC validation only. It is not
> published to any registry, not tagged, and carries no GitHub Release. Artifact identity:
> [`evidence/rc-artifact-0.2.0-rc.0.md`](evidence/rc-artifact-0.2.0-rc.0.md). These notes stay a
> draft until `0.2.0` itself is authorized.

`0.2.0` is the *proposed* next version, computed by Changesets from pending changesets
(`npx changeset status --verbose`). It has not been cut (`changeset version` has not run), not
packed under that number, not tagged, and not published to any registry. These notes are prepared
in advance so the eventual release ships with accurate, reviewed documentation.

## Package changes

| Package | From | To (proposed) | Bump |
| --- | --- | --- | --- |
| `@aoc/protocol` | 0.1.0 | 0.2.0 | minor |
| `@aoc/audit-sdk` | 0.1.0 | 0.1.1 | patch |
| `@aoc/capability-tokens` | 0.1.0 | 0.1.1 | patch (internal-dependency policy) |
| `@aoc/consent-engine` | 0.1.0 | 0.1.1 | patch (internal-dependency policy) |
| `@aoc/scoped-access` | 0.1.0 | 0.1.1 | patch (internal-dependency policy) |

## Public API additions (all additive — no removals, no renames, no breaking changes)

- **`AuditEventEnvelope`**: five new optional fields — `occurredAt`, `subject: ResourceRef`,
  `correlationId: CanonicalId`, `reasonCodes: readonly string[]`, `schemaVersion: string` — giving
  consumers with richer product-specific audit shapes a canonical, portable mapping target.
- **Root `"."` export** (alias of `./contracts`) and `"./package.json"` export, alongside the
  existing `contracts`/`errors`/`claims`/`adapters`/`runtime-registry` subpaths.
- **RFC-005 contract family additions** in `./claims`: canonical credential, registry-interface,
  principal/reference-source/scope-reference, proof-envelope, and semantic-vocabulary contracts.
  The legacy minimal `Claim` shape is deprecated in favor of `CanonicalClaim` (retained per the
  deprecation policy).
- **Packaging**: complete publish-decision metadata (`license`, `repository`, `homepage`, `bugs`,
  `engines`), package-local `LICENSE` and README.

## Compatibility

- 0.1.x consumer code compiles unchanged; `ScopedAccessRequest` is untouched (`requestedScope` was
  always the sole canonical scope field).
- CommonJS output; ESM `import` interop verified end-to-end. Node `>=20` (CI-tested on Node 20;
  additionally validated on Node 22).
- `./adapters` and `./runtime-registry` remain **experimental**.

## Enterprise reference consumer

Soberanía Enterprise validated this exact contract surface as a real external consumer against the
pinned 0.1.0 tarball (SHA-256 `4e5289b7…96b27`; byte-identical to fresh packs from this repository
until the Apache-2.0 relicense in PR #319 changed the packaged `package.json` — see
[`RELEASE_CANDIDATE_READINESS.md`](RELEASE_CANDIDATE_READINESS.md)), with blocking CI, no ambient
shims, and zero open contract gaps — full record in
[`REFERENCE_CONSUMER_EVIDENCE.md`](REFERENCE_CONSUMER_EVIDENCE.md). This is tarball-consumption
evidence, not a deployment claim.

## Known limitations

See [`KNOWN_LIMITATIONS.md`](KNOWN_LIMITATIONS.md) — notably: package still private, no registry
selected, `@aoc` scope control unverified, no public prerelease exists, release authority
incomplete, no 1.0 guarantee.

## Migration

No action required. Optional adoption guidance (new envelope fields, consumer-owned extension
patterns, common compiler errors): [`MIGRATION_GUIDE_0.2.md`](MIGRATION_GUIDE_0.2.md).

## Rollback

Pin-based, checksum-verified, artifacts immutable: [`ROLLBACK_PLAN.md`](ROLLBACK_PLAN.md).

## Proposed version

`0.2.0`, to be cut exclusively via Changesets (`changeset version`) once the publication approval
gate in [`RELEASE_CANDIDATE_READINESS.md`](RELEASE_CANDIDATE_READINESS.md) is passed. If the first
distributable is a prerelease, it will be `0.2.0-rc.0` or `0.2.0-next.0` per
[`PRERELEASE_POLICY.md`](PRERELEASE_POLICY.md) — tag choice pending founder decision.
