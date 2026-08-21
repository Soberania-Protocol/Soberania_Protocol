import type {
  CanonicalAttestation,
  CanonicalAttestationId,
  CanonicalEvidence,
  CanonicalEvidenceId,
} from '@aoc/protocol/claims';

import type { AssetRequirement } from '../requirements';
import { AssetRequirementObligation } from '../requirements';
import { deepFreeze } from '../case/case-freeze';
import type { ProtocolizationCaseContext } from '../case/case-operations';
import { ProtocolizationCaseState, ProtocolizationRequirementMaterialStatus } from '../case/case-state';
import type { ProtocolizationRequirementMaterialStatus as MaterialStatus } from '../case/case-state';
import type { ProtocolizationCase } from '../case/protocolization-case';
import { evaluateRequirement } from './readiness-evaluators';
import type { RequirementEvaluationContext, RequirementFindings } from './readiness-evaluators';
import { PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION } from './readiness-evaluation';
import type {
  ProtocolizationReadinessEvaluation,
  ProtocolizationReadinessInputs,
} from './readiness-evaluation';
import {
  PROTOCOLIZATION_READINESS_BLOCKER_CODES,
  PROTOCOLIZATION_READINESS_WARNING_CODES,
} from './readiness-reason';
import type {
  ProtocolizationReadinessBlockerCode,
  ProtocolizationReadinessReason,
} from './readiness-reason';
import {
  ProtocolizationReadinessState,
  ProtocolizationRequirementApplicability,
  ProtocolizationRequirementStatus,
  deriveProtocolizationReadinessState,
} from './readiness-state';
import type { ProtocolizationRequirementAssessment } from './requirement-assessment';
import {
  assertActingTenantOwnsCase,
  assertCaseIsValid,
  assertInputsBelongToCase,
  readEvaluationInstant,
  resolvePinnedProfile,
  withinEvaluatedRevision,
} from './readiness-validation';

/**
 * The APV-09 operation: **one** function, and it answers a question.
 *
 * ### What success means
 *
 * ```text
 * evaluateProtocolizationReadiness
 *   APV determined, deterministically, how this case stands against its exact
 *   pinned AssetProfile version at its exact current revision — and said why,
 *   requirement by requirement.
 * ```
 *
 * Success is *the question was answered*. A `VerificationPending` answer is as
 * successful as a `Ready` one; the difference between them is content, not
 * failure.
 *
 * ### What this operation never does
 *
 * ```text
 * mutate a case                    transition a lifecycle state
 * rewrite an evidence receipt      rewrite a declaration record
 * rewrite a verification result    rewrite a review decision
 * flag a record satisfied          flag a record accepted or approved
 * re-run a check                   recompute a digest or a freshness window
 * resolve an identity              contact a registry or any external system
 * validate a signature             resolve a proof or a credential
 * invoke a professional            ask Enterprise anything
 * persist anything                 emit a domain event
 * mint an identifier               protocolize, anchor, tokenize or sign
 * ```
 *
 * Every input it reads it leaves byte-for-byte as it found it. This is also the
 * complete list of operations the slice exposes: there is no second entry point
 * that promotes a case by hand, no administrative override, and no way to waive,
 * skip or discount a requirement, a failing check or an unavailable one. `Ready`
 * arises from deterministic evaluation or it does not arise. Waivers and
 * governance may be a legitimate future capability; they are emphatically not
 * this slice's, and a mechanism for them would have to be an explicit,
 * authorized, audited addition rather than a convenience parameter.
 *
 * ### Why there is no event and no repository
 *
 * A projection recomputed from immutable, already-audited inputs produces no new
 * fact. Emitting a `ReadinessEvaluated` event on every call would fill an audit
 * log with restatements of records the log already holds, and a projection
 * moving from `VerificationPending` to `Ready` is *already* fully explained by
 * the APV-07 result that caused it plus this deterministic rule — a second
 * "transition" fact would be a duplicate under a different name. Nothing here
 * manufactures a transition it did not perform.
 *
 * ### Pure and synchronous
 *
 * No injected port may go anywhere: the only dependency that does anything is
 * the clock, and the catalogue is an in-memory lookup of the exact pinned
 * version. Determinism is total — the same case, profile, records and revision
 * always produce the same evaluation, and the only non-constant is
 * `evaluatedAt`, which comes from the injected clock rather than from
 * `Date.now()`.
 */

/**
 * Blockers whose route out is a decision by a person, not more work by the
 * pipeline. They are what separates a requirement's `Blocked` status from its
 * `Pending` one.
 */
const AFFIRMATIVELY_BLOCKING: readonly ProtocolizationReadinessBlockerCode[] = Object.freeze([
  PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationFail,
  PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewRejected,
  PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewConflicting,
]);

/**
 * Warnings that qualify a satisfied requirement rather than merely describing
 * where a check lives.
 *
 * A `Warning` outcome is a finding *about the case*, so it downgrades
 * `Satisfied` to `SatisfiedWithWarning` and the qualification is visible on the
 * status itself. A delegated constraint is not: it says APV-07 owns that
 * evaluation, which is a property of the architecture and would be identical on
 * every case using that profile. Letting it change a status would make the
 * status a statement about this package instead of about the dossier.
 */
const QUALIFIES_SATISFACTION: readonly string[] = Object.freeze([
  PROTOCOLIZATION_READINESS_WARNING_CODES.verificationWarning,
]);

/**
 * Applicability from the profile's own obligation, and from nothing else.
 *
 * ```text
 * Required     Applicable      must be satisfied before Ready
 * Optional     Applicable      assessed and reported; never blocks
 * NotRequired  NotApplicable   the profile states on the record that this is
 *                              not demanded — the one applicability APV-09 can
 *                              mechanically resolve to "no"
 * Conditional  Unresolved      APV-03 defines a condition as an opaque token
 *                              and no slice defines an evaluator for one, so
 *                              nothing here can say whether it applies
 * ```
 *
 * The last line is deliberate and load-bearing. Reading a condition's
 * `conditionId` spelling, its `metadata.reason` prose, or the presence of
 * material against it to decide applicability would each be inventing a
 * profile's semantics — and would silently drop a requirement that genuinely
 * applied, or invent one that never did.
 */
function applicabilityOf(
  obligation: AssetRequirementObligation,
): ProtocolizationRequirementApplicability {
  switch (obligation) {
    case AssetRequirementObligation.NotRequired:
      return ProtocolizationRequirementApplicability.NotApplicable;
    case AssetRequirementObligation.Conditional:
      return ProtocolizationRequirementApplicability.Unresolved;
    default:
      return ProtocolizationRequirementApplicability.Applicable;
  }
}

function materialStatusOf(
  protocolizationCase: ProtocolizationCase,
  requirement: AssetRequirement,
): MaterialStatus {
  const state = protocolizationCase.requirementStates.find(
    (candidate) => candidate.requirementId === requirement.id,
  );
  return state?.materialStatus ?? ProtocolizationRequirementMaterialStatus.Pending;
}

function statusFor(
  blockers: readonly ProtocolizationReadinessReason[],
  warnings: readonly ProtocolizationReadinessReason[],
): ProtocolizationRequirementStatus {
  if (blockers.length > 0) {
    return blockers.some((blocker) =>
      (AFFIRMATIVELY_BLOCKING as readonly string[]).includes(blocker.reasonCode),
    )
      ? ProtocolizationRequirementStatus.Blocked
      : ProtocolizationRequirementStatus.Pending;
  }
  return warnings.some((warning) => QUALIFIES_SATISFACTION.includes(warning.reasonCode))
    ? ProtocolizationRequirementStatus.SatisfiedWithWarning
    : ProtocolizationRequirementStatus.Satisfied;
}

/**
 * Turns one requirement's findings into its assessment, applying the obligation
 * rules.
 *
 * ### `NotRequired` is assessed and dismissed
 *
 * It gets an assessment — dropping it would flatten the profile's four-member
 * obligation vocabulary into required/not-required in the very artifact that
 * exists to keep it legible — and it gets no findings, because nothing is
 * demanded.
 *
 * ### `Optional` can never produce a blocker
 *
 * Its findings are real and are reported, but they travel in `warnings`,
 * carrying their original blocker codes so a reader still learns exactly what is
 * unmet. Structurally, therefore, an optional gap cannot reach the evaluation's
 * blocker set and cannot prevent `Ready`. This is enforced by construction, not
 * by remembering to filter later.
 *
 * ### `Conditional` blocks on the condition, and reports the rest
 *
 * The single blocker is `requirement.condition.unresolved`, because that is the
 * honest finding: nobody knows whether this requirement applies. Its substantive
 * findings are still reported as warnings — a reader gets to see what the case
 * holds against it — but they are not raised as blockers, since blocking on the
 * substance of a requirement that may not apply at all would be asserting that
 * it does.
 */
function assess(
  protocolizationCase: ProtocolizationCase,
  requirement: AssetRequirement,
  findings: RequirementFindings,
): ProtocolizationRequirementAssessment {
  const applicability = applicabilityOf(requirement.obligation);
  const materialStatus = materialStatusOf(protocolizationCase, requirement);

  const base = {
    requirementId: requirement.id,
    kind: requirement.kind,
    obligation: requirement.obligation,
    applicability,
    materialStatus,
    ...(findings.verificationExecutionIds === undefined ||
    findings.verificationExecutionIds.length === 0
      ? {}
      : { verificationExecutionIds: findings.verificationExecutionIds }),
    ...(findings.reviewDecisionIds === undefined
      ? {}
      : { reviewDecisionIds: findings.reviewDecisionIds }),
    ...(findings.attestationRefs === undefined ? {} : { attestationRefs: findings.attestationRefs }),
  };

  if (applicability === ProtocolizationRequirementApplicability.NotApplicable) {
    return {
      ...base,
      status: ProtocolizationRequirementStatus.NotApplicable,
      materialIds: findings.materialIds,
      blockers: [],
      warnings: [],
    };
  }

  if (requirement.obligation === AssetRequirementObligation.Conditional) {
    return {
      ...base,
      status: ProtocolizationRequirementStatus.Pending,
      materialIds: findings.materialIds,
      blockers: [
        {
          reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.conditionUnresolved,
          requirementId: requirement.id,
        },
      ],
      warnings: [...findings.warnings, ...findings.blockers],
    };
  }

  if (requirement.obligation === AssetRequirementObligation.Optional) {
    const unmet = findings.blockers.length > 0;
    const warnings: readonly ProtocolizationReadinessReason[] = unmet
      ? [
          {
            reasonCode: PROTOCOLIZATION_READINESS_WARNING_CODES.optionalUnsatisfied,
            requirementId: requirement.id,
          },
          ...findings.warnings,
          ...findings.blockers,
        ]
      : findings.warnings;
    return {
      ...base,
      status: unmet ? ProtocolizationRequirementStatus.Pending : statusFor([], warnings),
      materialIds: findings.materialIds,
      blockers: [],
      warnings,
    };
  }

  return {
    ...base,
    status: statusFor(findings.blockers, findings.warnings),
    materialIds: findings.materialIds,
    blockers: findings.blockers,
    warnings: findings.warnings,
  };
}

/**
 * Indexes the supplied attestations by their Protocol identifier.
 *
 * A duplicate id keeps the first entry rather than the last, so the map is a
 * function of the supplied set and not of its ordering — reordering the input
 * array must never change a readiness answer.
 */
function indexAttestations(
  attestations: readonly CanonicalAttestation[],
): ReadonlyMap<CanonicalAttestationId, CanonicalAttestation> {
  const index = new Map<CanonicalAttestationId, CanonicalAttestation>();
  for (const attestation of attestations) {
    if (!index.has(attestation.id)) index.set(attestation.id, attestation);
  }
  return index;
}

/**
 * Indexes the supplied evidence records by their Protocol identifier, on the
 * same first-wins rule and for the same reason.
 */
function indexEvidence(
  evidence: readonly CanonicalEvidence[],
): ReadonlyMap<CanonicalEvidenceId, CanonicalEvidence> {
  const index = new Map<CanonicalEvidenceId, CanonicalEvidence>();
  for (const record of evidence) {
    if (!index.has(record.id)) index.set(record.id, record);
  }
  return index;
}

/**
 * Evaluates one `ProtocolizationCase` against its exact pinned `AssetProfile`
 * version at its exact current revision.
 *
 * Throws `ProtocolizationReadinessError` when the question cannot honestly be
 * answered — wrong tenant, malformed case, unresolvable pin, foreign input,
 * unknown requirement kind. Returns a complete, explainable evaluation
 * otherwise, including when the answer is a long list of blockers.
 *
 * The returned value is deeply frozen, so a caller cannot mutate an assessment,
 * a blocker list or a warning list on a result they happen to hold. Nothing they
 * could do to it would reach a source record in any case: every reference in it
 * is an identifier, and no source record is captured by reference.
 */
export function evaluateProtocolizationReadiness(
  context: ProtocolizationCaseContext,
  protocolizationCase: ProtocolizationCase,
  inputs: ProtocolizationReadinessInputs = {},
): ProtocolizationReadinessEvaluation {
  assertActingTenantOwnsCase(context, protocolizationCase);
  const profile = resolvePinnedProfile(context, protocolizationCase);
  assertCaseIsValid(protocolizationCase, profile);
  assertInputsBelongToCase(context, protocolizationCase, inputs);

  const evaluatedAt = readEvaluationInstant(context, protocolizationCase);
  const evaluatedCaseRevision = protocolizationCase.revision;

  const evaluationContext: RequirementEvaluationContext = {
    protocolizationCase,
    profile,
    evaluatedCaseRevision,
    declarations: (inputs.declarations ?? []).filter((record) =>
      withinEvaluatedRevision(record.caseRevision, evaluatedCaseRevision),
    ),
    verificationResults: (inputs.verificationResults ?? []).filter((result) =>
      withinEvaluatedRevision(result.evaluatedCaseRevision, evaluatedCaseRevision),
    ),
    reviewRequests: (inputs.reviewRequests ?? []).filter((request) =>
      withinEvaluatedRevision(request.reviewBasisRevision, evaluatedCaseRevision),
    ),
    reviewDecisions: (inputs.reviewDecisions ?? []).filter((decision) =>
      withinEvaluatedRevision(decision.reviewBasisRevision, evaluatedCaseRevision),
    ),
    attestationsById: indexAttestations(inputs.attestations ?? []),
    evidenceById: indexEvidence(inputs.evidence ?? []),
  };

  const requirementAssessments = profile.requirements.map((requirement) =>
    assess(protocolizationCase, requirement, evaluateRequirement(evaluationContext, requirement)),
  );

  // The lifecycle question is answered on the case, not on any requirement, and
  // it is answered first: a cancelled case cannot be Ready however complete its
  // dossier is. Every requirement is still assessed and still reported — the
  // dossier's standing remains a fact worth reading — but no ordinary readiness
  // derivation overrides the cancellation.
  const lifecycleBlockers: readonly ProtocolizationReadinessReason[] =
    protocolizationCase.state === ProtocolizationCaseState.Cancelled
      ? [{ reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.lifecycleCancelled }]
      : [];

  const blockers = [
    ...lifecycleBlockers,
    ...requirementAssessments.flatMap((assessment) => assessment.blockers),
  ];
  const warnings = requirementAssessments.flatMap((assessment) => assessment.warnings);

  const state = deriveProtocolizationReadinessState(blockers);

  const evaluation: ProtocolizationReadinessEvaluation = {
    schemaVersion: PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION,
    tenantId: protocolizationCase.tenantId,
    caseId: protocolizationCase.caseId,
    profile: protocolizationCase.profile,
    caseState: protocolizationCase.state,
    evaluatedCaseRevision,
    state,
    ready: state === ProtocolizationReadinessState.Ready,
    requirementAssessments,
    blockers,
    warnings,
    evaluatedAt,
  };

  return deepFreeze(evaluation);
}
