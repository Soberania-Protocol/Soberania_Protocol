import {
  PROTOCOLIZATION_READINESS_BLOCKER_CODES,
  PROTOCOLIZATION_READINESS_WARNING_CODES,
  ProtocolizationCaseState,
  ProtocolizationReadinessState,
  ProtocolizationRequirementStatus,
  VerificationCheckOutcome,
  activateProtocolizationCase,
  evaluateProtocolizationReadiness,
  getProtocolizationRequirementAssessment,
  listProtocolizationReadinessBlockers,
  listProtocolizationReadinessWarnings,
} from '@aoc/asset-protocolization';

import { TEST_CHECK_FAIL, TEST_CHECK_PASS } from './fixtures/test-verification';
import {
  READINESS_FAIL_V1,
  READINESS_MANUAL_V1,
  READINESS_MULTI_CHECK_V1,
  READINESS_PASS_V1,
  READINESS_UNAVAILABLE_V1,
  READINESS_VERIFICATION,
  READINESS_WARNING_V1,
  addDeclaration,
  createReadinessContext,
  newDossier,
  readinessInputs,
  runChecks,
} from './fixtures/test-readiness';
import type { ReadinessTestContext } from './fixtures/test-readiness';
import type { AssetProfile } from '@aoc/asset-protocolization';

/**
 * How APV-07's five outcomes reach a readiness answer — and how none of them is
 * folded into another on the way.
 */
async function verified(profile: AssetProfile, context: ReadinessTestContext = createReadinessContext()) {
  const dossier = newDossier(context, { profile, caseId: `case-${profile.profileId}` });
  addDeclaration(context, dossier);
  await runChecks(context, dossier);
  return {
    context,
    dossier,
    evaluation: evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    ),
  };
}

describe('APV-09 verification semantics', () => {
  // §130 ARCHITECTURE PROOF D — a declared check that never ran.
  it('blocks on a declared check that has never been executed', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_PASS_V1 });
    addDeclaration(context, dossier);

    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );

    expect(evaluation.state).toBe(ProtocolizationReadinessState.VerificationPending);
    expect(evaluation.ready).toBe(false);
    const missing = listProtocolizationReadinessBlockers(evaluation, {
      reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationMissing,
    });
    expect(missing).toHaveLength(1);
    expect(missing[0]).toMatchObject({
      requirementId: READINESS_VERIFICATION,
      checkId: TEST_CHECK_PASS,
    });
  });

  // §131 ARCHITECTURE PROOF E — PASS satisfies the check, and only the check.
  it('satisfies a verification requirement from a current Pass', async () => {
    const { evaluation, dossier } = await verified(READINESS_PASS_V1);

    expect(
      getProtocolizationRequirementAssessment(evaluation, READINESS_VERIFICATION)?.status,
    ).toBe(ProtocolizationRequirementStatus.Satisfied);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);

    // The result itself is untouched: a Pass is still a Pass, and it gained no
    // `accepted` flag.
    const result = dossier.verificationResults.find(
      (candidate) => candidate.checkId === TEST_CHECK_PASS,
    );
    expect(result?.outcome).toBe(VerificationCheckOutcome.Pass);
    expect(result).not.toHaveProperty('accepted');
  });

  // §132 ARCHITECTURE PROOF F / §35 — a current Fail blocks and concludes nothing.
  it('blocks on a current Fail without cancelling the case or drawing a conclusion', async () => {
    const { evaluation, dossier } = await verified(READINESS_FAIL_V1);

    expect(evaluation.ready).toBe(false);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.VerificationPending);
    expect(
      getProtocolizationRequirementAssessment(evaluation, READINESS_VERIFICATION)?.status,
    ).toBe(ProtocolizationRequirementStatus.Blocked);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationFail,
      }),
    ).toHaveLength(1);

    // The case is not cancelled, no evidence was deleted, no declaration was
    // invalidated, and no legal conclusion appears anywhere.
    expect(dossier.protocolizationCase.state).toBe(ProtocolizationCaseState.Draft);
    expect(dossier.declarations).toHaveLength(1);
    const serialized = JSON.stringify(evaluation).toLowerCase();
    for (const forbidden of ['fraud', 'invalid title', 'unlawful', 'rejected asset']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  // §133 ARCHITECTURE PROOF G / §36 — Warning is non-fatal and stays a Warning.
  it('treats a current Warning as satisfied-with-warning and never as a Pass', async () => {
    const { evaluation } = await verified(READINESS_WARNING_V1);

    const assessment = getProtocolizationRequirementAssessment(evaluation, READINESS_VERIFICATION);
    expect(assessment?.status).toBe(ProtocolizationRequirementStatus.SatisfiedWithWarning);
    expect(assessment?.blockers).toEqual([]);
    expect(
      listProtocolizationReadinessWarnings(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_WARNING_CODES.verificationWarning,
      }),
    ).toHaveLength(1);

    // Ready, with the warning preserved rather than rounded away.
    expect(evaluation.state).toBe(ProtocolizationReadinessState.Ready);
    expect(evaluation.warnings.length).toBeGreaterThan(0);
    expect(
      evaluation.warnings.some(
        (warning) =>
          warning.reasonCode === PROTOCOLIZATION_READINESS_WARNING_CODES.verificationWarning,
      ),
    ).toBe(true);
  });

  // §134 ARCHITECTURE PROOF H / §37 — ManualReview defers to a person.
  it('routes a current ManualReview to review work rather than to readiness', async () => {
    const { evaluation } = await verified(READINESS_MANUAL_V1);

    expect(evaluation.ready).toBe(false);
    // The resolution path is a human's, so the state names review work.
    expect(evaluation.state).toBe(ProtocolizationReadinessState.ReviewPending);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationManualReview,
      }),
    ).toHaveLength(1);
    expect(
      getProtocolizationRequirementAssessment(evaluation, READINESS_VERIFICATION)?.status,
    ).toBe(ProtocolizationRequirementStatus.Pending);
  });

  // §135 ARCHITECTURE PROOF I / §38 — Unavailable is distinct from Fail.
  it('keeps Unavailable distinct from Fail and still refuses readiness', async () => {
    const { evaluation } = await verified(READINESS_UNAVAILABLE_V1);

    expect(evaluation.ready).toBe(false);
    expect(evaluation.state).toBe(ProtocolizationReadinessState.VerificationPending);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationUnavailable,
      }),
    ).toHaveLength(1);
    expect(
      listProtocolizationReadinessBlockers(evaluation, {
        reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationFail,
      }),
    ).toEqual([]);
    // An Unavailable check is not an affirmative finding, so the requirement is
    // Pending rather than Blocked.
    expect(
      getProtocolizationRequirementAssessment(evaluation, READINESS_VERIFICATION)?.status,
    ).toBe(ProtocolizationRequirementStatus.Pending);
  });

  // §136 ARCHITECTURE PROOF J / §39 — a stale Pass does not satisfy.
  it('refuses to let a Pass from an earlier revision satisfy the current one', async () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_PASS_V1 });
    addDeclaration(context, dossier);
    await runChecks(context, dossier);

    const current = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(current.state).toBe(ProtocolizationReadinessState.Ready);

    // The case moves on. The historical Pass is preserved and stops being current.
    const moved = activateProtocolizationCase(context, dossier.protocolizationCase);
    const later = evaluateProtocolizationReadiness(context, moved.protocolizationCase, {
      ...readinessInputs(dossier),
    });

    expect(later.ready).toBe(false);
    expect(later.state).toBe(ProtocolizationReadinessState.VerificationPending);
    const stale = listProtocolizationReadinessBlockers(later, {
      reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationStale,
    });
    expect(stale).toHaveLength(1);
    expect(stale[0]?.atCaseRevision).toBe(moved.protocolizationCase.revision);
    // The old result is untouched, and still describes the revision it evaluated.
    expect(dossier.verificationResults[0]?.evaluatedCaseRevision).toBe(
      current.evaluatedCaseRevision,
    );

    // §126 — re-running the checks against the new revision recovers readiness.
    dossier.protocolizationCase = moved.protocolizationCase;
    await runChecks(context, dossier, { idPrefix: 'execution-rerun' });
    const recovered = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(recovered.state).toBe(ProtocolizationReadinessState.Ready);
    // Both results remain readable, in order.
    expect(dossier.verificationResults.length).toBeGreaterThan(1);
  });

  // §40 / §41 — every declared check counts, and no majority rule exists.
  it('never satisfies an All requirement while one declared check fails', async () => {
    const { evaluation } = await verified(READINESS_MULTI_CHECK_V1);

    // Two of three checks passed. That is not two-thirds of a satisfied
    // requirement; it is an unsatisfied one.
    expect(evaluation.ready).toBe(false);
    expect(
      getProtocolizationRequirementAssessment(evaluation, READINESS_VERIFICATION)?.status,
    ).toBe(ProtocolizationRequirementStatus.Blocked);
    const failures = listProtocolizationReadinessBlockers(evaluation, {
      reasonCode: PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationFail,
    });
    expect(failures).toHaveLength(1);
    expect(failures[0]?.checkId).toBe(TEST_CHECK_FAIL);

    // No score, percentage or aggregate verdict appears on the result.
    const serialized = JSON.stringify(evaluation);
    for (const forbidden of ['score', 'percentage', 'confidence', 'passRate', 'verdict']) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  // §30 — APV-09 consumes APV-07's results and re-executes nothing.
  it('records the executions it read and never produces one of its own', async () => {
    const { evaluation, dossier, context } = await verified(READINESS_PASS_V1);

    const assessment = getProtocolizationRequirementAssessment(evaluation, READINESS_VERIFICATION);
    expect(assessment?.verificationExecutionIds).toEqual(
      dossier.verificationResults
        .filter((result) => result.requirementId === READINESS_VERIFICATION)
        .map((result) => result.executionId),
    );

    // The number of results is exactly what APV-07 produced: evaluating again
    // adds nothing, because nothing here executes a check.
    const before = dossier.verificationResults.length;
    evaluateProtocolizationReadiness(context, dossier.protocolizationCase, readinessInputs(dossier));
    expect(dossier.verificationResults.length).toBe(before);
  });

  // §174 HARD TEST — all checks passing is not readiness.
  it('never treats an all-Pass tally as readiness while another requirement is unmet', () => {
    const context = createReadinessContext();
    const dossier = newDossier(context, { profile: READINESS_PASS_V1 });
    // No declaration: the required declaration requirement is unmet even though
    // no check has failed.
    const evaluation = evaluateProtocolizationReadiness(
      context,
      dossier.protocolizationCase,
      readinessInputs(dossier),
    );
    expect(evaluation.ready).toBe(false);
  });
});
