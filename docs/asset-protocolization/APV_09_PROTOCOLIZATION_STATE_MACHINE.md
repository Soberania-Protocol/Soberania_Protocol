# APV-09 — Protocolization State Machine and Readiness Evaluation

> **Status.** `VERIFIED` — implemented in `@aoc/asset-protocolization`
> (`packages/asset-protocolization/src/state-machine/`).

APV-09 is the first slice permitted to **interpret** the accumulated state of a
`ProtocolizationCase` and say whether it may proceed to protocolization
execution. Everything before it recorded facts and refused to draw a conclusion
from them. This slice draws exactly one conclusion, deterministically, and
explains it.

```text
AssetProfile                    APV-03   what a category of asset requires
    |
    v
ProtocolizationCase             APV-04   what this attempt was given
    |
    +-- Evidence                APV-05   what was admitted
    +-- Declarations            APV-06   who asserted what
    +-- Automated verification  APV-07   what the checks returned
    +-- Professional review     APV-08   what a reviewer decided
    |
    v
APV-09 Readiness evaluation
    |
    +-- ProtocolizationRequirementAssessment   one per requirement, explained
    +-- ProtocolizationReadinessReason         blockers and warnings
    +-- ProtocolizationReadinessState          the derived summary
    +-- ProtocolizationReadinessEvaluation     the whole answer, revision-bound
    |
    | FUTURE
    v
APV-10 protocolization execution
```

---

## 1. The truth boundary

**Read this first.** Everything below depends on it.

```text
MaterialPresent                 !=   requirement satisfied
Declaration present             !=   declaration true
Declaration satisfied as a
  workflow requirement          !=   the proposition is true
Evidence present                !=   evidence sufficient
minimumCount met                !=   the documents are any good
constraint unchecked            !=   constraint satisfied
constraint delegated to APV-07  !=   constraint evaluated by APV-07
a registered check              !=   a declared requirement
PASS                            !=   universal truth
WARNING                         !=   PASS
MANUAL_REVIEW                   !=   an attestation, or a reviewer assigned
UNAVAILABLE                     !=   FAIL
A stale PASS                    !=   a current PASS
Review decision                 !=   CanonicalAttestation
Attest decision                 !=   attestation material
Attest without a canonical
  artifact                      !=   attestation requirement satisfied
CanonicalAttestation without a
  required proof reference      !=   acceptable APV professional material
Proof reference present         !=   proof resolved, or signature verified
Attestation covering revision N !=   authority over revision N+k
Attestation requirement
  satisfied                     !=   legal truth, or legal authority
Reject                          !=   legal invalidity, fraud, or a cancelled case
All material present            !=   READY
All checks PASS                 !=   READY
All professionals Attest        !=   READY
READY                           !=   PROTOCOLIZED
READY                           !=   TOKENIZABLE
READY                           !=   Enterprise authorization
READY                           !=   legal title
READY                           !=   legally transferable
```

APV-09 **interprets existing facts. It does not manufacture them.**

---

## 2. What `READY` means, precisely

> **READY** means the current revision of this `ProtocolizationCase` satisfies
> the machine-readable protocolization prerequisites of its **exact pinned**
> `AssetProfile` version, under the evidence, verification and
> professional-attestation semantics Asset Protocolization currently represents.

It is a **technical protocolization state**. It is not:

- government recognition
- title transfer, ownership transfer, or legal title
- legal enforceability or statutory compliance in any jurisdiction
- tokenization approval or investment suitability
- an Enterprise capability grant of any kind

"Approved asset", "legally valid asset" and "certified ownership" are **not**
synonyms for `READY` and are used nowhere in this slice.

---

## 3. State architecture decision — **Option C, derived projection**

Four options were evaluated against the code as it actually stands.

```text
A  extend ProtocolizationCaseState        REJECTED
B  a second persisted workflow state      REJECTED
C  a derived readiness projection         SELECTED
D  hybrid: persist some, derive the rest  REJECTED
```

**Why not A.** APV-04's `ProtocolizationCaseState` is a *lifecycle* enum with
three deliberately simple members, and its own module says so at length:
`Ready` is called out there by name as "the specific trap". Adding readiness
members to it would either leave them unreachable or make one reachable on a
rule that only looks like the real one. APV-08's boundary test asserts
mechanically that the enum still holds exactly `Draft`, `Active` and
`Cancelled`; APV-09 does not weaken that assertion, it adds one of its own.

**Why not B or D.** Readiness is a **total function** of facts that are already
immutable and already audited: the pinned profile, the case at one revision, the
evidence receipts, the declarations, the verification results and the review
decisions. A persisted copy of a conclusion that can be recomputed exactly is a
value free to drift from the facts that justify it, with nothing anywhere to
explain the divergence — `stored = Ready` while `recomputed = VerificationPending`
is a bug class this slice declines to create. Persisting it would also have
required a commanding operation, and a commanding operation is one refactor away
from `markReady()`.

**Why C.** The projection is deterministic, cheap, and impossible to desynchronize.
Readiness has no independent existence to protect.

**If readiness history is later required** — a genuine audit obligation, not a
convenience — the additive amendment is append-only, tenant-scoped,
revision-bound evaluation records with no update and no delete. That is a
different decision with a different justification, and it is not this one.

### The three dimensions, kept apart

```text
A  CASE LIFECYCLE        Draft | Active | Cancelled
   does this attempt exist, and does it accept work?
   commanded, persisted on the aggregate, owned by APV-04

B  PROTOCOLIZATION READINESS
   does the dossier satisfy the pinned profile at this revision?
   derived, never persisted, owned by APV-09

C  PROTOCOLIZATION EXECUTION
   has final protocolization begun or completed?
   owned by APV-10, and does not exist yet
```

All three are meaningful at once, and the following is a perfectly ordinary
state of the world:

```text
lifecycle Active  +  readiness Ready  +  execution NotStarted
```

---

## 4. The state model

Eight members, every one reachable from legitimate inputs available today and
every one exercised by a test.

| State | Meaning | Entered when | Left when | Persisted |
|---|---|---|---|---|
| `Ineligible` | The lifecycle forbids protocolization work | the case is `Cancelled` | the lifecycle changes (APV-04 permits no such transition today) | derived |
| `Rejected` | The current professional position on a required attestation requirement is `Reject` | a current `Reject` exists | a later review on a later basis revision replaces it | derived |
| `Blocked` | Current professional positions disagree | current decisions carry more than one distinct action | a later review on a later basis revision resolves it | derived |
| `MoreEvidenceRequired` | The current professional position asks for further material | a current `RequestMoreEvidence` exists | more material arrives and a later review is taken | derived |
| `EvidencePending` | Required dossier material is missing, short of a minimum, incompatible, subject to a profile constraint nothing supplied establishes, or governed by an unresolved condition | any material, constraint or condition blocker exists | the material — and the record establishing what the profile demands of it — arrives | derived |
| `VerificationPending` | Required automated verification is outstanding, stale, unavailable or failing | any verification blocker except `ManualReview` exists | the checks are re-executed and return usable current results | derived |
| `ReviewPending` | Human or professional work is outstanding | `ManualReview`, a missing/unproven attestation, an attestation that no longer covers the current revision, or an undecided or abstained review | the professional path completes legitimately | derived |
| `Ready` | Every applicable `Required` requirement is satisfied, and no blocker remains | the blocker set is empty | any blocker reappears | derived |

Candidate roadmap names that are **deliberately absent**, because nothing in the
current architecture can reach them:

```text
ProfileSelected   a case pins its profile at creation, so the state has no
                  distinct reachable meaning
Suspended         no suspension command exists anywhere
Superseded        no case supersession semantics exist
Archived          no archive lifecycle exists
Protocolizing     APV-10 owns execution; APV-09 must not enter it
Protocolized      only successful APV-10 execution may establish it
```

`Protocolizing` and `Protocolized` are documented here as **reserved for
APV-10**. APV-09 declares neither and transitions into neither.

---

## 5. State precedence — the exact table

Precedence is an explicit ordered table
(`PROTOCOLIZATION_READINESS_STATE_PRECEDENCE`), read top to bottom. **Nothing
anywhere compares enum positions or relies on declaration order.**

```text
1  Ineligible             lifecycle.cancelled
2  Rejected               review.rejected
3  Blocked                review.conflicting
4  MoreEvidenceRequired   review.more-evidence-required
5  EvidencePending        requirement.material.missing
                          requirement.material.insufficient
                          requirement.material.incompatible
                          requirement.constraint.unevaluated
                          requirement.condition.unresolved
6  VerificationPending    verification.missing
                          verification.fail
                          verification.stale
                          verification.unavailable
7  ReviewPending          verification.manual-review
                          attestation.missing
                          attestation.decision.missing
                          attestation.unproven-artifact
                          attestation.type-incompatible
                          attestation.currency.unresolved
                          review.pending
8  Ready                  no blocker of any kind
```

Stages 5 → 6 → 7 follow the workflow's own order, so the reported state names the
**earliest unfinished stage**. Stages 1 → 4 are interventions that outrank the
pipeline because a person, not a process, has to move them.

The table is **total** over the closed blocker vocabulary — every blocker code
appears in exactly one entry, and a test asserts it — so no blocker can be
present while the derivation still reports `Ready`.

**A state is a summary, never a redaction.** An evaluation reporting
`MoreEvidenceRequired` still carries its unavailable check and its unresolved
condition in `blockers`, and each still appears on the assessment it came from.

### Why a current `Fail` lives in `VerificationPending`

Deliberate, and worth stating. A failing check is a finding about the
*material*, and the route out of it is the same route out of every other
verification gap: correct the dossier and re-execute. Giving `Fail` a top-level
state of its own would have implied a different resolution path that does not
exist. Nothing is lost — the blocker is `verification.fail`, never
`verification.missing`, and the requirement's own status is `Blocked` rather
than `Pending`.

---

## 6. `READY` — the exact machine conditions

A case is `Ready` **only if all** of the following hold.

1. The pinned `AssetProfile` version resolves exactly from the catalogue.
2. The case validates against that profile.
3. The case's lifecycle is not `Cancelled`.
4. For every requirement whose obligation is `Required`:
   - it is assessed as `Satisfied` or `SatisfiedWithWarning`;
   - no required material is missing, short of a declared `minimumCount`, or
     mechanically incompatible;
   - every explicit machine-readable constraint the profile declares on it is
     **established as satisfied**, not merely unchecked — and where evaluation
     is delegated to another layer, that layer has actually **discharged** it;
   - every check the requirement declares has a **current** result at the
     evaluated revision, and none of them is `Fail`, `Unavailable` or
     `ManualReview`;
   - no declared check is missing or stale;
   - where an attestation is required, legitimate proof-backed APV-08
     professional material exists for it, in at least the declared quantity, and
     that material still **covers the evaluated revision**;
   - no current professional `Reject`, conflict, `RequestMoreEvidence` or
     `Abstain` stands against it.
5. No requirement whose obligation is `Conditional` remains applicability-
   `Unresolved`.
6. The resulting blocker set is empty.

`Optional` requirements never participate in this list. Neither do
`NotRequired` ones.

**No single item may be skipped silently**, and none is: `Ready` is
`blockers.length === 0`, and every clause above is a blocker if it fails.

---

## 7. The requirement assessment model

`ProtocolizationRequirementAssessment` — one per requirement of the pinned
profile, in the profile's declaration order. **Every** requirement is assessed,
`Optional`, `Conditional` and `NotRequired` included: dropping the ones that look
irrelevant would flatten the profile's four-member obligation vocabulary into
required/not-required in the very artifact that exists to keep it legible.

```text
requirementId              the profile's own id
kind                       the profile's own AssetRequirementKind
obligation                 the profile's own obligation, unflattened
applicability              Applicable | NotApplicable | Unresolved
materialStatus             APV-04's structural answer, quoted unchanged
status                     NotApplicable | Pending | Blocked
                           | Satisfied | SatisfiedWithWarning
materialIds                the APV-04 associations read
verificationExecutionIds   the APV-07 executions read
reviewDecisionIds          the APV-08 decisions read
attestationRefs            the Protocol attestations accepted as qualifying
blockers                   why it is not satisfied
warnings                   non-fatal findings, preserved
```

### `MaterialPresent` is not `Satisfied`

APV-04's `ProtocolizationRequirementMaterialStatus` answers *was something
associated?* — two members, no judgement. APV-09 does **not** rename, widen or
reinterpret it; it quotes it beside its own conclusion so both facts are legible
at once:

```text
materialStatus MaterialPresent + status Pending    material arrived; a declared
                                                   check has not run yet
materialStatus MaterialPresent + status Blocked    material arrived; the check
                                                   that read it failed
```

The semantic *requirement satisfied* first exists in APV-09, it is owned by Asset
Protocolization, and nothing comparable was added to Protocol.

### It is derived, never commanded

There is no `markRequirementSatisfied`, no waiver, no override and no setter
anywhere in this slice. A status is a deterministic function of the requirement
definition, its applicability, the case's material at the evaluated revision and
the supplied records — and of nothing else.

---

## 8. Applicability

```text
Required     -> Applicable      must be satisfied before Ready
Optional     -> Applicable      assessed and reported; never blocks
NotRequired  -> NotApplicable   the profile states on the record that this is
                                not demanded. The one applicability APV-09 can
                                mechanically resolve to "no".
Conditional  -> Unresolved      nothing available can say whether it applies
```

**`Conditional` is always `Unresolved`, and that is deliberate.** APV-03 defines
a condition as an opaque `conditionId`, and no slice up to and including this one
defines a condition evaluator. Reading the token's spelling, the requirement's
`metadata.reason` prose, or the presence of material against it to decide
applicability would each be inventing a profile's semantics — and would silently
drop a requirement that genuinely applied, or invent one that never did.

So an unresolved conditional requirement **blocks `Ready`**
(`requirement.condition.unresolved`) rather than disappearing from it. Its
substantive findings are still reported, as warnings: a reader gets to see what
the case holds against it, without the evaluator asserting that it applies.

A condition-evaluation layer is a legitimate future capability. It is not APV-09.

**Jurisdiction scoping is recorded context, never interpreted** — the same
position APV-08 took. A requirement scoped to a jurisdiction is assessed as
though it applies, which is the conservative direction.

---

## 9. Identity requirements

APV-09 asks one mechanical question: *does the case carry identifying material
of the strategies this requirement accepts, under its `satisfaction` rule?*

Identity may be bound on the subject at case creation or supplied later as
material correlated to the requirement, and **both count** — this is exactly the
rule APV-07's `check.identity.strategy` already applies, reused rather than
re-decided, so the two layers cannot disagree about what "evidenced" means.

```text
ContentIdentity     material of that kind, or subject.contentIdentity
ExternalReference   material of that kind, or subject.subjectRef.externalReference
RegistryEntry       material of that kind
satisfaction All    every accepted strategy must be evidenced
satisfaction Any    at least one must be
```

**Material present is never identity established.** A satisfied identity
requirement says the identifying material the profile asked for is associated and
structurally present. It does not say the reference resolves, that a registry
entry exists, that a digest matches any bytes, or that anyone is who they claim
to be. A profile that needs resolution declares a verification check for it —
and that check is then a separate requirement which must itself be satisfied
before `Ready`. Identity is never authority.

The requirement's `registry` constraint **is** evaluated here, from the
`CanonicalRegistryEntryRef` the material already carries, through APV-07's own
`registryEntryConforms` rather than a second copy of that comparison. A
non-conforming entry does not evidence the `RegistryEntry` strategy — an entry
from the wrong registry is not the entry the profile asked for — and is reported
as `requirement.material.incompatible`.

The requirement's `freshness` constraint has **no evaluator anywhere** — no
built-in evaluates identity freshness — so it is `requirement.constraint.unevaluated`:
a blocker when Required, a warning when Optional (§11).

---

## 10. Declaration requirements

A declaration requirement is satisfied by the **presence** of the declarations
the profile asked for, in the quantity it demanded.

```text
count      distinct CanonicalClaimIds among Declaration-kind material
           correlated to this requirement
minimum    requirement.minimumCount, defaulting to 1
```

Counting is by distinct claim reference, never by material rows: associating one
claim twice is one declaration recorded twice, and letting it count twice would
be a replay satisfying a `minimumCount` of two.

Where a supplied APV-06 record disagrees with the requirement's `claimType` or
`claimSubtype`, that claim is **excluded** (`requirement.material.incompatible`).
APV-06 refuses such a record at write time, so this catches only reconstructed or
malformed history — which is exactly when it matters.

### And it establishes nothing about the proposition

```text
declaration requirement satisfied   the applicant made the declaration the
                                    profile asked for, of the claim type it
                                    named, in the quantity it demanded

proposition true                    not established by this, or by anything
                                    else in this package
```

A declarant asserting they own something makes the assertion exist. It does not
make them the owner, and satisfying the workflow requirement never upgrades it. A
profile that wants the assertion *tested* declares a verification requirement
whose checks test it.

---

## 11. Evidence requirements

```text
present    distinct CanonicalEvidenceIds among Evidence-kind material
           correlated to this requirement
qualifying those whose every evaluable-here constraint is established as satisfied
minimum    requirement.minimumCount, defaulting to 1
```

Distinct references, never material rows and never intake receipts: one document
offered three times is one document, and a receipt replayed twice is one
admission.

### An unestablished normative constraint is a blocker

`acceptedTypes` is not decoration. A profile that names the evidence types it
accepts is stating a machine-readable demand, and a `Required` evidence
requirement is **not** semantically satisfied while nothing establishes that the
evidence supplied meets it.

```text
established as satisfied      the reference counts toward minimumCount
established as incompatible   requirement.material.incompatible
not established at all        requirement.constraint.unevaluated
```

All three are **blockers** on an applicable required requirement. Counting
references and reporting the unchecked constraint as a warning would let `Ready`
be reached on material the profile never accepted — the profile contract loosened
invisibly, purely to make the state reachable.

On an `Optional` requirement all three are reported as warnings and block
nothing. That difference is what keeps the two obligations meaningful.

### What establishes them

Protocol's own `CanonicalEvidence`, supplied as bounded readiness input
(`ProtocolizationReadinessInputs.evidence`). It already carries everything three
of these constraints ask about, so nothing is duplicated, no parallel evidence
type is defined, and no second evidence vocabulary is invented:

| APV-03 constraint | Established from | Verdict |
|---|---|---|
| `acceptedTypes` | `CanonicalEvidence.type` | **evaluable here** |
| `registry` | `CanonicalEvidence.registryRefs`, through APV-07's own `registryEntryConforms` | **evaluable here** |
| `credential` | `CanonicalEvidence.credentialRefs`, by the same rule APV-08 applies to a reviewer's credentials | **evaluable here** |
| `freshness` | a **current result for a check the pinned profile explicitly declares** | **delegated — and the delegation must be discharged** |
| `acceptedSubtypes` | nothing | **currently unevaluable** — blocker |

An `EvidenceIntakeCategoryId` is deliberately **not** read as an `EvidenceType`:
they are different vocabularies on purpose (APV-05), and mapping one onto the
other would be inventing a correspondence no profile declared.

### `acceptedSubtypes` is currently unevaluable, and says so

It is an opaque *vertical* token, and no artifact this package receives carries
one. `CanonicalEvidence` has no subtype field; a `CanonicalSemanticRef` names a
term in a semantic namespace, which is a different thing; and matching a metadata
key by convention would be worse than either. So a required requirement declaring
`acceptedSubtypes` blocks with `requirement.constraint.unevaluated` until
something can establish it. That is the honest answer, and it is deliberately not
resolved by weakening the demand. See §29 for the resolution path.

### Delegation is not satisfaction

```text
constraint delegated to APV-07   !=   constraint evaluated by APV-07
```

APV-09 must not recompute a freshness window — APV-07 owns that, and a second
implementation would be free to drift from it. But *"somebody else owns this"* is
not an answer. A `Required` requirement whose freshness constraint nobody ever
evaluated is **not** satisfied.

**A registered check is not a declared requirement.** APV-07 executes only the
`checkIds` an `AssetVerificationRequirement` of the **pinned profile** explicitly
declares. That `check.evidence.freshness` exists in this package's built-in
library establishes nothing about any particular profile.

So an evidence requirement's `freshness` is discharged only through the check
that owns it, and the existing verification vocabulary answers every case:

| Situation | Outcome | Reason emitted |
|---|---|---|
| no verification requirement declares the check | not discharged | `requirement.constraint.unevaluated` |
| declared, never executed | not discharged | `verification.missing` |
| declared, results exist, none at this revision | not discharged | `verification.stale` |
| current `Fail` | not discharged | `verification.fail` |
| current `Unavailable` | not discharged | `verification.unavailable` |
| current `ManualReview` | not discharged | `verification.manual-review` |
| current `Warning` | **discharged**, non-fatally | `verification.warning` (warning) |
| current `Pass` | **discharged** | `requirement.constraint.delegated` (warning) |

Every "not discharged" row is a blocker on an applicable required requirement,
and a warning on an optional one. The finding is filed against the **evidence
requirement** whose satisfaction is in question, carrying `constraint: 'freshness'`
and the `checkId`, so a reader can see why an evidence requirement is blocked by
a verification finding.

`requirement.constraint.delegated` now means **delegated *and* discharged**, and
names the execution that discharged it — the discharge is recorded rather than
left silent:

```text
delegated AND discharged     requirement.constraint.delegated  (warning)
delegated, never evaluated   requirement.constraint.unevaluated (blocker)
delegated, evaluated badly   the APV-07 blocker the outcome earned
```

Several verification requirements may declare the same check; any one standing
satisfied discharges the obligation, and a declaring requirement whose own result
failed blocks in its own right, so nothing is smuggled past.

### Only evidence freshness has an evaluator

`check.evidence.freshness` is the only built-in whose declared proposition is a
freshness constraint, and it evaluates **evidence requirements only**. No
built-in evaluates identity, verification or attestation freshness, and APV-09
does not invent a check id for one — asserting a mapping this package does not
have would be worse than reporting the gap.

So a `freshness` constraint on an identity, verification or attestation
requirement is `requirement.constraint.unevaluated`: a blocker when Required, a
warning when Optional. That is deliberately safer than inventing semantics, and
it is a genuine limitation rather than a hidden pass — see §29.

### Presence is still not sufficiency

A qualifying reference of an accepted type satisfies a count. It does not make
the document adequate, authentic, current or probative of anything — nothing here
reads a document, and nothing here could.

---

## 12. Verification requirements

The obligation is `requirement.checkIds` of the **exact pinned version**. A
result for a check the requirement does not declare is not consulted, and a check
the registry happens to know but the profile does not demand is not required.

| Current outcome | Effect on the requirement | Reason emitted |
|---|---|---|
| `Pass` | satisfies this check | — |
| `Warning` | satisfies this check, non-fatally | `verification.warning` (warning) |
| `Fail` | does not satisfy; requirement `Blocked` | `verification.fail` |
| `ManualReview` | does not satisfy; resolution is a person's | `verification.manual-review` |
| `Unavailable` | does not satisfy; **never** reported as a `Fail` | `verification.unavailable` |

`satisfaction: 'All'` demands every declared check; `satisfaction: 'Any'` demands
one. **`Any` is the profile's own explicit alternative, not a tolerance.** Where
it is absent, no alternative is invented.

There is **no scoring, averaging, weighting, majority or "worst outcome wins"
reduction anywhere**:

```text
2 Pass + 1 Fail = Pass         not implemented, and not an oversight
80% of checks passed           not a concept this package has
anything !== Fail => passed    not implemented
```

Where an `Any` requirement is satisfied, the findings of the alternatives that
did not hold are preserved **as warnings** — discarding them would hide a failing
check behind a passing sibling.

`WARNING` is never silently collapsed into `PASS`. It travels onto the
assessment, onto the evaluation, and onto the requirement's own status
(`SatisfiedWithWarning`), all the way to whoever is entitled to weigh it.

`MANUAL_REVIEW` means automation intentionally deferred judgement. It never
satisfies the obligation on its own, and it routes the case to `ReviewPending`
because the resolution path is a professional's, not a re-run.

---

## 13. Verification currentness

APV-07's own comparison is imported and reused
(`isVerificationResultCurrentForRevision`, `listLatestVerificationResults`). **No
competing notion of "current" exists in this slice**, and a boundary test asserts
it.

```text
no result for (requirementId, checkId) at all       verification.missing
results exist, none at the evaluated revision       verification.stale
a result at the evaluated revision                  its outcome decides
```

A `Pass` at revision 4 does not satisfy a requirement being evaluated at
revision 5. It is not deleted, invalidated or rewritten either — it remains
exactly the historical fact it was, and **re-execution** is what produces a
current one. `verification.stale` carries the evaluated revision so a caller can
see the gap.

Correlation is by the **pair** `(requirementId, checkId)`, never by check alone:
one `checkId` may legitimately be declared by two requirements of one profile,
and letting one requirement's result stand in for another's is exactly the silent
substitution the pinning rules exist to prevent.

---

## 14. Professional review semantics

APV-08 records positions and adjudicates nothing. APV-09 interprets the **current**
history, where *current* means the decisions taken on the **highest
`reviewBasisRevision`** for that requirement. Everything older stays in history
and stays readable; it simply stops being the current position.

| Current action | Effect | Reason emitted |
|---|---|---|
| `Attest` | may satisfy — **only** with qualifying material (§15) | — |
| `Reject` | requirement `Blocked`; state `Rejected` | `review.rejected` |
| `RequestMoreEvidence` | requirement `Pending`; state `MoreEvidenceRequired` | `review.more-evidence-required` |
| `Abstain` | requirement unresolved; state `ReviewPending` | `review.pending` |
| conflicting actions | requirement `Blocked`; state `Blocked` | `review.conflicting` |
| a request with no decision | state `ReviewPending` | `review.pending` |

### `MoreEvidenceRequired` does not dominate forever

This is the state APV-08 deliberately did not implement, and APV-09 owns it.

```text
R1 @ revision 5   RequestMoreEvidence    ->  MoreEvidenceRequired
evidence added        revision 8
R2 @ revision 8   Attest + artifact      ->  R1 is historical; state moves on
```

Nothing is overwritten, marked superseded or deleted to achieve that. The
comparison is on read, over records that remain exactly as APV-08 wrote them, and
R1's `requestedMaterial` stays permanently readable.

### `Reject`

`Rejected` is **derived**, and therefore never terminal by construction: a later
review on a later basis revision changes what "current" means, and the state
changes with it. Nothing closes a case, and nothing reaches a legal conclusion.

```text
Reject != case cancelled   != fraud   != legal invalidity
```

### `Abstain`

An abstention is a recorded professional position, not a failure of the
workflow and not a finding against the subject. It leaves the requirement
unresolved: somebody else has to look.

### Conflicting professionals

Where the current positions carry more than one distinct action, APV-09 reports
`review.conflicting` and **stops**. It does not take the first, the last, the
majority or the most favourable, and it does not weight reviewers. No frozen
artifact defines a multi-attestor rule, and inventing one here would be this
package deciding whose professional judgement wins. Resolution is a human act — a
further review on a further basis revision — and both decisions remain
addressable throughout.

### Independence

Each attestation requirement is assessed on its own. There is deliberately no
case-global `professionalReviewed` flag anywhere: a profile with two required
attestation requirements needs both, and the assessment says which is missing.

---

## 15. Attestation requirements — the APV-08 hardening, re-established

### `Attest` decision without a canonical artifact — satisfied? **NO.**

This is the hard rule of the slice.

```text
ProfessionalReviewDecision(action: Attest)   !=   attestation material
```

A decision proves a professional chose to attest. The profile asked for an
*attestation*, and an `Attest` with no `CanonicalAttestation` and no APV-04
attestation material does not deliver one. APV-08 makes that state perfectly
legal — a recorded professional position without a Protocol artifact — and APV-09
must not read it as a satisfied requirement. The blocker is
`attestation.missing`.

### What qualifies as legitimate APV-08 professional material

Every clause is a separate way a lookalike is refused:

```text
kind is ProtocolizationMaterialKind.Attestation      never a Verification,
                                                     Declaration or Credential
                                                     association
correlated to this exact requirement id              never another attestation
                                                     requirement's artifact
an Attest decision names this exact material and
  this exact attestation                             never material somebody
                                                     associated by hand
the decision's scope answers this requirement        never a scope for another
the attested type is in the pinned version's
  acceptedTypes                                      never a type only a later
                                                     version accepts
the CanonicalAttestation carries >= 1 usable
  CanonicalProofRef                                  the APV-08 hardening,
                                                     re-established on the
                                                     artifact itself
count is by distinct attestation reference,
  against minimumCount                               never one artifact twice
```

The proof check reuses APV-08's own `isUsableProofRef`. Where the referenced
`CanonicalAttestation` is not supplied among the inputs, the invariant cannot be
established and the material does **not** qualify
(`attestation.unproven-artifact`). **Absence is never satisfaction**, and the
failure direction is always toward *not ready*.

### Proof semantics

```text
proof reference required for APV professional material   YES
proof resolved by APV-09                                 NO
signature verified by APV-09                             NO
```

Protocol's contract for `CanonicalProofRef` is "references a proof artifact
without embedding, resolving, or validating that artifact", and this package has
no way to do more — nor may it pretend to. **A profile that requires
cryptographic verification declares an APV-07 verification requirement for it,
and that requirement gates `Ready` in its own right.**

### None of this is truth

```text
attestation requirement satisfied  != the proposition is true
attestation requirement satisfied  != the reviewer had legal authority
proof reference present            != proof verified
```

### Attestation currency — a blocker, not a footnote

APV-08's contract is explicit: **a professional must never unknowingly attest a
moving target**, and material added after a review's basis is outside that
request's review basis. An attestation bound to revision `N` is a statement about
revision `N`, and treating it as authority over `N+k` would be exactly the
inference that contract forbids.

What an attestation demonstrably covers is
`resultingCaseRevision ?? reviewBasisRevision` — the basis the professional
reviewed, plus the revision their own attestation produced, which is new material
the reviewer by definition did not review.

```text
covers through revision N   +   case at revision N        satisfies
covers through revision N   +   case at revision N+k      does not
```

Where the **current** attestations do not meet the profile's `minimumCount` and a
stale one exists, `attestation.currency.unresolved` is a **blocker**, and the
state it derives is `ReviewPending` — because the resolution is a further review
on the newer basis.

### Every intervening revision must be accounted for

The case's `revision` increments once per successful operation, so the revisions
in `(coveredThrough, evaluatedCaseRevision]` are exactly the operations that
happened after coverage. An attestation is current only if **every one of them**
is accounted for. An unaccounted revision — a declaration, an evidence admission,
a bare material association, a lifecycle transition, anything this evaluator
cannot identify — makes it not current. The default direction is *not current*,
and a gap is never read as "probably harmless".

**One carve-out**, and it is not an invented scope rule: a revision is accounted
for when it is the `resultingCaseRevision` of an APV-08 `Attest` decision for a
**different** attestation requirement of the same pinned profile.

```text
a second reviewer recording their own attestation
    != dossier material this reviewer needed to see
```

APV-08 already established the narrower half of this — a reviewer did not review
the attestation their own decision produced, which is why `reviewBasisRevision`
and `resultingCaseRevision` are separate fields. One professional's recorded
position is likewise not evidence about another's proposition, for the same
reason conflicting decisions are preserved and never adjudicated.

Without the carve-out a profile with two required attestation requirements could
never be ready: attesting the second would stale the first, re-reviewing the
first would stale the second, and the regress would not terminate. That would not
be conservatism; it would be a rule that makes a legitimate profile
unsatisfiable.

### What it never does

```text
delete the old attestation           NO
mark the old attestation invalid     NO
rewrite review history               NO
infer that a signature is bad        NO
```

The old attestation remains a perfectly valid historical statement about the
basis it reviewed, addressable and unchanged. A new legitimate review on the
newer basis clears the blocker naturally, and once enough current attestations
exist the stale ones are history rather than an outstanding question.

### Required and Optional stay distinct

On an `Optional` attestation requirement, unresolved currency is reported as a
warning and blocks nothing — like every other optional finding.

---

## 16. Blockers and warnings

Two arrays, on the evaluation and on every assessment. A consumer **never parses
a code, matches a prefix or reads a sentence** to learn whether something
prevents readiness: the array it arrived in already said so. There is no
human-readable `message`, `detail` or `summary` anywhere on a reason.

### Blocker reason codes

```text
lifecycle.cancelled
requirement.condition.unresolved
requirement.material.missing
requirement.material.insufficient
requirement.material.incompatible
requirement.constraint.unevaluated
verification.missing
verification.fail
verification.stale
verification.unavailable
verification.manual-review
attestation.missing
attestation.decision.missing
attestation.unproven-artifact
attestation.type-incompatible
attestation.currency.unresolved
review.pending
review.more-evidence-required
review.rejected
review.conflicting
```

### Warning reason codes

```text
verification.warning                 a declared check's current result is Warning
requirement.optional.unsatisfied     an Optional requirement is unmet
requirement.constraint.delegated     a constraint another layer owns, and that
                                     layer actually discharged it — today,
                                     exactly evidence `freshness`. Carries the
                                     checkId and the execution that discharged it.
```

A reason carries **references, never payloads**: `requirementId`, `checkId`,
`executionIds`, `decisionIds`, `materialIds`, `attestationRefs`, the constraint
field name, `required`/`observed` counts, and `atCaseRevision`. No declaration
statement, reviewer note, evidence document or personal data appears in one — a
readiness result travels further than the material it describes.

### `Ready` with warnings

`Ready` may coexist with warnings, and it is expressed as `state: Ready` plus a
populated `warnings` array — never as a separate ambiguous state, which would
have made every consumer handle two spellings of one conclusion.

One warning qualifies a satisfied requirement's *status* (to
`SatisfiedWithWarning`): `verification.warning`, because it is a finding **about
the case**. `requirement.constraint.delegated` does not, because it records that a
constraint was answered elsewhere and passed — the qualification, if any, is
already carried by the `verification.warning` that discharge produced.

### `Optional` requirements can never produce a blocker

An unmet `Optional` requirement reports `requirement.optional.unsatisfied`
followed by its substantive findings — **in `warnings`**, carrying their original
blocker-vocabulary codes so a reader still learns exactly what is unmet. An
optional gap therefore cannot structurally reach the evaluation's blocker set, and
cannot prevent `Ready`. This is enforced by construction, not by remembering to
filter later.

### Where every explicit profile constraint is answered

```text
identity   acceptedStrategies / satisfaction   evaluable here
identity   registry                            evaluable here (APV-07's comparison)
identity   freshness                           no evaluator exists (blocker)

declaration claimType / claimSubtype           evaluable here
declaration minimumCount                       evaluable here

evidence   acceptedTypes                       evaluable here, from CanonicalEvidence
evidence   registry                            evaluable here, from CanonicalEvidence
evidence   credential                          evaluable here, from CanonicalEvidence
evidence   minimumCount                        evaluable here
evidence   freshness                           delegated to APV-07 — discharged
                                               only by a current result for a
                                               check the profile declares
evidence   acceptedSubtypes                    currently unevaluable (blocker)

verification checkIds / satisfaction           evaluable here
verification freshness                         no evaluator exists (blocker)

attestation acceptedTypes                      evaluable here (scope type)
attestation minimumCount                       evaluable here
attestation attester                           enforced by APV-08 at decision time
attestation freshness                          no evaluator exists (blocker)
```

An attestation requirement's `attester` constraint is enforced by APV-08's own
`assertReviewerSatisfiesConstraints` when the decision is recorded; re-checking it
here would be competing logic. Everything in the "currently unevaluable" row is a
**blocker** on an applicable required requirement, and a warning on an optional
one — never a silent pass.

---

## 17. Revision binding and TOCTOU protection

Every evaluation carries `evaluatedCaseRevision`, always the case's own
`revision`. **This is the whole TOCTOU story.**

```text
revision 20   evaluation says Ready
revision 21   a declaration is recorded
revision 21   the revision-20 evaluation is NOT current, and must not
              authorize anything
```

`isProtocolizationReadinessCurrentForCase(evaluation, case)` compares **four**
things — tenant, case, pinned profile and revision — and the revision comparison
is exact rather than "at least": an evaluation of an older revision saw strictly
less, and one carrying a newer revision describes a case the caller is not
holding.

It does not re-evaluate, refresh, invalidate or expire anything, and it does not
decide what a stale result means. It answers one question so APV-10 never has to
trust a `ready: true` it cannot place in time.

---

## 18. Exact profile version

Every evaluation uses `case.profile.profileId` and `case.profile.profileVersion`
**exactly**. There is no latest, current, newest, default or nearest resolution
anywhere in this slice. A case pinned to `1.0.0` is evaluated under `1.0.0` after
`2.0.0` is catalogued, even when `2.0.0` redefines the same requirement ids or
adds new ones. A catalogue that does not hold the pin produces
`READINESS_PROFILE_NOT_FOUND` — never a substitute version.

---

## 19. Readiness regression and recovery

**Readiness is not monotonic**, and nothing in the design assumes it is.

```text
Ready                 ->  VerificationPending    new material makes the
                                                 passing checks stale
MoreEvidenceRequired  ->  ReviewPending  ->  Ready
                                                 after new evidence and a
                                                 further review
Rejected              ->  Ready                  after a later review on a
                                                 later basis
```

Because readiness is a projection, a historical evaluation object a caller still
holds is **untouched** by any of this: it remains exactly the statement about its
own revision that it always was. It simply stops being current, which
`isProtocolizationReadinessCurrentForCase` reports.

---

## 20. Persistence, events and identity

```text
persistence      NONE. Pure deterministic projection. No repository, no stored
                 state field, no evaluation history.
events           NONE.
evaluation id    NONE.
```

**Why no repository.** See §3. A recomputable conclusion stored beside the facts
that justify it is a value free to drift from them.

**Why no event.** A projection recomputed from immutable, already-audited inputs
produces no new fact. A projection moving from `VerificationPending` to `Ready`
is *already* fully explained by the APV-07 result that caused it plus this
deterministic rule; a second "transition" fact would be a duplicate under a
different name. Emitting `ReadinessEvaluated` on every call would fill an audit
log with restatements of records the log already holds. **Nothing here
manufactures a transition it did not perform.**

**Why no id.** Readiness is deterministic and ephemeral, and its identity is
already `(tenantId, caseId, profile, evaluatedCaseRevision)` — four fields that
are on every evaluation. An opaque id would name the same thing less usefully.

If evaluation records are later persisted for a genuine audit obligation, they
must be tenant-scoped, immutable, append-only, revision-bound, validated on
reconstruction, and carry no update or delete.

---

## 21. Inputs, and what is refused

```text
context            { catalog, clock, tenantId }   — APV-04's own case context
protocolizationCase
inputs             evidenceReceipts?     APV-05
                   evidence?             Protocol CanonicalEvidence records
                   declarations?         APV-06
                   verificationResults?  APV-07
                   reviewRequests?       APV-08
                   reviewDecisions?      APV-08
                   attestations?         Protocol CanonicalAttestation records
```

Supplied rather than fetched: APV-09 holds no repository and is given no
arbitrary access to one. Every supplied record is checked to belong to the acting
tenant, this case and this pinned profile version **before any of it can
influence a conclusion**, and each failure is loud:

```text
another tenant's record          READINESS_INPUT_TENANT_MISMATCH
another case's record            READINESS_INPUT_CASE_MISMATCH
another profile version's record READINESS_INPUT_PROFILE_MISMATCH
```

Records bound to a revision the case has not reached are **filtered**, not
refused: they may be perfectly legitimate and simply belong to a future this
evaluation has not reached.

Supplying a `CanonicalEvidence` record establishes what a profile's evidence
constraints demand. Omitting it does not make the constraint pass — the
reference simply does not qualify, and an applicable required requirement blocks.

### No hidden I/O

APV-09 does not query an external registry, fetch a document, resolve a
credential, validate a signature, resolve a proof, run an APV-07 check, invoke a
professional, or contact Enterprise. It consumes existing results and recreates
no previous layer. The only injected dependency that does anything is the clock,
and `evaluatedAt` comes from it — never from `Date.now()`.

---

## 22. Errors — and why a blocker is not one

```text
blocker   the evaluation succeeded and this is part of the answer
          -> required check Fail, attestation missing, condition unresolved
          -> returned inside ProtocolizationReadinessEvaluation.blockers

error     the evaluation could not honestly be performed
          -> wrong tenant, malformed case, unresolvable pin, foreign input
          -> thrown as ProtocolizationReadinessError
```

A required verification `Fail` is emphatically **not** an error: refusing to
answer there would tell a caller "I cannot say" when the truthful answer is "I
can say precisely, and here is why".

```text
READINESS_TENANT_REQUIRED
READINESS_TENANT_MISMATCH
READINESS_CASE_INVALID
READINESS_PROFILE_NOT_FOUND
READINESS_PROFILE_MISMATCH
READINESS_INPUT_TENANT_MISMATCH
READINESS_INPUT_CASE_MISMATCH
READINESS_INPUT_PROFILE_MISMATCH
READINESS_REQUIREMENT_KIND_UNSUPPORTED
READINESS_TIMESTAMP_INVALID
```

`READINESS_REQUIREMENT_KIND_UNSUPPORTED` is deliberately loud. A future
`AssetRequirementKind` reaching a build that predates it must never be treated as
satisfied, skipped, or quietly counted as `NotApplicable` — every one of those
turns a demand nobody understood into a demand that was met.

---

## 23. Lifecycle interaction

```text
Draft      readiness is evaluated normally; Ready is reachable
Active     readiness is evaluated normally; Ready is reachable
Cancelled  Ineligible, always. Every requirement is still assessed and still
           reported — the dossier's standing remains a fact worth reading — but
           no ordinary readiness derivation overrides the cancellation.
```

APV-04's `Draft` means *created and being assembled*; it is **not** a synonym for
"no material collected", and APV-09 does not map it to one. APV-04's `Active`
means *taken up for processing*; it does **not** mean evidence is present,
verification is running, review is pending or anything is ready.

---

## 24. Tenant isolation

Every operation is tenant-bound and reuses the vertical's existing gate. Tenant B
cannot evaluate tenant A's case, obtain its readiness, or have its own records
influence A's answer — receipts, declarations, verification results, review
requests, review decisions and attestations alike.

**Ownership is `tenantId`, never the subject.** A subject can legitimately appear
in two tenants' cases, and reading ownership off one would leak one tenant's
dossier into the other's readiness.

---

## 25. Generic engine only

Production APV-09 branches on **no** asset class, profile id, profile version,
asset category, jurisdiction or role token. There is no
`if (profileId === 'realestate.cr.v1')` and there never will be: the profile
drives the requirements, and adding an asset category is writing a profile.

A boundary test scans the state-machine source for such branches, and the
architecture proofs run the same engine against two fundamentally different
subjects — one with a canonical byte representation, one named only inside an
external namespace — without a single branch between them.

No concrete profile is added. `digital.artifact.v1` belongs to APV-11;
`realestate.cr.v1` belongs much later.

---

## 26. APV-10 handoff

APV-10 will consume, from one `ProtocolizationReadinessEvaluation`:

```text
schemaVersion            what shape this is
tenantId                 who may act
caseId                   what to act on
profile                  the exact pinned version the answer was computed under
evaluatedCaseRevision    the revision the answer describes  <-- the TOCTOU guard
caseState                the lifecycle at evaluation time
state / ready            the conclusion
requirementAssessments   why, requirement by requirement
blockers / warnings      what remains, and what was merely noted
evaluatedAt             when, from the injected clock
```

and one helper: `isProtocolizationReadinessCurrentForCase(evaluation, case)`.

APV-10 must refuse to execute when that returns `false`. **Returning `Ready`
executes nothing**: no write, no anchor, no token, no signature, no registry
change, no case transition, no event.

**APV-10 is not implemented by this slice**, and neither is any part of it.

---

## 27. Boundary — what APV-09 is not

```text
Protocol core modified                          NO
A readiness concept added to Protocol           NO
APV-04 lifecycle enum changed                   NO
APV-04 MaterialPresent reinterpreted            NO
An APV-07 check re-executed                     NO
A freshness window recomputed                   NO
A signature or proof verified                   NO
An external registry contacted                  NO
A concrete AssetProfile added                   NO
Real-estate or jurisdiction logic added         NO
Enterprise governance, capability or TOKENIZE   NO
Tokenization, blockchain, wallet or custody     NO
Payments or fee model                           NO
Registry connectors                             NO
APV-10 execution, ProtocolizationResult,
  Protocolizing or Protocolized                 NO
Persistence, repository or domain event         NO
Waiver, override or manual promotion            NO
An unchecked constraint silently permitting
  Ready on a Required requirement               NO
A delegated constraint treated as satisfied
  without being discharged                      NO
A check id invented for a requirement kind
  with no evaluator                             NO
A stale attestation authorizing a current
  Ready                                        NO
```

---

## 28. Source layout

```text
packages/asset-protocolization/src/state-machine/
  readiness-reason.ts          the closed blocker and warning vocabulary
  readiness-state.ts           states, applicability, status, precedence table
  requirement-assessment.ts    one requirement's explained conclusion
  readiness-evaluation.ts      the evaluation record and its bounded inputs
  readiness-validation.ts      tenant, case, pin and input gates
  readiness-evaluators.ts      one evaluator per generic requirement kind
  readiness-operations.ts      evaluateProtocolizationReadiness
  readiness-projections.ts     read-only views, including the APV-10 guard
  readiness-errors.ts          the refusal vocabulary
```

Public surface: the state, applicability and status vocabularies; the reason
codes and their predicates; the precedence table; the assessment, evaluation and
input types; `evaluateProtocolizationReadiness`; the four projections; and the
error type. The evaluators, the validators, the freeze helper and the private
precedence constants are internal.

---

## 29. Known limitations

Three explicit machine-readable demands a profile can make that APV-09 cannot
currently establish. All three **block** an applicable `Required` requirement and
warn on an `Optional` one. None is silently passed, and none is resolved by
weakening the demand.

### Evidence `acceptedSubtypes`

An opaque *vertical* token, and no artifact this package receives carries one.
`CanonicalEvidence` has no subtype field, a `CanonicalSemanticRef` names a term in
a semantic namespace rather than this token, and `EvidenceIntakeCategoryId` is a
different vocabulary on purpose. A profile declaring it cannot currently reach
`Ready`.

*Resolution path:* APV-05 carrying the vertical subtype on its receipt, or an
APV-03 amendment. Both are changes to frozen slices and neither is APV-09's.

### Identity, verification and attestation `freshness`

`check.evidence.freshness` is the only built-in whose declared proposition is a
freshness constraint, and it evaluates evidence requirements only. There is no
check whose proposition is "this identity material is recent enough", "these
check results are recent enough" or "this attestation is recent enough", and
APV-09 does not invent a check id for one.

*Resolution path:* a new APV-07 built-in per requirement kind, declared by
profiles that need it. That is an APV-07 addition; APV-09 would then discharge it
by exactly the rule §11 already applies to evidence.

### Conditional applicability

APV-03 defines a condition as an opaque `conditionId` and no slice defines an
evaluator, so every `Conditional` requirement is `Unresolved` and blocks (§8).

*Resolution path:* a condition-evaluation layer. Not APV-09.
