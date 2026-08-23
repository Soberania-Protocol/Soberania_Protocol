import {
  PROTOCOLIZATION_EXECUTION_ERROR_CODES,
  PROTOCOLIZATION_EXECUTION_VALIDATION_CODES,
  PROTOCOLIZATION_READINESS_BLOCKER_CODES,
  ProfessionalReviewAction,
  ProtocolizationExecutionError,
  ProtocolizationReadinessState,
  cancelProtocolizationCase,
  createInMemoryProtocolizationResultRepository,
  executeProtocolization,
  isProtocolizationReadinessCurrentForCase,
  validateProtocolizationReadinessForExecution,
} from '@aoc/asset-protocolization';
import type {
  ProtocolizationCase,
  ProtocolizationReadinessEvaluation,
} from '@aoc/asset-protocolization';

import { TENANT_B } from './fixtures/test-cases';
import {
  READINESS_ATTESTATION_V1,
  READINESS_DECLARATION,
  READINESS_DECLARATION_V1,
  READINESS_FAIL_V1,
  READINESS_MANUAL_V1,
  READINESS_SECOND_REVIEWER,
  addDeclaration,
  newDossier,
  review,
  runChecks,
} from './fixtures/test-readiness';
import type { ReadinessDossier, ReadinessTestContext } from './fixtures/test-readiness';
import {
  createExecutionContext,
  evaluate,
  readyDeclarationDossier,
  readyDossier,
  readyEvaluation,
} from './fixtures/test-execution';

/**
 * The APV-10 preconditions.
 *
 * Execution is an act, so a request that cannot coherently be carried out is
 * refused rather than answered. Every refusal below leaves the world exactly as
 * it was: no result, no event, no case mutation, nothing written anywhere.
 */

const attempt = (
  context: ReadinessTestContext,
  protocolizationCase: ProtocolizationCase,
  evaluation: ProtocolizationReadinessEvaluation,
  resultId = 'protocolization-result-0001',
): ProtocolizationExecutionError => {
  try {
    executeProtocolization(context, protocolizationCase, evaluation, { resultId });
  } catch (error) {
    if (error instanceof ProtocolizationExecutionError) return error;
    throw error;
  }
  throw new Error('expected protocolization execution to be refused');
};

/** A dossier standing at a non-Ready state, built through the real operations. */
async function pendingDossier(
  context: ReadinessTestContext,
  shape: 'evidence' | 'verification' | 'review' | 'rejected' | 'moreEvidence' | 'conflict',
  caseId: string,
): Promise<ReadinessDossier> {
  if (shape === 'evidence') {
    // A required declaration requirement with nothing supplied against it.
    return newDossier(context, { profile: READINESS_DECLARATION_V1, caseId });
  }
  if (shape === 'verification') {
    const dossier = newDossier(context, { profile: READINESS_FAIL_V1, caseId });
    addDeclaration(context, dossier);
    await runChecks(context, dossier);
    return dossier;
  }
  if (shape === 'review') {
    const dossier = newDossier(context, { profile: READINESS_MANUAL_V1, caseId });
    addDeclaration(context, dossier);
    await runChecks(context, dossier);
    return dossier;
  }

  const dossier = newDossier(context, { profile: READINESS_ATTESTATION_V1, caseId });
  addDeclaration(context, dossier);
  if (shape === 'rejected') {
    await review(context, dossier, { action: ProfessionalReviewAction.Reject });
    return dossier;
  }
  if (shape === 'moreEvidence') {
    await review(context, dossier, { action: ProfessionalReviewAction.RequestMoreEvidence });
    return dossier;
  }
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
  return dossier;
}

describe('APV-10 execution preconditions', () => {
  // §8 / §104 — there is no execution without an APV-09 conclusion.
  it('requires a readiness evaluation, and refuses when none is supplied', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);

    for (const missing of [undefined, null]) {
      const error = attempt(
        context,
        dossier.protocolizationCase,
        missing as unknown as ProtocolizationReadinessEvaluation,
      );
      expect(error.code).toBe(PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessRequired);
    }
  });

  // §9 / §70 / §107 — every reachable non-Ready state is refused.
  it('refuses every non-Ready readiness state', async () => {
    const shapes = [
      { shape: 'evidence', state: ProtocolizationReadinessState.EvidencePending },
      { shape: 'verification', state: ProtocolizationReadinessState.VerificationPending },
      { shape: 'review', state: ProtocolizationReadinessState.ReviewPending },
      { shape: 'rejected', state: ProtocolizationReadinessState.Rejected },
      { shape: 'moreEvidence', state: ProtocolizationReadinessState.MoreEvidenceRequired },
      { shape: 'conflict', state: ProtocolizationReadinessState.Blocked },
    ] as const;

    for (const { shape, state } of shapes) {
      const context = createExecutionContext();
      const dossier = await pendingDossier(context, shape, `case-${shape}`);
      const evaluation = evaluate(context, dossier);

      expect(evaluation.state).toBe(state);
      expect(evaluation.ready).toBe(false);
      // The evaluation is perfectly current — it is the *conclusion* that refuses.
      expect(isProtocolizationReadinessCurrentForCase(evaluation, dossier.protocolizationCase)).toBe(
        true,
      );

      const error = attempt(context, dossier.protocolizationCase, evaluation);
      expect(error.code).toBe(PROTOCOLIZATION_EXECUTION_ERROR_CODES.notReady);
      // The refusal carries the case's own blockers, unreinterpreted.
      expect(error.details.reasonCodes).toEqual(
        expect.arrayContaining(evaluation.blockers.map((blocker) => blocker.reasonCode)),
      );
    }
  });

  // §35 — the eighth state, and the lifecycle gate that outranks any evaluation.
  it('refuses a cancelled case, and refuses it before it reads any readiness', async () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const readyBefore = readyEvaluation(context, dossier);

    const cancelled = cancelProtocolizationCase(context, dossier.protocolizationCase, {
      reason: 'test-only cancellation',
    });

    // APV-09 itself now says Ineligible, and cannot be made to say otherwise.
    const afterCancellation = evaluate(context, {
      ...dossier,
      protocolizationCase: cancelled.protocolizationCase,
    });
    expect(afterCancellation.state).toBe(ProtocolizationReadinessState.Ineligible);
    expect(
      attempt(context, cancelled.protocolizationCase, afterCancellation).code,
    ).toBe(PROTOCOLIZATION_EXECUTION_ERROR_CODES.caseNotExecutable);

    // ...and the stale Ready from before the cancellation does not get past it
    // either, however legitimate it once was.
    expect(attempt(context, cancelled.protocolizationCase, readyBefore).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.caseNotExecutable,
    );
  });

  // §11 / §71 / §75 / §108 / §112 — the TOCTOU boundary.
  it('refuses a Ready evaluation the case has moved past, with a stale-specific code', async () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const atN = readyEvaluation(context, dossier);
    const n = atN.evaluatedCaseRevision;

    addDeclaration(context, dossier, {
      declarationId: 'declaration-later',
      materialId: 'material-declaration-later',
      claimRef: 'aoc:claim:readiness-0002',
    });
    expect(dossier.protocolizationCase.revision).toBe(n + 1);

    const error = attempt(context, dossier.protocolizationCase, atN);
    expect(error.code).toBe(PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessStale);
    expect(error.code).not.toBe(PROTOCOLIZATION_EXECUTION_ERROR_CODES.notReady);
    expect(error.details.evaluatedCaseRevision).toBe(n);
    expect(error.details.executedCaseRevision).toBe(n + 1);

    // Nothing was refreshed, re-evaluated or repaired on the way through.
    expect(atN.evaluatedCaseRevision).toBe(n);
    expect(isProtocolizationReadinessCurrentForCase(atN, dossier.protocolizationCase)).toBe(false);
  });

  // §11 — and a readiness from the *future* is refused too, not welcomed.
  it('refuses a readiness evaluation carrying a newer revision than the case', async () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const evaluation = readyEvaluation(context, dossier);

    const fromTheFuture = {
      ...evaluation,
      evaluatedCaseRevision: evaluation.evaluatedCaseRevision + 5,
    };

    expect(attempt(context, dossier.protocolizationCase, fromTheFuture).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessStale,
    );
  });

  // §72 / §109 — tenant isolation, checked before anything sensitive is read.
  it('refuses a caller acting as another tenant', async () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const evaluation = readyEvaluation(context, dossier);

    const foreign = { ...context, tenantId: TENANT_B };
    const error = attempt(foreign, dossier.protocolizationCase, evaluation);
    expect(error.code).toBe(PROTOCOLIZATION_EXECUTION_ERROR_CODES.tenantMismatch);

    // A blank acting tenant is not a wildcard.
    expect(
      attempt({ ...context, tenantId: '' }, dossier.protocolizationCase, evaluation).code,
    ).toBe(PROTOCOLIZATION_EXECUTION_ERROR_CODES.tenantRequired);

    // And a readiness belonging to another tenant cannot execute this case.
    expect(
      attempt(context, dossier.protocolizationCase, { ...evaluation, tenantId: TENANT_B }).code,
    ).toBe(PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessMismatch);
  });

  // §73 / §110 — readiness for case A cannot execute case B.
  it('refuses a readiness evaluation belonging to another case', async () => {
    const context = createExecutionContext();
    const first = readyDeclarationDossier(context, { caseId: 'case-one' });
    const second = readyDeclarationDossier(context, { caseId: 'case-two' });

    const evaluation = readyEvaluation(context, first);
    // Same tenant, same profile, same revision, same subject shape — and still no.
    expect(second.protocolizationCase.revision).toBe(first.protocolizationCase.revision);
    expect(attempt(context, second.protocolizationCase, evaluation).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessMismatch,
    );
  });

  // §74 / §111 — readiness under one pin cannot execute a case pinned elsewhere.
  it('refuses a readiness evaluation produced under another profile version', async () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const evaluation = readyEvaluation(context, dossier);

    const otherPin = {
      ...evaluation,
      profile: { profileId: evaluation.profile.profileId, profileVersion: '2.0.0' },
    };
    expect(attempt(context, dossier.protocolizationCase, otherPin).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessMismatch,
    );
  });

  // §9 / §44 / §113 / §137 — impossible reconstructed evaluations.
  it('refuses malformed readiness: Ready with ready false, Ready with blockers, unknown fields', async () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const evaluation = readyEvaluation(context, dossier);

    const readyFalse = { ...evaluation, ready: false };
    expect(validateProtocolizationReadinessForExecution(readyFalse).reasons).toContain(
      PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessFlagInconsistent,
    );
    expect(attempt(context, dossier.protocolizationCase, readyFalse).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessMalformed,
    );

    const withBlockers = {
      ...evaluation,
      blockers: [
        {
          reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialMissing,
          requirementId: READINESS_DECLARATION,
        },
      ],
    };
    expect(validateProtocolizationReadinessForExecution(withBlockers).reasons).toContain(
      PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessBlockersInconsistent,
    );
    expect(attempt(context, dossier.protocolizationCase, withBlockers).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessMalformed,
    );

    // An assessment carrying a blocker the evaluation forgot to hoist is the
    // same lie told one level down.
    const hiddenBlocker = {
      ...evaluation,
      requirementAssessments: evaluation.requirementAssessments.map((assessment, index) =>
        index === 0
          ? {
              ...assessment,
              blockers: [
                { reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialMissing },
              ],
            }
          : assessment,
      ),
    };
    expect(attempt(context, dossier.protocolizationCase, hiddenBlocker).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessMalformed,
    );

    for (const malformed of [
      { ...evaluation, schemaVersion: 'aoc-protocolization-readiness/99' },
      { ...evaluation, state: 'Protocolized' },
      { ...evaluation, evaluatedCaseRevision: 0 },
      { ...evaluation, evaluatedAt: 'not-an-instant' },
      { ...evaluation, warnings: [{ reasonCode: 'invented.warning.code' }] },
      { ...evaluation, surprise: true },
      { ...evaluation, caseState: 'Protocolizing' },
      'not an object',
      42,
      [],
    ]) {
      expect(
        attempt(
          context,
          dossier.protocolizationCase,
          malformed as unknown as ProtocolizationReadinessEvaluation,
        ).code,
      ).toBe(PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessMalformed);
    }
  });

  // §41 — the caller's own revision assertion is compared exactly.
  it('refuses an expectedCaseRevision that is not the revision being executed', async () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const evaluation = readyEvaluation(context, dossier);
    const revision = dossier.protocolizationCase.revision;

    for (const expected of [revision - 1, revision + 1]) {
      let caught: ProtocolizationExecutionError | undefined;
      try {
        executeProtocolization(context, dossier.protocolizationCase, evaluation, {
          resultId: 'protocolization-result-0001',
          expectedCaseRevision: expected,
        });
      } catch (error) {
        caught = error as ProtocolizationExecutionError;
      }
      expect(caught?.code).toBe(PROTOCOLIZATION_EXECUTION_ERROR_CODES.revisionMismatch);
    }

    // The exact revision executes.
    const { result } = executeProtocolization(
      context,
      dossier.protocolizationCase,
      evaluation,
      { resultId: 'protocolization-result-0001', expectedCaseRevision: revision },
    );
    expect(result.executedCaseRevision).toBe(revision);
  });

  // §69 — a malformed request is refused before anything is built.
  it('refuses an inadmissible execution request', async () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const evaluation = readyEvaluation(context, dossier);

    const refuse = (request: unknown): ProtocolizationExecutionError => {
      try {
        executeProtocolization(
          context,
          dossier.protocolizationCase,
          evaluation,
          request as never,
        );
      } catch (error) {
        return error as ProtocolizationExecutionError;
      }
      throw new Error('expected the request to be refused');
    };

    expect(refuse({ resultId: '' }).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.resultIdInvalid,
    );
    expect(refuse({ resultId: 'has whitespace' }).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.resultIdInvalid,
    );
    expect(refuse({ resultId: 'result-1', correlationId: '' }).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.requestInvalid,
    );
    expect(refuse({ resultId: 'result-1', expectedCaseRevision: 1.5 }).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.requestInvalid,
    );
    // A present-but-undefined optional is not an absent one.
    expect(refuse({ resultId: 'result-1', correlationId: undefined }).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.requestInvalid,
    );
    expect(refuse({ resultId: 'result-1', force: true }).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.requestInvalid,
    );
  });

  // §66 / §67 — a refusal leaves nothing behind.
  it('leaves the case, the dossier and the store untouched when it refuses', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);
    const evaluation = readyEvaluation(context, dossier);
    const store = createInMemoryProtocolizationResultRepository();

    const before = {
      protocolizationCase: JSON.stringify(dossier.protocolizationCase),
      declarations: JSON.stringify(dossier.declarations),
      evidenceReceipts: JSON.stringify(dossier.evidenceReceipts),
      verificationResults: JSON.stringify(dossier.verificationResults),
      reviewRequests: JSON.stringify(dossier.reviewRequests),
      reviewDecisions: JSON.stringify(dossier.reviewDecisions),
      attestations: JSON.stringify(dossier.attestations),
      evaluation: JSON.stringify(evaluation),
    };

    attempt(context, dossier.protocolizationCase, {
      ...evaluation,
      evaluatedCaseRevision: evaluation.evaluatedCaseRevision + 1,
    });

    expect(JSON.stringify(dossier.protocolizationCase)).toBe(before.protocolizationCase);
    expect(JSON.stringify(dossier.declarations)).toBe(before.declarations);
    expect(JSON.stringify(dossier.evidenceReceipts)).toBe(before.evidenceReceipts);
    expect(JSON.stringify(dossier.verificationResults)).toBe(before.verificationResults);
    expect(JSON.stringify(dossier.reviewRequests)).toBe(before.reviewRequests);
    expect(JSON.stringify(dossier.reviewDecisions)).toBe(before.reviewDecisions);
    expect(JSON.stringify(dossier.attestations)).toBe(before.attestations);
    expect(JSON.stringify(evaluation)).toBe(before.evaluation);
    expect(store.listByCase(context.tenantId, dossier.protocolizationCase.caseId)).toEqual([]);
  });

  // §42 — the pin is resolved exactly, and an unresolvable one refuses.
  it('refuses when the exact pinned profile version is not catalogued', async () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const evaluation = readyEvaluation(context, dossier);

    const emptyCatalog = {
      ...context,
      catalog: { ...context.catalog, get: () => undefined },
    };
    expect(attempt(emptyCatalog, dossier.protocolizationCase, evaluation).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.profileNotFound,
    );
  });
});
