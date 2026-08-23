"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtocolizationExecutionError = exports.PROTOCOLIZATION_EXECUTION_ERROR_CODES = void 0;
/**
 * How protocolization execution refuses.
 *
 * Same shape as `ProtocolizationReadinessError`, `ProfessionalReviewError`,
 * `VerificationError`, `DeclarationError`, `EvidenceIntakeError`,
 * `ProtocolizationCaseError` and `AssetProfileError` — a real `Error` that
 * structurally satisfies `ProtocolError` — because an eighth error philosophy in
 * the eighth slice of one package would be a needless divergence. `code` and
 * `details` are the stable machine surface; `message` is a debugging aid and
 * nothing downstream may parse it.
 *
 * ### Not-ready is an error here, and that is the difference from APV-09
 *
 * APV-09 answers a *question*, so a blocker is part of a successful answer:
 * "this case is `VerificationPending`, and here is why" is the truthful result
 * of an evaluation that worked perfectly. APV-10 performs an *act*, and an act
 * has no equivalent of a partial answer:
 *
 * ```text
 * APV-09   state = VerificationPending   -> a valid evaluation, returned
 * APV-10   execute from that evaluation  -> an incoherent request, refused
 * ```
 *
 * Asking this slice to execute from a non-`Ready`, stale, foreign or malformed
 * readiness evaluation is not a finding about the case — it is a request that
 * cannot be carried out, and it fails loudly rather than degrading into a
 * "result" that records something that did not happen.
 *
 * ### Stale is its own code, on purpose
 *
 * `PROTOCOLIZATION_EXECUTION_READINESS_STALE` is deliberately not folded into
 * `PROTOCOLIZATION_EXECUTION_NOT_READY`. A stale `Ready` is the time-of-check /
 * time-of-use failure this whole slice exists to prevent: the evaluation was
 * legitimate, said `Ready`, and simply no longer describes the case the caller
 * is holding. The remedy is different too — re-evaluate and retry, rather than
 * finish the dossier — and an operator who cannot tell the two apart from the
 * code alone would have to guess which.
 */
exports.PROTOCOLIZATION_EXECUTION_ERROR_CODES = Object.freeze({
    /** The acting tenant is missing or malformed. */
    tenantRequired: 'PROTOCOLIZATION_EXECUTION_TENANT_REQUIRED',
    /** The acting tenant is not the case's tenant. */
    tenantMismatch: 'PROTOCOLIZATION_EXECUTION_TENANT_MISMATCH',
    /** The case does not validate against its pinned profile. Carries `reasonCodes`. */
    caseInvalid: 'PROTOCOLIZATION_EXECUTION_CASE_INVALID',
    /**
     * The case's lifecycle forbids execution. Today that is exactly `Cancelled`.
     *
     * APV-09 cannot legitimately produce a current `Ready` for a cancelled case —
     * cancellation is its highest-precedence blocker — so this is defence against
     * a *reconstructed* evaluation, not a second lifecycle policy. `Draft` and
     * `Active` both execute: this slice invents no activation requirement APV-04
     * and APV-09 do not have.
     */
    caseNotExecutable: 'PROTOCOLIZATION_EXECUTION_CASE_NOT_EXECUTABLE',
    /** The exact pinned profile version is not catalogued. Never resolved to a newer one. */
    profileNotFound: 'PROTOCOLIZATION_EXECUTION_PROFILE_NOT_FOUND',
    /** The catalogued profile is not the version the case pinned. */
    profileMismatch: 'PROTOCOLIZATION_EXECUTION_PROFILE_MISMATCH',
    /** No readiness evaluation was supplied. Execution has no other basis. */
    readinessRequired: 'PROTOCOLIZATION_EXECUTION_READINESS_REQUIRED',
    /**
     * The supplied evaluation is not a shape APV-09 could have produced.
     *
     * `state: Ready` with `ready: false`, `state: Ready` with blockers, an
     * assessment carrying a blocker the evaluation does not, a quoted lifecycle
     * that is not the case's own, a revision that is not a positive integer, an
     * unknown field. Carries `reasonCodes`.
     */
    readinessMalformed: 'PROTOCOLIZATION_EXECUTION_READINESS_MALFORMED',
    /** The evaluation is well-formed and its state is not `Ready`. */
    notReady: 'PROTOCOLIZATION_EXECUTION_NOT_READY',
    /** The evaluation describes another tenant, another case, or another profile version. */
    readinessMismatch: 'PROTOCOLIZATION_EXECUTION_READINESS_MISMATCH',
    /** The evaluation describes a different revision of this case. The TOCTOU refusal. */
    readinessStale: 'PROTOCOLIZATION_EXECUTION_READINESS_STALE',
    /** The request's `expectedCaseRevision` is not the revision being executed. */
    revisionMismatch: 'PROTOCOLIZATION_EXECUTION_REVISION_MISMATCH',
    /** The supplied result id does not satisfy the instance-identifier grammar. */
    resultIdInvalid: 'PROTOCOLIZATION_EXECUTION_RESULT_ID_INVALID',
    /** The execution request is structurally inadmissible. Carries `reasonCodes`. */
    requestInvalid: 'PROTOCOLIZATION_EXECUTION_REQUEST_INVALID',
    /** The injected clock did not return a canonical `UtcDateTime`. */
    timestampInvalid: 'PROTOCOLIZATION_EXECUTION_TIMESTAMP_INVALID',
    /** A result document failed structural admission. Carries `reasonCodes`. */
    resultInvalid: 'PROTOCOLIZATION_EXECUTION_RESULT_INVALID',
    /** A result with this `(tenantId, resultId)` already exists. Never overwritten. */
    duplicateResult: 'PROTOCOLIZATION_EXECUTION_RESULT_DUPLICATE',
    /**
     * This tenant, case, pin and revision were already protocolized.
     *
     * The one-result-per-basis rule. A different result id does not make a second
     * execution of the same basis a different fact, and the first result stands.
     */
    duplicateBasis: 'PROTOCOLIZATION_EXECUTION_BASIS_ALREADY_EXECUTED',
});
class ProtocolizationExecutionError extends Error {
    constructor(code, message, details) {
        super(message);
        this.name = 'ProtocolizationExecutionError';
        this.code = code;
        this.details = details;
    }
}
exports.ProtocolizationExecutionError = ProtocolizationExecutionError;
