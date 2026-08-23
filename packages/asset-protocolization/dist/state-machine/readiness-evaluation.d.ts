import type { CanonicalAttestation, CanonicalEvidence } from '@aoc/protocol/claims';
import type { UtcDateTime } from '@aoc/protocol/contracts';
import type { ProtocolizationCaseId, ProtocolizationProfileRef, ProtocolizationTenantId } from '../case/case-identifiers';
import type { ProtocolizationCaseState } from '../case/case-state';
import type { EvidenceIntakeReceipt } from '../evidence/evidence-intake-receipt';
import type { ProtocolizationDeclarationRecord } from '../declarations/declaration-record';
import type { ProtocolizationVerificationResult } from '../verification/verification-result';
import type { ProfessionalReviewRequest } from '../attestation/review-request';
import type { ProfessionalReviewDecision } from '../attestation/review-decision';
import type { ProtocolizationReadinessReason } from './readiness-reason';
import type { ProtocolizationReadinessState } from './readiness-state';
import type { ProtocolizationRequirementAssessment } from './requirement-assessment';
/**
 * `ProtocolizationReadinessEvaluation` — the complete, explainable answer to
 * *may protocolization be attempted for this case, right now?*
 *
 * ### What an evaluation means
 *
 * Exactly this, and reading more into it is the central risk of this slice:
 *
 * ```text
 * this case, belonging to this tenant,
 * as it stood at this exact revision,
 * assessed against this exact pinned AssetProfile version,
 * over the evidence receipts, declarations, verification results, review
 *   requests, review decisions and attestations supplied,
 * at this instant,
 * stands in this readiness state, for these reasons.
 * ```
 *
 * ### What it does not mean
 *
 * ```text
 * Ready != protocolized            Ready != tokenizable
 * Ready != legal title             Ready != legally transferable
 * Ready != statutory compliance    Ready != Enterprise authorization
 * Ready != investment suitability  Ready != government recognition
 * ```
 *
 * `READY` means the current revision of this `ProtocolizationCase` satisfies the
 * machine-readable protocolization prerequisites of its exact pinned
 * `AssetProfile`, under the evidence, verification and professional-attestation
 * semantics Asset Protocolization represents. It is a technical protocolization
 * state. It is not an approved asset, a legally valid asset, or certified
 * ownership, and it is never a synonym for any of those.
 *
 * ### Returning it executes nothing
 *
 * An evaluation is a value. Producing one writes nothing, anchors nothing,
 * mints nothing, signs nothing, notifies nobody, contacts no registry and
 * transitions no case. A `Ready` evaluation is exactly as inert as a
 * `VerificationPending` one.
 *
 * ### `ready` is derived, never authoritative
 *
 * The boolean is `state === Ready` and nothing else. It exists because callers
 * ask that question constantly, and it is deliberately not something anyone can
 * set: this slice exposes exactly one operation, that operation only derives,
 * and there is no persisted `ready` flag anywhere that could disagree with the
 * assessments justifying it.
 *
 * ### It is bound to one revision, and that is what protects APV-10
 *
 * `evaluatedCaseRevision` is the whole TOCTOU story. A result computed at
 * revision `20` is a statement about revision `20` forever; a declaration
 * recorded afterwards moves the case to `21` and the old result does not follow
 * it. APV-10 compares the two before acting — see
 * `isProtocolizationReadinessCurrentForCase` — and refuses on a mismatch rather
 * than executing on a readiness nobody re-established.
 *
 * ### It is not persisted
 *
 * There is no readiness repository, no stored state field, no evaluation id and
 * no readiness event in this slice. An evaluation is a pure deterministic
 * projection of records that are already immutable and already audited: storing
 * a second, mutable copy of a conclusion that can be recomputed exactly would
 * create a value free to drift from the facts it summarizes, with no mechanism
 * anywhere to explain the divergence. Where an audit obligation for readiness
 * history is later established, append-only, tenant-scoped, revision-bound
 * records are an additive amendment — not a silent reinterpretation of this one.
 */
export declare const PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION = "aoc-protocolization-readiness/1";
export interface ProtocolizationReadinessEvaluation {
    readonly schemaVersion: typeof PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION;
    readonly tenantId: ProtocolizationTenantId;
    readonly caseId: ProtocolizationCaseId;
    /**
     * The exact profile version the case pinned.
     *
     * Never re-resolved. There is no latest, current, newest, default or nearest
     * lookup anywhere in this slice: a case pinned to `1.0.0` is assessed under
     * `1.0.0`'s requirements after `2.0.0` is catalogued, even when `2.0.0`
     * redefines the same requirement ids.
     */
    readonly profile: ProtocolizationProfileRef;
    /**
     * The case's APV-04 lifecycle state at evaluation time, quoted.
     *
     * Carried beside `state` so the two dimensions stay legible side by side, and
     * so a reader never has to infer one from the other.
     */
    readonly caseState: ProtocolizationCaseState;
    /** The case revision this evaluation describes. Always the case's own `revision`. */
    readonly evaluatedCaseRevision: number;
    readonly state: ProtocolizationReadinessState;
    /** `state === Ready`. A convenience over the state, never a fact of its own. */
    readonly ready: boolean;
    /**
     * One assessment per requirement of the pinned profile, in the profile's
     * declaration order.
     *
     * Every requirement is assessed — `Optional`, `Conditional` and `NotRequired`
     * included — because dropping the ones that look irrelevant would flatten the
     * profile's vocabulary into required/not-required and hide exactly the
     * requirements a reader most needs to see reasoning about.
     */
    readonly requirementAssessments: readonly ProtocolizationRequirementAssessment[];
    /**
     * Every blocker from every assessment, plus case-level blockers, in assessment
     * order.
     *
     * Empty if and only if `state` is `Ready`. The top-level state is a summary of
     * this list and never a replacement for it: a `MoreEvidenceRequired`
     * evaluation still carries its unavailable check and its unresolved condition
     * here, exactly as they were found.
     */
    readonly blockers: readonly ProtocolizationReadinessReason[];
    /**
     * Every warning from every assessment. May be non-empty alongside `Ready`.
     *
     * `Ready` with warnings is expressed as `state: Ready` plus this list — never
     * as a separate ambiguous state, which would have made every consumer handle
     * two spellings of the same conclusion.
     */
    readonly warnings: readonly ProtocolizationReadinessReason[];
    /** When the evaluation ran, from the injected clock. Never `Date.now()`. */
    readonly evaluatedAt: UtcDateTime;
}
/**
 * The case-scoped records a caller supplies for one evaluation.
 *
 * ### Supplied, never fetched
 *
 * APV-09 holds no repository, opens no connection and reads no catalogue beyond
 * the pinned profile — the same input minimization APV-07 and APV-08 apply. It
 * does not re-run a check, resolve an external reference, dereference a claim,
 * contact a registry, validate a signature, invoke a professional or ask
 * Enterprise anything. It consumes results the earlier slices already produced.
 *
 * Everything supplied is checked to belong to the acting tenant, this case and
 * this pinned profile version before any of it can influence a conclusion.
 * Records evaluated against a revision later than the case's own are ignored,
 * because a case cannot be assessed against material it does not yet hold.
 *
 * ### Absence is never satisfaction
 *
 * Omitting an input never makes a requirement pass. A verification requirement
 * with no results supplied is `verification.missing`; an attestation requirement
 * whose `CanonicalAttestation` is not supplied cannot be shown to be
 * proof-backed and is `attestation.unproven-artifact`. The failure direction is
 * always toward *not ready*.
 */
export interface ProtocolizationReadinessInputs {
    /** APV-05 receipts for this case. */
    readonly evidenceReceipts?: readonly EvidenceIntakeReceipt[];
    /**
     * The Protocol evidence records the case's evidence material refers to.
     *
     * Supplied so an evidence requirement's explicit constraints —
     * `acceptedTypes`, `registry`, `credential` — can be established from
     * Protocol's own record rather than assumed. Without the record for a
     * reference, none of those constraints is established and the reference does
     * not qualify: absence is never satisfaction.
     *
     * References, never a copy: this package defines no parallel evidence type and
     * reads nothing from a record beyond the fields the profile's own constraints
     * name.
     */
    readonly evidence?: readonly CanonicalEvidence[];
    /** APV-06 declaration records for this case. */
    readonly declarations?: readonly ProtocolizationDeclarationRecord[];
    /** APV-07 results for this case. Consumed as found; never recomputed. */
    readonly verificationResults?: readonly ProtocolizationVerificationResult[];
    /** APV-08 review requests for this case. */
    readonly reviewRequests?: readonly ProfessionalReviewRequest[];
    /** APV-08 review decisions for this case. */
    readonly reviewDecisions?: readonly ProfessionalReviewDecision[];
    /**
     * The Protocol attestations the case's attestation material refers to.
     *
     * Supplied so APV-09 can establish the APV-08 invariant — a professional
     * attestation carries at least one `CanonicalProofRef` — on the artifact
     * itself rather than on trust. Presence of a proof reference is emphatically
     * not verification of it: nothing here resolves a proof, checks a signature or
     * contacts an issuer.
     */
    readonly attestations?: readonly CanonicalAttestation[];
}
//# sourceMappingURL=readiness-evaluation.d.ts.map