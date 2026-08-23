import {
  PROTOCOLIZATION_EXECUTION_ERROR_CODES,
  ProtocolizationExecutionError,
  createInMemoryProtocolizationResultRepository,
} from '@aoc/asset-protocolization';
import type { ProtocolizationResult } from '@aoc/asset-protocolization';

import { sync } from './fixtures/test-declarations';
import { addDeclaration } from './fixtures/test-readiness';
import {
  createExecutionContext,
  execute,
  readyDeclarationDossier,
  readyEvaluation,
} from './fixtures/test-execution';

/**
 * Idempotency and re-protocolization.
 *
 * ```text
 * exact replay of a committed execution   -> the first result stands; no second
 * a second id for the same basis          -> refused; a name is not a new act
 * a retry after a refusal                 -> free; nothing was committed
 * a new revision with a new Ready          -> a new result beside the old one
 * ```
 */

const refusal = (act: () => void): ProtocolizationExecutionError => {
  try {
    act();
  } catch (error) {
    if (error instanceof ProtocolizationExecutionError) return error;
    throw error;
  }
  throw new Error('expected the act to be refused');
};

describe('APV-10 execution idempotency', () => {
  // §19 / §20A / §81 / §116 — an exact replay produces no second protocolization.
  it('lets an exact replay find the existing result rather than making another', () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const store = createInMemoryProtocolizationResultRepository();

    const first = execute(context, dossier, { resultId: 'result-once' }).result;
    store.save(first);

    // The deterministic answer to "has this basis already been protocolized?".
    const existing = sync(
      store.getByBasis(
        context.tenantId,
        first.caseId,
        first.profile,
        first.executedCaseRevision,
      ),
    );
    expect(existing).toEqual(first);

    // A caller that replays anyway — same basis, same id — is refused, and the
    // first result is what remains.
    const replay = execute(context, dossier, { resultId: 'result-once' }).result;
    expect(refusal(() => store.save(replay)).code).toBe(
      PROTOCOLIZATION_EXECUTION_ERROR_CODES.duplicateResult,
    );
    expect(sync(store.listByCase(context.tenantId, first.caseId))).toEqual([first]);
  });

  // §20B / §80 / §117 — a fresh identifier does not buy a second protocolization.
  it('refuses a second result for the same tenant, case, pin and revision', () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const store = createInMemoryProtocolizationResultRepository();

    const first = execute(context, dossier, { resultId: 'result-a' }).result;
    store.save(first);

    const second = execute(context, dossier, { resultId: 'result-b' }).result;
    expect(second.resultId).not.toBe(first.resultId);
    expect(second.executedCaseRevision).toBe(first.executedCaseRevision);

    const error = refusal(() => store.save(second));
    expect(error.code).toBe(PROTOCOLIZATION_EXECUTION_ERROR_CODES.duplicateBasis);
    expect(error.details.executedCaseRevision).toBe(first.executedCaseRevision);
    expect(sync(store.listByCase(context.tenantId, first.caseId))).toEqual([first]);
  });

  // §20C — a refused execution committed nothing, so retrying it is free.
  it('lets a caller retry after a refusal, because nothing was committed', () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const store = createInMemoryProtocolizationResultRepository();
    const evaluation = readyEvaluation(context, dossier);

    // A refusal — a revision the caller asserted wrongly.
    expect(
      refusal(() =>
        execute(context, dossier, {
          resultId: 'result-retry',
          expectedCaseRevision: evaluation.evaluatedCaseRevision + 1,
        }),
      ).code,
    ).toBe(PROTOCOLIZATION_EXECUTION_ERROR_CODES.revisionMismatch);
    expect(sync(store.listByCase(context.tenantId, dossier.protocolizationCase.caseId))).toEqual([]);

    // The same id is still free, because the failed attempt claimed nothing.
    const { result } = execute(context, dossier, { resultId: 'result-retry' });
    store.save(result);
    expect(sync(store.get(context.tenantId, 'result-retry'))).toEqual(result);
  });

  // §63 / §64 / §118 — a later revision may be protocolized in its own right.
  it('protocolizes a later revision beside the earlier result, overwriting nothing', () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const store = createInMemoryProtocolizationResultRepository();

    const r1 = execute(context, dossier, { resultId: 'result-r1' }).result;
    store.save(r1);
    const firstRevision = r1.executedCaseRevision;
    const r1Snapshot = JSON.stringify(r1);

    // The dossier moves on, and APV-09 is asked again — nothing is inherited.
    addDeclaration(context, dossier, {
      declarationId: 'declaration-later',
      materialId: 'material-declaration-later',
      claimRef: 'aoc:claim:readiness-0002',
    });
    context.clock.advance(3600);
    const laterEvaluation = readyEvaluation(context, dossier);
    expect(laterEvaluation.evaluatedCaseRevision).toBe(firstRevision + 1);

    const r2 = execute(context, dossier, { resultId: 'result-r2' }).result;
    store.save(r2);

    expect(r2.executedCaseRevision).toBe(firstRevision + 1);
    expect(sync(store.get(context.tenantId, 'result-r1'))).toEqual(r1);
    expect(JSON.stringify(r1)).toBe(r1Snapshot);

    const history = sync(
      store.listByCase(context.tenantId, dossier.protocolizationCase.caseId),
    ) as readonly ProtocolizationResult[];
    expect(history.map((entry) => entry.resultId)).toEqual(['result-r1', 'result-r2']);
    expect(history.map((entry) => entry.executedCaseRevision)).toEqual([
      firstRevision,
      firstRevision + 1,
    ]);

    // No supersession, no flag, no pointer: two historical facts, both intact.
    for (const entry of history) {
      expect(Object.keys(entry)).not.toContain('supersedes');
      expect(Object.keys(entry)).not.toContain('supersededBy');
      expect(Object.keys(entry)).not.toContain('current');
    }

    // And each basis remains individually addressable.
    expect(
      sync(store.getByBasis(context.tenantId, r1.caseId, r1.profile, firstRevision))?.resultId,
    ).toBe('result-r1');
    expect(
      sync(store.getByBasis(context.tenantId, r2.caseId, r2.profile, firstRevision + 1))?.resultId,
    ).toBe('result-r2');
  });

  // §65 — a successful execution does not freeze, close or cancel the case.
  it('leaves the case free to carry on after a successful execution', () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);

    const before = JSON.stringify(dossier.protocolizationCase);
    execute(context, dossier, { resultId: 'result-carry-on' });
    expect(JSON.stringify(dossier.protocolizationCase)).toBe(before);

    // Material still attaches, exactly as it did before.
    expect(() =>
      addDeclaration(context, dossier, {
        declarationId: 'declaration-after',
        materialId: 'material-declaration-after',
        claimRef: 'aoc:claim:readiness-0002',
      }),
    ).not.toThrow();
  });
});
