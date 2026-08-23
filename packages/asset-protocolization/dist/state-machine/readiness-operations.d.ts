import type { ProtocolizationCaseContext } from '../case/case-operations';
import type { ProtocolizationCase } from '../case/protocolization-case';
import type { ProtocolizationReadinessEvaluation, ProtocolizationReadinessInputs } from './readiness-evaluation';
/**
 * Evaluates one `ProtocolizationCase` against its exact pinned `AssetProfile`
 * version at its exact current revision.
 *
 * Throws `ProtocolizationReadinessError` when the question cannot honestly be
 * answered — wrong tenant, malformed case, unresolvable pin, foreign input,
 * unknown requirement kind. Returns a complete, explainable evaluation
 * otherwise, including when the answer is a long list of blockers.
 *
 * The returned value is deeply frozen, so a caller cannot mutate an assessment,
 * a blocker list or a warning list on a result they happen to hold. Nothing they
 * could do to it would reach a source record in any case: every reference in it
 * is an identifier, and no source record is captured by reference.
 */
export declare function evaluateProtocolizationReadiness(context: ProtocolizationCaseContext, protocolizationCase: ProtocolizationCase, inputs?: ProtocolizationReadinessInputs): ProtocolizationReadinessEvaluation;
//# sourceMappingURL=readiness-operations.d.ts.map