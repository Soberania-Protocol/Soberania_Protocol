# `@aoc/asset-protocolization`

The Asset Protocolization Vertical — a vertical built **on** Soberanía Protocol.

> It is not Soberanía Protocol, it is not Soberanía Enterprise, and it does not tokenize.

## What this package contains

### APV-03 — the asset profile framework

An `AssetProfile` states what must be satisfied for a particular category of
asset to be processed by the vertical — which identifying material, which
declarations, which evidence, which automated checks and which attestation, in
which jurisdictions, and how fresh each input must be.

```ts
import {
  createAssetProfileCatalog,
  listAssetProfileReadinessRequirements,
} from '@aoc/asset-protocolization';

const catalog = createAssetProfileCatalog([myProfile]);
const resolved = catalog.get('my.profile.v1', '1.0.0');
const outstanding = listAssetProfileReadinessRequirements(resolved!, 'GLOBAL');
```

### APV-04 — the `ProtocolizationCase` aggregate

A `ProtocolizationCase` is one tenant's attempt to protocolize one subject under
one pinned profile version. It records what was supplied against which
requirements and where the attempt is in its lifecycle
(`Draft → Active → Cancelled`).

```ts
import {
  addProtocolizationCaseMaterial,
  createProtocolizationCase,
  listProtocolizationCasePendingMaterialRequirements,
} from '@aoc/asset-protocolization';

// `clock` and the case id come from the composition layer; this package is pure.
const context = { catalog, clock, tenantId: 'tenant-a' };
const { protocolizationCase, event } = createProtocolizationCase(context, {
  caseId: 'case-0001',
  profile: { profileId: 'my.profile.v1', profileVersion: '1.0.0' },
  subject: { subjectRef: { sovereignAssetId } },
});
```

Material presence is never truth: associating a claim, evidence, attestation or
verification reference records that the case was told about it — never that it
is valid, current, sufficient, checked or that the case is ready.

### APV-05 — the evidence intake layer

How a case is *told about* evidence: one operation that structurally admits a
submission, correlates it to requirements of the case's pinned profile, records
an immutable receipt, and performs the association through APV-04's own
`ProtocolizationMaterialKind.Evidence` pathway.

```ts
import { intakeProtocolizationEvidence } from '@aoc/asset-protocolization';

const { protocolizationCase, receipt, caseEvent, intakeEvent } =
  intakeProtocolizationEvidence(context, openCase, {
    intakeId: 'intake-0001',
    caseId: 'case-0001',
    materialId: 'material-0001',
    categoryId: 'my.intake.external-registry', // opaque; no enum of sources exists
    pathway: 'Reference',
    evidenceRef: canonicalEvidenceId,          // Protocol's CanonicalEvidenceId
    requirementIds: ['evidence.provenance.minimum'],
    observedAt: registryLookup.observedAt,     // the source's instant, never invented
  });
```

Nothing is persisted by the operation: it returns the updated case *and* the
receipt so a composition layer can commit both together. Evidence accumulates
over the life of a case, and no intake rewrites or deletes what an earlier one
recorded.

```text
Evidence received     !=  evidence verified.
Evidence associated   !=  requirement satisfied.
Evidence complete     !=  case ready.
```

### APV-06 — the declaration / claim preparation layer

How a participant *asserts something* into a case: one operation that structurally admits a
submission, correlates it to declaration requirements of the case's pinned profile,
optionally links evidence APV-05 already admitted, records an immutable declaration record,
and performs the association through APV-04's own
`ProtocolizationMaterialKind.Declaration` pathway.

```ts
import { recordProtocolizationDeclaration } from '@aoc/asset-protocolization';

const { protocolizationCase, record, caseEvent, declarationEvent } =
  recordProtocolizationDeclaration(context, openCase, {
    declarationId: 'declaration-0001',
    caseId: 'case-0001',
    materialId: 'material-d001',
    declarant: { id: principalId, kind: 'Human' }, // Protocol's CanonicalPrincipalRef
    pathway: 'Reference',
    claimRef: canonicalClaimId,                    // Protocol's CanonicalClaimId
    claimType: 'Authorship',                       // Protocol's ClaimType
    requirementIds: ['declaration.authorship.required'],
    statement: 'I created this work.',             // presentation only, never semantics
    supportingEvidenceRefs: [canonicalEvidenceId], // linkage, never support
    declaredAt: whenTheySayTheyDeclaredIt,         // distinct from when we recorded it
  });
```

The package never constructs a `CanonicalClaim`: doing so would require minting a canonical
record id *and* an `assertionRef` naming a `CanonicalAssertion` that would not exist. A
declaration names a claim, or supplies one the caller already holds, and the vertical records
its own account of who asserted what, when.

A new *kind* of declaration is a profile that names `ClaimType.Custom` plus a `claimSubtype`
token — a configuration change, never a code change here and never a change to Protocol.

```text
Declaration recorded     !=  declaration true.
Claim exists             !=  claim verified.
Evidence linked          !=  claim proven.
Declarant identity       !=  declarant authority.
All declarations present !=  case ready.
```

Conflicting declarations coexist: APV-06 preserves both and adjudicates neither. Declaration
history is append-only — a correction is a new declaration, never a rewrite.

### APV-07 — the verification pipeline

How the automated checks a pinned profile *declares* are actually executed. A check is
resolved by `AssetVerificationCheckId` through a registry, handed a bounded read-only view of
one case, and returns one of five explicit outcomes together with the basis it evaluated.

```ts
import {
  createVerificationCheckRegistry,
  BUILT_IN_VERIFICATION_CHECKS,
  executeProtocolizationVerificationCheck,
  runProtocolizationVerification,
} from '@aoc/asset-protocolization';

// Registration is the extension mechanism: a new check needs no engine change,
// no case-core change and no Protocol change.
const checks = createVerificationCheckRegistry([...BUILT_IN_VERIFICATION_CHECKS, myCheck]);

const { result, event } = await executeProtocolizationVerificationCheck(
  { catalog, clock, tenantId: 'tenant-a', checks, resolvers: { claim, content } },
  openCase,
  {
    executionId: 'execution-0001',
    requirementId: 'verification.integrity', // must be a Verification requirement
    checkId: 'check.content.digest',         // must be one that requirement declares
    evidenceReceipts,                        // APV-05 receipts, reused not duplicated
    declarations,                            // APV-06 records, reused not duplicated
  },
);

result.outcome;               // 'Pass' | 'Fail' | 'Warning' | 'ManualReview' | 'Unavailable'
result.evaluatedCaseRevision; // the exact case state this finding is about
result.profile;               // the exact pinned (profileId, profileVersion)
```

**An APV check outcome is not Protocol's `VerificationStatus`.** `VerificationStatus`
(`Pending | Verified | Failed`) is the status of a `CanonicalVerification` record; a
`VerificationCheckOutcome` is the result of executing one profile-declared check at one case
revision. Protocol's enum is untouched, and this package never imports it.

Executing a check **mutates no case**: results are separate append-only records bound to the
revision they evaluated, so a `Pass` at revision 4 never silently becomes a `Pass` over
evidence added at revision 5, and recording a finding can never become the input to the next
one. Re-running produces a *new* immutable result; the earlier one stays.

```text
APV outcome     !=  Protocol VerificationStatus.
PASS            !=  universal truth.
FAIL            !=  case rejection.
WARNING         !=  PASS.
MANUAL_REVIEW   !=  attestation.
UNAVAILABLE     !=  FAIL.
All checks PASS !=  READY.
```

`Unavailable` in particular is load-bearing: a registry that cannot be reached, a canonical
record that cannot be resolved and content bytes that cannot be read are all reported as
"could not evaluate", never as a negative finding. A check the pinned profile declares with no
registered implementation is a different thing again — a loud configuration error, not an
outcome.

Anything the pipeline cannot do itself arrives through an injected port
(`VerificationClaimResolver`, `VerificationContentResolver`). No registry connector, object
store, identity provider or crypto primitive is implemented here; digest comparison reuses
Protocol's `verifyContentIdentity`.

### APV-08 — the professional attestation workflow

A `ProfessionalReviewRequest` asks an appropriately identified reviewer to
consider **one** attestation requirement of the case's exact pinned profile
version, bound to **one** case revision. A `ProfessionalReviewPacket` is the
deterministic projection of that review basis. A `ProfessionalReviewDecision`
records what the reviewer did — and, only for `Attest` and only where Protocol's
own record can be built without invention, a `CanonicalAttestation` is produced
and associated to the case.

```ts
import {
  ProfessionalReviewAction,
  buildProfessionalReviewPacket,
  createProfessionalReviewRequest,
  recordProfessionalReviewDecision,
} from '@aoc/asset-protocolization';

const { request } = createProfessionalReviewRequest(context, protocolizationCase, {
  reviewRequestId: 'review-request-0001',
  attestationRequirementId: 'attestation.primary.required', // must be an Attestation requirement
  requestedAttestationType: 'Human',                        // must be one it accepts
  requestedScope,                                           // machine-readable; never prose
});

const packet = buildProfessionalReviewPacket(context, protocolizationCase, request, {
  evidenceReceipts,     // APV-05 receipts, reused not duplicated
  declarations,         // APV-06 records, reused not duplicated
  verificationResults,  // APV-07 results, reused not duplicated
});

const { decision, attestation, protocolizationCase: updated } =
  await recordProfessionalReviewDecision(context, protocolizationCase, request, {
    decisionId: 'review-decision-0001',
    reviewer,                                   // CanonicalPrincipalRef — Protocol's
    reviewerCredentialRefs,                     // as presented; never resolved
    action: ProfessionalReviewAction.Attest,
    scope: requestedScope,
    reviewedRefs,                               // what was actually read
    attestation: { attestationId, claimRef, statement, materialId, proofRefs },
  });
```

The action set is exactly four, closed, and never a boolean:

```text
Attest               willing to make this attestation, within this scope, on this basis
Reject               declines the requested attestation after review
RequestMoreEvidence  cannot responsibly attest; names what is needed, machine-readably
Abstain              declines to reach a substantive decision
```

**A review decision is not a `CanonicalAttestation`.** A decision is a vertical
workflow record that exists for all four actions; a `CanonicalAttestation` is a
Protocol record that only `Attest` may produce. Protocol defines no canonical
artifact for a refusal, so `Reject`, `RequestMoreEvidence` and `Abstain` produce
none — the vertical record is sufficient, and it is honest.

An attestation is structurally *about a claim*, so APV-08 builds one only when
the `claimRef` names a claim the case already holds. It also carries at least one
`CanonicalProofRef`, always: Protocol makes `proofRefs` optional, but a
*professional* attestation associated to a case as
`ProtocolizationMaterialKind.Attestation` is auditable or it is not produced. The
reference comes from the caller or from a narrow injected `AttestationSigner`
port; where neither yields one, the operation fails
(`REVIEW_SIGNATURE_UNAVAILABLE`) and no signature is ever synthesized. Requiring
the reference is not verifying it — nothing here resolves a proof.

Asking for an artifact you cannot legitimately have fails **atomically**: no
decision, no attestation, no event, no `Attestation` material and no revision
increment (`REVIEW_ATTESTATION_CANNOT_BE_CONSTRUCTED`,
`REVIEW_SIGNATURE_UNAVAILABLE`). Recording the professional's position *without*
a Protocol artifact remains fully supported and needs no signer and no proof —
that is the same `Attest` with the `attestation` input omitted, which returns a
decision carrying no `canonicalAttestationRef`, no attestation material and no
`resultingCaseRevision`.

Every APV-07 outcome stays visible to the reviewer, unreduced: a `ManualReview`
never blocks packet construction, an `Unavailable` is never reinterpreted, and a
`Fail` never forces a rejection. Nothing here branches on an outcome — the
professional decides, and an `Attest` recorded over a `Fail` leaves that `Fail`
exactly where it was.

```text
Professional review        !=  automated verification.
Review decision            !=  CanonicalAttestation.
Attest                     !=  universal truth      !=  READY.
Reject                     !=  case state Rejected.
RequestMoreEvidence        !=  state transition.
Abstain                    !=  FAIL.
Credential ref present     !=  the credential exists.
Credential type matches    !=  the credential is valid.
Declared status Active     !=  currently active.
Credential compatibility   !=  legal authority.
Proof reference present    !=  proof resolved       !=  signature verified.
Attestation material present !=  requirement satisfied.
```

Review binds to an exact case revision and stays there: a request raised at
revision 12 never absorbs evidence admitted at 13, and a successful `Attest`
records `reviewBasisRevision` and `resultingCaseRevision` separately so nobody can
conclude the attestation covered the material it created. A follow-up review is a
**new** request bound to the newer revision; nothing is overwritten, and two
reviewers who disagree both stay on the record with no winner picked.


### APV-09 — the protocolization state machine and readiness evaluation

`src/state-machine/`. The first slice permitted to **interpret** everything above
and answer one question: *may protocolization be attempted for this case, right
now?*

`evaluateProtocolizationReadiness` takes a case, its exact pinned profile version
and a bounded bundle of the records the earlier slices produced, and returns one
`ProtocolizationReadinessEvaluation`: a
`ProtocolizationRequirementAssessment` for **every** requirement of the profile,
a closed machine-readable set of blockers and warnings, a derived
`ProtocolizationReadinessState`, and the exact case revision the answer describes.

Readiness is a **derived projection**, orthogonal to APV-04's lifecycle and never
persisted. APV-04's three lifecycle states are untouched — no `Ready`, `Rejected`
or `MoreEvidenceRequired` member was added to them, and `MaterialPresent` still
means exactly what it meant. There is no readiness repository, no stored state
field, no evaluation id and no readiness event: a stored copy of a conclusion
that can be recomputed exactly would be free to drift from the facts justifying
it. There is likewise no way to *command* readiness — no manual promotion, no
administrative override, and no way to waive, skip or discount a requirement, a
failing check or an unavailable one.

```text
lifecycle Active  +  readiness EvidencePending   both true, and both meaningful
lifecycle Active  +  readiness Ready             likewise
lifecycle Cancelled                              Ineligible, always
```

The semantic *requirement satisfied* first exists here, it is owned by this
vertical, and nothing comparable was added to Protocol. It is derived from the
requirement definition, its applicability, the case's material at the evaluated
revision and the supplied records — and from nothing else.

Every APV-07 outcome keeps its own meaning on the way through: a `Warning`
satisfies non-fatally and stays a `Warning`, a `ManualReview` routes to a
professional rather than to readiness, an `Unavailable` is never reported as a
`Fail`, and a `Pass` that evaluated an earlier revision is stale rather than
current. APV-07's own currency comparison is imported, so no competing notion of
"current" exists. No score, average, weighting or majority appears anywhere.

A profile's explicit constraints are **established, not assumed**. An evidence
requirement's `acceptedTypes`, `registry` and `credential` are read from
Protocol's own `CanonicalEvidence`, supplied as bounded input; an identity
requirement's `registry` is read from the entry reference the case already holds,
through APV-07's own comparison. A `Required` requirement whose constraint cannot
be established is **not** satisfied — `requirement.constraint.unevaluated` is a
blocker, never a footnote, because treating "we could not check it" as "it holds"
would loosen the profile contract invisibly. On an `Optional` requirement the same
finding is a warning and blocks nothing.

**Delegation is not satisfaction.** APV-09 never recomputes a freshness window —
APV-07 owns that — but "somebody else owns this" is not an answer either. An
evidence requirement's `freshness` is discharged only by a current result for a
`check.evidence.freshness` the pinned profile **explicitly declares**: a
registered built-in is not a declared requirement. Undeclared, unexecuted, stale,
`Fail`, `Unavailable` or `ManualReview` all leave the obligation undischarged,
reported through APV-07's existing verification blockers filed against the
evidence requirement. `Pass` discharges it and names the execution that did;
`Warning` discharges it non-fatally with the warning preserved. Freshness on an
identity, verification or attestation requirement has no evaluator anywhere, so
it blocks when Required rather than being waved through under an invented check
id.

An attestation is authority over the revision it covers and no further. Where the
case has moved past `resultingCaseRevision` and the intervening revisions are not
accounted for, `attestation.currency.unresolved` is a **blocker** and the state is
`ReviewPending` — APV-08's own contract is that a professional must never
unknowingly attest a moving target. The historical artifact is untouched: not
deleted, not invalidated, and no inference drawn about its signature. A further
review on the newer basis clears it.

Professional history is interpreted at the **highest review basis revision** for
each attestation requirement, so an old `RequestMoreEvidence` stops dominating
once a later review exists — while remaining permanently readable. Conflicting
current positions block; they are never adjudicated.

APV-08's hardening is re-established rather than relaxed: an `Attest` decision
with no `CanonicalAttestation` does **not** satisfy an attestation requirement,
and an artifact that cannot be shown to carry at least one usable
`CanonicalProofRef` does not qualify as APV professional material. Presence of a
proof reference is still not verification of one — nothing here resolves a proof
or checks a signature.

```text
MaterialPresent            !=  requirement satisfied.
Declaration satisfied      !=  the proposition is true.
Evidence present           !=  evidence sufficient.
PASS                       !=  universal truth.
WARNING                    !=  PASS.
UNAVAILABLE                !=  FAIL.
A stale PASS               !=  a current PASS.
Constraint unchecked       !=  constraint satisfied.
Constraint delegated       !=  constraint evaluated.
A registered check         !=  a declared requirement.
Attest decision            !=  attestation material.
Covers revision N          !=  authority over revision N+k.
Proof reference present    !=  proof verified.
Reject                     !=  legal invalidity.
READY                      !=  PROTOCOLIZED  !=  TOKENIZABLE.
READY                      !=  legal title   !=  legally transferable.
```

Every answer is bound to `evaluatedCaseRevision`, and
`isProtocolizationReadinessCurrentForCase` is the guard APV-10 will use to refuse
a readiness result the case has since moved past. Returning `Ready` executes
nothing: no write, no anchor, no token, no signature, no case transition.

## What it does not contain

No evidence, claim, attestation, verification, standing, credential, proof,
provenance-source, subject-identity, principal-reference or integrity type — every
one of those is Protocol's and is referenced, never redefined, and Protocol's
`VerificationStatus` is neither widened nor reinterpreted. No identity resolution, no
authority or delegation resolution, no protocolization *execution* of any kind, no
`ProtocolizationResult`, no `Protocolizing` or `Protocolized` state, no
reviewer assignment, queue, inbox, dashboard or professional workbench, no protocolization
finalization, no registry connector, no fee assessment, no governance, no tokenization, and no
database adapter or blob store (the case, evidence-intake, declaration, verification-result and
professional-review persistence **ports** are here; binding any of them to a store is not). No cryptography of its own: no
hashing algorithm, signature format, key model or proof format is defined here, and no
signature is ever synthesized — signing is a narrow injected port with no production
implementation in this package. No file,
blob or upload handling: evidence reaches this package as a reference, never as bytes, and
content bytes for a digest check arrive through an injected resolver. No concrete product
profile: the fixtures under `tests/fixtures/` are test-only, including every `test.check.*`
executor.

## Dependency envelope

`@aoc/protocol` and nothing else. `scripts/check-version-graph.mjs` classifies
every `@aoc/*` package other than `@aoc/protocol` as a **facade**, and a facade
may depend only on `protocol` or `external`. That is the intended constraint, not
an obstacle: every concrete capability arrives by injection of a
Protocol-declared port, bound in a composition root.

## Documentation

- `docs/asset-protocolization/APV_03_ASSET_PROFILE_FRAMEWORK.md` — the profile slice.
- `docs/asset-protocolization/APV_04_PROTOCOLIZATION_CASE.md` — the case slice.
- `docs/asset-protocolization/APV_05_EVIDENCE_INTAKE.md` — the evidence intake slice.
- `docs/asset-protocolization/APV_06_DECLARATION_CLAIM_PREPARATION.md` — the declaration
  slice.
- `docs/asset-protocolization/APV_07_VERIFICATION_PIPELINE.md` — the verification slice.
- `docs/asset-protocolization/APV_08_PROFESSIONAL_ATTESTATION_WORKFLOW.md` — the professional
  attestation slice.
- `docs/asset-protocolization/APV_09_PROTOCOLIZATION_STATE_MACHINE.md` — the state machine and
  readiness slice.
- `docs/asset-protocolization/README.md` — the workstream and the Gate A0 record.
- `docs/architecture/adr-asset-protocolization-vertical-boundary.md` — the frozen
  boundary.
