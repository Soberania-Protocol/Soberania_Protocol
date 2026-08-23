import type { AdapterResult } from '@aoc/protocol/adapters';
import type { ProtocolizationCaseId, ProtocolizationProfileRef, ProtocolizationTenantId } from '../case/case-identifiers';
import type { ProtocolizationResultId } from './execution-identifiers';
import type { ProtocolizationResult } from './protocolization-result';
/**
 * Where protocolization history lives.
 *
 * In the vertical, for the reason Gate A0 / `U-6` settled for cases, receipts,
 * declaration records, verification results and review history: no vertical
 * workflow persistence port goes into Soberanía Protocol, and Protocol never
 * learns that asset protocolization exists. APV-10 ships the **port** and one
 * deterministic in-memory implementation of it — no database adapter, no
 * migration, no schema. Binding this interface to a store is an infrastructure
 * decision with its own owner and its own review.
 *
 * ### Append-only, and more strictly than anywhere else in this package
 *
 * There is no update and no delete. A result records that a protocolization
 * happened; rewriting one would be rewriting the single fact this vertical
 * exists to produce, and removing one would erase the only evidence that a case
 * revision was ever protocolized. A case that changes and is protocolized again
 * gets a *new* result at the new revision, and both remain readable, in order,
 * each bound to the revision it actually executed. The older one is never
 * superseded, marked, flagged or shadowed: supersession semantics do not exist
 * in this architecture, and inventing them here would be deciding, silently,
 * that one historical fact outranks another.
 *
 * ### Two distinct uniqueness rules
 *
 * ```text
 * (tenantId, resultId)                          identity  — two artifacts may
 *                                                 not share one name
 * (tenantId, caseId, profile, executedRevision)  basis    — one execution basis
 *                                                 is protocolized at most once
 * ```
 *
 * The first is the ordinary tenant-scoped identity rule every APV record
 * carries. The second is the one that matters to this slice, and it is why a
 * fresh result id does not buy a second protocolization: two results naming the
 * same tenant, case, pin and revision would be two records of one act, and a
 * reader could not tell which of them the world was supposed to believe. A
 * caller that wants to know whether a basis is already protocolized asks
 * `getByBasis` and gets the existing artifact — deterministically, and without
 * executing anything.
 *
 * ### Where idempotency actually lives
 *
 * Here, deliberately, and not in the domain operation. `executeProtocolization`
 * is pure and holds no repository — exactly as APV-05 through APV-08's
 * operations hold none — so *at most once per basis* is enforced where results
 * actually live, on the same terms as duplicate-id rejection. This is the same
 * split APV-08 made for one-terminal-decision-per-request, and it has the same
 * consequence: a retry that replays a successful execution is refused rather
 * than producing a second protocolization, and a failed execution committed
 * nothing, so retrying it is free.
 *
 * ### Tenancy
 *
 * Every method takes the tenant. There is deliberately no `get(resultId)`
 * overload, no `listByCase(caseId)` overload and no cross-tenant enumeration:
 * knowing another tenant's `resultId` or `caseId` must be worth nothing, and a
 * duplicate-id refusal must never become a way to discover that another tenant
 * protocolized something.
 *
 * ### Ordering
 *
 * Every listing is ordered by execution instant, then by identifier as a stable
 * tie-break — not by insertion order, which would make the reference
 * implementation's `Map` an accidental part of the contract that a database
 * adapter could not reproduce.
 */
export interface ProtocolizationResultRepository {
    /** The result, or `undefined` when this tenant has no such result. */
    get(tenantId: ProtocolizationTenantId, resultId: ProtocolizationResultId): AdapterResult<ProtocolizationResult | undefined>;
    exists(tenantId: ProtocolizationTenantId, resultId: ProtocolizationResultId): AdapterResult<boolean>;
    /**
     * Every protocolization recorded for one of this tenant's cases, in execution
     * order. Empty for a case that belongs to another tenant — indistinguishable,
     * on purpose, from a case that was never protocolized.
     *
     * The whole history: a case protocolized at revision `10` and again at
     * revision `15` appears twice, and nothing here picks between them.
     */
    listByCase(tenantId: ProtocolizationTenantId, caseId: ProtocolizationCaseId): AdapterResult<readonly ProtocolizationResult[]>;
    /**
     * The result for one exact execution basis, when one has been recorded.
     *
     * Singular, because a basis is protocolized at most once. This is what makes
     * an exact replay deterministic: a caller holding a `Ready` evaluation asks
     * whether this tenant, case, pin and revision already have a result, and
     * either gets the existing artifact or learns that executing is still to be
     * done.
     */
    getByBasis(tenantId: ProtocolizationTenantId, caseId: ProtocolizationCaseId, profile: ProtocolizationProfileRef, executedCaseRevision: number): AdapterResult<ProtocolizationResult | undefined>;
    /**
     * Records a result. Rejects a duplicate `(tenantId, resultId)`
     * (`PROTOCOLIZATION_EXECUTION_RESULT_DUPLICATE`), rejects a second result for
     * an execution basis that already has one
     * (`PROTOCOLIZATION_EXECUTION_BASIS_ALREADY_EXECUTED`), and never overwrites.
     */
    save(result: ProtocolizationResult): AdapterResult<void>;
}
/**
 * Total order over results: execution instant, then identifier.
 *
 * Exported for reuse *inside* this package only. Two copies of an ordering rule
 * are two orders waiting to disagree.
 */
export declare function compareProtocolizationResults(left: ProtocolizationResult, right: ProtocolizationResult): number;
/**
 * A deterministic, in-process implementation of the result port.
 *
 * It exists to make the contract executable — tenant isolation, duplicate-id
 * rejection, one-result-per-basis, append-only history and deterministic
 * ordering are behaviours a port can state but only an implementation can
 * demonstrate — and it is the reference a database adapter must match. Results
 * are validated on the way in and deeply frozen, so a caller cannot mutate
 * stored history by holding on to a reference it saved.
 */
export declare function createInMemoryProtocolizationResultRepository(): ProtocolizationResultRepository;
//# sourceMappingURL=execution-repository.d.ts.map