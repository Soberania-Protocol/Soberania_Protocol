import {
  PROTOCOLIZATION_READINESS_BLOCKER_CODES,
  ProtocolizationReadinessState,
  ProtocolizationRequirementStatus,
  evaluateProtocolizationReadiness,
  getProtocolizationRequirementAssessment,
  createAssetProfileCatalog,
  isProtocolizationReadinessCurrentForCase,
  listProtocolizationReadinessBlockers,
  listProtocolizationReadinessWarnings,
} from '@aoc/asset-protocolization';

import {
  READINESS_ATTESTATION,
  READINESS_ATTESTATION_V1,
  READINESS_DECLARATION_V1,
  READINESS_FULL_V1,
  READINESS_FULL_V2,
  READINESS_OPTIONAL_ATTESTATION_V1,
  READINESS_SECOND_CLAIM_ID,
  addDeclaration,
  addEvidence,
  createReadinessContext,
  newDossier,
  readinessInputs,
  review,
  runChecks,
} from './fixtures/test-readiness';

/**
 * Revision and version binding — the two pins that make a readiness answer mean
 * something a downstream slice can rely on.
 */
describe('APV-09 revision and profile-version binding', () => {
  // §17 / §82 / §149 ARCHITECTURE PROOF W / §179 HARD TEST.
  it('binds every evaluation to the exact revision it assessed', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_DECLARATION_V1 });
    addDeclaration(context, dossier);

    const atN = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(atN.state).toBe(ProtocolizationReadinessState.Ready);
    expect(atN.evaluatedCaseRevision).toBe(dossier.protocolizationCase.revision);
    expect(isProtocolizationReadinessCurrentForCase(atN, dossier.protocolizationCase)).toBe(true);

    // The case moves on.
    addDeclaration(context, dossier, {
      declarationId: 'declaration-later',
      materialId: 'material-declaration-later',
      claimRef: READINESS_SECOND_CLAIM_ID,
    });

    // The old result still says revision N, and it cannot represent N+1.
    expect(atN.evaluatedCaseRevision).toBeLessThan(dossier.protocolizationCase.revision);
    expect(isProtocolizationReadinessCurrentForCase(atN, dossier.protocolizationCase)).toBe(false);

    const atNPlus = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(isProtocolizationReadinessCurrentForCase(atNPlus, dossier.protocolizationCase)).toBe(true);
  });

  // §82 — the TOCTOU guard compares tenant, case, pin and revision.
  it('refuses to call a readiness result current for another case, tenant or pin', () => {
    const context = createReadinessContext();
    const first = newDossier(context, { profile: READINESS_DECLARATION_V1, caseId: 'case-one' });
    const second = newDossier(context, { profile: READINESS_DECLARATION_V1, caseId: 'case-two' });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      first.protocolizationCase,
      readinessInputs(first),
    );

    expect(isProtocolizationReadinessCurrentForCase(evaluation, second.protocolizationCase)).toBe(
      false,
    );
    expect(
      isProtocolizationReadinessCurrentForCase(evaluation, {
        ...first.protocolizationCase,
        tenantId: 'tenant-other',
      }),
    ).toBe(false);
    expect(
      isProtocolizationReadinessCurrentForCase(evaluation, {
        ...first.protocolizationCase,
        profile: { profileId: READINESS_FULL_V1.profileId, profileVersion: '1.0.0' },
      }),
    ).toBe(false);
  });

  // §152 ARCHITECTURE PROOF Z / §16 — the exact pinned profile version governs.
  it('evaluates a v1-pinned case under v1 while v2 sits beside it demanding more', () => {
    const context = createReadinessContext();

    const pinnedV1 = newDossier(context, {
      profile: READINESS_FULL_V1,
      profileVersion: '1.0.0',
      caseId: 'case-pinned-v1',
    });
    const pinnedV2 = newDossier(context, {
      profile: READINESS_FULL_V1,
      profileVersion: '2.0.0',
      caseId: 'case-pinned-v2',
    });

    const underV1 = evaluateProtocolizationReadiness(
      context,
      pinnedV1.protocolizationCase,
      readinessInputs(pinnedV1),
    );
    const underV2 = evaluateProtocolizationReadiness(
      context,
      pinnedV2.protocolizationCase,
      readinessInputs(pinnedV2),
    );

    expect(underV1.profile.profileVersion).toBe('1.0.0');
    expect(underV2.profile.profileVersion).toBe('2.0.0');
    expect(underV1.requirementAssessments).toHaveLength(READINESS_FULL_V1.requirements.length);
    expect(underV2.requirementAssessments).toHaveLength(READINESS_FULL_V2.requirements.length);

    // v2's extra requirement affects only the v2-pinned case.
    const extra = 'evidence.additional.required';
    expect(listProtocolizationReadinessBlockers(underV1, { requirementId: extra })).toEqual([]);
    expect(
      listProtocolizationReadinessBlockers(underV2, { requirementId: extra }).length,
    ).toBeGreaterThan(0);
  });

  // §124 / §150 ARCHITECTURE PROOF X — readiness is not monotonic.
  it('lets Ready regress when the basis of a requirement stops holding', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_FULL_V1 });
    addDeclaration(context, dossier);
    addEvidence(context, dossier, {
      intakeId: 'intake-a',
      materialId: 'material-evidence-a',
      evidenceRef: 'aoc:evidence:a',
    });
    addEvidence(context, dossier, {
      intakeId: 'intake-b',
      materialId: 'material-evidence-b',
      evidenceRef: 'aoc:evidence:b',
    });
    await review(context, dossier, { withArtifact: true });
    await runChecks(context, dossier);

    const ready = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(ready.state).toBe(ProtocolizationReadinessState.Ready);

    // New evidence arrives. The checks that passed no longer describe the case.
    addEvidence(context, dossier, {
      intakeId: 'intake-c',
      materialId: 'material-evidence-c',
      evidenceRef: 'aoc:evidence:c',
    });
    const regressed = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    // Two independent requirements regressed at once: the checks no longer
    // describe the case, and the attestation no longer covers it. Precedence
    // names the earliest unfinished stage, and both blockers survive.
    expect(regressed.state).toBe(ProtocolizationReadinessState.VerificationPending);
    expect(regressed.ready).toBe(false);
    expect(
      listProtocolizationReadinessBlockers(regressed, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationStale,
      }),
    ).toHaveLength(1);
    expect(
      listProtocolizationReadinessBlockers(regressed, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationCurrencyUnresolved,
      }),
    ).toHaveLength(1);

    // §125 — the earlier Ready result is untouched and stays exactly what it was.
    expect(ready.state).toBe(ProtocolizationReadinessState.Ready);
    expect(ready.blockers).toEqual([]);
    expect(ready.evaluatedCaseRevision).toBeLessThan(regressed.evaluatedCaseRevision);

    // §126 — re-verifying clears the verification blocker and leaves the
    // professional one, which is the honest remaining question.
    await runChecks(context, dossier, { idPrefix: 'execution-recovered' });
    const reverified = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(reverified.state).toBe(ProtocolizationReadinessState.ReviewPending);
    expect(
      listProtocolizationReadinessBlockers(reverified, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationStale,
      }),
    ).toEqual([]);

    // ...and a further review on the newer basis recovers readiness completely.
    await review(context, dossier, {
      requestId: 'review-request-recovered',
      decisionId: 'review-decision-recovered',
      attestationId: 'aoc:attestation:readiness-recovered',
      materialId: 'material-attestation-recovered',
      withArtifact: true,
    });
    await runChecks(context, dossier, { idPrefix: 'execution-final' });
    const recovered = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(recovered.state).toBe(ProtocolizationReadinessState.Ready);
  });

  // AUDIT B / §54 — a stale attestation does not authorize a current Ready.
  it('refuses Ready when a required attestation no longer covers the current revision', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_ATTESTATION_V1 });
    addDeclaration(context, dossier);
    await review(context, dossier, { withArtifact: true });

    const atAttestation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    // The revision the attestation itself produced is covered, so it is current.
    expect(atAttestation.state).toBe(ProtocolizationReadinessState.Ready);
    expect(
      listProtocolizationReadinessBlockers(atAttestation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationCurrencyUnresolved,
      }),
    ).toEqual([]);
    const covered = dossier.reviewDecisions[0]?.resultingCaseRevision;
    const historicalAttestation = JSON.stringify(dossier.attestations[0]);
    const historicalDecision = JSON.stringify(dossier.reviewDecisions[0]);

    // Material the reviewer never saw arrives.
    addDeclaration(context, dossier, {
      declarationId: 'declaration-after-attestation',
      materialId: 'material-declaration-after',
      claimRef: READINESS_SECOND_CLAIM_ID,
    });

    const later = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    // Not ready, and the reason is review work rather than a warning.
    expect(later.ready).toBe(false);
    expect(later.state).toBe(ProtocolizationReadinessState.ReviewPending);
    const currency = listProtocolizationReadinessBlockers(later, {
      requirementId: READINESS_ATTESTATION,
      reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationCurrencyUnresolved,
    });
    expect(currency).toHaveLength(1);
    expect(currency[0]?.atCaseRevision).toBe(covered);
    expect(currency[0]?.attestationRefs).toEqual([dossier.attestations[0]?.id]);
    expect(getProtocolizationRequirementAssessment(later, READINESS_ATTESTATION)?.status).toBe(
      ProtocolizationRequirementStatus.Pending,
    );

    // It never appears as a warning any more.
    expect(
      listProtocolizationReadinessWarnings(later, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationCurrencyUnresolved,
      }),
    ).toEqual([]);

    // §D.7 — the historical artifact and decision are untouched.
    expect(JSON.stringify(dossier.attestations[0])).toBe(historicalAttestation);
    expect(JSON.stringify(dossier.reviewDecisions[0])).toBe(historicalDecision);
    expect(dossier.protocolizationCase.materials.some((m) => m.kind === 'Attestation')).toBe(true);
    expect(JSON.stringify(later)).not.toContain('invalid');
    expect(JSON.stringify(later)).not.toContain('revoked');

    // §D.8 — a new legitimate review on the newer basis clears it.
    await review(context, dossier, {
      requirementId: READINESS_ATTESTATION,
      requestId: 'review-request-refresh',
      decisionId: 'review-decision-refresh',
      attestationId: 'aoc:attestation:readiness-refresh',
      materialId: 'material-attestation-refresh',
      claimRef: READINESS_SECOND_CLAIM_ID,
      withArtifact: true,
    });

    const refreshed = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(refreshed.state).toBe(ProtocolizationReadinessState.Ready);
    expect(
      listProtocolizationReadinessBlockers(refreshed, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationCurrencyUnresolved,
      }),
    ).toEqual([]);
    // Both attestations remain on the record; only the current one satisfies.
    expect(dossier.attestations).toHaveLength(2);
    expect(
      getProtocolizationRequirementAssessment(refreshed, READINESS_ATTESTATION)?.attestationRefs,
    ).toEqual(['aoc:attestation:readiness-refresh']);
  });

  // §D.9 — an Optional attestation's unresolved currency is a warning only.
  it('never blocks Ready on an Optional attestation whose currency is unresolved', async () => {
    const context = createReadinessContext({
      catalog: createAssetProfileCatalog([READINESS_OPTIONAL_ATTESTATION_V1]),
    });
    const dossier = newDossier(context, {
      profile: READINESS_OPTIONAL_ATTESTATION_V1,
      caseId: 'case-optional-attestation',
    });
    addDeclaration(context, dossier);
    await review(context, dossier, { withArtifact: true });
    addDeclaration(context, dossier, {
      declarationId: 'declaration-after-optional',
      materialId: 'material-declaration-after-optional',
      claimRef: READINESS_SECOND_CLAIM_ID,
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
        requirementId: READINESS_ATTESTATION,
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationCurrencyUnresolved,
      }),
    ).toHaveLength(1);
  });

  // §18 / §92 — a record bound to a revision the case has not reached is ignored.
  it('ignores a record bound to a revision the case has not reached', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_DECLARATION_V1 });
    addDeclaration(context, dossier);

    const fromTheFuture = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      {
        ...readinessInputs(dossier),
        declarations: dossier.declarations.map((record) => ({
          ...record,
          caseRevision: record.caseRevision + 50,
        })),
      },
    );

    // The material association is still on the case, so the requirement is met;
    // the future-dated record simply contributed nothing to the compatibility
    // check.
    expect(fromTheFuture.evaluatedCaseRevision).toBe(dossier.protocolizationCase.revision);
    expect(fromTheFuture.state).toBe(ProtocolizationReadinessState.Ready);
  });
});
