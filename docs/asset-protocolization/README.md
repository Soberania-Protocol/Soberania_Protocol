# Asset Protocolization Vertical (Workstream A)

A vertical built **on** Soberanía Protocol that turns an asset — a file, a recording, a physical
work, a plot of land — into a verifiable Soberanía record backed by declarations, evidence,
automated checks and, where the asset class requires it, a professional or notarial
attestation.

> **Asset Protocolization is a vertical built on Soberanía Protocol. It is not Soberanía Protocol
> itself, it is not Soberanía Enterprise, and it does not tokenize.**

## Layer map

```text
SOBERANÍA PROTOCOL      subject identity, integrity, canonical signed record,
                        evidence/claim/attestation/verification/standing vocabulary,
                        registry & credential references, canonicalization,
                        capability invocation + evidence, portability, adapter ports
                        —— knows nothing about asset classes

ASSET PROTOCOLIZATION   profiles, intake, case + lifecycle, requirement definitions,
VERTICAL                declaration capture, verification pipeline, professional review,
                        attestation workflow, protocolization, fee assessment
                        —— knows what a house and a WAV file are; governs nothing

SOBERANÍA ENTERPRISE    authority, policy, approvals, decisions, obligations,
                        grants, enforcement, revocation, usage evidence
                        —— governs actions; registers nothing legally

TOKENIZER               issuance, contracts, custody, marketplace, settlement
                        —— executes; decides nothing
```

## Documents

| Step | Document | Status |
|---|---|---|
| APV-00 | [`APV_00_RECONNAISSANCE.md`](./APV_00_RECONNAISSANCE.md) | `VERIFIED` |
| APV-01 | [`../architecture/adr-asset-protocolization-vertical-boundary.md`](../architecture/adr-asset-protocolization-vertical-boundary.md) | Accepted — frozen |
| APV-02 | [`APV_02_VERTICAL_PROTOCOL_CONTRACT.md`](./APV_02_VERTICAL_PROTOCOL_CONTRACT.md) | Frozen (specification; no code) |
| **GATE A0** | **Vertical boundary frozen** | **`RATIFIED`** — see below |
| APV-03 | [`APV_03_ASSET_PROFILE_FRAMEWORK.md`](./APV_03_ASSET_PROFILE_FRAMEWORK.md) | Implemented — `@aoc/asset-protocolization` |
| APV-04 | [`APV_04_PROTOCOLIZATION_CASE.md`](./APV_04_PROTOCOLIZATION_CASE.md) | `VERIFIED` — `ProtocolizationCase` in `@aoc/asset-protocolization` |
| APV-05 | [`APV_05_EVIDENCE_INTAKE.md`](./APV_05_EVIDENCE_INTAKE.md) | `VERIFIED` — evidence intake layer in `@aoc/asset-protocolization` |
| APV-06 | [`APV_06_DECLARATION_CLAIM_PREPARATION.md`](./APV_06_DECLARATION_CLAIM_PREPARATION.md) | `VERIFIED` — declaration / claim preparation layer in `@aoc/asset-protocolization` |
| APV-07 | [`APV_07_VERIFICATION_PIPELINE.md`](./APV_07_VERIFICATION_PIPELINE.md) | `VERIFIED` — verification pipeline in `@aoc/asset-protocolization` |
| APV-08 | [`APV_08_PROFESSIONAL_ATTESTATION_WORKFLOW.md`](./APV_08_PROFESSIONAL_ATTESTATION_WORKFLOW.md) | `VERIFIED` — professional attestation workflow in `@aoc/asset-protocolization` |
| APV-09 | [`APV_09_PROTOCOLIZATION_STATE_MACHINE.md`](./APV_09_PROTOCOLIZATION_STATE_MACHINE.md) | `VERIFIED` — protocolization state machine and readiness evaluation in `@aoc/asset-protocolization` |
| APV-10…APV-20 | not started | — |

The ADR lives under `docs/architecture/` to follow this repository's existing ADR naming
convention (`docs/architecture/adr-*.md`).

## Gate A0 — `RATIFIED`

```text
GATE A0 = RATIFIED
```

Ratified by the Founder / Soberanía Architecture Authority as the precondition for APV-03. The
boundary frozen by APV-01 and APV-02 is unchanged:

```text
Protocol                 != Asset Protocolization      frozen  (ADR §1, §2)
Asset Protocolization    != Enterprise Governance      frozen  (ADR §1, §2)
Enterprise Governance    != Tokenizer                  frozen  (ADR §1, §2)
Vertical → substrate contract                          frozen  (APV-02 §2)
```

Six decisions were carried from APV-00 §8 (`U-1`…`U-6`). `U-5` was closed by ADR §3
(`packages/asset-protocolization`, published as `@aoc/asset-protocolization`, role
`facade`). The remaining five are resolved as follows. This section is the ratification
record; APV-00 and the ADR are historical and are not rewritten by it.

### `U-1` — Verifiability

**Decision.** The vertical does **not** wait for an `AOC.VERIFIABILITY` capsule. It
composes the existing lower-level Protocol primitives it needs (`verifySovereignManifest`,
`VerificationKeyResolver`, `CredentialStatusLookup`, `computeContentIdentity` /
`verifyContentIdentity`).

If implementation surfaces a genuinely generic missing capability — one that at least
three unrelated verticals would need — it is documented as a *possible future Protocol
proposal* with its own gate (ADR §7). It is not added to Protocol inside this workstream.

APV-07 discharges this for the verification pipeline and surfaced no such gap. It reuses
`verifyContentIdentity` and `ContentDigestAlgorithm` for digest comparison, declares its own
vertically-scoped outcome vocabulary rather than widening Protocol's `VerificationStatus`
(which is a different concept, not a narrower one), and puts everything it cannot do itself
behind injected ports. No generic `AOC.VERIFIABILITY` capsule was invented, and Protocol was
not modified.

APV-08 discharges it again for professional attestation and likewise surfaced no gap. It reuses
`CanonicalAttestation`, `AttestationType`, `CanonicalCredentialRef`, `CanonicalPrincipalRef` and
`CanonicalProofRef` as they stand, declares its own four-member review-action vocabulary rather
than widening a Protocol enum, and puts signing behind a narrow injected `AttestationSigner`
port with no production implementation. Protocol was not modified.

Where APV-08 is *stricter* than Protocol, it narrows only what it constructs. Protocol permits a
`CanonicalAttestation` with no `proofRefs`; APV-08 produces none, because the artifact it
associates to a case as `ProtocolizationMaterialKind.Attestation` is a professional attestation
something downstream will be asked to rely on. Requiring the reference is not verifying it —
APV-08 resolves no proof artifact and checks no signature — and Protocol's own type is
unchanged.

APV-09 discharges it a third time for readiness and likewise surfaced no gap. It introduces the
semantic *requirement satisfied* — which no earlier slice was permitted to state — entirely
inside the vertical: no `ReadinessStatus`, `ReadinessState` or asset-state member was added to
Protocol for APV convenience, and `SovereignAssetState` is exactly what it was. It re-establishes
APV-08's proof-reference invariant on the artifact itself rather than weakening it, and it
verifies no proof and no signature while doing so. Protocol was not modified.

### `U-2` — External registries

**Decision.** Use the existing generic model:

```text
RegistryType.Custom  +  RegistryAuthorityLevel.External
```

This is sufficient for any future external registry source. No jurisdiction- or
domain-specific enum member (`RegistryType.CostaRica`, `.RealEstate`, `.Property`, or any
equivalent) is added to Protocol. Revisited only if multiple unrelated verticals
independently demonstrate a genuinely generic abstraction need.

### `U-3` — `CanonicalAssertionId` ownership

**Decision.** The vertical mints and derives the canonical assertion identifiers it needs.
No Protocol helper is added merely because one does not exist. Any such mechanism must be
deterministic where required, collision-resistant, unit-tested, documented, and independent
of asset-specific business semantics, and must obey Protocol's format constraints exactly.

APV-03 mints no assertion id, because it creates no claim — so no helper was written. The
ownership stands and is discharged by the slice that first needs one. APV-04 mints none
either: a case *references* claims, evidence, attestations and verifications by identifier;
it creates none. APV-05 mints none either, and deliberately constructs no
`CanonicalEvidence`: intake receives an evidence *reference*, or a record the caller
legitimately already holds, and never fabricates a canonical record identifier of its own.

APV-06 is the first slice that could plausibly have needed one, and it does not. A
`CanonicalAssertion` is reachable only through `CanonicalClaim.assertionRef`, and APV-06
constructs no `CanonicalClaim` — for the same reason APV-05 constructs no `CanonicalEvidence`,
and additionally because doing so would require minting an assertion identifier for a record
the vertical neither builds nor stores. A declaration therefore *names* a claim (or receives
one the caller already holds) and the vertical records its own `ProtocolizationDeclarationRecord`
alongside it. `U-3` remains undischarged, which is the honest state to leave it in. See
[`APV_06_DECLARATION_CLAIM_PREPARATION.md`](./APV_06_DECLARATION_CLAIM_PREPARATION.md#4-relationship-to-canonicalclaim--the-substrate-decision).

APV-07 mints none either, and for the same structural reason applied to the verification
substrate: a `CanonicalVerification` requires a minted canonical id, a `claimRef`, a verifier
and a Protocol `VerificationStatus`, and most profile-declared checks legitimately have none
of them. APV-07 records its own `ProtocolizationVerificationResult` and carries an *optional*
reference to a `CanonicalVerification` only where an executor genuinely observed one. `U-3`
therefore still stands undischarged. See
[`APV_07_VERIFICATION_PIPELINE.md`](./APV_07_VERIFICATION_PIPELINE.md#9-canonicalverification--the-substrate-decision).

APV-08 is the first slice that legitimately constructs a Protocol record — a
`CanonicalAttestation` — and it still needs no assertion identifier. A `CanonicalAttestation`
requires a `claimRef`, not an `assertionRef`; a `CanonicalAssertion` is reachable only through
`CanonicalClaim.assertionRef`; and APV-08 constructs no `CanonicalClaim`. The attestation is
therefore always *about a claim the case already holds*, and where the case holds none, no
attestation is constructed at all rather than one being fabricated. `U-3` remains undischarged.
See
[`APV_08_PROFESSIONAL_ATTESTATION_WORKFLOW.md`](./APV_08_PROFESSIONAL_ATTESTATION_WORKFLOW.md#10-canonicalattestation--the-substrate-decision-option-c).

### `U-4` — Fee model ownership

**Decision.** The vertical owns its own fee **assessment** model. APV-03, APV-04 and later
slices are not coupled to `runtime/monetization`, and implement no payment processing, no
payment provider integration and no settlement. Later slices may emit auditable assessments and
events that a separate subsystem can bill from; the architecture must not foreclose that.

### `U-6` — Case persistence ownership

**Decision.** Persistence for `ProtocolizationCase` and every other vertical workflow
aggregate belongs to the vertical. No vertical workflow persistence port is placed in Soberanía
Protocol. Protocol remains substrate and never learns the case exists.

APV-04 discharges this: `ProtocolizationCaseRepository` is declared in
`packages/asset-protocolization/src/case/case-repository.ts` together with one
deterministic in-memory implementation. No database adapter, migration or schema was added — binding the
port to a store is an infrastructure decision for the composition layer. See
[`APV_04_PROTOCOLIZATION_CASE.md`](./APV_04_PROTOCOLIZATION_CASE.md#13-persistence).

APV-05 extends the same decision to evidence intake: `EvidenceIntakeRepository` is declared
in `packages/asset-protocolization/src/evidence/evidence-intake-repository.ts` with one
in-memory implementation, stores *receipts* rather than evidence, and adds no database, blob
store or upload infrastructure. See
[`APV_05_EVIDENCE_INTAKE.md`](./APV_05_EVIDENCE_INTAKE.md#13-persistence).

APV-06 extends it again: `DeclarationRepository` is declared in
`packages/asset-protocolization/src/declarations/declaration-repository.ts` with one in-memory
implementation, stores *declaration records* rather than claims, and is append-only — no
update, no delete and no retraction, because a declaration log whose entries can be quietly
withdrawn is worth nothing to the slices that read it. See
[`APV_06_DECLARATION_CLAIM_PREPARATION.md`](./APV_06_DECLARATION_CLAIM_PREPARATION.md#18-persistence).

APV-07 extends it once more: `VerificationResultRepository` is declared in
`packages/asset-protocolization/src/verification/verification-repository.ts` with one in-memory
implementation, stores *execution results* rather than verifications, and is append-only for
the same reason — a check history whose entries can be rewritten cannot show that a case once
passed, or once failed. No database adapter, migration or schema was added. See
[`APV_07_VERIFICATION_PIPELINE.md`](./APV_07_VERIFICATION_PIPELINE.md#19-persistence).

APV-09 deliberately extends it **not at all**. Readiness is a pure deterministic projection of
records that are already immutable and already audited, so there is no readiness repository, no
persisted readiness state, no evaluation identifier and no readiness event: a stored copy of a
conclusion that can be recomputed exactly would be free to drift from the facts justifying it,
with nothing anywhere to explain the divergence. If a genuine audit obligation for readiness
history later arises, the additive amendment is append-only, tenant-scoped, revision-bound
records — a different decision with a different justification. See
[`APV_09_PROTOCOLIZATION_STATE_MACHINE.md`](./APV_09_PROTOCOLIZATION_STATE_MACHINE.md#20-persistence-events-and-identity).

APV-08 extends it a fourth time: `ProfessionalReviewRequestRepository` and
`ProfessionalReviewDecisionRepository` are declared in
`packages/asset-protocolization/src/attestation/review-repository.ts` with one in-memory
implementation each, store *review requests* and *review decisions* rather than attestations,
and are append-only — a review log whose entries can be rewritten cannot show that a case was
once rejected, or once attested. There is deliberately no packet repository (a packet is a
deterministic projection) and no attestation repository (a `CanonicalAttestation` is Protocol's
record, not the vertical's to take custody of). No database adapter, migration or schema was
added. See
[`APV_08_PROFESSIONAL_ATTESTATION_WORKFLOW.md`](./APV_08_PROFESSIONAL_ATTESTATION_WORKFLOW.md#20-persistence).

## Reading order for an implementer

1. `docs/architecture/sovereign-asset-core.md` — the frozen substrate and its invariants.
2. `docs/protocol/SOVEREIGNTY_CAPABILITIES.md` — the canonical eight and the invocation
   spine.
3. `APV_00_RECONNAISSANCE.md` §3 — the reuse map. **If you are about to define a type named
   `Evidence`, `Claim`, `Attestation`, `Verification` or `Proof`, stop and read it first.**
4. The ADR — what you may and may not own.
5. `APV_02_VERTICAL_PROTOCOL_CONTRACT.md` — what you must emit.
6. `APV_03_ASSET_PROFILE_FRAMEWORK.md` — how a profile states what an asset class requires.
7. `APV_04_PROTOCOLIZATION_CASE.md` — how one tenant's attempt under one pinned profile
   version is modelled, and why material presence is never truth.
8. `APV_05_EVIDENCE_INTAKE.md` — how evidence is received, structurally admitted,
   referenced, correlated and recorded over the life of a case, and why *received* is never
   *verified*.
9. `APV_06_DECLARATION_CLAIM_PREPARATION.md` — how a participant asserts something into a
   case, why the vertical never fabricates a `CanonicalClaim`, and why *recorded* is never
   *true*.
10. `APV_07_VERIFICATION_PIPELINE.md` — how the checks a pinned profile declares are actually
    executed, why an APV check outcome is not Protocol's `VerificationStatus`, and why every
    check passing is still never *ready*.
11. `APV_08_PROFESSIONAL_ATTESTATION_WORKFLOW.md` — how a professional reviews a bounded,
    revision-bound snapshot of a case, why a review decision is not a `CanonicalAttestation`,
    and why *attested* is still never *ready*.
12. `APV_09_PROTOCOLIZATION_STATE_MACHINE.md` — how the accumulated dossier is finally
    *interpreted*, why readiness is derived rather than commanded and orthogonal to APV-04's
    lifecycle, why `MaterialPresent` is still never `Satisfied`, and why `READY` is never
    protocolized, tokenizable or legally transferable.
13. `docs/constitution/ARCHITECTURAL-LAWS.md` — which mistakes fail the build.

## Workstream B

Tokenization governance (`TOKENIZE` as a Soberanía Enterprise capability) begins only after
GATE A4. It is deliberately not started, and no tokenization concept appears anywhere in
this workstream.
