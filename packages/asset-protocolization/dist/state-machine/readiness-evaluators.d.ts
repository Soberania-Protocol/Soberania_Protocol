import type { CanonicalAttestation, CanonicalAttestationId, CanonicalEvidence, CanonicalEvidenceId } from '@aoc/protocol/claims';
import type { AssetProfile } from '../profile';
import { AssetRequirementObligation } from '../requirements';
import type { AssetAttestationRequirement, AssetDeclarationRequirement, AssetEvidenceRequirement, AssetIdentityRequirement, AssetRequirement, AssetVerificationRequirement } from '../requirements';
import type { ProtocolizationMaterialId } from '../case/case-identifiers';
import type { ProtocolizationCase } from '../case/protocolization-case';
import type { ProtocolizationDeclarationRecord } from '../declarations/declaration-record';
import type { ProfessionalReviewDecision } from '../attestation/review-decision';
import type { ProfessionalReviewDecisionId } from '../attestation/review-identifiers';
import type { ProfessionalReviewRequest } from '../attestation/review-request';
import type { VerificationExecutionId } from '../verification/verification-identifiers';
import type { ProtocolizationVerificationResult } from '../verification/verification-result';
import type { ProtocolizationReadinessReason } from './readiness-reason';
/**
 * One evaluator per generic requirement kind.
 *
 * ### Generic by construction
 *
 * Nothing here knows what a house, a recording, a vehicle or a jurisdiction is.
 * There is no `if (profileId === ...)`, no asset-category branch, no country
 * rule and no concrete profile. The five functions below branch on
 * `AssetRequirementKind` — a closed APV-03 vocabulary — and on the *fields the
 * pinned profile declares*, and on nothing else. Adding an asset category is
 * writing a profile; it is never editing this file.
 *
 * ### Interpretation, never manufacture
 *
 * Each evaluator reads facts earlier slices recorded and decides whether they
 * meet what the profile demanded. None of them re-runs a check, recomputes a
 * digest or a freshness window, resolves an identity, dereferences a claim,
 * contacts a registry, validates a signature, invokes a professional or asks
 * Enterprise anything. Where a fact is absent, the answer is *not satisfied* —
 * never an assumed one.
 *
 * ### Kind compatibility is hard, permanently
 *
 * The lesson APV-06 and APV-07 paid for holds here without exception: material
 * satisfies only the requirement kind it mechanically answers. A `Declaration`
 * material correlated to an evidence requirement contributes nothing to its
 * count; a `Verification` material never answers an attestation requirement;
 * an `Attestation` material never answers a declaration requirement. Every
 * lookup below filters by `ProtocolizationMaterialKind` before it counts
 * anything.
 */
/** What one evaluator produces. The orchestrator turns this into an assessment. */
export interface RequirementFindings {
    readonly materialIds: readonly ProtocolizationMaterialId[];
    readonly blockers: readonly ProtocolizationReadinessReason[];
    readonly warnings: readonly ProtocolizationReadinessReason[];
    readonly verificationExecutionIds?: readonly VerificationExecutionId[];
    readonly reviewDecisionIds?: readonly ProfessionalReviewDecisionId[];
    readonly attestationRefs?: readonly CanonicalAttestationId[];
}
/** The bounded, already-validated world one evaluation reasons over. */
export interface RequirementEvaluationContext {
    readonly protocolizationCase: ProtocolizationCase;
    readonly profile: AssetProfile;
    readonly evaluatedCaseRevision: number;
    readonly declarations: readonly ProtocolizationDeclarationRecord[];
    readonly verificationResults: readonly ProtocolizationVerificationResult[];
    readonly reviewRequests: readonly ProfessionalReviewRequest[];
    readonly reviewDecisions: readonly ProfessionalReviewDecision[];
    readonly attestationsById: ReadonlyMap<CanonicalAttestationId, CanonicalAttestation>;
    readonly evidenceById: ReadonlyMap<CanonicalEvidenceId, CanonicalEvidence>;
}
/**
 * *Does the case carry identifying material of the strategies this requirement
 * accepts?*
 *
 * Identity may be bound on the subject at case creation or supplied later as
 * material correlated to the requirement, and both count — this is exactly the
 * rule APV-07's `check.identity.strategy` already applies, reused rather than
 * re-decided, so the two layers can never disagree about what "evidenced" means.
 *
 * ### Material present is never identity established
 *
 * A satisfied identity requirement says the identifying material the profile
 * asked for is associated and structurally present. It does not say the
 * reference resolves, that the registry entry exists, that the digest matches
 * any bytes, or that anyone is who they claim to be. Resolution is an external
 * act, and a profile that needs it declares a verification check for it — that
 * check is then a separate requirement which must itself be satisfied before
 * `Ready`. Identity is never authority either: nothing here says a declarant
 * owns the subject or may act for it.
 */
export declare function evaluateIdentityRequirement(context: RequirementEvaluationContext, requirement: AssetIdentityRequirement): RequirementFindings;
/**
 * *Has the applicant made the declarations this requirement demands?*
 *
 * ### A declaration satisfied is never a proposition true
 *
 * This is the distinction the whole requirement kind turns on, and it survives
 * intact here:
 *
 * ```text
 * declaration requirement satisfied   the applicant made the declaration the
 *                                     profile asked for, of the claim type it
 *                                     named, in the quantity it demanded
 *
 * proposition true                    not established by this, or by anything
 *                                     else in this package
 * ```
 *
 * A declarant asserting they own something makes the assertion exist. It does
 * not make them the owner, and satisfying the workflow requirement never
 * upgrades it. A profile that wants the assertion *tested* declares a
 * verification requirement whose checks test it — and that requirement gates
 * `Ready` in its own right.
 *
 * ### Counting
 *
 * Distinct `CanonicalClaimId`s, never material rows: associating the same claim
 * twice is one declaration recorded twice, and letting it count twice would be a
 * replay satisfying a `minimumCount` of two. Where a supplied APV-06 record
 * disagrees with the requirement's `claimType` or `claimSubtype`, that claim is
 * excluded — APV-06 refuses such a record at write time, so this catches only
 * reconstructed or malformed history, which is exactly when it matters.
 */
export declare function evaluateDeclarationRequirement(context: RequirementEvaluationContext, requirement: AssetDeclarationRequirement): RequirementFindings;
/**
 * *Has the case been given the supporting evidence this requirement demands,
 * and does that evidence meet what the profile explicitly demanded of it?*
 *
 * ### An unestablished normative constraint is a blocker, not a footnote
 *
 * `acceptedTypes` is not decoration. A profile that names the evidence types it
 * accepts is stating a machine-readable demand, and a `Required` evidence
 * requirement is **not** satisfied while nothing establishes that the evidence
 * supplied meets it. Counting references and reporting the unchecked constraint
 * as a warning would let `Ready` be reached on material the profile never
 * accepted — the profile contract loosened invisibly, purely to make the state
 * reachable.
 *
 * So a reference *qualifies* only when every constraint that is evaluable here
 * is **established as satisfied**:
 *
 * ```text
 * established as satisfied      the reference counts
 * established as incompatible   requirement.material.incompatible
 * not established at all        requirement.constraint.unevaluated
 * ```
 *
 * All three are blockers on an applicable required requirement. On an `Optional`
 * one they are reported as warnings and block nothing, which is what keeps the
 * two obligations meaningfully different.
 *
 * ### What establishes them
 *
 * Protocol's own `CanonicalEvidence`, supplied as bounded readiness input. It
 * already carries everything three of these constraints ask about, and this
 * package neither duplicates it, copies it into a parallel type, nor invents a
 * second evidence vocabulary:
 *
 * ```text
 * acceptedTypes    CanonicalEvidence.type          -> evaluable here
 * registry         CanonicalEvidence.registryRefs  -> evaluable here, through
 *                                                     APV-07's own comparison
 * credential       CanonicalEvidence.credentialRefs-> evaluable here, by the
 *                                                     same rule APV-08 applies
 * freshness        an APV-07 outcome               -> delegated, never recomputed
 * acceptedSubtypes nothing                         -> currently unevaluable
 * ```
 *
 * ### `acceptedSubtypes` is currently unevaluable, and says so
 *
 * It is an opaque *vertical* token, and no artifact this package receives
 * carries one. `CanonicalEvidence` has no subtype field;
 * `EvidenceIntakeCategoryId` is a different vocabulary on purpose and reading it
 * as a subtype would be inventing a mapping no profile declared; a
 * `CanonicalSemanticRef` names a term in a semantic namespace, which is again
 * not this token; and matching a metadata key by convention would be worse than
 * either. So a required requirement declaring `acceptedSubtypes` blocks until
 * something can establish it. That is the honest answer, and it is deliberately
 * not resolved by weakening the demand.
 *
 * ### Presence is still not sufficiency
 *
 * A qualifying reference of an accepted type satisfies a count. It does not make
 * the document adequate, authentic, current or probative of anything — nothing
 * here reads a document, and nothing here could.
 *
 * ### Counting
 *
 * Distinct `CanonicalEvidenceId`s against `minimumCount`, never material rows and
 * never intake receipts: one document offered three times is one document.
 */
export declare function evaluateEvidenceRequirement(context: RequirementEvaluationContext, requirement: AssetEvidenceRequirement): RequirementFindings;
/**
 * *Have the checks this requirement declares actually been executed against
 * this revision, and what did they say?*
 *
 * ### Check ids come from the pinned profile, never from a registry
 *
 * The obligation is `requirement.checkIds` of the exact pinned version. A result
 * for a check the requirement does not declare is not consulted, and a check the
 * registry happens to know but the profile does not demand is not required.
 *
 * ### Currency is APV-07's rule, reused
 *
 * A result describes the revision it evaluated, forever. Whether it describes
 * the revision being assessed is `isVerificationResultCurrentForRevision` —
 * APV-07's own comparison, imported rather than re-implemented, so no competing
 * notion of "current" can arise. Concretely:
 *
 * ```text
 * no result for the pair at all            verification.missing
 * results exist, none at this revision     verification.stale
 * a result at this revision                its outcome decides
 * ```
 *
 * A `Pass` at revision 4 does not satisfy a requirement being evaluated at
 * revision 5. It is not deleted, invalidated or rewritten either — it remains
 * exactly the historical fact it was, and re-execution is what produces a
 * current one.
 *
 * ### `All` and `Any` are the profile's own words
 *
 * `satisfaction: 'All'` demands every declared check; `satisfaction: 'Any'`
 * demands one. `Any` is not a majority rule and not a tolerance — it is an
 * alternative the profile explicitly encoded, and where it is absent no
 * alternative is invented.
 */
export declare function evaluateVerificationRequirement(context: RequirementEvaluationContext, requirement: AssetVerificationRequirement): RequirementFindings;
/**
 * *Does legitimate professional attestation material exist for this
 * requirement, and does the current professional position permit relying on it?*
 *
 * ### Each attestation requirement is independent
 *
 * There is deliberately no case-global `professionalReviewed` flag anywhere. A
 * profile with two required attestation requirements needs both satisfied; one
 * satisfied and one missing is not ready, and the assessment says which.
 *
 * ### Conflicting professionals are never adjudicated
 *
 * Where the current positions carry more than one distinct action, APV-09
 * reports `review.conflicting` and stops. It does not take the first, the last,
 * the majority or the most favourable, and it does not weight reviewers — no
 * frozen artifact defines a multi-attestor rule, and inventing one here would be
 * this package deciding whose professional judgement wins.
 *
 * ### A stale attestation does not authorize a current Ready
 *
 * ```text
 * covered through revision N   +   case at revision N          satisfies
 * covered through revision N   +   case at revision N+k        does not
 * ```
 *
 * Where the current attestations do not meet the profile's demand and a stale
 * one exists, `attestation.currency.unresolved` is a **blocker**, and the state
 * it derives is `ReviewPending` — because the resolution is a further review on
 * the newer basis, and a new legitimate artifact covering it clears the blocker
 * naturally. The old attestation is untouched throughout: it is not deleted, not
 * marked invalid, and no inference is drawn about its signature.
 *
 * ### None of this is truth
 *
 * ```text
 * attestation requirement satisfied  != the proposition is true
 * attestation requirement satisfied  != the reviewer had legal authority
 * proof reference present            != proof verified
 * Reject                             != legal invalidity, fraud, or a
 *                                       cancelled case
 * ```
 */
export declare function evaluateAttestationRequirement(context: RequirementEvaluationContext, requirement: AssetAttestationRequirement): RequirementFindings;
/**
 * Exhaustive dispatch over APV-03's closed requirement vocabulary.
 *
 * A kind this build does not know fails loudly with
 * `READINESS_REQUIREMENT_KIND_UNSUPPORTED`. It is deliberately not treated as
 * satisfied, not skipped and not reported as `NotApplicable`: every one of those
 * would turn a demand nobody understood into a demand that was met, and the
 * failure would be invisible in the result.
 */
export declare function evaluateRequirement(context: RequirementEvaluationContext, requirement: AssetRequirement): RequirementFindings;
/** Whether one obligation demands satisfaction before `Ready`. */
export declare function isBlockingObligation(obligation: AssetRequirementObligation): boolean;
//# sourceMappingURL=readiness-evaluators.d.ts.map