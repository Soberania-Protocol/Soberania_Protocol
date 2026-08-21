import {
  PROTOCOLIZATION_READINESS_ERROR_CODES,
  ProtocolizationReadinessError,
  ProtocolizationReadinessState,
  createAssetProfileCatalog,
  evaluateProtocolizationReadiness,
} from '@aoc/asset-protocolization';

import { TENANT_A, TENANT_B } from './fixtures/test-cases';
import {
  READINESS_DECLARATION_V1,
  READINESS_FULL_V1,
  READINESS_PASS_V1,
  addDeclaration,
  addEvidence,
  createReadinessCatalog,
  createReadinessContext,
  newDossier,
  readinessInputs,
  review,
  runChecks,
} from './fixtures/test-readiness';

/**
 * Tenancy, cross-case and cross-profile isolation, and the promise that an
 * evaluation changes nothing it reads.
 */
describe('APV-09 isolation and immutability', () => {
  // §89 / §155 — the tenant is the isolation boundary.
  it('lets a tenant evaluate its own case and refuses another tenant’s', () => {
    const catalog = createReadinessCatalog();
    const contextA = createReadinessContext({ tenantId: TENANT_A, catalog });
    const dossier = newDossier(contextA, { profile: READINESS_DECLARATION_V1 });
    addDeclaration(contextA, dossier);

    expect(
      evaluateProtocolizationReadiness(contextA, dossier.protocolizationCase, readinessInputs(dossier))
        .state,
    ).toBe(ProtocolizationReadinessState.Ready);

    const contextB = createReadinessContext({ tenantId: TENANT_B, catalog });
    expect(() =>
      evaluateProtocolizationReadiness(
        contextB,
        dossier.protocolizationCase,
        readinessInputs(dossier),
      ),
    ).toThrow(
      expect.objectContaining({ code: PROTOCOLIZATION_READINESS_ERROR_CODES.tenantMismatch }),
    );
  });

  it('refuses a blank acting tenant outright', () => {
    const context = createReadinessContext({ tenantId: '   ' });
    const owner = createReadinessContext({ catalog: context.catalog });
    const dossier = newDossier(owner, { profile: READINESS_DECLARATION_V1 });

    expect(() =>
      evaluateProtocolizationReadiness(context, dossier.protocolizationCase, readinessInputs(dossier)),
    ).toThrow(expect.objectContaining({ code: PROTOCOLIZATION_READINESS_ERROR_CODES.invalidTenant }));
  });

  // §94 / §155 — another tenant's records can never satisfy this case.
  it('refuses every kind of record belonging to another tenant', async () => {
    const catalog = createReadinessCatalog();
    const contextA = createReadinessContext({ tenantId: TENANT_A, catalog });
    const contextB = createReadinessContext({ tenantId: TENANT_B, catalog });

    const mine = newDossier(contextA, { profile: READINESS_FULL_V1, caseId: 'case-mine' });
    const theirs = newDossier(contextB, { profile: READINESS_FULL_V1, caseId: 'case-mine' });
    addDeclaration(contextB, theirs);
    addEvidence(contextB, theirs);
    await runChecks(contextB, theirs);
    await review(contextB, theirs, { withArtifact: true });

    const foreign = [
      { declarations: theirs.declarations },
      { evidenceReceipts: theirs.evidenceReceipts },
      { verificationResults: theirs.verificationResults },
      { reviewRequests: theirs.reviewRequests },
      { reviewDecisions: theirs.reviewDecisions },
    ];

    for (const inputs of foreign) {
      // Guard the guard: an empty bundle would make the refusal below pass for
      // the wrong reason.
      expect((Object.values(inputs)[0] as readonly unknown[]).length).toBeGreaterThan(0);
      expect(() =>
        evaluateProtocolizationReadiness(contextA, mine.protocolizationCase, inputs),
      ).toThrow(
        expect.objectContaining({
          code: PROTOCOLIZATION_READINESS_ERROR_CODES.inputTenantMismatch,
        }),
      );
    }

    // ...and the attestation another tenant's reviewer produced does not become
    // this case's attestation material either: this case holds no association
    // naming it, so nothing can qualify.
    const withForeignArtifact = evaluateProtocolizationReadiness(
      contextA,
      mine.protocolizationCase,
      { attestations: theirs.attestations },
    );
    expect(withForeignArtifact.ready).toBe(false);
  });

  // §93 — another case's records can never satisfy this case.
  it('refuses records belonging to another case of the same tenant', () => {
    const context = createReadinessContext();
    const first = newDossier(context, { profile: READINESS_DECLARATION_V1, caseId: 'case-first' });
    const second = newDossier(context, { profile: READINESS_DECLARATION_V1, caseId: 'case-second' });
    addDeclaration(context, second);

    expect(() =>
      evaluateProtocolizationReadiness(context, first.protocolizationCase, {
        declarations: second.declarations,
      }),
    ).toThrow(
      expect.objectContaining({ code: PROTOCOLIZATION_READINESS_ERROR_CODES.inputCaseMismatch }),
    );
  });

  // §95 — records produced under another profile version cannot satisfy this case.
  it('refuses records produced under another profile version', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_DECLARATION_V1 });
    addDeclaration(context, dossier);

    expect(() =>
      evaluateProtocolizationReadiness(context, dossier.protocolizationCase, {
        declarations: dossier.declarations.map((record) => ({
          ...record,
          profile: { profileId: READINESS_FULL_V1.profileId, profileVersion: '2.0.0' },
        })),
      }),
    ).toThrow(
      expect.objectContaining({ code: PROTOCOLIZATION_READINESS_ERROR_CODES.inputProfileMismatch }),
    );
  });

  // §90 — ownership is never inferred from the subject.
  it('never infers ownership from the subject reference', () => {
    const catalog = createReadinessCatalog();
    const contextA = createReadinessContext({ tenantId: TENANT_A, catalog });
    const contextB = createReadinessContext({ tenantId: TENANT_B, catalog });

    // The same subject, in two tenants. Neither can read the other's readiness.
    const mine = newDossier(contextA, { profile: READINESS_DECLARATION_V1, caseId: 'case-shared' });
    const theirs = newDossier(contextB, { profile: READINESS_DECLARATION_V1, caseId: 'case-shared' });
    expect(mine.protocolizationCase.subject.subjectRef).toEqual(
      theirs.protocolizationCase.subject.subjectRef,
    );

    expect(() =>
      evaluateProtocolizationReadiness(contextA, theirs.protocolizationCase, {}),
    ).toThrow(ProtocolizationReadinessError);
  });

  // §91 — a malformed case produces no readiness answer at all.
  it('refuses to evaluate a case that does not validate', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_DECLARATION_V1 });

    expect(() =>
      evaluateProtocolizationReadiness(
        context,
        { ...dossier.protocolizationCase, revision: 0 },
        readinessInputs(dossier),
      ),
    ).toThrow(expect.objectContaining({ code: PROTOCOLIZATION_READINESS_ERROR_CODES.invalidCase }));
  });

  // §16 — an unresolvable pin is an error, never a nearest-version fallback.
  it('refuses a pin the catalogue does not hold rather than resolving a nearest version', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_FULL_V1 });

    // A catalogue holding only `2.0.0` of the same line: a `1.0.0`-pinned case
    // gets an error, never `2.0.0`'s rules.
    const narrowed = createReadinessContext({
      catalog: createAssetProfileCatalog([
        { ...READINESS_FULL_V1, version: '2.0.0', requirements: READINESS_FULL_V1.requirements },
      ]),
    });

    expect(() =>
      evaluateProtocolizationReadiness(narrowed, dossier.protocolizationCase, readinessInputs(dossier)),
    ).toThrow(
      expect.objectContaining({ code: PROTOCOLIZATION_READINESS_ERROR_CODES.profileNotFound }),
    );
  });

  // §156 / §157 / §158 — an evaluation changes nothing it reads.
  it('mutates no case, receipt, declaration, result, decision or attestation', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_PASS_V1 });
    addDeclaration(context, dossier);
    await runChecks(context, dossier);

    const before = {
      protocolizationCase: JSON.stringify(dossier.protocolizationCase),
      declarations: JSON.stringify(dossier.declarations),
      verificationResults: JSON.stringify(dossier.verificationResults),
    };

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(JSON.stringify(dossier.protocolizationCase)).toBe(before.protocolizationCase);
    expect(JSON.stringify(dossier.declarations)).toBe(before.declarations);
    expect(JSON.stringify(dossier.verificationResults)).toBe(before.verificationResults);

    // No retroactive flag was written onto anything.
    for (const serialized of Object.values(before)) {
      for (const forbidden of ['"satisfied"', '"accepted"', '"approved"', '"valid"']) {
        expect(serialized).not.toContain(forbidden);
      }
    }
    expect(evaluation.ready).toBe(true);
  });

  // §156 — the returned evaluation is deeply frozen.
  it('returns a deeply frozen evaluation whose mutation reaches nothing', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_FULL_V1 });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(Object.isFrozen(evaluation)).toBe(true);
    expect(Object.isFrozen(evaluation.blockers)).toBe(true);
    expect(Object.isFrozen(evaluation.warnings)).toBe(true);
    expect(Object.isFrozen(evaluation.requirementAssessments)).toBe(true);
    for (const assessment of evaluation.requirementAssessments) {
      expect(Object.isFrozen(assessment)).toBe(true);
      expect(Object.isFrozen(assessment.blockers)).toBe(true);
      expect(Object.isFrozen(assessment.materialIds)).toBe(true);
    }

    const mutable = evaluation as unknown as { ready: boolean; blockers: unknown[] };
    expect(() => {
      mutable.ready = true;
    }).toThrow(TypeError);
    expect(() => mutable.blockers.push({})).toThrow(TypeError);
  });
});
