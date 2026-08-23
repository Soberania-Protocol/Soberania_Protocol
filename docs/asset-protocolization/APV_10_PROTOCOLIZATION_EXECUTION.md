# APV-10 — Protocolization Execution

| Field | Value |
|---|---|
| Work package | APV-10 (Workstream A, Asset Protocolization Vertical) |
| Status | `VERIFIED` — implemented in `@aoc/asset-protocolization` |
| Depends on | APV-03, APV-04, APV-05, APV-06, APV-07, APV-08, APV-09 (all merged), GATE A0 `RATIFIED` |
| Delivers | `ProtocolizationResult`, `executeProtocolization`, `ProtocolizationResultRepository`, `ProtocolizationExecuted` |
| Feeds | GATE A1 |
| Protocol core modified | **NO** |

---

## 1. The invariants, first

Everything else in this document is detail. These are the load-bearing statements,
and each of them is enforced by code and asserted by a test.

```text
Ready                     != Executed
Ready at revision N       != Ready at revision N+1
Execution started         != Execution succeeded
ProtocolizationResult     != legal title
ProtocolizationResult     != ownership transfer
ProtocolizationResult     != government registration
ProtocolizationResult     != token
ProtocolizationResult     != Enterprise authorization
Protocolized              != tokenized
Successful execution does not rewrite claims, evidence, verifications,
  attestations, readiness or the case.
A result protocolizes one exact case revision, permanently, and no other.
```

---

## 2. What this slice is for

APV-09 answers a question. APV-10 performs an act.

```text
AssetProfile                                      APV-03
  └── ProtocolizationCase                         APV-04
        ├── Evidence                              APV-05
        ├── Declarations                          APV-06
        ├── Verification results                  APV-07
        └── Professional attestations             APV-08
              └── Readiness evaluation            APV-09   "may this proceed?"
                    └── Protocolization execution APV-10   "it did proceed"
                          └── ProtocolizationResult
```

The whole of APV-10's responsibility is narrow:

> take a `ProtocolizationCase` that APV-09 has established as `Ready` for the exact
> current case revision under the exact pinned profile, verify that conclusion is
> still current, perform the final protocolization operation, and produce an
> immutable, auditable `ProtocolizationResult`.

And what it deliberately does not do is just as narrow:

```text
APV-10 does not define readiness            APV-09 owns it
APV-10 does not verify anything             APV-07 owns it
APV-10 does not review anything             APV-08 owns it
APV-10 defines no concrete asset profile    APV-11 owns the first one
APV-10 tokenizes nothing                    Enterprise, much later, if ever
APV-10 authorizes nobody                    Enterprise governance owns that
```

---

## 3. Three orthogonal dimensions, now all present

APV-09 named the third dimension and declined to enter it. This slice enters it.

```text
A  CASE LIFECYCLE        Draft | Active | Cancelled
   does this attempt exist, and does it accept work?
   commanded, persisted on the aggregate, owned by APV-04

B  PROTOCOLIZATION READINESS
   does the dossier satisfy the pinned profile at this revision?
   derived, never persisted, owned by APV-09

C  PROTOCOLIZATION EXECUTION
   was this exact revision carried through the workflow, and when?
   recorded as an immutable artifact, owned by APV-10
```

All three are meaningful at once, and every combination below is an ordinary state
of the world:

```text
lifecycle Draft   + readiness Ready              + no result yet
lifecycle Draft   + readiness Ready              + result at this revision
lifecycle Active  + readiness EvidencePending    + result at an older revision
lifecycle Active  + readiness Ready              + result at an older revision
lifecycle Cancelled + readiness Ineligible       + result at an older revision
```

The last line is worth reading twice. Cancelling a case does not un-protocolize a
revision that was protocolized: the result remains, permanently true about the
revision it names, and the case simply accepts no further work.

---

## 4. The APV-09 handoff

Execution consumes one `ProtocolizationReadinessEvaluation`, exactly as APV-09
§26 specified, and reads these fields:

```text
schemaVersion            the shape is one APV-09 could have produced
tenantId                 whose workflow this is
caseId                   which case the conclusion is about
profile                  the exact pinned version it was computed under
caseState                the lifecycle it quoted
evaluatedCaseRevision    the revision it describes        <-- the TOCTOU guard
state / ready            the conclusion, and its derived convenience
requirementAssessments   the per-requirement reasoning, read only for its
                         reference lists and its structural consistency
blockers                 must be empty
warnings                 carried forward verbatim
evaluatedAt              when APV-09 answered
```

and one helper, unchanged and unduplicated:

```ts
isProtocolizationReadinessCurrentForCase(evaluation, protocolizationCase)
```

### APV-10 does not evaluate readiness

There is no code path by which `executeProtocolization` could conclude `Ready` on
its own, and this is structural rather than disciplinary:

- the operation's signature is `(context, case, evaluation, request)` — it takes
  **no** evidence receipts, declarations, verification results, review requests,
  review decisions or attestations, so the inputs a re-evaluation would need never
  reach it;
- `evaluateProtocolizationReadiness`, `deriveProtocolizationReadinessState` and
  `evaluateRequirement` appear nowhere under `src/execution/`, asserted by the
  boundary test;
- there is no `force`, `override`, `skipReadiness` or `waive` parameter anywhere,
  and the request type is closed, so passing one is refused as an unknown field.

What APV-10 *does* decide is currency and integrity: is this evaluation
well-formed, is it `Ready`, and does it still describe the exact case in hand?

---

## 5. Execution preconditions — the exact list

Checked in this order, and every one of them refuses rather than degrades:

```text
 1  the acting tenant is well-formed and owns the case
 2  the exact pinned AssetProfile version resolves from the catalogue
 3  the case validates against that profile
 4  the case is not Cancelled
 5  the request is structurally admissible and names a valid result id
 6  a readiness evaluation was supplied
 7  it is a shape APV-09 could have produced
 8  its state is Ready
 9  it names this tenant, this case, this exact pin and this lifecycle state
10  it describes this exact revision
11  isProtocolizationReadinessCurrentForCase agrees
12  the request's expectedCaseRevision, if given, is exactly that revision
```

The tenant gate is first so that a foreign caller learns nothing about a case it
may not see — not whether it exists, not whether it is valid, and not whether it
has already been protocolized.

Step 4 is defence in depth, not a second lifecycle policy. APV-09 cannot
legitimately produce a current `Ready` for a cancelled case, because cancellation
is its highest-precedence blocker; step 4 exists so that a *reconstructed*
evaluation cannot get past it either.

Step 9 includes the quoted lifecycle deliberately: an evaluation computed while
the case was `Draft` does not authorize an execution of the same revision after
the case became `Active`, because APV-04 advances the revision on activation and
the two can never legitimately disagree.

`Draft` and `Active` both execute. APV-09 permits `Ready` on either, and this
slice invents no activation requirement the frozen architecture does not have.

---

## 6. TOCTOU — the boundary this slice exists for

```text
revision 20   APV-09 => Ready
revision 21   a declaration is recorded
              the caller executes with the revision-20 evaluation
              -> PROTOCOLIZATION_EXECUTION_READINESS_STALE
```

Nothing is refreshed, re-evaluated, repaired or accepted as "close enough". The
comparison is exact in both directions: an evaluation of an *older* revision saw
strictly less than the case now holds, and one carrying a *newer* revision
describes a case this caller is not holding. Both are refused.

Stale is a **distinct error code** from not-ready, and deliberately so. A
`NOT_READY` refusal says *finish the dossier*; a `READINESS_STALE` refusal says
*re-evaluate and retry*. An operator who could not tell them apart from the code
alone would have to guess which.

The currency verdict is APV-09's own helper. The field-by-field reads that precede
it exist only to report *which* dimension diverged; the helper is what actually
authorizes, and a divergence it catches which the field reads somehow did not
still refuses.

---

## 7. Execution architecture

| Concern | Decision |
|---|---|
| Domain operation | `executeProtocolization` — pure, synchronous, deterministic, side-effect-free |
| Persistence | `ProtocolizationResultRepository` port + one in-memory implementation; the operation holds none |
| Output | `ProtocolizationExecutionOutcome { result, event }` — one coherent value for a composition layer |
| Case mutation | **None** (see §12) |
| Event | `ProtocolizationExecuted`, on success only, returned rather than dispatched |
| External effects | **None** — no network, no database, no registry, no chain, no storage, no payment |
| Execution status enum | **Not introduced** (see §13) |
| Result digest | **Not introduced** (see §14) |
| Result signature | **Not introduced** (see §14) |

The split between the pure operation and persistence is the same one APV-05
through APV-08 made. It has one consequence worth stating plainly: **this package
does not pretend that two independent writes are atomic.** The operation builds
every output before anything is committed, and committing them is the composition
layer's business under whatever transaction it actually has.

---

## 8. `ProtocolizationResult`

Schema version `aoc-protocolization-execution/1`.

```ts
interface ProtocolizationResult {
  schemaVersion:        'aoc-protocolization-execution/1';
  resultId:             ProtocolizationResultId;
  tenantId:             ProtocolizationTenantId;
  caseId:               ProtocolizationCaseId;
  profile:              ProtocolizationProfileRef;   // the exact pin
  subject:              ProtocolizationCaseSubject;  // preserved exactly
  executedCaseRevision: number;
  readinessBasis:       ProtocolizationReadinessBasis;
  materialRefs:         readonly ProtocolizationExecutionMaterialRef[];
  executedAt:           UtcDateTime;
  correlationId?:       CanonicalId;
}
```

A future reader holding only this record can answer every question the artifact
exists to answer:

```text
what case was protocolized?      caseId
whose tenant workflow?           tenantId
which exact subject?             subject.subjectRef.sovereignAssetId
under which exact profile?       profile.profileId @ profile.profileVersion
which exact case revision?       executedCaseRevision
on which Ready evaluation?       readinessBasis
when?                            executedAt
over what dossier?               materialRefs + the basis reference lists
what warnings remained?          readinessBasis.warnings
```

And it can answer none of the questions it must never answer. There is no
`owner`, `legalOwner`, `titleHolder`, `valid`, `verified`, `proven`, `certified`,
`approved`, `registered`, `enforceable`, `titleClear`, `passed`, `score` or
`confidence` field anywhere on it — asserted over the actual key set, not by
convention.

### It is not the APV-02 §2.1 envelope

`ProtocolizationResultV1` (APV-02 §2.1, schema `aoc-protocolization-result/1`) is
the *consumer-facing* envelope. It additionally carries a `SignedSovereignManifest`
and the `ResourceRef` handle Enterprise addresses. Producing one requires a
**registrant** and a **signing key**, and no slice up to and including this one
establishes either — inventing a registrant would be inventing an authority model
(forbidden), and holding a key would be inventing key custody (forbidden). So:

- the envelope stays **deferred and unmodified**; APV-02 is not amended;
- this record carries its **own** schema identifier, so the two documents can
  never be confused on the wire or silently substituted for one another;
- a later slice that gains manifest issuance projects the envelope *from* a
  `ProtocolizationResult` plus a signed manifest, and this record is exactly the
  vertical-side half it will need.

That is the honest state to leave it in. The alternative — fabricating a
registrant and a manifest to populate a field — is precisely the counterfeit
Protocol record this vertical must never put into circulation.

---

## 9. Result identity

```text
type              ProtocolizationResultId = string
grammar           APV-04's instance-identifier grammar, unchanged
minted by         the caller; this package mints no identifier, ever
uniqueness scope  (tenantId, resultId)
```

Tenant-scoped for the reason every other APV instance identifier is: result ids
are minted by tenants, so a globally unique constraint would let one tenant's
choice of identifier collide with another's — which leaks the existence of a
protocolization across a tenant boundary *and* makes a legitimate `save` fail for
a reason its caller can neither see nor fix.

That scope is *identity* uniqueness and nothing more. It is emphatically not the
rule that stops a case revision being protocolized twice — see §10.

---

## 10. Idempotency and duplicate execution

The chosen invariant, stated once:

> **At most one successful protocolization result per
> `(tenantId, caseId, profile, executedCaseRevision)`.**

Enforced in the repository, beside duplicate-id rejection, because the domain
operation is pure and holds no store — the same split APV-08 made for
one-terminal-decision-per-request.

| Situation | Behaviour |
|---|---|
| **A** — exact replay after a committed success | `getByBasis` returns the existing result deterministically; a `save` of a replay is refused (`RESULT_DUPLICATE` for the same id, `BASIS_ALREADY_EXECUTED` for a fresh one). The first result stands. |
| **B** — a second result id for the same basis | Refused: `PROTOCOLIZATION_EXECUTION_BASIS_ALREADY_EXECUTED`. A new name is not a new act. |
| **C** — retry after a *failed* execution | Free. Nothing was committed, so the result id is still available and the basis is still unprotocolized. |
| **D** — the case reaches a newer revision | A new APV-09 evaluation must be obtained; a new execution then produces a **second** result beside the first. |

`getByBasis(tenantId, caseId, profile, executedCaseRevision)` is the supported way
to make an exact replay deterministic without executing anything: a caller asks
whether this basis is already protocolized and either receives the existing
artifact or learns that executing is still to be done.

---

## 11. Re-protocolization and supersession

Multiple historical results for one case coexist, and that is intended:

```text
revision 10  -> Ready -> result R1
revision 15  -> the dossier changed -> a new Ready -> result R2

R1 and R2 both exist.
R1 is not deleted, not marked, not flagged and not superseded.
R2 does not make R1 false; R1 was never a statement about revision 15.
```

There is deliberately no `supersedes`, `supersededBy` or `current` field on a
result, and no operation anywhere that sets one. Supersession semantics do not
exist in this architecture — APV-02 §2.3 already rejected a parallel lineage
field, and Protocol expresses supersession at the manifest layer
(`SovereignManifestV1.state`), which this slice does not touch. If future
supersession semantics are genuinely required, they belong to a later slice with
their own justification.

`isProtocolizationResultCurrentForCase(result, case)` answers *does this result
describe the case as it stands now?* — a projection, not a policy. It decides
nothing about what a non-current result means.

---

## 12. Case mutation — the explicit decision

**Decision: A — no case mutation.**

A successful execution mutates nothing on the `ProtocolizationCase`. The result is
a separate immutable artifact, and it is the only thing a successful execution
produces.

Why:

- **Lifecycle, readiness and execution are three dimensions** (§3). Writing
  execution metadata onto the aggregate would collapse the third into the first
  and make "was this revision protocolized?" a question you answer by reading a
  mutable field rather than by reading history.
- **A mutation would invalidate its own authorization.** Any write to the case
  advances its revision, so the `Ready` evaluation that authorized the execution
  would describe revision `N` while the execution produced revision `N+1` — and
  nothing would have established readiness for `N+1`. Modelling that honestly
  would require distinguishing `executedCaseRevision` from
  `resultingCaseRevision`, which is real complexity bought for no benefit.
- **A flag is the wrong shape for the fact.** `protocolized: true` on a case
  cannot say *which revision*, and a case whose revision moves on would carry a
  flag that is quietly about the past.

Consequently:

```text
APV-04 lifecycle enum widened          NO
`Protocolizing` added                  NO
`Protocolized` added                   NO
a protocolized flag on the case        NO
a protocolized flag on the subject     NO
a protocolized flag on evidence/claims NO
```

*Protocolized* is represented by the existence of a result for a given basis, and
by nothing else.

---

## 13. Why there is no execution status enum

`Pending`, `Running`, `Failed` and `Succeeded` model a workflow that outlives a
single call — one that commits something before it finishes and therefore needs a
persisted place to say how far it got.

This slice is atomic, synchronous, deterministic and side-effect-free. It
validates, it builds two values, it returns. A failed attempt writes nothing, so
there is nothing for `Failed` to describe; a successful one produces the result,
so `Succeeded` would be a second spelling of "the result exists". Declaring the
enum now would mean either leaving members unreachable or — far worse — making one
reachable on a rule that only looks like the real one.

When external execution genuinely arrives (a registry write, an anchor, a
signature), the state it needs is an additive amendment made by whoever owns that
step.

---

## 14. Digest and signature — explicit decisions

**Result digest: NO.**

A content digest binds an envelope so a third party can verify it was not altered
in transit. Nothing consumes such a proof in this slice: the result never leaves
the vertical, is deeply frozen in memory, and is structurally re-validated on the
way back out of any store. Adding a digest would put an integrity claim into
circulation that nobody checks, and computing one would mean either reaching for
`canonicalizeJSON`/`createHash` inside a slice that performs no cryptography, or —
worse — inventing an ad-hoc serialization. Neither is warranted. Where a genuine
verification need appears, Protocol's existing canonicalization is the thing to
reuse, deliberately, in the slice that needs it.

**Result signature: NO.**

Signing is not deferred out of laziness; it is deferred because there is nothing
coherent to sign *with*. Professional attestations are already separately
signed and proof-backed by APV-08 through an injected `AttestationSigner`. A
system proof over an execution would need a system identity, a key and a custody
model, none of which the frozen architecture establishes. Inventing one here would
be inventing an authority model, which §54 of this slice's charter forbids and
which the ADR reserves for Enterprise.

---

## 15. Warnings

A `Ready` evaluation may legitimately carry warnings — an unmet `Optional`
requirement, a check that returned `Warning`, a constraint APV-09 delegates. The
result carries all of them, verbatim: same codes, same order, same references.

What APV-10 must never do is re-read them:

```text
if (warnings.length > 0) refuse        <-- FORBIDDEN
```

That would be a second readiness policy, disagreeing with the first, in the slice
least entitled to hold one. APV-09 already decided that a case carrying these
findings is `Ready`. APV-10 records what remained and executes.

`blockerCount` is recorded alongside them, always `0`, so a reader of the artifact
alone does not have to trust that the check happened — and so a stored record
claiming `Ready` beside a non-zero count is malformed history that reconstitution
refuses rather than repairs.

---

## 16. Execution basis — what the result preserves

References, never copies. Nothing about the artifact grows with the size of the
dossier's contents.

**Material** (`materialRefs`) — one entry per APV-04 association the executed
revision held, in the case's own association order:

```text
materialId      the association's identity inside the case
kind            the vertical's closed material vocabulary
requirementIds  which requirements of the pinned profile it was offered against
ref?            the Protocol record it names, for the id-bearing kinds
                (Declaration, Evidence, Verification, Attestation, Credential,
                 RegistryEntry); absent for ContentIdentity and
                 ExternalReference, whose payloads are structures rather than
                 record identities and which `subject` already carries
```

**Readiness basis** (`readinessBasis`) — the conclusion, plus the workflow records
that established it, deduplicated and in the profile's declaration order:

```text
evaluationSchemaVersion   which readiness shape was relied on
state                     structurally `Ready`, and nothing else
evaluatedCaseRevision     always equal to executedCaseRevision
caseState                 the lifecycle APV-09 quoted
evaluatedAt               when APV-09 answered
blockerCount              always 0
warnings                  every warning, verbatim
verificationExecutionIds  the APV-07 executions the evaluation read
reviewDecisionIds         the APV-08 decisions the evaluation read
attestationRefs           the Protocol attestations it accepted as qualifying
```

**Not preserved**, on purpose: whole requirement assessments (a pure deterministic
projection, recomputable exactly from the pin and the revision the result already
names), declaration statements, evidence bodies, reviewer notes, scope statements,
credential payloads and every other piece of content that belongs to the record
that owns it. An audit needs the ability to go and read what was relied on; it
does not need a second copy that can drift.

Ordering is deterministic everywhere — association order for material, assessment
order for the reference lists — so two executions over the same inputs produce
byte-identical artifacts apart from `resultId` and `executedAt`.

---

## 17. Persistence

```text
port             ProtocolizationResultRepository
implementation   createInMemoryProtocolizationResultRepository (deterministic, in-process)
adapters         none — no database, no migration, no schema
tenancy          every method takes the tenant; no global enumeration exists
append-only      no update, no delete, no supersession pointer
identity rule    (tenantId, resultId)              — refuses a duplicate id
basis rule       (tenantId, caseId, profile,
                  executedCaseRevision)            — refuses a duplicate act
ordering         executedAt, then resultId
validation       results are validated on the way in and deeply frozen
```

This extends `U-6` a fifth time, on the same terms: no vertical workflow
persistence port goes into Soberanía Protocol, and Protocol never learns that
asset protocolization exists.

**Transaction limitation, stated plainly.** The operation returns a result and an
event; persisting the result and dispatching the event are two acts, and this
package makes no atomicity claim about them. A composition layer that needs them
atomic must provide the transaction. The safe ordering is *persist, then
dispatch*: an event announcing a protocolization that failed to commit is worse
than a dropped notification, because the result is the record and the event is
only an output.

---

## 18. Events

One event, on success only:

```ts
ProtocolizationExecuted {
  eventType, resultId, tenantId, caseId, profile,
  executedCaseRevision, occurredAt, correlationId?
}
```

Read the name literally. *Executed* — the APV protocolization workflow completed
over one exact case revision and produced result R. Not `AssetRegistered`, not
`TitleIssued`, not `OwnershipTransferred`, not `AssetTokenized`, not
`AssetMinted`, not `CaseApproved`, not `EnterpriseAuthorized`, not
`AssetVerified`, not `ClaimProven`. Each of those names a conclusion no part of
this vertical is entitled to reach.

There is no `ProtocolizationExecutionFailed`, no `ProtocolizationAttempted` and no
`ProtocolizationStarted`: nothing is committed before the result exists, so a
failure leaves the world exactly as it was and has nothing to report but its own
error.

The payload is narrow — identifiers, the pin, the revision, the instant. Notably
absent is `subject`: the sovereign identity of a protocolized thing is exactly the
kind of fact a broadcast payload should not scatter, and a reader entitled to it
reads the result. No evidence, claim, declaration, reviewer note, attestation
statement, warning or personal datum appears anywhere in it.

Result and event cannot disagree: the event is derived from the result, and
`occurredAt` is the result's own `executedAt` rather than a second clock read.

---

## 19. Tenant isolation

```text
tenant B executes tenant A's case                 refused (TENANT_MISMATCH)
tenant B uses A's readiness against B's case      refused (READINESS_MISMATCH)
tenant B reads A's result by id                   undefined
tenant B lists A's case results                   empty
tenant B enumerates A's results                   no such API exists
tenant B stores its own result under A's id       permitted, and isolated
```

The last line is the one that matters for leakage: `(tenantId, resultId)` scoping
means a duplicate-id refusal can never become a way to discover that another
tenant protocolized something. A blank tenant is not a wildcard — it is a refusal.

Ownership of a workflow is `tenantId`, never inferred from a subject, a declarant,
a reviewer or an external identifier: a subject can legitimately appear in two
tenants' cases.

---

## 20. Clock and timestamps

`executedAt` comes from the injected `ProtocolizationClock` and is validated as
Protocol's canonical `UtcDateTime`; a clock returning anything else fails the
operation rather than being silently repaired. No module under `src/` calls
`Date.now()` or an argument-less `new Date()`, asserted mechanically by the
boundary test rather than by convention.

The event's `occurredAt` is the result's `executedAt`, copied — not a second read.

---

## 21. Protocol reuse, and what was not minted

Reused as they stand, by reference only:

```text
UtcDateTime, CanonicalId                    @aoc/protocol/contracts
CanonicalAttestationId                      @aoc/protocol/claims
AdapterResult                               @aoc/protocol/adapters
ProtocolError                               @aoc/protocol/errors
SovereignSubjectRef, ContentIdentity        via APV-04's ProtocolizationCaseSubject
```

Minted: **nothing**.

```text
CanonicalClaim                minted?  NO
CanonicalEvidence             minted?  NO
CanonicalVerification         minted?  NO
CanonicalAttestation          minted?  NO
CanonicalAssertion            minted?  NO
SovereignAssetId              minted?  NO
SovereignManifestV1           built?   NO
SignedSovereignManifest       signed?  NO
```

Every reference the result carries is one the case already held. `U-3` therefore
remains undischarged after this slice as well, which is the honest state to leave
it in: APV-10 creates no claim, so it needs no assertion identifier.

No `ProtocolizedAsset`, `SoberaniaAsset` or `AssetProtocolizationRecord` type was
added to Protocol, and none was proposed. The vertical owns its result; Protocol
remains the generic substrate underneath, and no Protocol consumer is forced to
learn that asset protocolization exists.

**Protocol core modified: NO.**

---

## 22. External effects

```text
registry writes      NONE
network calls        NONE
blockchain writes    NONE
storage writes       NONE
Enterprise calls     NONE
payment calls        NONE
file system reads    NONE
```

The slice is pure domain. Its only injected dependencies are the clock and the
profile catalogue, and the catalogue is an in-memory lookup of the exact pinned
version.

---

## 23. Error model

All refusals throw `ProtocolizationExecutionError` (a `ProtocolError`) carrying a
stable `code` and `details`.

```text
PROTOCOLIZATION_EXECUTION_TENANT_REQUIRED          acting tenant missing/malformed
PROTOCOLIZATION_EXECUTION_TENANT_MISMATCH          not this tenant's case
PROTOCOLIZATION_EXECUTION_CASE_INVALID             case fails APV-04 validation
PROTOCOLIZATION_EXECUTION_CASE_NOT_EXECUTABLE      the case is Cancelled
PROTOCOLIZATION_EXECUTION_PROFILE_NOT_FOUND        the exact pin is not catalogued
PROTOCOLIZATION_EXECUTION_PROFILE_MISMATCH         the catalogued version is not the pin
PROTOCOLIZATION_EXECUTION_READINESS_REQUIRED       no evaluation supplied
PROTOCOLIZATION_EXECUTION_READINESS_MALFORMED      not a shape APV-09 could produce
PROTOCOLIZATION_EXECUTION_NOT_READY                well-formed, and not Ready
PROTOCOLIZATION_EXECUTION_READINESS_MISMATCH       another tenant/case/pin/lifecycle
PROTOCOLIZATION_EXECUTION_READINESS_STALE          another revision — the TOCTOU refusal
PROTOCOLIZATION_EXECUTION_REVISION_MISMATCH        expectedCaseRevision disagrees
PROTOCOLIZATION_EXECUTION_RESULT_ID_INVALID        result id fails the grammar
PROTOCOLIZATION_EXECUTION_REQUEST_INVALID          request structurally inadmissible
PROTOCOLIZATION_EXECUTION_TIMESTAMP_INVALID        the clock returned a non-instant
PROTOCOLIZATION_EXECUTION_RESULT_INVALID           a result document fails admission
PROTOCOLIZATION_EXECUTION_RESULT_DUPLICATE         (tenantId, resultId) exists
PROTOCOLIZATION_EXECUTION_BASIS_ALREADY_EXECUTED   this basis is already protocolized
```

Unlike APV-09, where a blocker is part of a successful answer, a non-`Ready`
readiness here is an incoherent *request*, not a finding about the case — see §6
on why stale is a code of its own.

---

## 24. Failure semantics

A refused execution leaves:

```text
the case                       unchanged, byte for byte
declarations and claims        unchanged
evidence and receipts          unchanged
verification results           unchanged
review requests and decisions  unchanged
attestations                   unchanged
the readiness evaluation       unchanged
the result store               unchanged
events                         none emitted
external systems               untouched (there are none)
```

There is no partial execution to unwind, because nothing is committed before every
precondition holds and the slice performs no external side effect at all.

---

## 25. Truth and legal boundaries

Stated once more, at the end, because it is the thing most likely to be misread:

> A `ProtocolizationResult` is a **technical and product artifact** representing
> successful completion of the Asset Protocolization workflow for one case
> revision. It is not, in any jurisdiction, a legal title category.

```text
ProtocolizationResult != legal title
ProtocolizationResult != ownership transfer
ProtocolizationResult != government registration
ProtocolizationResult != token
ProtocolizationResult != Enterprise authorization
```

Executing does not upgrade the truth of anything it names. A claim is still a
claim; evidence is still evidence, not certified evidence; a verification result
is still one check's finding; a professional attestation is still one
professional's scoped position, not universal truth. The dossier says exactly what
it said before, and this record says only that the workflow over it completed.

---

## 26. Source layout

```text
packages/asset-protocolization/src/execution/
  execution-identifiers.ts   ProtocolizationResultId and its grammar
  protocolization-result.ts  the artifact, its readiness basis and material refs
  execution-request.ts       the request and the compound outcome
  execution-validation.ts    structural validation and the execution gates
  execution-operations.ts    executeProtocolization, reconstituteProtocolizationResult
  execution-repository.ts    the port, and one in-memory implementation
  execution-projections.ts   read-only views over results
  execution-errors.ts        the refusal vocabulary
  execution-events.ts        ProtocolizationExecuted
```

Public surface: the result id and its predicate; the result, basis and material-ref
types plus the schema version; the request and outcome types; the validation codes,
validators and predicates; the event type map and event types;
`executeProtocolization` and `reconstituteProtocolizationResult`; the repository
port and its in-memory implementation; the two projections; and the error type.
The gates, the ordering comparator, the material-reference helper and the freeze
helper are internal.

---

## 27. Boundary — what APV-10 is not

```text
Protocol core modified                          NO
An execution or result concept added to Protocol NO
A ProtocolizedAsset core type                   NO
APV-04 lifecycle enum changed                   NO
Protocolizing / Protocolized state              NO
A protocolized flag anywhere                    NO
Readiness re-evaluated or re-derived            NO
An APV-07 check re-executed                     NO
A professional contacted                        NO
A CanonicalClaim/Evidence/Verification/
  Attestation minted                            NO
A SovereignManifest built or signed             NO
A signature or proof verified                   NO
An external registry contacted                  NO
A concrete AssetProfile added                    NO
Asset-class or profile-id branching             NO
Real-estate or jurisdiction logic added         NO
Enterprise governance, capability or TOKENIZE   NO
Tokenization, blockchain, wallet or custody     NO
Payments or fee model                           NO
Registry connectors                             NO
A user interface                                NO
Waiver, override, force or manual promotion     NO
Supersession or deletion of a historical result NO
```

---

## 28. Gate A1 handoff

APV-10 completes the generic Asset Protocolization foundation:

```text
AssetProfile              APV-03
+ ProtocolizationCase     APV-04
+ Evidence intake         APV-05
+ Declarations            APV-06
+ Verification            APV-07
+ Professional attestation APV-08
+ Readiness               APV-09
+ Execution               APV-10
= Asset Protocolization Foundation
```

Every slice of it is asset-agnostic: no concrete profile exists, no code branches
on an asset category or a profile id, and the same execution path is exercised for
a subject with a canonical byte representation and a subject named only inside an
external namespace.

```text
GATE A1  RATIFIED   (2026-08-23)
```

Ratification was a separate act by the Founder / Soberanía Architecture Authority,
exactly as Gate A0 was — this slice did not self-ratify, and the state above was
`READY_FOR_REVIEW` when APV-10 was delivered. The ratification record, including
what the gate deliberately does **not** cover, lives in
[`README.md`](./README.md#gate-a1--ratified).

Ratifying the gate changes nothing about this slice. In particular it does not
build the APV-02 §2.1 envelope, does not sign a manifest, does not discharge
`U-3`, and gives no protocolization any legal effect — §25's boundaries stand
exactly as written.

After Gate A1: **APV-11 — `digital.artifact.v1`**, the first concrete asset
profile. It is not started, and no concrete asset semantics appear anywhere in
this slice.
