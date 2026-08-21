"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProtocolizationRequirementAssessment = getProtocolizationRequirementAssessment;
exports.listProtocolizationReadinessBlockers = listProtocolizationReadinessBlockers;
exports.listProtocolizationReadinessWarnings = listProtocolizationReadinessWarnings;
exports.isProtocolizationReadinessCurrentForCase = isProtocolizationReadinessCurrentForCase;
const case_identifiers_1 = require("../case/case-identifiers");
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
function getProtocolizationRequirementAssessment(evaluation, requirementId) {
    return evaluation.requirementAssessments.find((assessment) => assessment.requirementId === requirementId);
}
/** The evaluation's blockers, optionally narrowed. Order is the evaluation's own. */
function listProtocolizationReadinessBlockers(evaluation, filter = {}) {
    return evaluation.blockers.filter((blocker) => {
        if (filter.requirementId !== undefined && blocker.requirementId !== filter.requirementId) {
            return false;
        }
        if (filter.reasonCode !== undefined && blocker.reasonCode !== filter.reasonCode)
            return false;
        return true;
    });
}
/** The evaluation's warnings, optionally narrowed. Order is the evaluation's own. */
function listProtocolizationReadinessWarnings(evaluation, filter = {}) {
    return evaluation.warnings.filter((warning) => {
        if (filter.requirementId !== undefined && warning.requirementId !== filter.requirementId) {
            return false;
        }
        if (filter.reasonCode !== undefined && warning.reasonCode !== filter.reasonCode)
            return false;
        return true;
    });
}
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
function isProtocolizationReadinessCurrentForCase(evaluation, protocolizationCase) {
    return (evaluation.tenantId === protocolizationCase.tenantId &&
        evaluation.caseId === protocolizationCase.caseId &&
        (0, case_identifiers_1.protocolizationProfileRefsEqual)(evaluation.profile, protocolizationCase.profile) &&
        evaluation.evaluatedCaseRevision === protocolizationCase.revision);
}
