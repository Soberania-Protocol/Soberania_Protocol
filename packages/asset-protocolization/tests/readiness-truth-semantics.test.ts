import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION,
  ProtocolizationCaseState,
  ProtocolizationReadinessState,
  ProtocolizationRequirementStatus,
  evaluateProtocolizationReadiness,
  getProtocolizationRequirementAssessment,
  isProtocolizationReadinessCurrentForCase,
} from '@aoc/asset-protocolization';

import {
  READINESS_ATTESTATION,
  READINESS_ATTESTATION_V1,
  READINESS_DECLARATION,
  READINESS_DECLARATION_V1,
  addDeclaration,
  createReadinessContext,
  newDossier,
  readinessInputs,
  review,
} from './fixtures/test-readiness';

const sourceRoot = join(__dirname, '..', 'src');

const collect = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collect(path);
    return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
  });

/**
 * The truth boundaries APV-09 must never cross, and the handoff APV-10 will
 * later depend on.
 */
describe('APV-09 truth semantics', () => {
  // §104 / §165 — READY is a technical protocolization state and nothing more.
  it('never spells Ready as approval, legality, ownership or transferability', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_DECLARATION_V1 });
    addDeclaration(context, dossier);

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);

    const serialized = JSON.stringify(evaluation).toLowerCase();
    for (const forbidden of [
      'approved',
      'certified',
      'legally',
      'ownership',
      'titleholder',
      'transferable',
      'tokenizable',
      'enforceable',
      'authorized',
      'protocolized',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  // §103 / §45 — a proof-backed professional artifact is not legal authority.
  it('never upgrades a satisfied attestation requirement into authority or truth', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_ATTESTATION_V1 });
    addDeclaration(context, dossier);
    await review(context, dossier, { withArtifact: true });

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(getProtocolizationRequirementAssessment(evaluation, READINESS_ATTESTATION)?.status).toBe(
      ProtocolizationRequirementStatus.Satisfied,
    );

    // The requirement is satisfied. Nothing anywhere claims the professional had
    // authority, that the proof verified, or that the proposition is true.
    const assessment = getProtocolizationRequirementAssessment(evaluation, READINESS_ATTESTATION);
    for (const forbidden of [
      'authority',
      'verified',
      'valid',
      'true',
      'credentialValid',
      'proofVerified',
    ]) {
      expect(Object.keys(assessment ?? {})).not.toContain(forbidden);
    }

    // And the declaration it rests on gained nothing either.
    expect(getProtocolizationRequirementAssessment(evaluation, READINESS_DECLARATION)?.status).toBe(
      ProtocolizationRequirementStatus.Satisfied,
    );
    expect(dossier.declarations[0]).not.toHaveProperty('verified');
    expect(dossier.attestations[0]).not.toHaveProperty('verified');
  });

  // §81 / §166 — the APV-10 handoff contract.
  it('exposes exactly what APV-10 will need, and nothing that executes', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_DECLARATION_V1 });
    addDeclaration(context, dossier);

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    // Everything a consuming slice needs to decide whether it may act, and to
    // detect that the case has moved on since.
    expect(evaluation.schemaVersion).toBe(PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION);
    expect(evaluation.tenantId).toBe(dossier.protocolizationCase.tenantId);
    expect(evaluation.caseId).toBe(dossier.protocolizationCase.caseId);
    expect(evaluation.profile).toEqual(dossier.protocolizationCase.profile);
    expect(evaluation.evaluatedCaseRevision).toBe(dossier.protocolizationCase.revision);
    expect(evaluation.caseState).toBe(ProtocolizationCaseState.Draft);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);
    expect(evaluation.ready).toBe(true);
    expect(evaluation.requirementAssessments.length).toBeGreaterThan(0);
    expect(isProtocolizationReadinessCurrentForCase(evaluation, dossier.protocolizationCase)).toBe(
      true,
    );

    // ...and nothing on it is, or produces, an execution artifact.
    for (const forbidden of [
      'protocolizationResult',
      'manifest',
      'anchor',
      'token',
      'signature',
      'execute',
      'commit',
    ]) {
      expect(Object.keys(evaluation)).not.toContain(forbidden);
    }
  });

  // §14 — `ready` is a derivative, never an independent fact.
  it('derives ready from the state and never carries it independently', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_DECLARATION_V1 });

    const notReady = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(notReady.ready).toBe(notReady.state === ProtocolizationReadinessState.Ready);
    expect(notReady.ready).toBe(false);
    expect(notReady.blockers.length).toBeGreaterThan(0);

    addDeclaration(context, dossier);
    const ready = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(ready.ready).toBe(ready.state === ProtocolizationReadinessState.Ready);
    expect(ready.ready).toBe(true);
    expect(ready.blockers).toEqual([]);
  });

  // §57 / §58 — no waiver, override or force mechanism was introduced.
  it('adds no waiver, override or force mechanism', () => {
    const code = collect(sourceRoot)
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n');

    for (const forbidden of [
      'forceReadiness',
      'waiveRequirement',
      'overrideReadiness',
      'grantReadiness',
      'promoteCase',
      'setReadinessState',
      'markSatisfied',
    ]) {
      expect(code).not.toContain(forbidden);
    }
  });

  // §115 / §159 — readiness belongs to the vertical, not to Protocol.
  it('keeps every readiness concept under the vertical package', async () => {
    const facade: Record<string, unknown> = await import('@aoc/asset-protocolization');
    const protocolFacade: Record<string, unknown> = await import('@aoc/protocol/claims');

    expect(facade.evaluateProtocolizationReadiness).toBeDefined();
    expect(facade.ProtocolizationReadinessState).toBeDefined();
    for (const readinessName of [
      'evaluateProtocolizationReadiness',
      'ProtocolizationReadinessState',
      'ProtocolizationRequirementStatus',
      'ProtocolizationRequirementApplicability',
    ]) {
      expect(protocolFacade[readinessName]).toBeUndefined();
    }
  });
});
