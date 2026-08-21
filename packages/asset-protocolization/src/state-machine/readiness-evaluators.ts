import type {
  CanonicalAttestation,
  CanonicalAttestationId,
  CanonicalEvidence,
  CanonicalEvidenceId,
} from '@aoc/protocol/claims';

import type { AssetCredentialConstraint, AssetRegistryConstraint } from '../constraints';
import type { AssetRequirementId, AssetVerificationCheckId } from '../identifiers';
import type { AssetProfile } from '../profile';
import {
  AssetIdentityStrategy,
  AssetRequirementKind,
  AssetRequirementObligation,
  AssetRequirementSatisfaction,
} from '../requirements';
import type {
  AssetAttestationRequirement,
  AssetDeclarationRequirement,
  AssetEvidenceRequirement,
  AssetIdentityRequirement,
  AssetRequirement,
  AssetVerificationRequirement,
} from '../requirements';
import type { ProtocolizationMaterialId } from '../case/case-identifiers';
import { ProtocolizationMaterialKind } from '../case/case-material';
import type { ProtocolizationCaseMaterial } from '../case/case-material';
import type { ProtocolizationCase } from '../case/protocolization-case';
import type { ProtocolizationDeclarationRecord } from '../declarations/declaration-record';
import { isUsableProofRef } from '../attestation/attestation-preparation';
import { ProfessionalReviewAction } from '../attestation/review-actions';
import type { ProfessionalReviewDecision } from '../attestation/review-decision';
import type { ProfessionalReviewDecisionId } from '../attestation/review-identifiers';
import type { ProfessionalReviewRequest } from '../attestation/review-request';
import type { VerificationExecutionId } from '../verification/verification-identifiers';
import {
  evidenceFreshnessCheck,
  registryEntryConforms,
} from '../verification/verification-builtin-checks';
import { VerificationCheckOutcome } from '../verification/verification-outcome';
import {
  isVerificationResultCurrentForRevision,
  listLatestVerificationResults,
} from '../verification/verification-projections';
import type { ProtocolizationVerificationResult } from '../verification/verification-result';
import {
  PROTOCOLIZATION_READINESS_BLOCKER_CODES,
  PROTOCOLIZATION_READINESS_WARNING_CODES,
} from './readiness-reason';
import type { ProtocolizationReadinessReason } from './readiness-reason';
import {
  PROTOCOLIZATION_READINESS_ERROR_CODES,
  ProtocolizationReadinessError,
} from './readiness-errors';

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

function reason(
  reasonCode: ProtocolizationReadinessReason['reasonCode'],
  requirementId: AssetRequirementId,
  extra: Omit<ProtocolizationReadinessReason, 'reasonCode' | 'requirementId'> = {},
): ProtocolizationReadinessReason {
  return { reasonCode, requirementId, ...extra };
}

/**
 * Every material of one kind correlated to one requirement, in association
 * order.
 *
 * The kind filter is the whole point — see the module note on kind
 * compatibility.
 */
function materialsFor(
  protocolizationCase: ProtocolizationCase,
  requirementId: AssetRequirementId,
  kind: ProtocolizationMaterialKind,
): readonly ProtocolizationCaseMaterial[] {
  return protocolizationCase.materials.filter(
    (material) => material.kind === kind && material.requirementIds.includes(requirementId),
  );
}

const materialIdsOf = (
  materials: readonly ProtocolizationCaseMaterial[],
): readonly ProtocolizationMaterialId[] => materials.map((material) => material.materialId);

/** The profile's declared minimum, or the structural minimum of one. */
const minimumOf = (declared: number | undefined): number =>
  typeof declared === 'number' && Number.isInteger(declared) && declared > 0 ? declared : 1;

/**
 * Records that a profile constraint could not be **established** from the
 * records supplied.
 *
 * A blocker, not a warning, wherever the requirement is applicable and required.
 * A `Required` requirement is not semantically satisfied while an explicit
 * machine-readable demand of the pinned profile is unestablished: treating "we
 * could not check it" as "it holds" would loosen the profile contract purely to
 * make `Ready` reachable. The `Optional` path downgrades it to a warning, so the
 * two obligations stay meaningfully different.
 */
function unevaluatedConstraint(
  requirementId: AssetRequirementId,
  constraint: string,
  extra: Omit<ProtocolizationReadinessReason, 'reasonCode' | 'requirementId' | 'constraint'> = {},
): ProtocolizationReadinessReason {
  return reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.constraintUnevaluated, requirementId, {
    constraint,
    ...extra,
  });
}

/**
 * Whether a `CanonicalEvidence` record satisfies a profile's credential
 * constraint.
 *
 * The same mechanical rule APV-08 applies to a reviewer's presented credentials,
 * asked here of the credential references the evidence record itself carries: at
 * least one reference of an accepted `CredentialType`, and — where the profile
 * names acceptable statuses — a matching reference that *declares* one of them.
 * A reference declaring no status never counts as having declared an acceptable
 * one.
 *
 * ```text
 * credential ref present   != the credential exists
 * type matches             != the credential is valid
 * declared status Active   != the credential is currently active
 * ```
 *
 * `acceptedIssuerNamespaces` and the constraint's own nested `freshness` are not
 * enforced here for the reasons APV-08 already recorded: a
 * `CanonicalCredentialIssuer` carries an id and a kind rather than a namespace,
 * and expiry lives on a `CanonicalCredential` this vertical never receives.
 */
function evidenceCredentialConforms(
  evidence: CanonicalEvidence,
  constraint: AssetCredentialConstraint,
): boolean {
  const refs = evidence.credentialRefs ?? [];
  const typeMatches = refs.filter((ref) => constraint.acceptedTypes.includes(ref.type));
  if (typeMatches.length === 0) return false;
  const acceptedStatuses = constraint.acceptedStatuses;
  if (acceptedStatuses === undefined) return true;
  return typeMatches.some(
    (ref) => ref.status !== undefined && acceptedStatuses.includes(ref.status.status),
  );
}

/** Whether any registry entry the evidence record names conforms to the constraint. */
function evidenceRegistryConforms(
  evidence: CanonicalEvidence,
  constraint: AssetRegistryConstraint,
): boolean {
  return (evidence.registryRefs ?? []).some((entryRef) =>
    registryEntryConforms(entryRef, constraint),
  );
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

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
export function evaluateIdentityRequirement(
  context: RequirementEvaluationContext,
  requirement: AssetIdentityRequirement,
): RequirementFindings {
  const subject = context.protocolizationCase.subject;
  const byStrategy: Readonly<Record<AssetIdentityStrategy, ProtocolizationMaterialKind>> = {
    [AssetIdentityStrategy.ContentIdentity]: ProtocolizationMaterialKind.ContentIdentity,
    [AssetIdentityStrategy.ExternalReference]: ProtocolizationMaterialKind.ExternalReference,
    [AssetIdentityStrategy.RegistryEntry]: ProtocolizationMaterialKind.RegistryEntry,
  };

  const materials: ProtocolizationCaseMaterial[] = [];
  const evidenced = new Set<AssetIdentityStrategy>();
  const blockers: ProtocolizationReadinessReason[] = [];
  const nonConforming: ProtocolizationMaterialId[] = [];

  for (const strategy of requirement.acceptedStrategies) {
    const found = materialsFor(context.protocolizationCase, requirement.id, byStrategy[strategy]);
    materials.push(...found);

    // A registry constraint is evaluated here, from the entry reference the
    // material already carries, using APV-07's own comparison. An entry that
    // does not conform does not evidence the strategy — a registry entry from
    // the wrong registry is not the registry entry the profile asked for.
    const conforming =
      strategy === AssetIdentityStrategy.RegistryEntry && requirement.registry !== undefined
        ? found.filter(
            (material) =>
              material.kind === ProtocolizationMaterialKind.RegistryEntry &&
              registryEntryConforms(material.registryEntryRef, requirement.registry!),
          )
        : found;
    if (conforming.length < found.length) {
      nonConforming.push(
        ...found
          .filter((material) => !conforming.includes(material))
          .map((material) => material.materialId),
      );
    }

    if (conforming.length > 0) {
      evidenced.add(strategy);
      continue;
    }
    if (strategy === AssetIdentityStrategy.ContentIdentity && subject.contentIdentity !== undefined) {
      evidenced.add(strategy);
    }
    if (
      strategy === AssetIdentityStrategy.ExternalReference &&
      subject.subjectRef.externalReference !== undefined
    ) {
      evidenced.add(strategy);
    }
  }

  const warnings: ProtocolizationReadinessReason[] = [];
  if (nonConforming.length > 0) {
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialIncompatible, requirement.id, {
        constraint: 'registry',
        materialIds: nonConforming,
      }),
    );
  }
  // No built-in evaluates identity freshness, and inventing a check id for it
  // would be asserting a contract this package does not have.
  if (requirement.freshness !== undefined) {
    blockers.push(unevaluatedConstraint(requirement.id, 'freshness'));
  }

  const required =
    requirement.satisfaction === AssetRequirementSatisfaction.All
      ? requirement.acceptedStrategies.length
      : 1;

  if (evidenced.size === 0) {
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialMissing, requirement.id, {
        required,
        observed: 0,
      }),
    );
  } else if (evidenced.size < required) {
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialInsufficient, requirement.id, {
        required,
        observed: evidenced.size,
      }),
    );
  }

  return { materialIds: materialIdsOf(materials), blockers, warnings };
}

// ---------------------------------------------------------------------------
// Declaration
// ---------------------------------------------------------------------------

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
export function evaluateDeclarationRequirement(
  context: RequirementEvaluationContext,
  requirement: AssetDeclarationRequirement,
): RequirementFindings {
  const materials = materialsFor(
    context.protocolizationCase,
    requirement.id,
    ProtocolizationMaterialKind.Declaration,
  );
  const minimum = minimumOf(requirement.minimumCount);

  const recordsByClaim = new Map<string, ProtocolizationDeclarationRecord>();
  for (const record of context.declarations) {
    if (record.requirementIds.includes(requirement.id)) recordsByClaim.set(record.claimRef, record);
  }

  const qualifying = new Set<string>();
  const incompatible = new Set<ProtocolizationMaterialId>();
  for (const material of materials) {
    if (material.kind !== ProtocolizationMaterialKind.Declaration) continue;
    const record = recordsByClaim.get(material.claimRef);
    if (record !== undefined) {
      const typeMatches = record.claimType === requirement.claimType;
      const subtypeMatches =
        requirement.claimSubtype === undefined || record.claimSubtype === requirement.claimSubtype;
      if (!typeMatches || !subtypeMatches) {
        incompatible.add(material.materialId);
        continue;
      }
    }
    qualifying.add(material.claimRef);
  }

  const blockers: ProtocolizationReadinessReason[] = [];
  if (incompatible.size > 0) {
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialIncompatible, requirement.id, {
        materialIds: [...incompatible],
      }),
    );
  }
  if (qualifying.size === 0) {
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialMissing, requirement.id, {
        required: minimum,
        observed: 0,
      }),
    );
  } else if (qualifying.size < minimum) {
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialInsufficient, requirement.id, {
        required: minimum,
        observed: qualifying.size,
      }),
    );
  }

  return { materialIds: materialIdsOf(materials), blockers, warnings: [] };
}

// ---------------------------------------------------------------------------
// Evidence
// ---------------------------------------------------------------------------

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
export function evaluateEvidenceRequirement(
  context: RequirementEvaluationContext,
  requirement: AssetEvidenceRequirement,
): RequirementFindings {
  const materials = materialsFor(
    context.protocolizationCase,
    requirement.id,
    ProtocolizationMaterialKind.Evidence,
  );
  const minimum = minimumOf(requirement.minimumCount);

  const present = new Set<CanonicalEvidenceId>();
  for (const material of materials) {
    if (material.kind === ProtocolizationMaterialKind.Evidence) present.add(material.evidenceRef);
  }

  const blockers: ProtocolizationReadinessReason[] = [];
  const warnings: ProtocolizationReadinessReason[] = [];
  if (requirement.freshness !== undefined) {
    const freshness = dischargeEvidenceFreshness(context, requirement);
    blockers.push(...freshness.blockers);
    warnings.push(...freshness.warnings);
  }

  // An opaque vertical token nothing supplied can carry. Reported once, at the
  // requirement, because it is a property of the constraint rather than of any
  // particular reference.
  if (requirement.acceptedSubtypes !== undefined) {
    blockers.push(unevaluatedConstraint(requirement.id, 'acceptedSubtypes'));
  }

  const qualifying = new Set<CanonicalEvidenceId>();
  const unestablished = new Map<string, CanonicalEvidenceId[]>();
  const incompatible = new Map<string, CanonicalEvidenceId[]>();
  const note = (held: Map<string, CanonicalEvidenceId[]>, constraint: string, ref: CanonicalEvidenceId): void => {
    held.set(constraint, [...(held.get(constraint) ?? []), ref]);
  };

  for (const evidenceRef of present) {
    const record = context.evidenceById.get(evidenceRef);
    if (record === undefined) {
      // Nothing establishes any of the constraints the profile declared, so the
      // reference cannot qualify. Absence is never satisfaction.
      note(unestablished, 'acceptedTypes', evidenceRef);
      if (requirement.registry !== undefined) note(unestablished, 'registry', evidenceRef);
      if (requirement.credential !== undefined) note(unestablished, 'credential', evidenceRef);
      continue;
    }

    let conforms = true;
    if (!requirement.acceptedTypes.includes(record.type)) {
      note(incompatible, 'acceptedTypes', evidenceRef);
      conforms = false;
    }
    if (requirement.registry !== undefined && !evidenceRegistryConforms(record, requirement.registry)) {
      note(incompatible, 'registry', evidenceRef);
      conforms = false;
    }
    if (
      requirement.credential !== undefined &&
      !evidenceCredentialConforms(record, requirement.credential)
    ) {
      note(incompatible, 'credential', evidenceRef);
      conforms = false;
    }
    if (conforms) qualifying.add(evidenceRef);
  }

  for (const [constraint, refs] of unestablished) {
    blockers.push(unevaluatedConstraint(requirement.id, constraint, { evidenceRefs: refs }));
  }
  for (const [constraint, refs] of incompatible) {
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialIncompatible, requirement.id, {
        constraint,
        evidenceRefs: refs,
      }),
    );
  }

  if (present.size === 0) {
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialMissing, requirement.id, {
        required: minimum,
        observed: 0,
      }),
    );
  } else if (qualifying.size < minimum) {
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialInsufficient, requirement.id, {
        required: minimum,
        observed: qualifying.size,
      }),
    );
  }

  return { materialIds: materialIdsOf(materials), blockers, warnings };
}

// ---------------------------------------------------------------------------
// Verification
// ---------------------------------------------------------------------------

/** How one declared check stands at the evaluated revision. */
interface CheckStanding {
  readonly satisfied: boolean;
  readonly blocker?: ProtocolizationReadinessReason;
  readonly warning?: ProtocolizationReadinessReason;
  readonly executionIds: readonly VerificationExecutionId[];
}

/**
 * The outcome-to-standing table. Every member of APV-07's closed vocabulary is
 * handled, and none is folded into another.
 *
 * ```text
 * Pass          satisfies this check
 * Warning       satisfies this check, and the warning travels on
 * Fail          does not satisfy — verification.fail
 * ManualReview  does not satisfy — automation deferred to a person
 * Unavailable   does not satisfy — and is never reported as a Fail
 * ```
 *
 * There is no scoring, no averaging, no majority and no "worst outcome wins"
 * reduction anywhere: `2 Pass + 1 Fail` is not a pass, and `80% passed` is not a
 * concept this package has.
 */
function standingForOutcome(
  reportAgainst: AssetRequirementId,
  result: ProtocolizationVerificationResult,
  extra: Omit<ProtocolizationReadinessReason, 'reasonCode' | 'requirementId'> = {},
): CheckStanding {
  const executionIds = [result.executionId];
  const at = (
    code: ProtocolizationReadinessReason['reasonCode'],
  ): ProtocolizationReadinessReason =>
    reason(code, reportAgainst, { checkId: result.checkId, executionIds, ...extra });

  switch (result.outcome) {
    case VerificationCheckOutcome.Pass:
      return { satisfied: true, executionIds };
    case VerificationCheckOutcome.Warning:
      return {
        satisfied: true,
        warning: at(PROTOCOLIZATION_READINESS_WARNING_CODES.verificationWarning),
        executionIds,
      };
    case VerificationCheckOutcome.Fail:
      return {
        satisfied: false,
        blocker: at(PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationFail),
        executionIds,
      };
    case VerificationCheckOutcome.ManualReview:
      return {
        satisfied: false,
        blocker: at(PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationManualReview),
        executionIds,
      };
    case VerificationCheckOutcome.Unavailable:
      return {
        satisfied: false,
        blocker: at(PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationUnavailable),
        executionIds,
      };
    default:
      return {
        satisfied: false,
        blocker: at(PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationMissing),
        executionIds,
      };
  }
}

/**
 * How one `(declaringRequirementId, checkId)` obligation stands at the evaluated
 * revision.
 *
 * The single place this slice decides whether a check has a usable current
 * answer. `evaluateVerificationRequirement` uses it for the checks a
 * verification requirement declares, and the freshness discharge below uses it
 * for the check that owns a freshness evaluation — so there is exactly one
 * notion of missing, stale and current, built on APV-07's own comparison.
 *
 * ```text
 * no result for the pair at all            verification.missing
 * results exist, none at this revision     verification.stale
 * a result at this revision                its outcome decides
 * ```
 *
 * `reportAgainst` is the requirement the finding is *about*, which is not always
 * the requirement that declared the check: an evidence requirement's freshness
 * obligation is discharged by a check some verification requirement declares,
 * and a reader needs the blocker filed against the evidence requirement whose
 * satisfaction is actually in question.
 */
function resolveCheckStanding(
  context: RequirementEvaluationContext,
  declaringRequirementId: AssetRequirementId,
  checkId: AssetVerificationCheckId,
  reportAgainst: AssetRequirementId,
  extra: Omit<ProtocolizationReadinessReason, 'reasonCode' | 'requirementId'> = {},
): CheckStanding {
  const forPair = context.verificationResults.filter(
    (result) => result.requirementId === declaringRequirementId && result.checkId === checkId,
  );
  const current = listLatestVerificationResults(
    forPair.filter((result) =>
      isVerificationResultCurrentForRevision(result, context.evaluatedCaseRevision),
    ),
  )[0];

  if (current !== undefined) return standingForOutcome(reportAgainst, current, extra);

  if (forPair.length > 0) {
    const executionIds = forPair.map((result) => result.executionId);
    return {
      satisfied: false,
      blocker: reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationStale, reportAgainst, {
        checkId,
        executionIds,
        atCaseRevision: context.evaluatedCaseRevision,
        ...extra,
      }),
      executionIds,
    };
  }
  return {
    satisfied: false,
    blocker: reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationMissing, reportAgainst, {
      checkId,
      ...extra,
    }),
    executionIds: [],
  };
}

/**
 * The one check this package establishes as the evaluator of an evidence
 * freshness constraint.
 *
 * Read off the built-in itself rather than written as a literal, so the mapping
 * cannot drift from the implementation it names. `evidenceFreshnessCheck`'s own
 * proposition is *every observation behind this case's evidence satisfies the
 * freshness constraint the pinned profile declares for the requirement it
 * answers* — which is exactly the obligation being discharged.
 */
const EVIDENCE_FRESHNESS_CHECK_ID: AssetVerificationCheckId = evidenceFreshnessCheck.checkId;

/**
 * Whether an evidence requirement's freshness constraint has actually been
 * **discharged** by the subsystem that owns its evaluation.
 *
 * ### Delegation is not satisfaction
 *
 * ```text
 * constraint delegated to APV-07   !=   constraint evaluated by APV-07
 * ```
 *
 * A profile that declares `freshness` is stating a normative demand. APV-07 owns
 * evaluating it, and APV-09 must not recompute the proposition — but "somebody
 * else owns this" is not an answer, and treating it as one let a required
 * requirement be satisfied on a constraint nobody ever checked.
 *
 * ### A registered check is not a declared requirement
 *
 * APV-07 executes only the `checkIds` an `AssetVerificationRequirement` of the
 * **pinned profile** explicitly declares. That a built-in implementation exists
 * in this package's library establishes nothing about this profile: a profile
 * that declares `freshness` and no verification requirement demanding
 * `check.evidence.freshness` has delegated the evaluation to nobody, and the
 * constraint is unestablished (`requirement.constraint.unevaluated`).
 *
 * ### Otherwise the existing verification vocabulary answers it
 *
 * Where the check *is* declared, its standing is resolved exactly as any other
 * check's — missing, stale, or an outcome — and the finding is filed against the
 * evidence requirement whose satisfaction is in question, carrying
 * `constraint: 'freshness'` and the `checkId` so a reader can see why an evidence
 * requirement is blocked by a verification finding. `Pass` discharges the
 * obligation; `Warning` discharges it non-fatally under APV-07's own frozen
 * semantics, with the warning preserved; `Fail`, `Unavailable` and
 * `ManualReview` do not discharge it.
 *
 * Several verification requirements may declare the same check. Any one of them
 * standing satisfied discharges the obligation — a declaring requirement whose
 * own result failed blocks in its own right, so nothing is smuggled past.
 */
function dischargeEvidenceFreshness(
  context: RequirementEvaluationContext,
  requirement: AssetEvidenceRequirement,
): { readonly blockers: readonly ProtocolizationReadinessReason[]; readonly warnings: readonly ProtocolizationReadinessReason[] } {
  const declaring = context.profile.requirements.filter(
    (candidate): candidate is AssetVerificationRequirement =>
      candidate.kind === AssetRequirementKind.Verification &&
      candidate.checkIds.includes(EVIDENCE_FRESHNESS_CHECK_ID),
  );

  if (declaring.length === 0) {
    return {
      blockers: [unevaluatedConstraint(requirement.id, 'freshness')],
      warnings: [],
    };
  }

  const standings = declaring.map((declarer) =>
    resolveCheckStanding(context, declarer.id, EVIDENCE_FRESHNESS_CHECK_ID, requirement.id, {
      constraint: 'freshness',
    }),
  );
  const discharged = standings.find((standing) => standing.satisfied);

  if (discharged !== undefined) {
    return {
      blockers: [],
      warnings: [
        // The discharge is recorded rather than left silent: a reader can see
        // which execution answered the constraint APV-09 did not evaluate.
        reason(PROTOCOLIZATION_READINESS_WARNING_CODES.constraintDelegated, requirement.id, {
          constraint: 'freshness',
          checkId: EVIDENCE_FRESHNESS_CHECK_ID,
          executionIds: discharged.executionIds,
        }),
        ...standings.flatMap((standing) =>
          standing.warning === undefined ? [] : [standing.warning],
        ),
      ],
    };
  }

  return {
    blockers: standings.flatMap((standing) =>
      standing.blocker === undefined ? [] : [standing.blocker],
    ),
    warnings: [],
  };
}

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
export function evaluateVerificationRequirement(
  context: RequirementEvaluationContext,
  requirement: AssetVerificationRequirement,
): RequirementFindings {
  const standings = requirement.checkIds.map((checkId) =>
    resolveCheckStanding(context, requirement.id, checkId, requirement.id),
  );

  const executionIds = standings.flatMap((standing) => standing.executionIds);
  const satisfiedCount = standings.filter((standing) => standing.satisfied).length;
  const satisfied =
    requirement.satisfaction === AssetRequirementSatisfaction.All
      ? satisfiedCount === requirement.checkIds.length
      : satisfiedCount > 0;

  const warnings = standings.flatMap((standing) =>
    standing.warning === undefined ? [] : [standing.warning],
  );
  // A verification requirement's own freshness constraint has no evaluator
  // either — there is no check whose declared proposition is "these check
  // results are recent enough".
  const freshnessBlockers =
    requirement.freshness === undefined
      ? []
      : [unevaluatedConstraint(requirement.id, 'freshness')];
  // A satisfied `Any` keeps the findings of the alternatives that did not hold
  // as warnings: they are real observations, and discarding them would hide a
  // failing check behind a passing sibling.
  const unsatisfiedReasons = standings.flatMap((standing) =>
    standing.satisfied || standing.blocker === undefined ? [] : [standing.blocker],
  );

  return {
    materialIds: [],
    verificationExecutionIds: executionIds,
    blockers: satisfied ? freshnessBlockers : [...freshnessBlockers, ...unsatisfiedReasons],
    warnings: satisfied ? [...warnings, ...unsatisfiedReasons] : warnings,
  };
}

// ---------------------------------------------------------------------------
// Attestation
// ---------------------------------------------------------------------------

/**
 * Whether one `Attest` decision produced material this vertical may treat as
 * professional attestation material for this requirement.
 *
 * ### The hard rule
 *
 * ```text
 * ProfessionalReviewDecision(action: Attest)   !=   attestation material
 * ```
 *
 * A decision proves a professional chose to attest. The profile asked for an
 * *attestation*, and an `Attest` with no `CanonicalAttestation` and no APV-04
 * attestation material does not deliver one. APV-08 makes that state perfectly
 * legal — a recorded professional position without a Protocol artifact — and
 * APV-09 must not read it as a satisfied requirement.
 *
 * ### And the artifact must be the legitimate one
 *
 * Every clause below is a separate way a lookalike is refused:
 *
 * ```text
 * kind is ProtocolizationMaterialKind.Attestation     never a Verification,
 *                                                     Declaration or Credential
 *                                                     association
 * correlated to this exact requirement id             never another attestation
 *                                                     requirement's artifact
 * an Attest decision names this exact material and
 *   this exact attestation                            never material somebody
 *                                                     associated by hand
 * the decision's scope answers this requirement       never a scope for another
 * the attested type is in acceptedTypes of the
 *   pinned version                                    never a type only a later
 *                                                     profile version accepts
 * the CanonicalAttestation carries >= 1 usable
 *   CanonicalProofRef                                 the APV-08 hardening,
 *                                                     re-established here on the
 *                                                     artifact itself
 * ```
 *
 * ### Proof present is not proof verified
 *
 * The last clause checks that a proof reference *exists and is structurally
 * usable*, reusing APV-08's own `isUsableProofRef`. It does not resolve the
 * proof, fetch the artifact, check a signature, contact an issuer or evaluate a
 * key. Protocol's contract for `CanonicalProofRef` is "references a proof
 * artifact without embedding, resolving, or validating that artifact", and this
 * package has no way to do more — nor may it pretend to. A profile that requires
 * cryptographic verification declares a verification check for it, and that
 * check gates `Ready` in its own right.
 */
function qualifyingAttestation(
  context: RequirementEvaluationContext,
  requirement: AssetAttestationRequirement,
  material: ProtocolizationCaseMaterial,
):
  | { readonly ok: true; readonly decision: ProfessionalReviewDecision; readonly attestationRef: CanonicalAttestationId }
  | { readonly ok: false; readonly reasonCode: ProtocolizationReadinessReason['reasonCode'] } {
  if (material.kind !== ProtocolizationMaterialKind.Attestation) {
    return { ok: false, reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationDecisionMissing };
  }

  const decision = context.reviewDecisions.find(
    (candidate) =>
      candidate.action === ProfessionalReviewAction.Attest &&
      candidate.attestationRequirementId === requirement.id &&
      candidate.attestationMaterialId === material.materialId &&
      candidate.canonicalAttestationRef === material.attestationRef &&
      candidate.scope?.requirementId === requirement.id,
  );
  if (decision === undefined) {
    return { ok: false, reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationDecisionMissing };
  }

  if (
    decision.scope === undefined ||
    !requirement.acceptedTypes.includes(decision.scope.attestationType)
  ) {
    return {
      ok: false,
      reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationTypeIncompatible,
    };
  }

  const attestation = context.attestationsById.get(material.attestationRef);
  const proofRefs = attestation?.proofRefs;
  if (
    attestation === undefined ||
    !Array.isArray(proofRefs) ||
    proofRefs.length === 0 ||
    !proofRefs.every((proofRef) => isUsableProofRef(proofRef))
  ) {
    return {
      ok: false,
      reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationUnprovenArtifact,
    };
  }

  return { ok: true, decision, attestationRef: material.attestationRef };
}

/**
 * Whether an attestation covering through revision `coveredThrough` still
 * describes the case at the revision being evaluated.
 *
 * ### Every revision must be accounted for
 *
 * The case's `revision` increments once per successful operation, so the
 * revisions in `(coveredThrough, evaluatedCaseRevision]` are exactly the
 * operations that happened after this attestation's coverage. The attestation is
 * current only if **every one of them** is accounted for by a change that could
 * not be about what this reviewer attested. An unaccounted revision — a
 * declaration, an evidence admission, a bare material association, a lifecycle
 * transition, anything at all this evaluator cannot identify — makes the
 * attestation not current. The default direction is *not current*, and a gap is
 * never read as "probably harmless".
 *
 * ### The one carve-out, and why it is not an invented scope rule
 *
 * A revision is accounted for when it is the `resultingCaseRevision` of an
 * APV-08 `Attest` decision for a **different** attestation requirement of the
 * same pinned profile. That revision exists because another professional's own
 * artifact was associated to the case, and APV-08 guarantees such material is
 * correlated to exactly that other requirement.
 *
 * ```text
 * a second reviewer recording their own attestation
 *     != dossier material this reviewer needed to see
 * ```
 *
 * APV-08 already established the narrower half of this: a reviewer, by
 * definition, did not review the attestation their own decision produced, which
 * is why `reviewBasisRevision` and `resultingCaseRevision` are separate fields.
 * One professional's recorded position is likewise not evidence about another's
 * proposition — the same reason conflicting decisions are preserved and never
 * adjudicated.
 *
 * Without this carve-out a profile with two required attestation requirements
 * could never be ready: attesting the second would stale the first, re-reviewing
 * the first would stale the second, and the regress would not terminate. That
 * would not be conservatism; it would be a rule that makes a legitimate profile
 * unsatisfiable.
 */
function coversCurrentRevision(
  context: RequirementEvaluationContext,
  requirement: AssetAttestationRequirement,
  coveredThrough: number,
): boolean {
  for (let revision = coveredThrough + 1; revision <= context.evaluatedCaseRevision; revision += 1) {
    const accountedFor = context.reviewDecisions.some(
      (decision) =>
        decision.action === ProfessionalReviewAction.Attest &&
        decision.attestationRequirementId !== requirement.id &&
        decision.resultingCaseRevision === revision,
    );
    if (!accountedFor) return false;
  }
  return true;
}

/**
 * The professional positions that are *current* for one attestation requirement.
 *
 * "Current" is the highest `reviewBasisRevision` any decision for this
 * requirement was taken on. Everything older stays in history and stays
 * readable; it simply stops being the current position.
 *
 * This is what stops an old `RequestMoreEvidence` dominating forever:
 *
 * ```text
 * R1 @ revision 5   RequestMoreEvidence    historical once R2 exists
 * evidence added    revision 8
 * R2 @ revision 8   Attest                 the current position
 * ```
 *
 * Nothing is overwritten, marked superseded or deleted to achieve that — the
 * comparison is on read, over records that remain exactly as APV-08 wrote them.
 */
function currentDecisions(
  context: RequirementEvaluationContext,
  requirement: AssetAttestationRequirement,
): readonly ProfessionalReviewDecision[] {
  const forRequirement = context.reviewDecisions.filter(
    (decision) => decision.attestationRequirementId === requirement.id,
  );
  if (forRequirement.length === 0) return [];
  const latestBasis = forRequirement.reduce(
    (highest, decision) => Math.max(highest, decision.reviewBasisRevision),
    Number.NEGATIVE_INFINITY,
  );
  return forRequirement.filter((decision) => decision.reviewBasisRevision === latestBasis);
}

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
export function evaluateAttestationRequirement(
  context: RequirementEvaluationContext,
  requirement: AssetAttestationRequirement,
): RequirementFindings {
  const materials = materialsFor(
    context.protocolizationCase,
    requirement.id,
    ProtocolizationMaterialKind.Attestation,
  );
  const minimum = minimumOf(requirement.minimumCount);

  const blockers: ProtocolizationReadinessReason[] = [];
  const warnings: ProtocolizationReadinessReason[] = [];
  // No built-in evaluates attestation freshness either.
  if (requirement.freshness !== undefined) {
    blockers.push(unevaluatedConstraint(requirement.id, 'freshness'));
  }

  // Qualifying attestations are partitioned by what they demonstrably cover.
  //
  // What an attestation covers is the basis the professional reviewed, plus the
  // revision their own attestation produced — new material the reviewer, by
  // definition, did not review. Anything the case gained *after* that is outside
  // everything they looked at, and APV-08's own contract is that a professional
  // must never unknowingly attest a moving target. So a stale attestation does
  // not satisfy the requirement; it remains a perfectly valid historical
  // statement about the basis it reviewed, and nothing here deletes it,
  // invalidates it or infers anything about its signature.
  const currentRefs = new Set<CanonicalAttestationId>();
  const qualifyingDecisionIds = new Set<ProfessionalReviewDecisionId>();
  const staleRefs: CanonicalAttestationId[] = [];
  const staleDecisionIds: ProfessionalReviewDecisionId[] = [];
  let staleCoveredThrough: number | undefined;
  const rejectedByCode = new Map<
    ProtocolizationReadinessReason['reasonCode'],
    ProtocolizationMaterialId[]
  >();

  for (const material of materials) {
    const outcome = qualifyingAttestation(context, requirement, material);
    if (outcome.ok) {
      qualifyingDecisionIds.add(outcome.decision.decisionId);
      const coveredThrough =
        outcome.decision.resultingCaseRevision ?? outcome.decision.reviewBasisRevision;
      if (!coversCurrentRevision(context, requirement, coveredThrough)) {
        staleRefs.push(outcome.attestationRef);
        staleDecisionIds.push(outcome.decision.decisionId);
        staleCoveredThrough =
          staleCoveredThrough === undefined
            ? coveredThrough
            : Math.max(staleCoveredThrough, coveredThrough);
        continue;
      }
      currentRefs.add(outcome.attestationRef);
      continue;
    }
    const held = rejectedByCode.get(outcome.reasonCode) ?? [];
    held.push(material.materialId);
    rejectedByCode.set(outcome.reasonCode, held);
  }

  for (const [reasonCode, materialIds] of rejectedByCode) {
    blockers.push(reason(reasonCode, requirement.id, { materialIds }));
  }

  // Reported only where the current ones do not already meet the profile's
  // demand: an attestation that has been superseded by a newer one covering the
  // current revision is history, not an outstanding question.
  if (currentRefs.size < minimum && staleRefs.length > 0) {
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationCurrencyUnresolved, requirement.id, {
        decisionIds: staleDecisionIds,
        attestationRefs: staleRefs,
        ...(staleCoveredThrough === undefined ? {} : { atCaseRevision: staleCoveredThrough }),
      }),
    );
  }

  const current = currentDecisions(context, requirement);
  const currentActions = new Set(current.map((decision) => decision.action));
  const decisionIds = [
    ...new Set([
      ...current.map((decision) => decision.decisionId),
      ...qualifyingDecisionIds,
    ]),
  ];

  if (currentActions.size > 1) {
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewConflicting, requirement.id, {
        decisionIds: current.map((decision) => decision.decisionId),
        atCaseRevision: current[0]?.reviewBasisRevision,
      }),
    );
  } else if (currentActions.has(ProfessionalReviewAction.Reject)) {
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewRejected, requirement.id, {
        decisionIds: current.map((decision) => decision.decisionId),
      }),
    );
  } else if (currentActions.has(ProfessionalReviewAction.RequestMoreEvidence)) {
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewMoreEvidenceRequired, requirement.id, {
        decisionIds: current.map((decision) => decision.decisionId),
      }),
    );
  } else if (currentActions.has(ProfessionalReviewAction.Abstain)) {
    // An abstention is a recorded professional position, and it is emphatically
    // not a failure of the subject. It simply leaves the requirement unresolved:
    // somebody else has to look.
    blockers.push(
      reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewPending, requirement.id, {
        decisionIds: current.map((decision) => decision.decisionId),
      }),
    );
  }

  if (currentRefs.size < minimum) {
    if (materials.length === 0) {
      blockers.push(
        reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationMissing, requirement.id, {
          required: minimum,
          observed: 0,
        }),
      );
    } else if (currentRefs.size > 0) {
      blockers.push(
        reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationMissing, requirement.id, {
          required: minimum,
          observed: currentRefs.size,
        }),
      );
    }

    // A review that was asked for and has not come back is outstanding work, and
    // saying so is more useful than reporting only that the artifact is absent.
    const undecided = context.reviewRequests.filter(
      (request) =>
        request.attestationRequirementId === requirement.id &&
        !context.reviewDecisions.some(
          (decision) => decision.reviewRequestId === request.reviewRequestId,
        ),
    );
    if (undecided.length > 0) {
      blockers.push(reason(PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewPending, requirement.id));
    }
  }

  return {
    materialIds: materialIdsOf(materials),
    ...(decisionIds.length === 0 ? {} : { reviewDecisionIds: decisionIds }),
    ...(currentRefs.size === 0 ? {} : { attestationRefs: [...currentRefs] }),
    blockers,
    warnings,
  };
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Exhaustive dispatch over APV-03's closed requirement vocabulary.
 *
 * A kind this build does not know fails loudly with
 * `READINESS_REQUIREMENT_KIND_UNSUPPORTED`. It is deliberately not treated as
 * satisfied, not skipped and not reported as `NotApplicable`: every one of those
 * would turn a demand nobody understood into a demand that was met, and the
 * failure would be invisible in the result.
 */
export function evaluateRequirement(
  context: RequirementEvaluationContext,
  requirement: AssetRequirement,
): RequirementFindings {
  switch (requirement.kind) {
    case AssetRequirementKind.Identity:
      return evaluateIdentityRequirement(context, requirement);
    case AssetRequirementKind.Declaration:
      return evaluateDeclarationRequirement(context, requirement);
    case AssetRequirementKind.Evidence:
      return evaluateEvidenceRequirement(context, requirement);
    case AssetRequirementKind.Verification:
      return evaluateVerificationRequirement(context, requirement);
    case AssetRequirementKind.Attestation:
      return evaluateAttestationRequirement(context, requirement);
    default:
      throw new ProtocolizationReadinessError(
        PROTOCOLIZATION_READINESS_ERROR_CODES.unsupportedRequirementKind,
        `The pinned profile declares a requirement kind this evaluator does not handle`,
        {
          reasonCodes: [PROTOCOLIZATION_READINESS_ERROR_CODES.unsupportedRequirementKind],
          tenantId: context.protocolizationCase.tenantId,
          caseId: context.protocolizationCase.caseId,
          profile: context.protocolizationCase.profile,
          requirementIds: [(requirement as AssetRequirement).id],
        },
      );
  }
}

/** Whether one obligation demands satisfaction before `Ready`. */
export function isBlockingObligation(obligation: AssetRequirementObligation): boolean {
  return (
    obligation === AssetRequirementObligation.Required ||
    obligation === AssetRequirementObligation.Conditional
  );
}
