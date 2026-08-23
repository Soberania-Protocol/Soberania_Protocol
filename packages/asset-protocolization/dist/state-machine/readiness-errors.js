"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtocolizationReadinessError = exports.PROTOCOLIZATION_READINESS_ERROR_CODES = void 0;
/**
 * When APV-09 refuses to answer at all.
 *
 * ### A blocker is not an error
 *
 * The distinction is the one this slice most needs a reader to hold:
 *
 * ```text
 * blocker   the evaluation succeeded and this is part of the answer
 *           -> required check Fail, attestation missing, condition unresolved
 *           -> returned inside ProtocolizationReadinessEvaluation.blockers
 *
 * error     the evaluation could not honestly be performed
 *           -> wrong tenant, malformed case, unresolvable pinned profile,
 *              an input belonging to another case
 *           -> thrown
 * ```
 *
 * A required verification `Fail` is emphatically *not* an error: refusing to
 * answer there would tell a caller "I cannot say" when the truthful answer is "I
 * can say precisely, and here is why". Conversely, producing a readiness result
 * from a case that does not validate, or from another tenant's records, would be
 * answering a question nobody asked about a case nobody holds.
 *
 * Naming follows the package's existing convention — a SCREAMING_SNAKE code per
 * refusal, carried on a `ProtocolError`, with the same code repeated in
 * `reasonCodes` so a caller can handle one shape across every slice.
 */
exports.PROTOCOLIZATION_READINESS_ERROR_CODES = Object.freeze({
    invalidTenant: 'READINESS_TENANT_REQUIRED',
    tenantMismatch: 'READINESS_TENANT_MISMATCH',
    invalidCase: 'READINESS_CASE_INVALID',
    profileNotFound: 'READINESS_PROFILE_NOT_FOUND',
    profileMismatch: 'READINESS_PROFILE_MISMATCH',
    inputTenantMismatch: 'READINESS_INPUT_TENANT_MISMATCH',
    inputCaseMismatch: 'READINESS_INPUT_CASE_MISMATCH',
    inputProfileMismatch: 'READINESS_INPUT_PROFILE_MISMATCH',
    /**
     * The pinned profile declares a requirement of a kind this evaluator does not
     * handle.
     *
     * Deliberately loud. A future `AssetRequirementKind` reaching a build that
     * predates it must never be treated as satisfied, ignored, or quietly counted
     * as `NotApplicable` — every one of those turns an unknown demand into a met
     * one.
     */
    unsupportedRequirementKind: 'READINESS_REQUIREMENT_KIND_UNSUPPORTED',
    invalidTimestamp: 'READINESS_TIMESTAMP_INVALID',
});
class ProtocolizationReadinessError extends Error {
    constructor(code, message, details) {
        super(message);
        this.name = 'ProtocolizationReadinessError';
        this.code = code;
        this.details = details;
    }
}
exports.ProtocolizationReadinessError = ProtocolizationReadinessError;
