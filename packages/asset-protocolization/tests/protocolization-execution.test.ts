import {
  PROTOCOLIZATION_EXECUTION_EVENT_TYPES,
  PROTOCOLIZATION_EXECUTION_RESULT_SCHEMA_VERSION,
  PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION,
  ProtocolizationCaseState,
  ProtocolizationMaterialKind,
  ProtocolizationReadinessState,
  activateProtocolizationCase,
  executeProtocolization,
  isProtocolizationResultCurrentForCase,
  listProtocolizationResultsForRevision,
} from '@aoc/asset-protocolization';

import { createTestClock } from './fixtures/test-cases';
import {
  READINESS_ATTESTATION,
  READINESS_CONTENT_SUBJECT,
  READINESS_EXTERNAL_SUBJECT,
  READINESS_FULL_V1,
  addDeclaration,
} from './fixtures/test-readiness';
import {
  createExecutionContext,
  evaluate,
  execute,
  readyDeclarationDossier,
  readyDossier,
  readyEvaluation,
  readyExternalSubjectDossier,
} from './fixtures/test-execution';

/**
 * APV-10 — protocolization execution.
 *
 * The act APV-09's answer authorizes, and the artifact it produces. Every
 * readiness evaluation used here is derived by APV-09's own operation over a
 * dossier assembled by APV-04 through APV-08, never hand-written: a proof about
 * *consuming* readiness is worth nothing if the readiness was invented by the
 * test.
 */
describe('APV-10 protocolization execution', () => {
  // §105 — the central success case.
  it('executes a current Ready evaluation and produces one immutable result', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);
    const evaluation = readyEvaluation(context, dossier);
    const revision = dossier.protocolizationCase.revision;

    const { result, event } = executeProtocolization(
      context,
      dossier.protocolizationCase,
      evaluation,
      { resultId: 'protocolization-result-0001', correlationId: 'aoc:correlation:exec-0001' },
    );

    expect(result.schemaVersion).toBe(PROTOCOLIZATION_EXECUTION_RESULT_SCHEMA_VERSION);
    expect(result.resultId).toBe('protocolization-result-0001');
    expect(result.tenantId).toBe(dossier.protocolizationCase.tenantId);
    expect(result.caseId).toBe(dossier.protocolizationCase.caseId);
    expect(result.profile).toEqual(dossier.protocolizationCase.profile);
    expect(result.subject).toEqual(dossier.protocolizationCase.subject);
    expect(result.executedCaseRevision).toBe(revision);
    expect(result.correlationId).toBe('aoc:correlation:exec-0001');
    expect(result.executedAt).toBe(context.clock.now());

    // The event is the same fact, narrowly.
    expect(event.eventType).toBe(PROTOCOLIZATION_EXECUTION_EVENT_TYPES.executed);
    expect(event.resultId).toBe(result.resultId);
    expect(event.caseId).toBe(result.caseId);
    expect(event.tenantId).toBe(result.tenantId);
    expect(event.profile).toEqual(result.profile);
    expect(event.executedCaseRevision).toBe(result.executedCaseRevision);
    expect(event.occurredAt).toBe(result.executedAt);
    expect(event.correlationId).toBe(result.correlationId);
  });

  // §12 / §32 / §47 — the basis is quoted, and it is enough to audit the act.
  it('preserves the exact APV-09 conclusion it stood on', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);
    const evaluation = readyEvaluation(context, dossier);

    const { result } = execute(context, dossier);
    const basis = result.readinessBasis;

    expect(basis.evaluationSchemaVersion).toBe(PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION);
    expect(basis.state).toBe(ProtocolizationReadinessState.Ready);
    expect(basis.evaluatedCaseRevision).toBe(evaluation.evaluatedCaseRevision);
    expect(basis.evaluatedCaseRevision).toBe(result.executedCaseRevision);
    expect(basis.caseState).toBe(evaluation.caseState);
    expect(basis.evaluatedAt).toBe(evaluation.evaluatedAt);
    expect(basis.blockerCount).toBe(0);
  });

  // §31 / §135 — enough references to audit, and no copied documents.
  it('names the dossier it rested on by reference, and copies none of it', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);
    const { result } = execute(context, dossier);

    // Every material association of the executed revision, in the case's own order.
    expect(result.materialRefs.map((entry) => entry.materialId)).toEqual(
      dossier.protocolizationCase.materials.map((material) => material.materialId),
    );
    const declaration = result.materialRefs.find(
      (entry) => entry.kind === ProtocolizationMaterialKind.Declaration,
    );
    expect(declaration?.ref).toBe('aoc:claim:readiness-0001');
    expect(result.materialRefs.map((entry) => entry.ref)).toContain('aoc:evidence:execution-a');
    expect(result.materialRefs.map((entry) => entry.ref)).toContain('aoc:evidence:execution-b');

    // The workflow records that established readiness, by id.
    expect(result.readinessBasis.verificationExecutionIds.length).toBeGreaterThan(0);
    expect(result.readinessBasis.reviewDecisionIds).toEqual([
      `review-decision-${READINESS_ATTESTATION}`,
    ]);
    expect(result.readinessBasis.attestationRefs).toEqual([
      `aoc:attestation:readiness-${READINESS_ATTESTATION}`,
    ]);

    // ...and nothing else. No statement, no document, no reviewer note, no
    // credential payload, no evidence body reaches the artifact.
    const serialized = JSON.stringify(result);
    for (const payload of [
      'Test-only attested statement',
      'Test-only evidence record',
      'declarant',
      'reviewer',
      'issuer',
      'statement',
      'note',
    ]) {
      expect(serialized).not.toContain(payload);
    }
  });

  // §33 / §46 / §106 / §136 — Ready with warnings executes, and the warnings survive.
  it('executes a Ready evaluation that carries warnings, and preserves them unreinterpreted', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);
    const evaluation = readyEvaluation(context, dossier);

    // The full shape carries an unsatisfied Optional requirement, so this is a
    // genuine Ready-with-warnings, not a contrived one.
    expect(evaluation.warnings.length).toBeGreaterThan(0);
    expect(evaluation.blockers).toEqual([]);

    const { result } = execute(context, dossier);

    expect(result.readinessBasis.warnings).toEqual(evaluation.warnings);
    // Carried, never promoted: nothing became a blocker on the way in.
    expect(result.readinessBasis.blockerCount).toBe(0);
  });

  // §36 / §119 — APV-09 permits Ready on Draft and on Active; APV-10 tightens neither.
  it('executes a Draft case and an Active case alike', async () => {
    const draftContext = createExecutionContext();
    const draft = await readyDossier(draftContext, { caseId: 'case-draft' });
    expect(draft.protocolizationCase.state).toBe(ProtocolizationCaseState.Draft);
    expect(execute(draftContext, draft).result.readinessBasis.caseState).toBe(
      ProtocolizationCaseState.Draft,
    );

    const activeContext = createExecutionContext();
    const active = readyDeclarationDossier(activeContext, { caseId: 'case-active' });
    const activated = activateProtocolizationCase(activeContext, active.protocolizationCase);
    active.protocolizationCase = activated.protocolizationCase;
    expect(active.protocolizationCase.state).toBe(ProtocolizationCaseState.Active);
    expect(execute(activeContext, active).result.readinessBasis.caseState).toBe(
      ProtocolizationCaseState.Active,
    );
  });

  // §90 / §128 — one code path, two fundamentally different subjects.
  it('executes a byte subject and a non-byte subject through the same path', async () => {
    const context = createExecutionContext();

    const withBytes = await readyDossier(context, { caseId: 'case-bytes' });
    const bytesResult = execute(context, withBytes, { resultId: 'result-bytes' }).result;

    const withoutBytes = await readyExternalSubjectDossier(context, { caseId: 'case-no-bytes' });
    const externalResult = execute(context, withoutBytes, { resultId: 'result-no-bytes' }).result;

    expect(bytesResult.subject).toEqual(READINESS_CONTENT_SUBJECT);
    expect(bytesResult.subject.contentIdentity).toBeDefined();

    expect(externalResult.subject).toEqual(READINESS_EXTERNAL_SUBJECT);
    // Absent is absent: no digest was synthesized to fill the field.
    expect(Object.prototype.hasOwnProperty.call(externalResult.subject, 'contentIdentity')).toBe(
      false,
    );

    // The two artifacts differ only in what the subjects actually are.
    expect(Object.keys(bytesResult).sort()).toEqual(Object.keys(externalResult).sort());
  });

  // §29 — the subject is preserved, never replaced by a new asset identity.
  it('preserves the case subject exactly and mints no identity of its own', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context);
    const { result } = execute(context, dossier);

    expect(result.subject.subjectRef.sovereignAssetId).toBe(
      dossier.protocolizationCase.subject.subjectRef.sovereignAssetId,
    );
    expect(JSON.stringify(result.subject)).toBe(
      JSON.stringify(dossier.protocolizationCase.subject),
    );
  });

  // §37 / §38 / §131 — every instant comes from the injected clock.
  it('stamps the execution from the injected clock, and nowhere else', async () => {
    const clock = createTestClock('2026-03-04T05:06:07.000Z');
    const context = createExecutionContext({ clock });
    const dossier = readyDeclarationDossier(context);

    clock.set('2026-06-07T08:09:10.000Z');
    const first = execute(context, dossier).result;
    expect(first.executedAt).toBe('2026-06-07T08:09:10.000Z');

    // A second execution of the same basis would be refused by the store, but
    // the operation itself remains a pure function of its inputs plus the clock:
    // move the clock, and only the stamps move.
    clock.set('2027-01-01T00:00:00.000Z');
    const second = execute(context, dossier, { resultId: 'protocolization-result-0002' }).result;
    expect(second.executedAt).toBe('2027-01-01T00:00:00.000Z');
    expect(second.executedCaseRevision).toBe(first.executedCaseRevision);
    expect(second.profile).toEqual(first.profile);
    expect(second.subject).toEqual(first.subject);
    expect(second.materialRefs).toEqual(first.materialRefs);
    // Nothing anywhere read a wall clock: both instants are exactly what the
    // injected port returned.
    expect(Date.parse(second.executedAt)).toBeGreaterThan(Date.parse(first.executedAt));
  });

  // §62 — a result describes one revision, and does not follow its case.
  it('stops describing the case once the case moves on, without becoming false', async () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const { result } = execute(context, dossier);

    expect(isProtocolizationResultCurrentForCase(result, dossier.protocolizationCase)).toBe(true);
    expect(listProtocolizationResultsForRevision([result], dossier.protocolizationCase)).toEqual([
      result,
    ]);

    const executedRevision = result.executedCaseRevision;
    addDeclaration(context, dossier, {
      declarationId: 'declaration-later',
      materialId: 'material-declaration-later',
      claimRef: 'aoc:claim:readiness-0002',
    });

    expect(isProtocolizationResultCurrentForCase(result, dossier.protocolizationCase)).toBe(false);
    expect(listProtocolizationResultsForRevision([result], dossier.protocolizationCase)).toEqual([]);
    // Unchanged, and still true about the revision it names.
    expect(result.executedCaseRevision).toBe(executedRevision);
  });

  // §7 / §144.3 — execution reads APV-09's answer; it never derives one.
  it('is handed a conclusion, and is given no dossier to draw one from', async () => {
    const context = createExecutionContext();
    const dossier = await readyDossier(context, { profile: READINESS_FULL_V1 });
    const evaluation = readyEvaluation(context, dossier);

    // The operation's whole surface: context, case, evaluation, request. There
    // is no receipts, declarations, verificationResults, reviewDecisions or
    // attestations parameter anywhere, so re-deriving readiness is not something
    // this slice declined to do — it is something it cannot express.
    expect(executeProtocolization).toHaveLength(4);

    const { result } = executeProtocolization(context, dossier.protocolizationCase, evaluation, {
      resultId: 'protocolization-result-0001',
    });

    // What it recorded is the conclusion it was handed, not one of its own.
    expect(result.readinessBasis.evaluatedAt).toBe(evaluation.evaluatedAt);
    expect(result.readinessBasis.evaluatedCaseRevision).toBe(evaluation.evaluatedCaseRevision);
    expect(result.readinessBasis.caseState).toBe(evaluation.caseState);
  });
});
