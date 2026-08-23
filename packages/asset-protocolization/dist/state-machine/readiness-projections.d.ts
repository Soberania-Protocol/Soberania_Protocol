import type { AssetRequirementId } from '../identifiers';
import type { ProtocolizationCase } from '../case/protocolization-case';
import type { ProtocolizationReadinessEvaluation } from './readiness-evaluation';
import type { ProtocolizationReadinessReason } from './readiness-reason';
import type { ProtocolizationRequirementAssessment } from './requirement-assessment';
/**
 * Read-only views over one readiness evaluation.
 *
 * Pure and synchronous: no clock, no repository, no I/O, no case mutation.
 * Nothing here decides anything the evaluation did not already decide — these
 * are conveniences over a value a caller already holds.
 */
/**
 * Deterministic lookup of one requirement's assessment. Returns `undefined` when
 * the pinned profile does not declare it — an ordinary answer, matching
 * `getAssetProfileRequirement` and `getProtocolizationCaseRequirementProgress`.
 */
export declare function getProtocolizationRequirementAssessment(evaluation: ProtocolizationReadinessEvaluation, requirementId: AssetRequirementId): ProtocolizationRequirementAssessment | undefined;
export interface ProtocolizationReadinessReasonFilter {
    readonly requirementId?: AssetRequirementId;
    readonly reasonCode?: ProtocolizationReadinessReason['reasonCode'];
}
/** The evaluation's blockers, optionally narrowed. Order is the evaluation's own. */
export declare function listProtocolizationReadinessBlockers(evaluation: ProtocolizationReadinessEvaluation, filter?: ProtocolizationReadinessReasonFilter): readonly ProtocolizationReadinessReason[];
/** The evaluation's warnings, optionally narrowed. Order is the evaluation's own. */
export declare function listProtocolizationReadinessWarnings(evaluation: ProtocolizationReadinessEvaluation, filter?: ProtocolizationReadinessReasonFilter): readonly ProtocolizationReadinessReason[];
/**
 * Whether this evaluation still describes the case a caller is holding.
 *
 * ### This is the APV-10 guard, and it is the whole TOCTOU story
 *
 * ```text
 * revision 20   evaluation says Ready
 * revision 21   a declaration is recorded
 * revision 21   the revision-20 evaluation is NOT current, and must not
 *               authorize anything
 * ```
 *
 * A readiness result is a statement about one exact revision of one exact case
 * under one exact pinned profile version, and all four of those are compared
 * here — tenant, case, pin and revision. The comparison is deliberately exact
 * rather than "at least": an evaluation of an *older* revision saw strictly
 * less, and one carrying a *newer* revision describes a case this caller is not
 * holding.
 *
 * Notice what it does not do. It does not re-evaluate, refresh, invalidate or
 * expire anything, and it does not decide what a stale result means — that is
 * the consuming slice's policy. It answers one question so that APV-10 never has
 * to trust a `ready: true` it cannot place in time.
 */
export declare function isProtocolizationReadinessCurrentForCase(evaluation: ProtocolizationReadinessEvaluation, protocolizationCase: ProtocolizationCase): boolean;
//# sourceMappingURL=readiness-projections.d.ts.map