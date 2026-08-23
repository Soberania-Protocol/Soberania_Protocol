import type { ProtocolError } from '@aoc/protocol/errors';
import type { AssetRequirementId } from '../identifiers';
import type { ProtocolizationCaseId, ProtocolizationProfileRef, ProtocolizationTenantId } from '../case/case-identifiers';
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
export declare const PROTOCOLIZATION_READINESS_ERROR_CODES: Readonly<{
    readonly invalidTenant: "READINESS_TENANT_REQUIRED";
    readonly tenantMismatch: "READINESS_TENANT_MISMATCH";
    readonly invalidCase: "READINESS_CASE_INVALID";
    readonly profileNotFound: "READINESS_PROFILE_NOT_FOUND";
    readonly profileMismatch: "READINESS_PROFILE_MISMATCH";
    readonly inputTenantMismatch: "READINESS_INPUT_TENANT_MISMATCH";
    readonly inputCaseMismatch: "READINESS_INPUT_CASE_MISMATCH";
    readonly inputProfileMismatch: "READINESS_INPUT_PROFILE_MISMATCH";
    /**
     * The pinned profile declares a requirement of a kind this evaluator does not
     * handle.
     *
     * Deliberately loud. A future `AssetRequirementKind` reaching a build that
     * predates it must never be treated as satisfied, ignored, or quietly counted
     * as `NotApplicable` — every one of those turns an unknown demand into a met
     * one.
     */
    readonly unsupportedRequirementKind: "READINESS_REQUIREMENT_KIND_UNSUPPORTED";
    readonly invalidTimestamp: "READINESS_TIMESTAMP_INVALID";
}>;
export type ProtocolizationReadinessErrorCode = (typeof PROTOCOLIZATION_READINESS_ERROR_CODES)[keyof typeof PROTOCOLIZATION_READINESS_ERROR_CODES];
export type ProtocolizationReadinessErrorDetails = {
    readonly reasonCodes: readonly string[];
    readonly tenantId?: ProtocolizationTenantId;
    readonly caseId?: ProtocolizationCaseId;
    readonly profile?: ProtocolizationProfileRef;
    readonly requirementIds?: readonly AssetRequirementId[];
};
export declare class ProtocolizationReadinessError extends Error implements ProtocolError {
    readonly code: ProtocolizationReadinessErrorCode;
    readonly details: ProtocolizationReadinessErrorDetails;
    constructor(code: ProtocolizationReadinessErrorCode, message: string, details: ProtocolizationReadinessErrorDetails);
}
//# sourceMappingURL=readiness-errors.d.ts.map