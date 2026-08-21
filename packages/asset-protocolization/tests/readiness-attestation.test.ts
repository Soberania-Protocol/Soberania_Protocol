import { AttestationType } from '@aoc/protocol/claims';

import {
  PROTOCOLIZATION_READINESS_BLOCKER_CODES,
  ProfessionalReviewAction,
  ProtocolizationCaseState,
  ProtocolizationMaterialKind,
  ProtocolizationReadinessState,
  ProtocolizationRequirementMaterialStatus,
  ProtocolizationRequirementStatus,
  evaluateProtocolizationReadiness,
  getProtocolizationRequirementAssessment,
  listProtocolizationReadinessBlockers,
} from '@aoc/asset-protocolization';

import {
  READINESS_ATTESTATION,
  READINESS_ATTESTATION_FAIL_V1,
  READINESS_ATTESTATION_TYPE_V1,
  READINESS_ATTESTATION_V1,
  READINESS_SECOND_ATTESTATION,
  READINESS_SECOND_CLAIM_ID,
  READINESS_SECOND_REVIEWER,
  READINESS_TWO_ATTESTATIONS_V1,
  addDeclaration,
  createReadinessContext,
  newDossier,
  openReview,
  readinessInputs,
  review,
  runChecks,
} from './fixtures/test-readiness';
import type { ReadinessDossier, ReadinessTestContext } from './fixtures/test-readiness';

/**
 * Professional attestation semantics — the part of APV-09 that must not weaken
 * APV-08's hardening by a single clause.
 */
function attestable(
  context: ReadinessTestContext = createReadinessContext(),
): { readonly context: ReadinessTestContext; readonly dossier: ReadinessDossier } {
  const dossier = newDossier(context, { profile: READINESS_ATTESTATION_V1 });
  addDeclaration(context, dossier);
  return { context, dossier };
}

const evaluate = (context: ReadinessTestContext, dossier: ReadinessDossier) =>
  evaluateProtocolizationReadiness(context, dossier.protocolizationCase, readinessInputs(dossier));

describe('APV-09 professional attestation semantics', () => {
  // §138 ARCHITECTURE PROOF L / §43 / §172 HARD TEST — this is the mandatory one.
  it('never satisfies an Attestation requirement from an Attest decision with no artifact', async () => {
    const { context, dossier } = attestable();
    await review(context, dossier, { withArtifact: false });

    // The decision exists, it is an Attest, and it is perfectly legitimate.
    expect(dossier.reviewDecisions).toHaveLength(1);
    expect(dossier.reviewDecisions[0]?.action).toBe(ProfessionalReviewAction.Attest);
    expect(dossier.reviewDecisions[0]?.canonicalAttestationRef).toBeUndefined();
    expect(dossier.attestations).toHaveLength(0);

    const evaluation = evaluate(context, dossier);

    expect(evaluation.ready).toBe(false);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.ReviewPending);
    const assessment = getProtocolizationRequirementAssessment(evaluation, READINESS_ATTESTATION);
    expect(assessment?.status).toBe(ProtocolizationRequirementStatus.Pending);
    expect(assessment?.attestationRefs).toBeUndefined();
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        requirementId: READINESS_ATTESTATION,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationMissing,
      }),
    ).toHaveLength(1);
  });

  // §139 ARCHITECTURE PROOF M / §173 HARD TEST — a proof-backed artifact qualifies.
  it('satisfies an Attestation requirement from a legitimate proof-backed artifact', async () => {
    const { context, dossier } = attestable();
    await review(context, dossier, { withArtifact: true });

    expect(dossier.attestations).toHaveLength(1);
    expect(dossier.attestations[0]?.proofRefs?.length).toBeGreaterThanOrEqual(1);

    const evaluation = evaluate(context, dossier);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);

    const assessment = getProtocolizationRequirementAssessment(evaluation, READINESS_ATTESTATION);
    expect(assessment?.status).toBe(ProtocolizationRequirementStatus.Satisfied);
    expect(assessment?.attestationRefs).toEqual([dossier.attestations[0]?.id]);
    expect(assessment?.reviewDecisionIds).toContain(dossier.reviewDecisions[0]?.decisionId);

    // §45 / §102 — the proof was never resolved, verified or inspected.
    const serialized = JSON.stringify(evaluation).toLowerCase();
    for (const forbidden of ['signaturevalid', 'proofverified', 'verifiedproof', 'publickey']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  // §101 / §44 — an artifact carrying no proof reference does not qualify,
  // whatever a reconstructed history claims.
  it('refuses an attestation that cannot be shown to carry a proof reference', async () => {
    const { context, dossier } = attestable();
    await review(context, dossier, { withArtifact: true });

    for (const attestations of [
      // Reconstructed history in which the artifact lost its proof references.
      dossier.attestations.map((attestation) => ({ ...attestation, proofRefs: [] })),
      // ...or carries something that is not a usable reference.
      dossier.attestations.map((attestation) => ({
        ...attestation,
        proofRefs: [{ id: '  ', type: 'NotAProofType', source: '' }],
      })),
      // ...or was not supplied at all, so nothing establishes the invariant.
      [],
    ]) {
      const evaluation = evaluateProtocolizationReadiness(context, dossier.protocolizationCase, {
        ...readinessInputs(dossier),
        attestations: attestations as never,
      });

      expect(evaluation.ready).toBe(false);
      expect(
        listProtocolizationReadinessBlockers(evaluation, {
          requirementId: READINESS_ATTESTATION,
          reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationUnprovenArtifact,
        }),
      ).toHaveLength(1);
    }
  });

  // §44 — attestation material with no APV-08 decision behind it is not an attestation.
  it('refuses attestation material that no Attest decision produced', async () => {
    const { context, dossier } = attestable();
    await review(context, dossier, { withArtifact: true });

    const evaluation = evaluateProtocolizationReadiness(context, dossier.protocolizationCase, {
      ...readinessInputs(dossier),
      reviewDecisions: [],
    });

    expect(evaluation.ready).toBe(false);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        requirementId: READINESS_ATTESTATION,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationDecisionMissing,
      }),
    ).toHaveLength(1);
    // The material is still present on the case. Presence was never the question.
    expect(
      dossier.protocolizationCase.materials.some(
        (material) => material.kind === ProtocolizationMaterialKind.Attestation,
      ),
    ).toBe(true);
  });

  // §46 — the attested type must be one the pinned version accepts.
  it('refuses an attested type the pinned profile version does not accept', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_ATTESTATION_TYPE_V1,
      caseId: 'case-readiness-type',
    });
    addDeclaration(context, dossier);
    await review(context, dossier, {
      withArtifact: true,
      attestationType: AttestationType.Organization,
    });

    // The decision is legitimate under the profile it was made against...
    expect(dossier.attestations).toHaveLength(1);

    // ...and stops qualifying the moment the scope's type is rewritten to one
    // this version does not accept.
    const evaluation = evaluateProtocolizationReadiness(context, dossier.protocolizationCase, {
      ...readinessInputs(dossier),
      reviewDecisions: dossier.reviewDecisions.map((decision) => ({
        ...decision,
        scope:
          decision.scope === undefined
            ? undefined
            : { ...decision.scope, attestationType: AttestationType.System },
      })) as never,
    });

    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationTypeIncompatible,
      }),
    ).toHaveLength(1);
    expect(evaluation.ready).toBe(false);
  });

  // §140 ARCHITECTURE PROOF N / §49 — a professional Reject.
  it('derives Rejected from a current professional Reject without concluding anything', async () => {
    const { context, dossier } = attestable();
    await review(context, dossier, { action: ProfessionalReviewAction.Reject });

    const evaluation = evaluate(context, dossier);

    expect(evaluation.state).toBe(ProtocolizationReadinessState.Rejected);
    expect(evaluation.ready).toBe(false);
    expect(
      getProtocolizationRequirementAssessment(evaluation, READINESS_ATTESTATION)?.status,
    ).toBe(ProtocolizationRequirementStatus.Blocked);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewRejected,
      })[0]?.decisionIds,
    ).toEqual([dossier.reviewDecisions[0]?.decisionId]);

    // The case is not cancelled and no legal conclusion is drawn.
    expect(dossier.protocolizationCase.state).toBe(ProtocolizationCaseState.Draft);
    const serialized = JSON.stringify(evaluation).toLowerCase();
    for (const forbidden of ['fraud', 'invalid', 'unlawful', 'legal']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  // §75 — Rejected is derived, so a later review leaves it.
  it('leaves Rejected when a later review on a later basis attests legitimately', async () => {
    const { context, dossier } = attestable();
    await review(context, dossier, {
      action: ProfessionalReviewAction.Reject,
      requestId: 'review-request-r1',
      decisionId: 'review-decision-r1',
    });
    expect(evaluate(context, dossier).state).toBe(ProtocolizationReadinessState.Rejected);

    // New material moves the case on, and a second review is taken on the new basis.
    addDeclaration(context, dossier, {
      declarationId: 'declaration-followup',
      materialId: 'material-declaration-followup',
      claimRef: READINESS_SECOND_CLAIM_ID,
    });
    await review(context, dossier, {
      requestId: 'review-request-r2',
      decisionId: 'review-decision-r2',
      withArtifact: true,
    });

    const evaluation = evaluate(context, dossier);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);
    // Both decisions remain readable, in order, and neither was rewritten.
    expect(dossier.reviewDecisions.map((decision) => decision.action)).toEqual([
      ProfessionalReviewAction.Reject,
      ProfessionalReviewAction.Attest,
    ]);
  });

  // §141 ARCHITECTURE PROOF O / §50 — Abstain resolves nothing.
  it('leaves an Attestation requirement unresolved after an Abstain', async () => {
    const { context, dossier } = attestable();
    await review(context, dossier, { action: ProfessionalReviewAction.Abstain });

    const evaluation = evaluate(context, dossier);
    expect(evaluation.ready).toBe(false);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.ReviewPending);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewPending,
      }).length,
    ).toBeGreaterThan(0);
    // An abstention is not a failure of the subject.
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewRejected,
      }),
    ).toEqual([]);
  });

  // §137 ARCHITECTURE PROOF K / §47 / §48 — RequestMoreEvidence, and its expiry.
  it('derives MoreEvidenceRequired from a current request, and stops when a later review supersedes it', async () => {
    const { context, dossier } = attestable();
    await review(context, dossier, {
      action: ProfessionalReviewAction.RequestMoreEvidence,
      requestId: 'review-request-r1',
      decisionId: 'review-decision-r1',
    });

    const pending = evaluate(context, dossier);
    expect(pending.state).toBe(ProtocolizationReadinessState.MoreEvidenceRequired);
    expect(
      listProtocolizationReadinessBlockers(pending, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewMoreEvidenceRequired,
      }),
    ).toHaveLength(1);

    // The applicant supplies more, and a second review is taken on the new basis.
    addDeclaration(context, dossier, {
      declarationId: 'declaration-followup',
      materialId: 'material-declaration-followup',
      claimRef: READINESS_SECOND_CLAIM_ID,
    });
    await review(context, dossier, {
      requestId: 'review-request-r2',
      decisionId: 'review-decision-r2',
      withArtifact: true,
    });

    const resolved = evaluate(context, dossier);
    expect(resolved.state).toBe(ProtocolizationReadinessState.Ready);
    expect(
      listProtocolizationReadinessBlockers(resolved, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewMoreEvidenceRequired,
      }),
    ).toEqual([]);

    // §125 — the old request is historical, not erased.
    expect(dossier.reviewDecisions[0]?.action).toBe(ProfessionalReviewAction.RequestMoreEvidence);
    expect(dossier.reviewDecisions[0]?.requestedMaterial?.length).toBeGreaterThan(0);
  });

  // §142 ARCHITECTURE PROOF P / §51 — conflicts are never adjudicated.
  it('blocks on conflicting current professional positions and picks no winner', async () => {
    const { context, dossier } = attestable();

    const basis = dossier.protocolizationCase.revision;
    await review(context, dossier, {
      requestId: 'review-request-a',
      decisionId: 'review-decision-a',
      action: ProfessionalReviewAction.Reject,
    });
    await review(context, dossier, {
      requestId: 'review-request-b',
      decisionId: 'review-decision-b',
      reviewer: READINESS_SECOND_REVIEWER,
      action: ProfessionalReviewAction.Abstain,
    });

    // Both decisions were taken on the same basis revision, and they disagree.
    expect(dossier.reviewDecisions.map((decision) => decision.reviewBasisRevision)).toEqual([
      basis,
      basis,
    ]);

    const evaluation = evaluate(context, dossier);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.Blocked);
    expect(
      getProtocolizationRequirementAssessment(evaluation, READINESS_ATTESTATION)?.status,
    ).toBe(ProtocolizationRequirementStatus.Blocked);
    const conflict = listProtocolizationReadinessBlockers(evaluation, {
      reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewConflicting,
    });
    expect(conflict).toHaveLength(1);
    expect(conflict[0]?.decisionIds).toEqual(['review-decision-a', 'review-decision-b']);

    // Both decisions stay exactly as APV-08 wrote them.
    expect(dossier.reviewDecisions).toHaveLength(2);
    expect(dossier.reviewDecisions[0]).not.toHaveProperty('superseded');
    expect(dossier.reviewDecisions[1]).not.toHaveProperty('superseded');
  });

  // §52 / §146 ARCHITECTURE PROOF T — attestation requirements are independent.
  it('assesses two attestation requirements independently and needs both', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_TWO_ATTESTATIONS_V1,
      caseId: 'case-readiness-two',
    });
    addDeclaration(context, dossier);

    await review(context, dossier, {
      requirementId: READINESS_ATTESTATION,
      withArtifact: true,
      attestationId: 'aoc:attestation:readiness-first',
      materialId: 'material-attestation-first',
    });

    const half = evaluate(context, dossier);
    expect(half.ready).toBe(false);
    expect(getProtocolizationRequirementAssessment(half, READINESS_ATTESTATION)?.status).toBe(
      ProtocolizationRequirementStatus.Satisfied,
    );
    expect(getProtocolizationRequirementAssessment(half, READINESS_SECOND_ATTESTATION)?.status).toBe(
      ProtocolizationRequirementStatus.Pending,
    );
    // There is no case-global "reviewed" flag anywhere on the result.
    expect(JSON.stringify(half)).not.toContain('professionalReviewed');

    await review(context, dossier, {
      requirementId: READINESS_SECOND_ATTESTATION,
      withArtifact: true,
      attestationId: 'aoc:attestation:readiness-second',
      materialId: 'material-attestation-second',
    });

    const whole = evaluate(context, dossier);
    expect(whole.state).toBe(ProtocolizationReadinessState.Ready);
  });

  // §73 — an outstanding request is review work, and it says so.
  it('reports an outstanding review request as pending review work', () => {
    const { context, dossier } = attestable();
    openReview(context, dossier);

    const evaluation = evaluate(context, dossier);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.ReviewPending);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewPending,
      }),
    ).toHaveLength(1);
  });

  // §53 — the two revisions stay distinct, and APV-04 material stays structural.
  it('preserves APV-08 review basis and resulting revisions without conflating them', async () => {
    const { context, dossier } = attestable();
    const basis = dossier.protocolizationCase.revision;
    await review(context, dossier, { withArtifact: true });

    const decision = dossier.reviewDecisions[0];
    expect(decision?.reviewBasisRevision).toBe(basis);
    expect(decision?.resultingCaseRevision).toBe(basis + 1);

    const evaluation = evaluate(context, dossier);
    const assessment = getProtocolizationRequirementAssessment(evaluation, READINESS_ATTESTATION);
    expect(assessment?.materialStatus).toBe(
      ProtocolizationRequirementMaterialStatus.MaterialPresent,
    );
    expect(assessment?.status).toBe(ProtocolizationRequirementStatus.Satisfied);
    // The reviewer did not review their own attestation, and nothing says they did.
    expect(evaluation.evaluatedCaseRevision).toBe(decision?.resultingCaseRevision);
  });

  // AUDIT B — the currency carve-out, stated as its own proof.
  it('does not stale one attestation merely because another requirement was attested', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_TWO_ATTESTATIONS_V1,
      caseId: 'case-readiness-carveout',
    });
    addDeclaration(context, dossier);

    await review(context, dossier, {
      requirementId: READINESS_ATTESTATION,
      withArtifact: true,
      attestationId: 'aoc:attestation:carveout-first',
      materialId: 'material-attestation-carveout-first',
    });
    const firstCovers = dossier.reviewDecisions[0]?.resultingCaseRevision;

    await review(context, dossier, {
      requirementId: READINESS_SECOND_ATTESTATION,
      withArtifact: true,
      attestationId: 'aoc:attestation:carveout-second',
      materialId: 'material-attestation-carveout-second',
    });

    const evaluation = evaluate(context, dossier);

    // The first attestation covers an earlier revision than the case now
    // stands at, and is still current: the only thing that happened since was
    // another professional recording their own artifact against another
    // requirement, which is not dossier material the first reviewer needed.
    expect(firstCovers).toBeLessThan(evaluation.evaluatedCaseRevision);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationCurrencyUnresolved,
      }),
    ).toEqual([]);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);

    // ...whereas an unaccounted revision does stale it. A declaration is
    // dossier material, and neither reviewer saw it.
    addDeclaration(context, dossier, {
      declarationId: 'declaration-carveout-later',
      materialId: 'material-declaration-carveout-later',
      claimRef: READINESS_SECOND_CLAIM_ID,
    });
    const later = evaluate(context, dossier);
    expect(later.state).toBe(ProtocolizationReadinessState.ReviewPending);
    expect(
      listProtocolizationReadinessBlockers(later, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationCurrencyUnresolved,
      }),
    ).toHaveLength(2);
  });

  // AUDIT B / §D.5 — an attestation current for what it covers may satisfy.
  it('satisfies a required attestation that still covers the evaluated revision', async () => {
    const { context, dossier } = attestable();
    await review(context, dossier, { withArtifact: true });

    const evaluation = evaluate(context, dossier);
    expect(evaluation.evaluatedCaseRevision).toBe(
      dossier.reviewDecisions[0]?.resultingCaseRevision,
    );
    expect(getProtocolizationRequirementAssessment(evaluation, READINESS_ATTESTATION)?.status).toBe(
      ProtocolizationRequirementStatus.Satisfied,
    );
    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);
  });

  // §175 HARD TEST — a complete professional record is not readiness.
  it('never treats complete professional material as readiness while a required check fails', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_ATTESTATION_FAIL_V1,
      caseId: 'case-readiness-attested-but-failing',
    });
    addDeclaration(context, dossier);
    await review(context, dossier, { withArtifact: true });
    await runChecks(context, dossier);

    const evaluation = evaluate(context, dossier);

    // The professional record is complete and legitimate...
    expect(
      getProtocolizationRequirementAssessment(evaluation, READINESS_ATTESTATION)?.status,
    ).toBe(ProtocolizationRequirementStatus.Satisfied);
    // ...and the case is emphatically not ready.
    expect(evaluation.ready).toBe(false);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.VerificationPending);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationFail,
      }),
    ).toHaveLength(1);
  });
});
