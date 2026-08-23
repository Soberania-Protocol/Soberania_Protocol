import type { CanonicalAttestationId } from '@aoc/protocol/claims';

import type { AssetRequirementId } from '../identifiers';
import type { AssetRequirementKind, AssetRequirementObligation } from '../requirements';
import type { ProtocolizationMaterialId } from '../case/case-identifiers';
import type { ProtocolizationRequirementMaterialStatus } from '../case/case-state';
import type { ProfessionalReviewDecisionId } from '../attestation/review-identifiers';
import type { VerificationExecutionId } from '../verification/verification-identifiers';
import type { ProtocolizationReadinessReason } from './readiness-reason';
import type {
  ProtocolizationRequirementApplicability,
  ProtocolizationRequirementStatus,
} from './readiness-state';

/**
 * What APV-09 concluded about **one** requirement of the exact pinned profile
 * version, and why.
 *
 * ### This is where "satisfied" first exists
 *
 * APV-03 stated requirements. APV-04 recorded whether material was associated.
 * APV-05, APV-06 and APV-07 recorded what was received, declared and checked.
 * APV-08 recorded what a professional decided. None of them was permitted to say
 * *this requirement is satisfied* — the semantic did not exist anywhere, on
 * purpose, because saying it needs all of the above at once plus the profile
 * that demanded it.
 *
 * This type is that semantic, and it belongs to Asset Protocolization. Nothing
 * comparable is added to Protocol: Protocol describes evidence, claims,
 * attestations and verifications in general and has no opinion about whether an
 * asset profile's demands were met.
 *
 * ### It is derived, never commanded
 *
 * There is no `markRequirementSatisfied`, no `waive`, no `override` and no
 * setter anywhere in this slice. A status is a deterministic function of the
 * requirement definition, its applicability, the case's material at the
 * evaluated revision, the records supplied, and nothing else. Two evaluations
 * over the same inputs produce byte-identical assessments.
 *
 * ### `materialStatus` is quoted, not reinterpreted
 *
 * APV-04's structural answer travels here verbatim so a reader can see both
 * facts side by side and the gap between them:
 *
 * ```text
 * materialStatus MaterialPresent + status Pending    material arrived; a declared
 *                                                    check has not run yet
 * materialStatus MaterialPresent + status Blocked    material arrived; the check
 *                                                    that read it failed
 * materialStatus Pending         + status Satisfied  not representable for a
 *                                                    material-answered requirement
 * ```
 *
 * ### It names records; it never copies them
 *
 * The reference lists below let a caller go and read exactly what the conclusion
 * rests on. No declaration statement, evidence document, reviewer note or
 * credential payload is duplicated into an assessment — a readiness result
 * travels further than the material it describes.
 */
export interface ProtocolizationRequirementAssessment {
  readonly requirementId: AssetRequirementId;

  /** The profile's own requirement family, read from the profile. Never restated. */
  readonly kind: AssetRequirementKind;

  /** The profile's own obligation, unflattened. */
  readonly obligation: AssetRequirementObligation;

  /** Whether this requirement applies, or whether nobody can say. */
  readonly applicability: ProtocolizationRequirementApplicability;

  /** APV-04's structural answer, quoted unchanged. `MaterialPresent` is not `Satisfied`. */
  readonly materialStatus: ProtocolizationRequirementMaterialStatus;

  /** APV-09's own conclusion. */
  readonly status: ProtocolizationRequirementStatus;

  /** The APV-04 material associations this assessment read, in association order. */
  readonly materialIds: readonly ProtocolizationMaterialId[];

  /** The APV-07 executions this assessment read. Present on verification requirements. */
  readonly verificationExecutionIds?: readonly VerificationExecutionId[];

  /** The APV-08 decisions this assessment read. Present on attestation requirements. */
  readonly reviewDecisionIds?: readonly ProfessionalReviewDecisionId[];

  /** The Protocol attestations this assessment accepted as qualifying. */
  readonly attestationRefs?: readonly CanonicalAttestationId[];

  /**
   * Why this requirement is not satisfied. Empty if and only if `status` is
   * `NotApplicable`, `Satisfied` or `SatisfiedWithWarning`.
   *
   * A blocker on an `Optional` requirement is not representable: an optional
   * requirement that is unmet reports it as a warning, so an optional gap can
   * never reach the evaluation's blocker set and can never prevent `Ready`.
   */
  readonly blockers: readonly ProtocolizationReadinessReason[];

  /** Non-fatal findings that must stay visible. May be non-empty on a satisfied requirement. */
  readonly warnings: readonly ProtocolizationReadinessReason[];
}
