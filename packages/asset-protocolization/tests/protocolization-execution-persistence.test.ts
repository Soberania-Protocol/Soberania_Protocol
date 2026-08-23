import {
  PROTOCOLIZATION_EXECUTION_ERROR_CODES,
  ProtocolizationExecutionError,
  createInMemoryProtocolizationResultRepository,
  reconstituteProtocolizationResult,
} from '@aoc/asset-protocolization';
import type { ProtocolizationResult } from '@aoc/asset-protocolization';

import { TENANT_B, createTestClock } from './fixtures/test-cases';
import { sync } from './fixtures/test-declarations';
import { addDeclaration } from './fixtures/test-readiness';
import {
  createExecutionContext,
  execute,
  readyDeclarationDossier,
} from './fixtures/test-execution';

/**
 * Protocolization history: tenant-scoped, append-only, and immutable.
 *
 * The port carries two distinct uniqueness rules — identity and execution basis
 * — and it is the basis rule that stops one case revision being protocolized
 * twice. Both are demonstrated here rather than merely asserted in prose.
 */
describe('APV-10 protocolization result persistence', () => {
  // §21 / §115 — the ordinary path.
  it('stores a result and returns it to its own tenant', () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const { result } = execute(context, dossier);
    const store = createInMemoryProtocolizationResultRepository();

    store.save(result);

    expect(sync(store.get(context.tenantId, result.resultId))).toEqual(result);
    expect(sync(store.exists(context.tenantId, result.resultId))).toBe(true);
    expect(sync(store.listByCase(context.tenantId, result.caseId))).toEqual([result]);
    expect(
      sync(
        store.getByBasis(
          context.tenantId,
          result.caseId,
          result.profile,
          result.executedCaseRevision,
        ),
      ),
    ).toEqual(result);
  });

  // §72 / §77 / §133 / §134 — tenancy, and no existence leakage.
  it('tells another tenant nothing at all', () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const { result } = execute(context, dossier);
    const store = createInMemoryProtocolizationResultRepository();
    store.save(result);

    expect(sync(store.get(TENANT_B, result.resultId))).toBeUndefined();
    expect(sync(store.exists(TENANT_B, result.resultId))).toBe(false);
    expect(sync(store.listByCase(TENANT_B, result.caseId))).toEqual([]);
    expect(
      sync(store.getByBasis(TENANT_B, result.caseId, result.profile, result.executedCaseRevision)),
    ).toBeUndefined();

    // ...and tenant B may store its own result under the very same identifier,
    // so a duplicate-id refusal can never become a way to discover tenant A.
    const other = { ...result, tenantId: TENANT_B, caseId: 'case-of-tenant-b' };
    expect(() => store.save(other)).not.toThrow();
    expect(sync(store.get(TENANT_B, other.resultId))).toEqual(other);
    expect(sync(store.get(context.tenantId, result.resultId))).toEqual(result);

    // A blank tenant is not a wildcard onto everybody's history.
    expect(() => store.get('', result.resultId)).toThrow(ProtocolizationExecutionError);
    expect(() => store.listByCase('', result.caseId)).toThrow(ProtocolizationExecutionError);
  });

  // §79 — identity uniqueness.
  it('never overwrites an existing (tenantId, resultId)', () => {
    const context = createExecutionContext();
    const first = readyDeclarationDossier(context, { caseId: 'case-one' });
    const second = readyDeclarationDossier(context, { caseId: 'case-two' });
    const store = createInMemoryProtocolizationResultRepository();

    const original = execute(context, first, { resultId: 'shared-id' }).result;
    store.save(original);

    let caught: ProtocolizationExecutionError | undefined;
    try {
      store.save(execute(context, second, { resultId: 'shared-id' }).result);
    } catch (error) {
      caught = error as ProtocolizationExecutionError;
    }
    expect(caught?.code).toBe(PROTOCOLIZATION_EXECUTION_ERROR_CODES.duplicateResult);
    expect(sync(store.get(context.tenantId, 'shared-id'))).toEqual(original);
  });

  // §18 / §114 — stored history cannot be mutated through a held reference.
  it('freezes what it stores, and exposes no update or delete', () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const { result } = execute(context, dossier);
    const store = createInMemoryProtocolizationResultRepository();
    store.save(result);

    const stored = sync(store.get(context.tenantId, result.resultId)) as ProtocolizationResult;
    expect(Object.isFrozen(stored)).toBe(true);
    expect(Object.isFrozen(stored.readinessBasis)).toBe(true);
    expect(Object.isFrozen(stored.materialRefs)).toBe(true);

    expect(Object.keys(store).sort()).toEqual([
      'exists',
      'get',
      'getByBasis',
      'listByCase',
      'save',
    ]);
  });

  // §78 — deterministic order, independent of insertion order.
  it('orders a case listing by execution instant, then identifier', () => {
    const clock = createTestClock('2026-01-01T00:00:00.000Z');
    const context = createExecutionContext({ clock });
    const dossier = readyDeclarationDossier(context);
    const store = createInMemoryProtocolizationResultRepository();

    // Three revisions of one case, protocolized out of chronological order.
    const first = execute(context, dossier, { resultId: 'result-a' }).result;
    addDeclaration(context, dossier, {
      declarationId: 'declaration-2',
      materialId: 'material-declaration-2',
      claimRef: 'aoc:claim:readiness-0002',
    });
    clock.advance(3600);
    const second = execute(context, dossier, { resultId: 'result-b' }).result;
    addDeclaration(context, dossier, {
      declarationId: 'declaration-3',
      materialId: 'material-declaration-3',
      claimRef: 'aoc:claim:readiness-0003',
    });
    clock.advance(3600);
    const third = execute(context, dossier, { resultId: 'result-c' }).result;

    store.save(third);
    store.save(first);
    store.save(second);

    expect(
      sync(store.listByCase(context.tenantId, dossier.protocolizationCase.caseId)).map(
        (entry) => entry.resultId,
      ),
    ).toEqual(['result-a', 'result-b', 'result-c']);
  });

  // §76 / §132 — reconstitution validates before it trusts.
  it('reconstitutes a valid historical result and refuses a malformed one', () => {
    const context = createExecutionContext();
    const dossier = readyDeclarationDossier(context);
    const { result } = execute(context, dossier);

    const roundTripped = reconstituteProtocolizationResult(
      JSON.parse(JSON.stringify(result)) as unknown,
    );
    expect(roundTripped).toEqual(result);
    expect(Object.isFrozen(roundTripped)).toBe(true);

    const malformed: readonly unknown[] = [
      undefined,
      null,
      'not an object',
      [],
      { ...result, schemaVersion: 'aoc-protocolization-result/1' },
      { ...result, resultId: '' },
      { ...result, tenantId: '' },
      { ...result, executedCaseRevision: 0 },
      { ...result, executedAt: 'not-an-instant' },
      { ...result, correlationId: undefined },
      { ...result, surprise: true },
      // A protocolization justified by a conclusion about another revision.
      {
        ...result,
        readinessBasis: {
          ...result.readinessBasis,
          evaluatedCaseRevision: result.executedCaseRevision + 1,
        },
      },
      // A protocolization claiming a readiness state that cannot authorize one.
      { ...result, readinessBasis: { ...result.readinessBasis, state: 'ReviewPending' } },
      // A protocolization that admits it had blockers.
      { ...result, readinessBasis: { ...result.readinessBasis, blockerCount: 1 } },
      // A protocolization quoting a cancelled lifecycle.
      { ...result, readinessBasis: { ...result.readinessBasis, caseState: 'Cancelled' } },
    ];

    for (const candidate of malformed) {
      expect(() => reconstituteProtocolizationResult(candidate)).toThrow(
        ProtocolizationExecutionError,
      );
      expect(() => createInMemoryProtocolizationResultRepository().save(candidate as never)).toThrow(
        ProtocolizationExecutionError,
      );
    }
  });
});
