import { ClaimType, EvidenceType } from '@aoc/protocol/claims';

import {
  AssetRequirementKind,
  PROTOCOLIZATION_READINESS_BLOCKER_CODES,
  VerificationCheckOutcome,
  createAssetProfileCatalog,
  reconstituteProtocolizationVerificationResult,
  PROTOCOLIZATION_READINESS_WARNING_CODES,
  ProtocolizationMaterialKind,
  ProtocolizationReadinessState,
  ProtocolizationRequirementMaterialStatus,
  ProtocolizationRequirementApplicability,
  ProtocolizationRequirementStatus,
  evaluateProtocolizationReadiness,
  getProtocolizationRequirementAssessment,
  listProtocolizationReadinessBlockers,
  listProtocolizationReadinessWarnings,
} from '@aoc/asset-protocolization';

import {
  READINESS_CLAIM_ID,
  READINESS_CONDITIONAL_EVIDENCE,
  READINESS_CONDITIONAL_V1,
  READINESS_DECLARATION,
  READINESS_DECLARATION_COUNT_V1,
  READINESS_DECLARATION_V1,
  READINESS_EVIDENCE,
  READINESS_EXTERNAL_SUBJECT,
  READINESS_EXTERNAL_V1,
  READINESS_CONFORMING_REGISTRY_ENTRY,
  READINESS_FRESHNESS_CHECKED_V1,
  READINESS_FRESHNESS_CHECK_ID,
  READINESS_FRESHNESS_V1,
  READINESS_FULL_V1,
  READINESS_IDENTITY,
  READINESS_IDENTITY_FRESHNESS_V1,
  READINESS_NONCONFORMING_REGISTRY_ENTRY,
  READINESS_OPTIONAL_FRESHNESS_V1,
  READINESS_REGISTRY_V1,
  READINESS_SUBTYPE_V1,
  READINESS_NOT_REQUIRED_EVIDENCE,
  READINESS_NOT_REQUIRED_V1,
  READINESS_OPTIONAL_EVIDENCE,
  READINESS_OPTIONAL_V1,
  READINESS_VERIFICATION,
  READINESS_SECOND_CLAIM_ID,
  addDeclaration,
  addEvidence,
  addRawMaterial,
  createReadinessContext,
  newDossier,
  readinessEvidenceRecord,
  readinessInputs,
  runChecks,
} from './fixtures/test-readiness';

/**
 * Requirement-level readiness semantics: applicability, material, counts, and
 * the truth boundaries each requirement kind has to preserve.
 */
describe('APV-09 requirement semantics', () => {
  // §128 ARCHITECTURE PROOF B — evidence pending, then satisfied.
  it('clears an evidence blocker only when the declared minimum is actually met', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_FULL_V1 });

    const before = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(before.state).toBe(ProtocolizationReadinessState.EvidencePending);
    expect(
      listProtocolizationReadinessBlockers(before, { requirementId: READINESS_EVIDENCE }),
    ).toHaveLength(1);

    addEvidence(context, dossier, {
      intakeId: 'intake-a',
      materialId: 'material-evidence-a',
      evidenceRef: 'aoc:evidence:a',
    });
    const partial = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    // One document does not meet a minimum of two.
    expect(
      listProtocolizationReadinessBlockers(partial, {
        requirementId: READINESS_EVIDENCE,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialInsufficient,
      })[0],
    ).toMatchObject({ required: 2, observed: 1 });

    addEvidence(context, dossier, {
      intakeId: 'intake-b',
      materialId: 'material-evidence-b',
      evidenceRef: 'aoc:evidence:b',
    });
    const after = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(
      listProtocolizationReadinessBlockers(after, { requirementId: READINESS_EVIDENCE }),
    ).toEqual([]);
  });

  // §96 / §97 — the same evidence twice is one document.
  it('never counts one evidence reference twice toward a minimum', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_FULL_V1 });

    // APV-05 refuses a replayed canonical reference at intake, so the only way
    // to hold two associations naming one record is APV-04's own operation.
    addRawMaterial(context, dossier, {
      materialId: 'material-evidence-a',
      kind: ProtocolizationMaterialKind.Evidence,
      requirementIds: [READINESS_EVIDENCE],
      evidenceRef: 'aoc:evidence:same',
    });
    addRawMaterial(context, dossier, {
      materialId: 'material-evidence-b',
      kind: ProtocolizationMaterialKind.Evidence,
      requirementIds: [READINESS_EVIDENCE],
      evidenceRef: 'aoc:evidence:same',
    });

    // The record is supplied, so the accepted type is established and the only
    // thing left to observe is the count.
    const evaluation = evaluateProtocolizationReadiness(context, dossier.protocolizationCase, {
      ...readinessInputs(dossier),
      evidence: [readinessEvidenceRecord('aoc:evidence:same')],
    });
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        requirementId: READINESS_EVIDENCE,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialInsufficient,
      })[0],
    ).toMatchObject({ required: 2, observed: 1 });
  });

  // §129 ARCHITECTURE PROOF C — declaration satisfaction, and its boundary.
  it('satisfies a declaration requirement by presence without asserting the proposition', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_DECLARATION_V1 });

    const before = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(before.ready).toBe(false);

    addDeclaration(context, dossier);
    const after = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(after.state).toBe(ProtocolizationReadinessState.Ready);
    const assessment = getProtocolizationRequirementAssessment(after, READINESS_DECLARATION);
    expect(assessment?.status).toBe(ProtocolizationRequirementStatus.Satisfied);

    // The workflow requirement is satisfied. Nothing anywhere says the
    // proposition is true, that the declarant is an authority, or that the
    // claim was verified.
    const serialized = JSON.stringify(after);
    for (const forbidden of ['true', 'verified', 'proven', 'owner', 'authority']) {
      expect(serialized.toLowerCase()).not.toContain(`"${forbidden}"`);
    }
    expect(dossier.declarations[0]).not.toHaveProperty('verified');
    expect(dossier.declarations[0]).not.toHaveProperty('accepted');
  });

  // §98 — a replayed claim does not satisfy a minimum of two.
  it('never lets one claim reference satisfy a declaration minimum of two', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_DECLARATION_COUNT_V1 });

    addRawMaterial(context, dossier, {
      materialId: 'material-declaration-one',
      kind: ProtocolizationMaterialKind.Declaration,
      requirementIds: [READINESS_DECLARATION],
      claimRef: READINESS_CLAIM_ID,
    });
    addRawMaterial(context, dossier, {
      materialId: 'material-declaration-two',
      kind: ProtocolizationMaterialKind.Declaration,
      requirementIds: [READINESS_DECLARATION],
      claimRef: READINESS_CLAIM_ID,
    });

    const replayed = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(
      listProtocolizationReadinessBlockers(replayed, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialInsufficient,
      })[0],
    ).toMatchObject({ required: 2, observed: 1 });

    addRawMaterial(context, dossier, {
      materialId: 'material-declaration-three',
      kind: ProtocolizationMaterialKind.Declaration,
      requirementIds: [READINESS_DECLARATION],
      claimRef: READINESS_SECOND_CLAIM_ID,
    });
    const distinct = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(distinct.state).toBe(ProtocolizationReadinessState.Ready);
  });

  // §100 — kind compatibility remains hard.
  it('never lets material of one kind answer a requirement of another', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_FULL_V1 });

    // A declaration correlated to the declaration requirement contributes
    // nothing whatsoever to the evidence requirement's count.
    addDeclaration(context, dossier);
    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(
      getProtocolizationRequirementAssessment(evaluation, READINESS_DECLARATION)?.status,
    ).toBe(ProtocolizationRequirementStatus.Satisfied);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        requirementId: READINESS_EVIDENCE,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialMissing,
      }),
    ).toHaveLength(1);
  });

  // §143 ARCHITECTURE PROOF Q / §176 — optional absence never blocks.
  it('never blocks Ready on an unsatisfied Optional requirement', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_OPTIONAL_V1 });
    addDeclaration(context, dossier);

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);
    expect(evaluation.blockers).toEqual([]);

    const optional = getProtocolizationRequirementAssessment(evaluation, READINESS_OPTIONAL_EVIDENCE);
    expect(optional?.applicability).toBe(ProtocolizationRequirementApplicability.Applicable);
    expect(optional?.status).toBe(ProtocolizationRequirementStatus.Pending);
    // Its findings are reported — as warnings, and never as blockers.
    expect(optional?.blockers).toEqual([]);
    expect(
      optional?.warnings.some(
        (warning) =>
          warning.reasonCode === PROTOCOLIZATION_READINESS_WARNING_CODES.optionalUnsatisfied,
      ),
    ).toBe(true);
    expect(
      optional?.warnings.some(
        (warning) =>
          warning.reasonCode === PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialMissing,
      ),
    ).toBe(true);
  });

  // §144 ARCHITECTURE PROOF R / §177 — an unresolved conditional blocks.
  it('blocks Ready on a Conditional requirement whose applicability nobody resolved', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_CONDITIONAL_V1 });
    addDeclaration(context, dossier);

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(evaluation.ready).toBe(false);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.EvidencePending);

    const conditional = getProtocolizationRequirementAssessment(
      evaluation,
      READINESS_CONDITIONAL_EVIDENCE,
    );
    expect(conditional?.applicability).toBe(ProtocolizationRequirementApplicability.Unresolved);
    expect(conditional?.status).toBe(ProtocolizationRequirementStatus.Pending);
    expect(conditional?.blockers).toEqual([
      {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.conditionUnresolved,
        requirementId: READINESS_CONDITIONAL_EVIDENCE,
      },
    ]);

    // It never silently disappears — it is present in the top-level blockers too.
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.conditionUnresolved,
      }),
    ).toHaveLength(1);
  });

  // §145 ARCHITECTURE PROOF S — a mechanically resolved NotApplicable does not block.
  it('never blocks Ready on a requirement the profile states is NotRequired', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_NOT_REQUIRED_V1 });
    addDeclaration(context, dossier);

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);
    const notRequired = getProtocolizationRequirementAssessment(
      evaluation,
      READINESS_NOT_REQUIRED_EVIDENCE,
    );
    expect(notRequired?.applicability).toBe(ProtocolizationRequirementApplicability.NotApplicable);
    expect(notRequired?.status).toBe(ProtocolizationRequirementStatus.NotApplicable);
    expect(notRequired?.blockers).toEqual([]);
    expect(notRequired?.warnings).toEqual([]);
  });

  // §27 — identity is answered by identifying material, and never by assumption.
  it('answers an identity requirement from the strategies the profile accepts', () => {
    const context = createReadinessContext();

    // A subject that carries bytes evidences ContentIdentity through the case's
    // own binding, exactly as APV-07's identity check reads it.
    const withBytes = newDossier(context, { profile: READINESS_FULL_V1 });
    const bound = evaluateProtocolizationReadiness(
      context,
      withBytes.protocolizationCase,
      readinessInputs(withBytes),
    );
    expect(getProtocolizationRequirementAssessment(bound, READINESS_IDENTITY)?.status).toBe(
      ProtocolizationRequirementStatus.Satisfied,
    );

    // §154 — the same engine, a subject named only in an external namespace.
    const external = newDossier(context, {
      caseId: 'case-readiness-external',
      profile: READINESS_EXTERNAL_V1,
      subject: READINESS_EXTERNAL_SUBJECT,
    });
    const outside = evaluateProtocolizationReadiness(
      context,
      external.protocolizationCase,
      readinessInputs(external),
    );
    expect(getProtocolizationRequirementAssessment(outside, READINESS_IDENTITY)?.status).toBe(
      ProtocolizationRequirementStatus.Satisfied,
    );
  });

  // §153 / §154 — one engine, two fundamentally different subjects, no branching.
  it('drives both subject shapes to Ready through the same evaluator', async () => {
    const context = createReadinessContext();

    const external = newDossier(context, {
      caseId: 'case-readiness-external-ready',
      profile: READINESS_EXTERNAL_V1,
      subject: READINESS_EXTERNAL_SUBJECT,
    });
    addDeclaration(context, external);
    await runChecks(context, external);

    const evaluation = evaluateProtocolizationReadiness(
      context,
      external.protocolizationCase,
      readinessInputs(external),
    );
    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);
    // Nothing about the answer names a category, a jurisdiction or a profile id
    // other than the pin the case itself carries.
    expect(evaluation.profile.profileId).toBe(READINESS_EXTERNAL_V1.profileId);
  });

  // AUDIT A / §29 — an unestablished normative constraint is a blocker, and a
  // delegated one is a warning. The two are never the same thing.
  it('blocks a Required evidence requirement whose acceptedTypes nothing establishes', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_FULL_V1 });

    // Two references, admitted by reference only, so no Protocol record reaches
    // the evaluation and nothing can establish the accepted type.
    addEvidence(context, dossier, {
      intakeId: 'intake-a',
      materialId: 'material-evidence-a',
      evidenceRef: 'aoc:evidence:a',
      withRecord: false,
    });
    addEvidence(context, dossier, {
      intakeId: 'intake-b',
      materialId: 'material-evidence-b',
      evidenceRef: 'aoc:evidence:b',
      withRecord: false,
    });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    // The count is met, and that is emphatically not satisfaction.
    const assessment = getProtocolizationRequirementAssessment(evaluation, READINESS_EVIDENCE);
    expect(assessment?.materialStatus).toBe(ProtocolizationRequirementMaterialStatus.MaterialPresent);
    expect(assessment?.status).toBe(ProtocolizationRequirementStatus.Pending);
    expect(evaluation.ready).toBe(false);

    const unevaluated = listProtocolizationReadinessBlockers(evaluation, {
      requirementId: READINESS_EVIDENCE,
      reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.constraintUnevaluated,
    });
    expect(unevaluated).toHaveLength(1);
    expect(unevaluated[0]?.constraint).toBe('acceptedTypes');
    expect(unevaluated[0]?.evidenceRefs).toEqual(['aoc:evidence:a', 'aoc:evidence:b']);

    // It is a blocker, so it never appears among the warnings.
    expect(
      listProtocolizationReadinessWarnings(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.constraintUnevaluated,
      }),
    ).toEqual([]);
  });

  // AUDIT A — supplying the Protocol record establishes the constraint.
  it('satisfies a Required evidence requirement once the accepted type is established', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_FULL_V1 });
    addEvidence(context, dossier, {
      intakeId: 'intake-a',
      materialId: 'material-evidence-a',
      evidenceRef: 'aoc:evidence:a',
      type: EvidenceType.Document,
    });
    addEvidence(context, dossier, {
      intakeId: 'intake-b',
      materialId: 'material-evidence-b',
      evidenceRef: 'aoc:evidence:b',
      type: EvidenceType.Certification,
    });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(
      listProtocolizationReadinessBlockers(evaluation, { requirementId: READINESS_EVIDENCE }),
    ).toEqual([]);
    expect(getProtocolizationRequirementAssessment(evaluation, READINESS_EVIDENCE)?.status).toBe(
      ProtocolizationRequirementStatus.Satisfied,
    );
  });

  // AUDIT A — a known-incompatible type never satisfies.
  it('never satisfies an evidence requirement from a type the profile does not accept', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_FULL_V1 });
    addEvidence(context, dossier, {
      intakeId: 'intake-a',
      materialId: 'material-evidence-a',
      evidenceRef: 'aoc:evidence:a',
      type: EvidenceType.Document,
    });
    addEvidence(context, dossier, {
      intakeId: 'intake-b',
      materialId: 'material-evidence-b',
      evidenceRef: 'aoc:evidence:b',
      // The fixture requirement accepts Document and Certification only.
      type: EvidenceType.Attestation,
    });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    const incompatible = listProtocolizationReadinessBlockers(evaluation, {
      requirementId: READINESS_EVIDENCE,
      reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialIncompatible,
    });
    expect(incompatible).toHaveLength(1);
    expect(incompatible[0]?.constraint).toBe('acceptedTypes');
    expect(incompatible[0]?.evidenceRefs).toEqual(['aoc:evidence:b']);

    // One qualifying reference against a minimum of two.
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        requirementId: READINESS_EVIDENCE,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialInsufficient,
      })[0],
    ).toMatchObject({ required: 2, observed: 1 });
    expect(evaluation.ready).toBe(false);
  });

  // AUDIT A / §D.4 — an Optional requirement's unestablished constraint stays a
  // warning and blocks nothing.
  it('never blocks Ready on an Optional requirement whose constraint is unestablished', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_OPTIONAL_V1 });
    addDeclaration(context, dossier);
    addEvidence(context, dossier, {
      intakeId: 'intake-optional',
      materialId: 'material-evidence-optional',
      evidenceRef: 'aoc:evidence:optional',
      requirementIds: [READINESS_OPTIONAL_EVIDENCE],
      withRecord: false,
    });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);
    expect(evaluation.blockers).toEqual([]);
    expect(
      listProtocolizationReadinessWarnings(evaluation, {
        requirementId: READINESS_OPTIONAL_EVIDENCE,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.constraintUnevaluated,
      }),
    ).toHaveLength(1);
  });

  // AUDIT C.1 — a delegation made to nobody is not a discharge.
  it('blocks a Required evidence freshness constraint no declared check evaluates', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_FRESHNESS_V1,
      caseId: 'case-freshness-undeclared',
    });
    addEvidence(context, dossier, {
      intakeId: 'intake-fresh',
      materialId: 'material-evidence-fresh',
      evidenceRef: 'aoc:evidence:fresh',
      observedAt: context.clock.now(),
    });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    // A registered built-in exists in this package's library. That establishes
    // nothing: this profile declares no verification requirement demanding it.
    expect(
      READINESS_FRESHNESS_V1.requirements.some((r) => r.kind === AssetRequirementKind.Verification),
    ).toBe(false);
    expect(evaluation.ready).toBe(false);
    const unevaluated = listProtocolizationReadinessBlockers(evaluation, {
      requirementId: READINESS_EVIDENCE,
      reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.constraintUnevaluated,
    });
    expect(unevaluated).toHaveLength(1);
    expect(unevaluated[0]?.constraint).toBe('freshness');
    // And it is emphatically not reported as a discharged delegation.
    expect(
      listProtocolizationReadinessWarnings(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_WARNING_CODES.constraintDelegated,
      }),
    ).toEqual([]);
  });

  // AUDIT C.2 — declared but never executed.
  it('blocks a Required evidence freshness whose declared check has never run', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_FRESHNESS_CHECKED_V1,
      caseId: 'case-freshness-unrun',
    });
    addEvidence(context, dossier, {
      intakeId: 'intake-fresh',
      materialId: 'material-evidence-fresh',
      evidenceRef: 'aoc:evidence:fresh',
      observedAt: context.clock.now(),
    });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(evaluation.ready).toBe(false);
    const missing = listProtocolizationReadinessBlockers(evaluation, {
      requirementId: READINESS_EVIDENCE,
      reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationMissing,
    });
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      checkId: READINESS_FRESHNESS_CHECK_ID,
      constraint: 'freshness',
    });
  });

  // AUDIT C.4 — a current Pass discharges the obligation, and says which
  // execution did it.
  it('discharges a Required evidence freshness from a current Pass', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_FRESHNESS_CHECKED_V1,
      caseId: 'case-freshness-pass',
    });
    addEvidence(context, dossier, {
      intakeId: 'intake-fresh',
      materialId: 'material-evidence-fresh',
      evidenceRef: 'aoc:evidence:fresh',
      observedAt: context.clock.now(),
    });
    await runChecks(context, dossier);

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);
    expect(getProtocolizationRequirementAssessment(evaluation, READINESS_EVIDENCE)?.status).toBe(
      ProtocolizationRequirementStatus.Satisfied,
    );
    const delegated = listProtocolizationReadinessWarnings(evaluation, {
      requirementId: READINESS_EVIDENCE,
      reasonCode: PROTOCOLIZATION_READINESS_WARNING_CODES.constraintDelegated,
    });
    expect(delegated).toHaveLength(1);
    expect(delegated[0]).toMatchObject({
      constraint: 'freshness',
      checkId: READINESS_FRESHNESS_CHECK_ID,
    });
    expect(delegated[0]?.executionIds?.length).toBe(1);
  });

  // AUDIT C.3 — a Pass that evaluated an earlier revision does not discharge.
  it('blocks a Required evidence freshness whose discharging Pass is stale', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_FRESHNESS_CHECKED_V1,
      caseId: 'case-freshness-stale',
    });
    addEvidence(context, dossier, {
      intakeId: 'intake-fresh',
      materialId: 'material-evidence-fresh',
      evidenceRef: 'aoc:evidence:fresh',
      observedAt: context.clock.now(),
    });
    await runChecks(context, dossier);
    expect(
      evaluateProtocolizationReadiness(context, dossier.protocolizationCase, readinessInputs(dossier))
        .state,
    ).toBe(ProtocolizationReadinessState.Ready);

    // The case moves on; the discharging result stops describing it.
    addEvidence(context, dossier, {
      intakeId: 'intake-fresh-2',
      materialId: 'material-evidence-fresh-2',
      evidenceRef: 'aoc:evidence:fresh-2',
      observedAt: context.clock.now(),
    });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(evaluation.ready).toBe(false);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        requirementId: READINESS_EVIDENCE,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationStale,
      })[0],
    ).toMatchObject({ checkId: READINESS_FRESHNESS_CHECK_ID, constraint: 'freshness' });
  });

  // AUDIT C.6 — a stale observation makes the built-in Fail, and that blocks.
  it('blocks a Required evidence freshness on a current Fail', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_FRESHNESS_CHECKED_V1,
      caseId: 'case-freshness-fail',
    });
    addEvidence(context, dossier, {
      intakeId: 'intake-fresh',
      materialId: 'material-evidence-fresh',
      evidenceRef: 'aoc:evidence:fresh',
      // Observed well outside the profile's declared window.
      observedAt: '2020-01-01T00:00:00.000Z',
    });
    await runChecks(context, dossier);

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(evaluation.ready).toBe(false);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        requirementId: READINESS_EVIDENCE,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationFail,
      })[0],
    ).toMatchObject({ checkId: READINESS_FRESHNESS_CHECK_ID, constraint: 'freshness' });
  });

  // AUDIT C.7 — no observation instant makes the built-in Unavailable.
  it('blocks a Required evidence freshness on a current Unavailable', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_FRESHNESS_CHECKED_V1,
      caseId: 'case-freshness-unavailable',
    });
    // No observedAt: APV-05 preserved its absence, and the check declines to
    // assume an instant.
    addEvidence(context, dossier, {
      intakeId: 'intake-fresh',
      materialId: 'material-evidence-fresh',
      evidenceRef: 'aoc:evidence:fresh',
    });
    await runChecks(context, dossier);

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(evaluation.ready).toBe(false);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        requirementId: READINESS_EVIDENCE,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationUnavailable,
      })[0],
    ).toMatchObject({ checkId: READINESS_FRESHNESS_CHECK_ID, constraint: 'freshness' });
    // Unavailable is still never reported as a Fail.
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationFail,
      }),
    ).toEqual([]);
  });

  // AUDIT C.5 — APV-07's Warning semantics are preserved exactly.
  it('discharges a Required evidence freshness on a current Warning, preserving it', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_FRESHNESS_CHECKED_V1,
      caseId: 'case-freshness-warning',
    });
    // A future-dated observation: arithmetically fresh, and meaningless. APV-07
    // reports Warning rather than calling it a failure.
    addEvidence(context, dossier, {
      intakeId: 'intake-fresh',
      materialId: 'material-evidence-fresh',
      evidenceRef: 'aoc:evidence:fresh',
      observedAt: '2099-01-01T00:00:00.000Z',
    });
    await runChecks(context, dossier);

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);
    expect(evaluation.blockers).toEqual([]);
    // The warning is preserved and never rewritten as a Pass.
    expect(
      listProtocolizationReadinessWarnings(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_WARNING_CODES.verificationWarning,
      }).length,
    ).toBeGreaterThan(0);
    expect(
      getProtocolizationRequirementAssessment(evaluation, READINESS_VERIFICATION)?.status,
    ).toBe(ProtocolizationRequirementStatus.SatisfiedWithWarning);
  });

  // AUDIT C.8 — a ManualReview result does not discharge the obligation.
  it('blocks a Required evidence freshness on a current ManualReview', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_FRESHNESS_CHECKED_V1,
      caseId: 'case-freshness-manual',
    });
    addEvidence(context, dossier, {
      intakeId: 'intake-fresh',
      materialId: 'material-evidence-fresh',
      evidenceRef: 'aoc:evidence:fresh',
      observedAt: context.clock.now(),
    });
    await runChecks(context, dossier);

    // The same execution, reconstituted with the outcome a check would emit
    // when it defers judgement — through APV-07's own reconstitution path.
    const deferred = dossier.verificationResults.map((result) =>
      reconstituteProtocolizationVerificationResult({
        ...result,
        outcome: VerificationCheckOutcome.ManualReview,
      }),
    );

    const evaluation = evaluateProtocolizationReadiness(context, dossier.protocolizationCase, {
      ...readinessInputs(dossier),
      verificationResults: deferred,
    });

    expect(evaluation.ready).toBe(false);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.ReviewPending);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        requirementId: READINESS_EVIDENCE,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationManualReview,
      })[0],
    ).toMatchObject({ checkId: READINESS_FRESHNESS_CHECK_ID, constraint: 'freshness' });
  });

  // AUDIT C.9 — Optional undischarged freshness is a warning only.
  it('never blocks Ready on an Optional requirement whose freshness is undischarged', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_OPTIONAL_FRESHNESS_V1,
      caseId: 'case-freshness-optional',
    });
    addDeclaration(context, dossier);
    addEvidence(context, dossier, {
      intakeId: 'intake-fresh',
      materialId: 'material-evidence-fresh',
      evidenceRef: 'aoc:evidence:fresh',
      observedAt: context.clock.now(),
    });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);
    expect(evaluation.blockers).toEqual([]);
    expect(
      listProtocolizationReadinessWarnings(evaluation, {
        requirementId: READINESS_EVIDENCE,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.constraintUnevaluated,
      })[0]?.constraint,
    ).toBe('freshness');
  });

  // AUDIT C.10 — a requirement kind with no legitimate evaluator is never
  // silently considered discharged.
  it('blocks a Required identity freshness, for which no evaluator exists', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, {
      profile: READINESS_IDENTITY_FRESHNESS_V1,
      caseId: 'case-identity-freshness',
    });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    // The identity strategy itself is evidenced by the subject's own binding...
    expect(evaluation.ready).toBe(false);
    const unevaluated = listProtocolizationReadinessBlockers(evaluation, {
      requirementId: READINESS_IDENTITY,
      reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.constraintUnevaluated,
    });
    // ...and its freshness constraint has no evaluator anywhere, so it blocks.
    expect(unevaluated).toHaveLength(1);
    expect(unevaluated[0]?.constraint).toBe('freshness');
    expect(
      listProtocolizationReadinessWarnings(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_WARNING_CODES.constraintDelegated,
      }),
    ).toEqual([]);
  });

  // §A.6 — a registry constraint is evaluated here, from the record itself.
  it('evaluates an evidence registry constraint from the Protocol record', () => {
    const context = createReadinessContext({
      catalog: createAssetProfileCatalog([READINESS_REGISTRY_V1]),
    });

    const conforming = newDossier(context, {
      profile: READINESS_REGISTRY_V1,
      caseId: 'case-registry-ok',
    });
    addEvidence(context, conforming, {
      intakeId: 'intake-registry-ok',
      materialId: 'material-registry-ok',
      evidenceRef: 'aoc:evidence:registry-ok',
      registryRefs: [READINESS_CONFORMING_REGISTRY_ENTRY],
    });
    expect(
      evaluateProtocolizationReadiness(
        context,
        conforming.protocolizationCase,
        readinessInputs(conforming),
      ).state,
    ).toBe(ProtocolizationReadinessState.Ready);

    const wrongRegistry = newDossier(context, {
      profile: READINESS_REGISTRY_V1,
      caseId: 'case-registry-bad',
    });
    addEvidence(context, wrongRegistry, {
      intakeId: 'intake-registry-bad',
      materialId: 'material-registry-bad',
      evidenceRef: 'aoc:evidence:registry-bad',
      registryRefs: [READINESS_NONCONFORMING_REGISTRY_ENTRY],
    });
    const rejected = evaluateProtocolizationReadiness(
      context,
      wrongRegistry.protocolizationCase,
      readinessInputs(wrongRegistry),
    );
    expect(rejected.ready).toBe(false);
    expect(
      listProtocolizationReadinessBlockers(rejected, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialIncompatible,
      })[0]?.constraint,
    ).toBe('registry');
  });

  // §A.6 — acceptedSubtypes is the one evidence constraint nothing can establish.
  it('blocks a Required evidence requirement declaring an unestablishable subtype', () => {
    const context = createReadinessContext({
      catalog: createAssetProfileCatalog([READINESS_SUBTYPE_V1]),
    });
    const dossier = newDossier(context, {
      profile: READINESS_SUBTYPE_V1,
      caseId: 'case-readiness-subtype',
    });
    addEvidence(context, dossier, {
      intakeId: 'intake-subtype',
      materialId: 'material-evidence-subtype',
      evidenceRef: 'aoc:evidence:subtype',
    });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    const unevaluated = listProtocolizationReadinessBlockers(evaluation, {
      reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.constraintUnevaluated,
    });
    expect(unevaluated).toHaveLength(1);
    expect(unevaluated[0]?.constraint).toBe('acceptedSubtypes');
    expect(evaluation.ready).toBe(false);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.EvidencePending);
  });

  // §28 / §100 — a declaration whose claim type disagrees with the requirement
  // is excluded, whatever it is associated to.
  it('excludes a declaration record whose claim type the requirement does not name', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_DECLARATION_V1 });
    addDeclaration(context, dossier);

    const tampered = {
      ...readinessInputs(dossier),
      declarations: dossier.declarations.map((record) => ({
        ...record,
        claimType: ClaimType.Certification,
      })),
    };

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      tampered,
    );
    expect(evaluation.ready).toBe(false);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialIncompatible,
      }),
    ).toHaveLength(1);
  });
});
