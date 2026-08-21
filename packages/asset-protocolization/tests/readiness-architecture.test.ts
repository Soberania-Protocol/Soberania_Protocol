import {
  PROTOCOLIZATION_READINESS_BLOCKER_CODES,
  PROTOCOLIZATION_READINESS_BLOCKER_CODE_LIST,
  PROTOCOLIZATION_READINESS_ERROR_CODES,
  PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION,
  PROTOCOLIZATION_READINESS_STATE_PRECEDENCE,
  PROTOCOLIZATION_READINESS_WARNING_CODES,
  PROTOCOLIZATION_READINESS_WARNING_CODE_LIST,
  ProtocolizationCaseState,
  ProtocolizationReadinessState,
  ProtocolizationRequirementApplicability,
  ProtocolizationRequirementMaterialStatus,
  ProtocolizationRequirementStatus,
  activateProtocolizationCase,
  cancelProtocolizationCase,
  deriveProtocolizationReadinessState,
  evaluateProtocolizationReadiness,
  getProtocolizationRequirementAssessment,
  isProtocolizationReadinessState,
  listProtocolizationReadinessBlockers,
} from '@aoc/asset-protocolization';

import { TENANT_B } from './fixtures/test-cases';
import {
  READINESS_ATTESTATION,
  READINESS_DECLARATION,
  READINESS_DECLARATION_V1,
  READINESS_EVIDENCE,
  READINESS_FULL_V1,
  READINESS_IDENTITY,
  READINESS_OPTIONAL_EVIDENCE,
  READINESS_VERIFICATION,
  addDeclaration,
  addEvidence,
  createReadinessContext,
  newDossier,
  readinessInputs,
  review,
  runChecks,
} from './fixtures/test-readiness';

/**
 * The APV-09 architecture proofs.
 *
 * They assert the *shape* of the decision this slice makes: that lifecycle and
 * readiness are separate dimensions, that a state is derived rather than
 * commanded, that every answer explains itself, and that nothing here executes
 * anything.
 */

async function readyDossier(context = createReadinessContext()) {
  const dossier = newDossier(context, { profile: READINESS_FULL_V1 });
  addDeclaration(context, dossier);
  addEvidence(context, dossier, {
    intakeId: 'intake-a',
    materialId: 'material-evidence-a',
    evidenceRef: 'aoc:evidence:readiness-a',
  });
  addEvidence(context, dossier, {
    intakeId: 'intake-b',
    materialId: 'material-evidence-b',
    evidenceRef: 'aoc:evidence:readiness-b',
  });
  await review(context, dossier, { withArtifact: true });
  await runChecks(context, dossier);
  return { context, dossier };
}

describe('APV-09 readiness architecture', () => {
  // §9 / §11 — the architecture decision: readiness is a derived projection,
  // orthogonal to APV-04's lifecycle.
  it('adds no member to the APV-04 lifecycle enum', () => {
    expect(Object.keys(ProtocolizationCaseState).sort()).toEqual(['Active', 'Cancelled', 'Draft']);
    for (const forbidden of ['Ready', 'Rejected', 'MoreEvidenceRequired', 'Protocolizing', 'Protocolized']) {
      expect(Object.keys(ProtocolizationCaseState)).not.toContain(forbidden);
    }
  });

  // §180 — both dimensions are representable at once, and they are independent.
  it('represents lifecycle and readiness as two independent dimensions', async () => {
    const context = createReadinessContext();

    const collecting = newDossier(context, { profile: READINESS_FULL_V1 });
    const activated = activateProtocolizationCase(context, collecting.protocolizationCase);
    collecting.protocolizationCase = activated.protocolizationCase;

    const early = evaluateProtocolizationReadiness(
      context,
      collecting.protocolizationCase,
      readinessInputs(collecting),
    );
    expect(early.caseState).toBe(ProtocolizationCaseState.Active);
    expect(early.state).toBe(ProtocolizationReadinessState.EvidencePending);

    const { context: readyContext, dossier } = await readyDossier();
    const promoted = activateProtocolizationCase(readyContext, dossier.protocolizationCase);
    const late = evaluateProtocolizationReadiness(readyContext, promoted.protocolizationCase, {
      ...readinessInputs(dossier),
      // The activation advanced the revision, so the checks must be current again.
      verificationResults: dossier.verificationResults,
    });
    expect(late.caseState).toBe(ProtocolizationCaseState.Active);
    expect(late.state).toBe(ProtocolizationReadinessState.VerificationPending);

    // ...and the same dossier at the revision its checks actually evaluated is Ready.
    const current = evaluateProtocolizationReadiness(
      readyContext,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(current.caseState).toBe(ProtocolizationCaseState.Draft);
    expect(current.state).toBe(ProtocolizationReadinessState.Ready);
  });

  // §79 / §80 / §108 — no execution vocabulary exists at all.
  it('declares no Protocolizing and no Protocolized readiness state', () => {
    expect(Object.keys(ProtocolizationReadinessState).sort()).toEqual([
      'Blocked',
      'EvidencePending',
      'Ineligible',
      'MoreEvidenceRequired',
      'Ready',
      'Rejected',
      'ReviewPending',
      'VerificationPending',
    ]);
    expect(isProtocolizationReadinessState('Protocolizing')).toBe(false);
    expect(isProtocolizationReadinessState('Protocolized')).toBe(false);
    expect(isProtocolizationReadinessState('Suspended')).toBe(false);
    expect(isProtocolizationReadinessState('Superseded')).toBe(false);
    expect(isProtocolizationReadinessState('Archived')).toBe(false);
    expect(isProtocolizationReadinessState('ProfileSelected')).toBe(false);
  });

  // §64 / §66 — precedence is an explicit table, and it is total over the
  // closed blocker vocabulary.
  it('derives every state from an explicit precedence table, never from enum order', () => {
    const covered = PROTOCOLIZATION_READINESS_STATE_PRECEDENCE.flatMap((entry) => [
      ...entry.reasonCodes,
    ]);
    expect([...PROTOCOLIZATION_READINESS_BLOCKER_CODE_LIST].sort()).toEqual([...covered].sort());
    expect(new Set(covered).size).toBe(covered.length);

    // Every blocker on its own derives exactly the state the table names.
    for (const entry of PROTOCOLIZATION_READINESS_STATE_PRECEDENCE) {
      for (const reasonCode of entry.reasonCodes) {
        expect(deriveProtocolizationReadinessState([{ reasonCode }])).toBe(entry.state);
      }
    }
    expect(deriveProtocolizationReadinessState([])).toBe(ProtocolizationReadinessState.Ready);
  });

  it('orders precedence exactly as documented', () => {
    expect(PROTOCOLIZATION_READINESS_STATE_PRECEDENCE.map((entry) => entry.state)).toEqual([
      ProtocolizationReadinessState.Ineligible,
      ProtocolizationReadinessState.Rejected,
      ProtocolizationReadinessState.Blocked,
      ProtocolizationReadinessState.MoreEvidenceRequired,
      ProtocolizationReadinessState.EvidencePending,
      ProtocolizationReadinessState.VerificationPending,
      ProtocolizationReadinessState.ReviewPending,
    ]);
  });

  // §65 — the winning state is a summary and never a redaction.
  it('keeps every blocker even when one state wins precedence', () => {
    const blockers = [
      { reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewMoreEvidenceRequired },
      { reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationUnavailable },
      { reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.conditionUnresolved },
    ];
    expect(deriveProtocolizationReadinessState(blockers)).toBe(
      ProtocolizationReadinessState.MoreEvidenceRequired,
    );
    // Derivation reads the list; it never shortens it.
    expect(blockers).toHaveLength(3);
  });

  // §127 ARCHITECTURE PROOF A — an empty case.
  it('reports a fresh case as not ready, with every required gap visible', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_FULL_V1 });
    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(evaluation.schemaVersion).toBe(PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION);
    expect(evaluation.ready).toBe(false);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.EvidencePending);
    expect(evaluation.evaluatedCaseRevision).toBe(dossier.protocolizationCase.revision);

    // Every requirement is assessed, including the optional one.
    expect(evaluation.requirementAssessments.map((assessment) => assessment.requirementId)).toEqual(
      READINESS_FULL_V1.requirements.map((requirement) => requirement.id),
    );

    for (const requirementId of [READINESS_DECLARATION, READINESS_EVIDENCE]) {
      expect(
        listProtocolizationReadinessBlockers(evaluation, {
          requirementId,
          reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialMissing,
        }),
      ).toHaveLength(1);
    }
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        requirementId: READINESS_VERIFICATION,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationMissing,
      }),
    ).toHaveLength(1);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        requirementId: READINESS_ATTESTATION,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationMissing,
      }),
    ).toHaveLength(1);

    // §148 — nothing executed, and no APV-10 artifact exists anywhere on the result.
    const serialized = JSON.stringify(evaluation);
    for (const forbidden of ['ProtocolizationResult', 'Protocolizing', 'Protocolized', 'anchor', 'token']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  // §147 ARCHITECTURE PROOF U + §61 / §183 — Ready explains itself.
  it('reaches Ready only through a complete, explainable assessment', async () => {
    const { dossier, context } = await readyDossier();
    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);
    expect(evaluation.ready).toBe(true);
    expect(evaluation.blockers).toEqual([]);

    for (const requirementId of [
      READINESS_IDENTITY,
      READINESS_DECLARATION,
      READINESS_EVIDENCE,
      READINESS_VERIFICATION,
      READINESS_ATTESTATION,
    ]) {
      const assessment = getProtocolizationRequirementAssessment(evaluation, requirementId);
      expect(assessment?.applicability).toBe(ProtocolizationRequirementApplicability.Applicable);
      expect([
        ProtocolizationRequirementStatus.Satisfied,
        ProtocolizationRequirementStatus.SatisfiedWithWarning,
      ]).toContain(assessment?.status);
      expect(assessment?.blockers).toEqual([]);
    }

    // §148 ARCHITECTURE PROOF V — Ready executes nothing.
    expect(dossier.protocolizationCase.state).toBe(ProtocolizationCaseState.Draft);
    expect(Object.keys(evaluation)).not.toContain('protocolizationResult');
    expect(Object.keys(evaluation)).not.toContain('executed');
  });

  // §60 / §121 — Ready coexists with warnings, and warnings are structurally
  // separate from blockers.
  it('reports Ready alongside warnings without inventing another state', async () => {
    const { dossier, context } = await readyDossier();
    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);
    expect(evaluation.warnings.length).toBeGreaterThan(0);
    expect(evaluation.blockers).toEqual([]);
    // The optional requirement is unmet, and it says so — non-fatally.
    expect(
      evaluation.warnings.some(
        (warning) =>
          warning.reasonCode === PROTOCOLIZATION_READINESS_WARNING_CODES.optionalUnsatisfied &&
          warning.requirementId === READINESS_OPTIONAL_EVIDENCE,
      ),
    ).toBe(true);
  });

  // §26 / §171 HARD TEST — MaterialPresent is not Satisfied.
  it('keeps APV-04 MaterialPresent structural and never renames it Satisfied', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_FULL_V1 });
    addDeclaration(context, dossier);
    addEvidence(context, dossier, {
      intakeId: 'intake-single',
      materialId: 'material-evidence-single',
      evidenceRef: 'aoc:evidence:single',
    });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    const evidence = getProtocolizationRequirementAssessment(evaluation, READINESS_EVIDENCE);
    // The case says material arrived...
    expect(evidence?.materialStatus).toBe(ProtocolizationRequirementMaterialStatus.MaterialPresent);
    // ...and readiness says one document does not meet a minimum of two.
    expect(evidence?.status).toBe(ProtocolizationRequirementStatus.Pending);

    const verification = getProtocolizationRequirementAssessment(evaluation, READINESS_VERIFICATION);
    const attestation = getProtocolizationRequirementAssessment(evaluation, READINESS_ATTESTATION);
    expect(verification?.status).toBe(ProtocolizationRequirementStatus.Pending);
    expect(attestation?.status).toBe(ProtocolizationRequirementStatus.Pending);
    expect(evaluation.ready).toBe(false);
  });

  // §151 ARCHITECTURE PROOF Y — a cancelled case is never ready.
  it('refuses readiness for a cancelled case however complete its dossier is', async () => {
    const { dossier, context } = await readyDossier();
    const cancelled = cancelProtocolizationCase(context, dossier.protocolizationCase, {
      reason: 'Test-only cancellation.',
    });

    const evaluation = evaluateProtocolizationReadiness(context, cancelled.protocolizationCase, {
      ...readinessInputs(dossier),
    });

    expect(evaluation.caseState).toBe(ProtocolizationCaseState.Cancelled);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ineligible);
    expect(evaluation.ready).toBe(false);
    expect(
      evaluation.blockers.some(
        (blocker) =>
          blocker.reasonCode === PROTOCOLIZATION_READINESS_BLOCKER_CODES.lifecycleCancelled,
      ),
    ).toBe(true);
    // The dossier's standing is still reported requirement by requirement.
    expect(evaluation.requirementAssessments.length).toBe(READINESS_FULL_V1.requirements.length);
  });

  // §122 — determinism, and §123 — the instant comes from the injected clock.
  it('is deterministic over the same inputs and stamps the injected clock', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_DECLARATION_V1 });

    const first = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    const second = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(second).toEqual(first);
    expect(first.evaluatedAt).toBe(context.clock.now());

    context.clock.advance(3600);
    const later = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(later.evaluatedAt).not.toBe(first.evaluatedAt);
    expect(later.state).toBe(first.state);
    expect(later.blockers).toEqual(first.blockers);
  });

  // §57 / §58 — no manual promotion and no override exists.
  it('exposes no way to command readiness', async () => {
    const facade: Record<string, unknown> = await import('@aoc/asset-protocolization');
    for (const forbidden of [
      'markReady',
      'forceReady',
      'approveReady',
      'setReady',
      'adminOverride',
      'waiveRequirement',
      'ignoreFailure',
      'ignoreUnavailable',
      'markRequirementSatisfied',
      'protocolizeCase',
      'finalizeProtocolization',
      'createInMemoryReadinessRepository',
    ]) {
      expect(facade[forbidden]).toBeUndefined();
    }
  });

  // §160 / §161 — a blocker is not an error, and an error is not a blocker.
  it('separates evaluation errors from readiness blockers', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_DECLARATION_V1 });

    // A required declaration that is missing is a successful evaluation.
    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(evaluation.blockers.length).toBeGreaterThan(0);

    // Another tenant asking the same question is an error.
    expect(() =>
      evaluateProtocolizationReadiness(
        createReadinessContext({ tenantId: TENANT_B, catalog: context.catalog }),
        dossier.protocolizationCase,
        readinessInputs(dossier),
      ),
    ).toThrow(
      expect.objectContaining({ code: PROTOCOLIZATION_READINESS_ERROR_CODES.tenantMismatch }),
    );
  });

  // AUDIT A + B — the two corrected classifications, asserted directly so a
  // future edit cannot quietly demote either back to a warning.
  it('classifies unestablished constraints and stale attestations as blockers', () => {
    const blockers: readonly string[] = PROTOCOLIZATION_READINESS_BLOCKER_CODE_LIST;
    const warnings: readonly string[] = PROTOCOLIZATION_READINESS_WARNING_CODE_LIST;

    expect(blockers).toContain('requirement.constraint.unevaluated');
    expect(blockers).toContain('attestation.currency.unresolved');
    expect(warnings).not.toContain('requirement.constraint.unevaluated');
    expect(warnings).not.toContain('attestation.currency.unresolved');

    // Delegation — a decision about where a check lives — stays a warning, and
    // is a different code from an inability to make one.
    expect(warnings).toContain('requirement.constraint.delegated');
    expect(blockers).not.toContain('requirement.constraint.delegated');

    expect(
      deriveProtocolizationReadinessState([
        { reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.constraintUnevaluated },
      ]),
    ).toBe(ProtocolizationReadinessState.EvidencePending);
    expect(
      deriveProtocolizationReadinessState([
        { reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationCurrencyUnresolved },
      ]),
    ).toBe(ProtocolizationReadinessState.ReviewPending);
  });

  it('declares a closed, dotted, machine-readable reason vocabulary', () => {
    const codes = [
      ...PROTOCOLIZATION_READINESS_BLOCKER_CODE_LIST,
      ...PROTOCOLIZATION_READINESS_WARNING_CODE_LIST,
    ];
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) {
      expect(code).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/);
    }
  });
});
