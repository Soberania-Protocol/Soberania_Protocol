import type { CanonicalAttestationId, CanonicalEvidenceId } from '@aoc/protocol/claims';
import type { AssetRequirementId, AssetVerificationCheckId } from '../identifiers';
import type { ProtocolizationMaterialId } from '../case/case-identifiers';
import type { ProfessionalReviewDecisionId } from '../attestation/review-identifiers';
import type { VerificationExecutionId } from '../verification/verification-identifiers';
/**
 * Why a readiness evaluation says what it says — as machine-readable structure,
 * never as prose.
 *
 * ### A reason is not an error
 *
 * This is the distinction APV-09 turns on, and getting it wrong would collapse
 * the whole slice:
 *
 * ```text
 * ProtocolizationReadinessError   the evaluation could not be performed
 *                                 — wrong tenant, malformed case, unresolvable
 *                                   profile, foreign input. Thrown.
 *
 * ProtocolizationReadinessReason  the evaluation *was* performed and this is
 *                                 part of its answer — a required check failed,
 *                                 a professional asked for more material,
 *                                 an attestation is missing. Returned.
 * ```
 *
 * A required verification `Fail` is a perfectly successful evaluation carrying a
 * blocker. Throwing there would tell a caller "I could not tell you" when the
 * truthful answer is "I can tell you exactly, and here it is".
 *
 * ### Blockers and warnings are separated by structure, not by text
 *
 * An evaluation and each of its assessments carry two arrays. A consumer never
 * parses a code, matches a prefix or reads a sentence to learn whether something
 * prevents readiness: the array it arrived in already said so. That is why there
 * is deliberately no severity field duplicating the distinction, and no
 * human-readable `message`, `detail` or `summary` anywhere on this type —
 * machine behaviour that depends on a sentence is machine behaviour that can be
 * changed by rephrasing one.
 *
 * ### It carries references, never payloads
 *
 * A reason names the requirement, the check, the executions, the decisions, the
 * materials and the attestation references it is about. It carries no
 * declaration statement, no reviewer note, no evidence document and no personal
 * data — a readiness result travels further than the material it describes, the
 * same exclusion APV-02 §2.3 froze for the result envelope.
 */
/**
 * The reasons a requirement, or the case, cannot presently be considered
 * satisfied. Every one of these prevents `Ready`.
 *
 * Closed and stable. A downstream consumer switches on these tokens; it never
 * matches on a prefix, and it never has to understand a new one silently — an
 * unknown requirement kind fails loudly (`READINESS_REQUIREMENT_KIND_UNSUPPORTED`)
 * rather than producing an unrecognized code.
 */
export declare const PROTOCOLIZATION_READINESS_BLOCKER_CODES: Readonly<{
    /** The case's lifecycle does not permit protocolization work at all. */
    readonly lifecycleCancelled: "lifecycle.cancelled";
    /**
     * An applicable-or-possibly-applicable requirement's condition has not been
     * resolved, so nobody can say whether it applies. Never silently dropped.
     */
    readonly conditionUnresolved: "requirement.condition.unresolved";
    /** No material of the kind that mechanically answers this requirement. */
    readonly materialMissing: "requirement.material.missing";
    /** Material is present but fewer than the profile's declared minimum. */
    readonly materialInsufficient: "requirement.material.insufficient";
    /** Material is present but mechanically incompatible with what the requirement declares. */
    readonly materialIncompatible: "requirement.material.incompatible";
    /** A check the pinned profile declares has never been executed for this requirement. */
    readonly verificationMissing: "verification.missing";
    /** The current result for a declared check is `Fail`. */
    readonly verificationFail: "verification.fail";
    /** Results exist, but none evaluated the revision being assessed. */
    readonly verificationStale: "verification.stale";
    /** The current result for a declared check is `Unavailable`. Never a `Fail`. */
    readonly verificationUnavailable: "verification.unavailable";
    /** The current result for a declared check is `ManualReview`: automation deferred. */
    readonly verificationManualReview: "verification.manual-review";
    /** No attestation material is associated with this attestation requirement. */
    readonly attestationMissing: "attestation.missing";
    /**
     * Attestation material is associated, but no legitimate APV-08 `Attest`
     * decision produced it. Material presence is never an attestation.
     */
    readonly attestationDecisionMissing: "attestation.decision.missing";
    /**
     * The referenced `CanonicalAttestation` could not be shown to carry the proof
     * reference APV-08 requires of a professional attestation.
     */
    readonly attestationUnprovenArtifact: "attestation.unproven-artifact";
    /** The attested type is not one this requirement's pinned version accepts. */
    readonly attestationTypeIncompatible: "attestation.type-incompatible";
    /**
     * A qualifying attestation exists, but the case has moved past what it
     * demonstrably covers, and nothing available establishes that the later
     * changes fall outside its scope.
     *
     * A blocker on an applicable required requirement, deliberately. APV-08's own
     * contract is that a professional must never unknowingly attest a moving
     * target: an attestation bound to revision `N` is a statement about revision
     * `N`, and treating it as authority over `N+k` would be exactly the inference
     * that contract forbids. The resolution is a further review on the newer
     * basis, which is why this derives `ReviewPending`.
     *
     * It never deletes, invalidates or rewrites the attestation. The artifact
     * remains a perfectly valid historical statement about the basis it reviewed,
     * and nothing here infers that a signature is bad.
     */
    readonly attestationCurrencyUnresolved: "attestation.currency.unresolved";
    /**
     * The pinned profile declares a normative constraint on this requirement that
     * could not be established from the records supplied.
     *
     * A blocker on an applicable required requirement, deliberately. A `Required`
     * requirement is not semantically satisfied while an explicit machine-readable
     * demand of the profile is unestablished — treating "we could not check it" as
     * "it holds" would loosen the profile contract purely to make `Ready`
     * reachable, and would do so invisibly.
     *
     * `constraint` names the APV-03 field, so a caller can see exactly what is
     * outstanding and supply what would establish it. On an `Optional`
     * requirement this is reported as a warning like every other optional
     * finding, and blocks nothing.
     */
    readonly constraintUnevaluated: "requirement.constraint.unevaluated";
    /** Professional review is outstanding: requested and undecided, or abstained. */
    readonly reviewPending: "review.pending";
    /** The current professional position asks for further material. */
    readonly reviewMoreEvidenceRequired: "review.more-evidence-required";
    /** The current professional position declines to attest. */
    readonly reviewRejected: "review.rejected";
    /** Current professional positions disagree, and APV-09 adjudicates none of them. */
    readonly reviewConflicting: "review.conflicting";
}>;
/**
 * Findings that must stay visible but do not, on their own, prevent `Ready`.
 *
 * A warning that anything downstream is free to round away is a warning that was
 * never worth emitting, so none of these is ever folded into a blocker, dropped
 * from a `Ready` result, or collapsed into the absence of a finding.
 */
export declare const PROTOCOLIZATION_READINESS_WARNING_CODES: Readonly<{
    /**
     * A declared check's current result is `Warning`.
     *
     * Preserved verbatim on a satisfied requirement. It is emphatically never
     * rewritten as a `Pass`: the check said something non-fatal and worth saying,
     * and a reader of the readiness result still gets to see it.
     */
    readonly verificationWarning: "verification.warning";
    /** An `Optional` requirement is unsatisfied. Reported, never blocking. */
    readonly optionalUnsatisfied: "requirement.optional.unsatisfied";
    /**
     * A constraint whose evaluation belongs to another layer **was actually
     * discharged there**, and this names the execution that did it.
     *
     * Exactly one constraint reaches here: an evidence requirement's `freshness`,
     * discharged by a current result for the `check.evidence.freshness` the pinned
     * profile explicitly declared. APV-09 never recomputes the window — but it
     * does insist the delegation was honoured, and records which execution
     * honoured it rather than leaving the discharge silent.
     *
     * ```text
     * delegated AND discharged     this warning
     * delegated, never evaluated   requirement.constraint.unevaluated  (blocker)
     * delegated, evaluated badly   the APV-07 blocker the outcome earned
     * ```
     *
     * Delegation on its own is emphatically **not** satisfaction: a profile that
     * declares `freshness` and no verification requirement demanding the check has
     * delegated the evaluation to nobody, and that is a blocker rather than this.
     */
    readonly constraintDelegated: "requirement.constraint.delegated";
}>;
export type ProtocolizationReadinessBlockerCode = (typeof PROTOCOLIZATION_READINESS_BLOCKER_CODES)[keyof typeof PROTOCOLIZATION_READINESS_BLOCKER_CODES];
export type ProtocolizationReadinessWarningCode = (typeof PROTOCOLIZATION_READINESS_WARNING_CODES)[keyof typeof PROTOCOLIZATION_READINESS_WARNING_CODES];
export type ProtocolizationReadinessReasonCode = ProtocolizationReadinessBlockerCode | ProtocolizationReadinessWarningCode;
/** Every blocker code, in a stable order for deterministic reporting. */
export declare const PROTOCOLIZATION_READINESS_BLOCKER_CODE_LIST: readonly ProtocolizationReadinessBlockerCode[];
/** Every warning code, in a stable order for deterministic reporting. */
export declare const PROTOCOLIZATION_READINESS_WARNING_CODE_LIST: readonly ProtocolizationReadinessWarningCode[];
/**
 * One machine-readable finding.
 *
 * Every optional field is a *reference* the caller can go and look up — never a
 * copy of the record it names. Which fields are populated depends on the code;
 * none is ever populated with a placeholder to make the shape look uniform.
 */
export interface ProtocolizationReadinessReason {
    readonly reasonCode: ProtocolizationReadinessReasonCode;
    /** The requirement this is about. Absent only for case-level findings. */
    readonly requirementId?: AssetRequirementId;
    /** The profile-declared check this is about, where the code names one. */
    readonly checkId?: AssetVerificationCheckId;
    /** The APV-07 executions this finding rests on. */
    readonly executionIds?: readonly VerificationExecutionId[];
    /** The APV-08 decisions this finding rests on. */
    readonly decisionIds?: readonly ProfessionalReviewDecisionId[];
    /** The APV-04 material associations this finding rests on. */
    readonly materialIds?: readonly ProtocolizationMaterialId[];
    /** The Protocol evidence records this finding is about. */
    readonly evidenceRefs?: readonly CanonicalEvidenceId[];
    /** The Protocol attestations this finding rests on. */
    readonly attestationRefs?: readonly CanonicalAttestationId[];
    /**
     * The APV-03 requirement field this finding is about, e.g. `acceptedTypes`.
     * A field name, never a sentence.
     */
    readonly constraint?: string;
    /** What the pinned profile demanded, where a count is the point. */
    readonly required?: number;
    /** What was actually found, where a count is the point. */
    readonly observed?: number;
    /** The case revision a currency or staleness finding refers to. */
    readonly atCaseRevision?: number;
}
export declare function isProtocolizationReadinessBlockerCode(value: unknown): value is ProtocolizationReadinessBlockerCode;
export declare function isProtocolizationReadinessWarningCode(value: unknown): value is ProtocolizationReadinessWarningCode;
//# sourceMappingURL=readiness-reason.d.ts.map