import { ProtocolizationCaseState, evaluateProtocolizationReadiness } from '@aoc/asset-protocolization';
import type { ProtocolizationResult } from '@aoc/asset-protocolization';

import { readinessInputs } from './fixtures/test-readiness';
import {
  createExecutionContext,
  execute,
  readyDossier,
  readyEvaluation,
} from './fixtures/test-execution';

/**
 * What a successful execution changes: exactly one thing, and it is new.
 *
 * A `ProtocolizationResult` comes into existence. Nothing else does, and nothing
 * that already existed is touched — not the case, not a claim, not an evidence
 * receipt, not a verification result, not a review decision, not an attestation,
 * and not the readiness evaluation that authorized it.
 */
describe('APV-10 execution immutability', () => {
  // §18 / §114 — the artifact cannot be edited by whoever holds it.
  it('returns a deeply frozen result that resists mutation at every level', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);
    const { result, event } = execute(context, dossier);

    const before = JSON.stringify(result);

    const mutable = result as unknown as Record<string, unknown>;
    const attempts: readonly (() => void)[] = [
      () => {
        mutable.executedCaseRevision = 999;
      },
      () => {
        mutable.tenantId = 'tenant-someone-else';
      },
      () => {
        (result.profile as unknown as Record<string, unknown>).profileVersion = '9.9.9';
      },
      () => {
        (result.subject.subjectRef as unknown as Record<string, unknown>).sovereignAssetId =
          'aoc:sovereign-asset:00000000-0000-4000-8000-000000000000';
      },
      () => {
        (result.readinessBasis as unknown as Record<string, unknown>).blockerCount = 7;
      },
      () => {
        (result.readinessBasis.warnings as unknown[]).push({ reasonCode: 'invented' });
      },
      () => {
        (result.materialRefs as unknown[]).push({ materialId: 'smuggled' });
      },
      () => {
        (result.materialRefs[0] as unknown as Record<string, unknown>).ref = 'aoc:claim:other';
      },
      () => {
        (event as unknown as Record<string, unknown>).resultId = 'someone-elses-result';
      },
    ];

    for (const attempt of attempts) {
      // Frozen objects throw in strict mode, which compiled test modules are.
      expect(attempt).toThrow();
    }

    expect(JSON.stringify(result)).toBe(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.readinessBasis)).toBe(true);
    expect(Object.isFrozen(result.readinessBasis.warnings)).toBe(true);
    expect(Object.isFrozen(result.materialRefs)).toBe(true);
    expect(Object.isFrozen(event)).toBe(true);
  });

  // §120 – §125 / §144.31 – §144.35 — nothing the execution read is rewritten.
  it('leaves the case, the whole dossier and the readiness evaluation byte-identical', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);
    const evaluation = readyEvaluation(context, dossier);

    const before = {
      protocolizationCase: JSON.stringify(dossier.protocolizationCase),
      declarations: JSON.stringify(dossier.declarations),
      evidenceReceipts: JSON.stringify(dossier.evidenceReceipts),
      evidence: JSON.stringify(dossier.evidence),
      verificationResults: JSON.stringify(dossier.verificationResults),
      reviewRequests: JSON.stringify(dossier.reviewRequests),
      reviewDecisions: JSON.stringify(dossier.reviewDecisions),
      attestations: JSON.stringify(dossier.attestations),
      evaluation: JSON.stringify(evaluation),
    };
    const caseReference = dossier.protocolizationCase;

    execute(context, dossier);

    // The aggregate is the same object, at the same revision, in the same state.
    expect(dossier.protocolizationCase).toBe(caseReference);
    expect(JSON.stringify(dossier.protocolizationCase)).toBe(before.protocolizationCase);
    expect(dossier.protocolizationCase.state).toBe(ProtocolizationCaseState.Draft);

    // No claim was proven, no evidence certified, no check re-run, no review
    // reinterpreted, no attestation widened, no readiness rewritten.
    expect(JSON.stringify(dossier.declarations)).toBe(before.declarations);
    expect(JSON.stringify(dossier.evidenceReceipts)).toBe(before.evidenceReceipts);
    expect(JSON.stringify(dossier.evidence)).toBe(before.evidence);
    expect(JSON.stringify(dossier.verificationResults)).toBe(before.verificationResults);
    expect(JSON.stringify(dossier.reviewRequests)).toBe(before.reviewRequests);
    expect(JSON.stringify(dossier.reviewDecisions)).toBe(before.reviewDecisions);
    expect(JSON.stringify(dossier.attestations)).toBe(before.attestations);
    expect(JSON.stringify(evaluation)).toBe(before.evaluation);

    // And re-asking APV-09 afterwards gives the same answer it gave before:
    // execution changed no input the projection reads.
    const after = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect({ ...after, evaluatedAt: evaluation.evaluatedAt }).toEqual(evaluation);
  });

  // §83 — protocolized is a result in history, never a flag on anything.
  it('writes no protocolized flag onto the case, the subject or any material', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);
    const { result } = execute(context, dossier);

    const caseJson = JSON.stringify(dossier.protocolizationCase).toLowerCase();
    for (const forbidden of [
      'protocolized',
      'protocolizing',
      'executed',
      'resultid',
      'complete',
      'finalized',
    ]) {
      expect(caseJson).not.toContain(forbidden);
    }

    // The fact lives in exactly one place: the artifact.
    expect((result as ProtocolizationResult).executedCaseRevision).toBe(
      dossier.protocolizationCase.revision,
    );
  });
});
