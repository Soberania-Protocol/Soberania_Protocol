import type { ProtocolizationCaseContext } from '../case/case-operations';
import type { ProtocolizationCase } from '../case/protocolization-case';
import type { ProtocolizationReadinessEvaluation } from '../state-machine/readiness-evaluation';
import type { ProtocolizationExecutionOutcome, ProtocolizationExecutionRequest } from './execution-request';
import type { ProtocolizationResult } from './protocolization-result';
/**
 * Executes protocolization for one `ProtocolizationCase` at its exact current
 * revision, from a current `Ready` APV-09 evaluation.
 *
 * ### Preconditions, in the order they are checked
 *
 * ```text
 * 1  the acting tenant is well-formed and owns the case
 * 2  the exact pinned AssetProfile version resolves from the catalogue
 * 3  the case validates against that profile, and is not Cancelled
 * 4  the request is structurally admissible and names a valid result id
 * 5  a readiness evaluation was supplied
 * 6  it is a shape APV-09 could have produced
 * 7  its state is Ready
 * 8  it names this tenant, this case, this exact pin and this lifecycle
 * 9  it describes this exact revision — and APV-09's own currency guard agrees
 * 10 the request's expectedCaseRevision, if given, is exactly that revision
 * ```
 *
 * The tenant gate is first so that a foreign caller learns nothing about a case
 * it may not see — not whether it exists, not whether it is valid, and not
 * whether it has already been protocolized.
 *
 * ### What it returns, and what the caller still owes
 *
 * A `ProtocolizationExecutionOutcome`: the immutable, deeply frozen result and
 * the single fact it produced. Persisting the result and dispatching the event
 * belong to a composition layer, which is also where the *one result per
 * execution basis* invariant is enforced — see `execution-repository.ts`. This
 * function holds no repository, so it cannot and does not claim that two
 * independent writes are atomic.
 *
 * Throws `ProtocolizationExecutionError` on every refusal above. A refusal
 * leaves the case, the dossier, the readiness evaluation and the result store
 * exactly as they were, and produces no event: nothing is committed before every
 * precondition holds, so there is no partial execution to unwind.
 */
export declare function executeProtocolization(context: ProtocolizationCaseContext, protocolizationCase: ProtocolizationCase, readinessEvaluation: ProtocolizationReadinessEvaluation, request: ProtocolizationExecutionRequest): ProtocolizationExecutionOutcome;
/**
 * Turns an untrusted, persisted value back into a protocolization result, or
 * fails.
 *
 * The single supported way to bring one back across a persistence or network
 * boundary. It validates before it trusts and freezes what it returns, so a
 * store cannot hand a caller a result the workflow would have refused to
 * produce: a record claiming a readiness state other than `Ready`, one whose
 * quoted basis describes a different revision from the one it says it
 * protocolized, one carrying blockers, or one quoting a cancelled lifecycle is
 * refused rather than repaired.
 */
export declare function reconstituteProtocolizationResult(value: unknown): ProtocolizationResult;
//# sourceMappingURL=execution-operations.d.ts.map