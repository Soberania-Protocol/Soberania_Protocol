"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES = void 0;
exports.validateProtocolizationReadinessForExecution = validateProtocolizationReadinessForExecution;
exports.validateProtocolizationExecutionRequest = validateProtocolizationExecutionRequest;
exports.isAdmissibleProtocolizationExecutionRequest = isAdmissibleProtocolizationExecutionRequest;
exports.validateProtocolizationResult = validateProtocolizationResult;
exports.isValidProtocolizationResult = isValidProtocolizationResult;
exports.assertExecutingTenantOwnsCase = assertExecutingTenantOwnsCase;
exports.resolveExecutionProfile = resolveExecutionProfile;
exports.assertCaseIsExecutable = assertCaseIsExecutable;
exports.assertReadinessAuthorizesExecution = assertReadinessAuthorizesExecution;
exports.assertExpectedRevision = assertExpectedRevision;
exports.readExecutionInstant = readExecutionInstant;
const freshness_1 = require("../freshness");
const identifiers_1 = require("../identifiers");
const case_identifiers_1 = require("../case/case-identifiers");
const case_material_1 = require("../case/case-material");
const case_state_1 = require("../case/case-state");
const case_subject_1 = require("../case/case-subject");
const case_validation_1 = require("../case/case-validation");
const readiness_evaluation_1 = require("../state-machine/readiness-evaluation");
const readiness_projections_1 = require("../state-machine/readiness-projections");
const readiness_reason_1 = require("../state-machine/readiness-reason");
const readiness_state_1 = require("../state-machine/readiness-state");
const execution_errors_1 = require("./execution-errors");
const execution_identifiers_1 = require("./execution-identifiers");
const protocolization_result_1 = require("./protocolization-result");
/**
 * Everything that must hold before protocolization may be executed at all, and
 * everything a stored result must satisfy before it is trusted as history.
 *
 * ### Structural, and deliberately only structural
 *
 * Read "validation" here as narrowly as APV-05 through APV-09 read it. Every
 * check below decides whether a value has the *shape* this workflow can carry.
 * Not one of them decides whether a case ought to be `Ready`, whether a check
 * returned the right outcome, whether a professional was right to attest, or
 * whether anything anybody declared is true.
 *
 * That line matters more here than anywhere else in the package, because APV-10
 * is the slice with the strongest temptation to cross it. The rule is absolute:
 *
 * ```text
 * APV-09 owns readiness semantics.
 * APV-10 owns execution currency and integrity.
 * ```
 *
 * So this module never counts evidence, never re-reads a verification outcome,
 * never weighs an attestation, never resolves a condition, never re-checks a
 * profile constraint and never re-derives a readiness state. It establishes that
 * the evaluation it was handed is a shape APV-09 could have produced, that its
 * conclusion is `Ready`, and that it still describes the exact case in front of
 * it. Everything past that is APV-09's answer, taken as given.
 *
 * ### And it never re-runs the currency comparison
 *
 * `isProtocolizationReadinessCurrentForCase` is APV-09's own guard and is the
 * single authoritative gate here. This module reads the identity fields first so
 * it can report *which* of tenant, case, pin or revision diverged — a stale
 * revision and a foreign case are different operational problems — but the
 * helper's verdict is what actually authorizes execution, and a divergence it
 * catches which the field-by-field reading somehow did not still refuses.
 */
exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES = Object.freeze({
    notAnObject: 'EXECUTION_NOT_AN_OBJECT',
    unknownField: 'EXECUTION_UNKNOWN_FIELD',
    invalidSchemaVersion: 'EXECUTION_SCHEMA_VERSION_INVALID',
    invalidResultId: 'EXECUTION_RESULT_ID_INVALID',
    invalidTenantId: 'EXECUTION_TENANT_ID_INVALID',
    invalidCaseId: 'EXECUTION_CASE_ID_INVALID',
    invalidProfileRef: 'EXECUTION_PROFILE_REF_INVALID',
    invalidSubject: 'EXECUTION_SUBJECT_INVALID',
    invalidCaseRevision: 'EXECUTION_CASE_REVISION_INVALID',
    invalidReadinessBasis: 'EXECUTION_READINESS_BASIS_INVALID',
    /** The quoted basis describes a different revision from the one executed. */
    basisRevisionMismatch: 'EXECUTION_READINESS_BASIS_REVISION_MISMATCH',
    invalidMaterialRefs: 'EXECUTION_MATERIAL_REFS_INVALID',
    invalidExecutedAt: 'EXECUTION_EXECUTED_AT_INVALID',
    invalidCorrelationId: 'EXECUTION_CORRELATION_ID_INVALID',
    invalidExpectedCaseRevision: 'EXECUTION_EXPECTED_CASE_REVISION_INVALID',
    // --- the supplied APV-09 evaluation ------------------------------------
    readinessNotAnObject: 'EXECUTION_READINESS_NOT_AN_OBJECT',
    readinessUnknownField: 'EXECUTION_READINESS_UNKNOWN_FIELD',
    readinessSchemaVersionInvalid: 'EXECUTION_READINESS_SCHEMA_VERSION_INVALID',
    readinessTenantInvalid: 'EXECUTION_READINESS_TENANT_ID_INVALID',
    readinessCaseInvalid: 'EXECUTION_READINESS_CASE_ID_INVALID',
    readinessProfileInvalid: 'EXECUTION_READINESS_PROFILE_REF_INVALID',
    readinessCaseStateInvalid: 'EXECUTION_READINESS_CASE_STATE_INVALID',
    readinessRevisionInvalid: 'EXECUTION_READINESS_CASE_REVISION_INVALID',
    readinessStateInvalid: 'EXECUTION_READINESS_STATE_INVALID',
    /** `state: Ready` beside `ready: false`, or the reverse. An impossible evaluation. */
    readinessFlagInconsistent: 'EXECUTION_READINESS_READY_FLAG_INCONSISTENT',
    /** `state: Ready` beside a non-empty blocker set, on the evaluation or an assessment. */
    readinessBlockersInconsistent: 'EXECUTION_READINESS_BLOCKERS_INCONSISTENT',
    readinessReasonsInvalid: 'EXECUTION_READINESS_REASONS_INVALID',
    readinessAssessmentsInvalid: 'EXECUTION_READINESS_ASSESSMENTS_INVALID',
    readinessEvaluatedAtInvalid: 'EXECUTION_READINESS_EVALUATED_AT_INVALID',
});
const RESULT_KEYS = [
    'schemaVersion',
    'resultId',
    'tenantId',
    'caseId',
    'profile',
    'subject',
    'executedCaseRevision',
    'readinessBasis',
    'materialRefs',
    'executedAt',
    'correlationId',
];
const READINESS_BASIS_KEYS = [
    'evaluationSchemaVersion',
    'state',
    'evaluatedCaseRevision',
    'caseState',
    'evaluatedAt',
    'blockerCount',
    'warnings',
    'verificationExecutionIds',
    'reviewDecisionIds',
    'attestationRefs',
];
const MATERIAL_REF_KEYS = ['materialId', 'kind', 'requirementIds', 'ref'];
const REQUEST_KEYS = ['resultId', 'expectedCaseRevision', 'correlationId'];
const EVALUATION_KEYS = [
    'schemaVersion',
    'tenantId',
    'caseId',
    'profile',
    'caseState',
    'evaluatedCaseRevision',
    'state',
    'ready',
    'requirementAssessments',
    'blockers',
    'warnings',
    'evaluatedAt',
];
/**
 * The bound on how much basis one result may cite.
 *
 * A guard, not a semantic rule — the same one APV-07 places on its input
 * references, for the same reason: an artifact that named tens of thousands of
 * individual references would be unreadable by the humans it exists for, and the
 * field would have become a log sink. Internal, because the number is an
 * implementation guard and not a contract downstream should branch on.
 */
const REFERENCE_LIST_MAX_LENGTH = 4096;
function hasOwn(value, key) {
    return Object.prototype.hasOwnProperty.call(value, key);
}
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
/**
 * A `CanonicalId` naming a Protocol record. Bounded and non-blank; never parsed,
 * never resolved, and never checked for existence — the same guard APV-04 and
 * APV-07 use for the references they carry.
 */
function isCanonicalRecordId(value) {
    return (typeof value === 'string' &&
        value.trim() !== '' &&
        value.length <= case_identifiers_1.PROTOCOLIZATION_IDENTIFIER_MAX_LENGTH);
}
/** A case revision is `1` at creation and only ever increments. */
function isCaseRevision(value) {
    return Number.isSafeInteger(value) && value >= 1;
}
function isBoundedIdList(value) {
    return (Array.isArray(value) &&
        value.length <= REFERENCE_LIST_MAX_LENGTH &&
        value.every((entry) => isCanonicalRecordId(entry)));
}
/**
 * A readiness reason, structurally.
 *
 * The reason code must belong to APV-09's **closed** vocabulary. An unknown code
 * is refused rather than carried: a warning nobody can interpret would travel
 * into a permanent artifact as an opaque token, and the whole point of a closed
 * machine vocabulary is that a reader can act on what it finds.
 */
function isReadinessReason(value, kind) {
    if (!isPlainObject(value))
        return false;
    const code = value.reasonCode;
    // A warning may legitimately carry a blocker code — APV-09 reports an unmet
    // Optional requirement's findings as warnings without rewriting them — so a
    // warning admits either vocabulary and a blocker admits only its own.
    const admitted = kind === 'blocker'
        ? (0, readiness_reason_1.isProtocolizationReadinessBlockerCode)(code)
        : (0, readiness_reason_1.isProtocolizationReadinessWarningCode)(code) || (0, readiness_reason_1.isProtocolizationReadinessBlockerCode)(code);
    if (!admitted)
        return false;
    if (hasOwn(value, 'requirementId') && !(0, identifiers_1.isValidAssetRequirementId)(value.requirementId)) {
        return false;
    }
    return true;
}
function isReasonList(value, kind) {
    return (Array.isArray(value) &&
        value.length <= REFERENCE_LIST_MAX_LENGTH &&
        value.every((entry) => isReadinessReason(entry, kind)));
}
// ---------------------------------------------------------------------------
// The supplied APV-09 evaluation
// ---------------------------------------------------------------------------
/**
 * Validates a caller-supplied readiness evaluation *structurally*, before
 * execution is allowed to rely on it.
 *
 * ### Why a caller-supplied evaluation is not trusted
 *
 * APV-09 deliberately persists nothing, so the evaluation reaching this slice
 * has crossed a process, a queue, a store or a test fixture, and anybody able to
 * hand one over could hand over an object that merely *looks* like one. The
 * dangerous shapes are the self-inconsistent ones — `state: 'Ready'` beside
 * `ready: false`, `state: 'Ready'` beside a blocker, an assessment carrying a
 * blocker the evaluation forgot to hoist — because each of them is a
 * hand-assembled claim of readiness that no legitimate evaluation could produce.
 * Every one of them is refused here.
 *
 * ### What it does not do
 *
 * It does not re-derive the state from the blockers, does not re-assess a
 * requirement, and does not decide that a `Ready` evaluation *should* have been
 * `Ready`. Those would each be a second readiness engine, and two engines are
 * two answers waiting to disagree.
 */
function validateProtocolizationReadinessForExecution(value) {
    if (!isPlainObject(value)) {
        return {
            admitted: false,
            reasons: [exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessNotAnObject],
        };
    }
    const candidate = value;
    const reasons = [];
    for (const key of Object.keys(candidate)) {
        if (!EVALUATION_KEYS.includes(key)) {
            reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessUnknownField);
            break;
        }
    }
    if (candidate.schemaVersion !== readiness_evaluation_1.PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessSchemaVersionInvalid);
    }
    if (!(0, case_identifiers_1.isValidProtocolizationTenantId)(candidate.tenantId)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessTenantInvalid);
    }
    if (!(0, case_identifiers_1.isValidProtocolizationCaseId)(candidate.caseId)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessCaseInvalid);
    }
    if (!(0, case_identifiers_1.isValidProtocolizationProfileRef)(candidate.profile)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessProfileInvalid);
    }
    if (!(0, case_state_1.isProtocolizationCaseState)(candidate.caseState)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessCaseStateInvalid);
    }
    if (!isCaseRevision(candidate.evaluatedCaseRevision)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessRevisionInvalid);
    }
    if (!(0, readiness_state_1.isProtocolizationReadinessState)(candidate.state)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessStateInvalid);
    }
    if (!(0, freshness_1.isValidUtcDateTime)(candidate.evaluatedAt)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessEvaluatedAtInvalid);
    }
    const blockersWellFormed = isReasonList(candidate.blockers, 'blocker');
    const warningsWellFormed = isReasonList(candidate.warnings, 'warning');
    if (!blockersWellFormed || !warningsWellFormed) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessReasonsInvalid);
    }
    // `ready` is APV-09's own derived convenience: it is `state === Ready` and
    // nothing else. A pair that disagrees is not a readiness evaluation at all.
    if (typeof candidate.ready !== 'boolean') {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessFlagInconsistent);
    }
    else if ((0, readiness_state_1.isProtocolizationReadinessState)(candidate.state) &&
        candidate.ready !== (candidate.state === readiness_state_1.ProtocolizationReadinessState.Ready)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessFlagInconsistent);
    }
    const assessments = candidate.requirementAssessments;
    const assessmentsWellFormed = Array.isArray(assessments) &&
        assessments.length <= REFERENCE_LIST_MAX_LENGTH &&
        assessments.every((entry) => isPlainObject(entry) &&
            (0, identifiers_1.isValidAssetRequirementId)(entry.requirementId) &&
            isReasonList(entry.blockers, 'blocker') &&
            isReasonList(entry.warnings, 'warning'));
    if (!assessmentsWellFormed) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessAssessmentsInvalid);
    }
    // APV-09 builds `warnings` as the concatenation of its assessments' warnings,
    // and `blockers` as the case-level blockers plus its assessments' blockers. A
    // supplied evaluation whose totals do not add up has had findings added or
    // removed after the fact, whatever its top-level state claims.
    if (assessmentsWellFormed && warningsWellFormed) {
        const assessmentWarnings = assessments
            .reduce((total, entry) => total + entry.warnings.length, 0);
        if (assessmentWarnings !== candidate.warnings.length) {
            reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessAssessmentsInvalid);
        }
    }
    if (candidate.state === readiness_state_1.ProtocolizationReadinessState.Ready) {
        const evaluationBlockers = blockersWellFormed
            ? candidate.blockers.length
            : 0;
        const assessmentBlockers = assessmentsWellFormed
            ? assessments.reduce((total, entry) => total + entry.blockers.length, 0)
            : 0;
        if (evaluationBlockers > 0 || assessmentBlockers > 0) {
            reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.readinessBlockersInconsistent);
        }
    }
    return { admitted: reasons.length === 0, reasons };
}
// ---------------------------------------------------------------------------
// The execution request
// ---------------------------------------------------------------------------
function validateProtocolizationExecutionRequest(value) {
    if (!isPlainObject(value)) {
        return { admitted: false, reasons: [exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.notAnObject] };
    }
    const candidate = value;
    const reasons = [];
    for (const key of Object.keys(candidate)) {
        if (!REQUEST_KEYS.includes(key)) {
            reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.unknownField);
            break;
        }
    }
    if (!(0, execution_identifiers_1.isValidProtocolizationResultId)(candidate.resultId)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidResultId);
    }
    // A present-but-`undefined` optional is invalid rather than absent — the same
    // rule every other validator in this package applies, because `{ correlationId:
    // undefined }` and `{}` serialize differently.
    if (hasOwn(candidate, 'expectedCaseRevision') && !isCaseRevision(candidate.expectedCaseRevision)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidExpectedCaseRevision);
    }
    if (hasOwn(candidate, 'correlationId') && !isCanonicalRecordId(candidate.correlationId)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidCorrelationId);
    }
    return { admitted: reasons.length === 0, reasons };
}
function isAdmissibleProtocolizationExecutionRequest(value) {
    return validateProtocolizationExecutionRequest(value).admitted;
}
// ---------------------------------------------------------------------------
// The result document
// ---------------------------------------------------------------------------
function isReadinessBasis(value) {
    if (!isPlainObject(value))
        return false;
    for (const key of Object.keys(value)) {
        if (!READINESS_BASIS_KEYS.includes(key))
            return false;
    }
    if (value.evaluationSchemaVersion !== readiness_evaluation_1.PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION) {
        return false;
    }
    // A result exists only for a `Ready` evaluation, so the quoted state is not a
    // variable: any other value is a record claiming a protocolization that could
    // not have been authorized.
    if (value.state !== readiness_state_1.ProtocolizationReadinessState.Ready)
        return false;
    if (!isCaseRevision(value.evaluatedCaseRevision))
        return false;
    if (!(0, case_state_1.isProtocolizationCaseState)(value.caseState))
        return false;
    // Cancellation is APV-09's highest-precedence blocker, so a basis quoting a
    // cancelled lifecycle beside `Ready` is history that cannot have happened.
    if (value.caseState === case_state_1.ProtocolizationCaseState.Cancelled)
        return false;
    if (!(0, freshness_1.isValidUtcDateTime)(value.evaluatedAt))
        return false;
    if (value.blockerCount !== 0)
        return false;
    if (!isReasonList(value.warnings, 'warning'))
        return false;
    if (!isBoundedIdList(value.verificationExecutionIds))
        return false;
    if (!isBoundedIdList(value.reviewDecisionIds))
        return false;
    if (!isBoundedIdList(value.attestationRefs))
        return false;
    return true;
}
function isMaterialRefList(value) {
    if (!Array.isArray(value) || value.length > REFERENCE_LIST_MAX_LENGTH)
        return false;
    for (const entry of value) {
        if (!isPlainObject(entry))
            return false;
        for (const key of Object.keys(entry)) {
            if (!MATERIAL_REF_KEYS.includes(key))
                return false;
        }
        if (!(0, case_identifiers_1.isValidProtocolizationMaterialId)(entry.materialId))
            return false;
        if (!(0, case_material_1.isProtocolizationMaterialKind)(entry.kind))
            return false;
        if (!Array.isArray(entry.requirementIds) ||
            entry.requirementIds.length === 0 ||
            !entry.requirementIds.every((id) => (0, identifiers_1.isValidAssetRequirementId)(id))) {
            return false;
        }
        if (hasOwn(entry, 'ref') && !isCanonicalRecordId(entry.ref))
            return false;
    }
    return true;
}
/**
 * Validates a persisted result document.
 *
 * Structure only. It does not decide that the case still exists, that the
 * profile is still catalogued, that the revision is still current, or that the
 * execution should have happened — none of which a validator could know, and the
 * last of which nothing in this package may re-decide after the fact.
 *
 * One cross-field invariant is enforced, because it is the invariant the whole
 * slice rests on: the revision the result says it protocolized and the revision
 * its quoted readiness basis describes must be the same number. A stored record
 * where they differ is a protocolization of one revision justified by a
 * conclusion about another, and it is refused rather than repaired.
 */
function validateProtocolizationResult(value) {
    if (!isPlainObject(value)) {
        return { admitted: false, reasons: [exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.notAnObject] };
    }
    const candidate = value;
    const reasons = [];
    for (const key of Object.keys(candidate)) {
        if (!RESULT_KEYS.includes(key)) {
            reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.unknownField);
            break;
        }
    }
    if (candidate.schemaVersion !== protocolization_result_1.PROTOCOLIZATION_EXECUTION_RESULT_SCHEMA_VERSION) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidSchemaVersion);
    }
    if (!(0, execution_identifiers_1.isValidProtocolizationResultId)(candidate.resultId)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidResultId);
    }
    if (!(0, case_identifiers_1.isValidProtocolizationTenantId)(candidate.tenantId)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidTenantId);
    }
    if (!(0, case_identifiers_1.isValidProtocolizationCaseId)(candidate.caseId)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidCaseId);
    }
    if (!(0, case_identifiers_1.isValidProtocolizationProfileRef)(candidate.profile)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidProfileRef);
    }
    if (!(0, case_subject_1.isValidProtocolizationCaseSubject)(candidate.subject)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidSubject);
    }
    if (!isCaseRevision(candidate.executedCaseRevision)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidCaseRevision);
    }
    if (!isReadinessBasis(candidate.readinessBasis)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidReadinessBasis);
    }
    else if (candidate.readinessBasis
        .evaluatedCaseRevision !== candidate.executedCaseRevision) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.basisRevisionMismatch);
    }
    if (!isMaterialRefList(candidate.materialRefs)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidMaterialRefs);
    }
    if (!(0, freshness_1.isValidUtcDateTime)(candidate.executedAt)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidExecutedAt);
    }
    if (hasOwn(candidate, 'correlationId') && !isCanonicalRecordId(candidate.correlationId)) {
        reasons.push(exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidCorrelationId);
    }
    return { admitted: reasons.length === 0, reasons };
}
function isValidProtocolizationResult(value) {
    return validateProtocolizationResult(value).admitted;
}
// ---------------------------------------------------------------------------
// The execution gates
// ---------------------------------------------------------------------------
function fail(code, message, details = {}) {
    throw new execution_errors_1.ProtocolizationExecutionError(code, message, {
        ...details,
        reasonCodes: details.reasonCodes ?? [code],
    });
}
/**
 * The acting tenant must be well-formed and must be the case's own.
 *
 * The same gate every other slice applies, reused rather than re-invented, and
 * applied *before* anything sensitive about the case is read. Tenant B never
 * learns whether tenant A's case exists, is valid, is ready or has been
 * protocolized: it learns only that this case is not its own.
 */
function assertExecutingTenantOwnsCase(context, protocolizationCase) {
    if (!(0, case_identifiers_1.isValidProtocolizationTenantId)(context.tenantId)) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.tenantRequired, 'A non-blank acting tenantId is required to execute protocolization');
    }
    if (protocolizationCase.tenantId !== context.tenantId) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.tenantMismatch, 'This ProtocolizationCase belongs to another tenant', { tenantId: context.tenantId, caseId: protocolizationCase.caseId });
    }
}
/**
 * Resolves the **exact** pinned profile version from the catalogue.
 *
 * There is no latest, current, newest, default or nearest resolution here or
 * anywhere else in this package: a case pinned to `1.0.0` is executed under
 * `1.0.0` after `2.0.0` is catalogued, and the result records `1.0.0`. The
 * comparison is APV-04's own `protocolizationProfileRefsEqual`, so exactness is
 * one rule in one place rather than a second spelling that could loosen.
 */
function resolveExecutionProfile(context, protocolizationCase) {
    const resolved = context.catalog.get(protocolizationCase.profile.profileId, protocolizationCase.profile.profileVersion);
    if (resolved === undefined) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.profileNotFound, `No AssetProfile ${protocolizationCase.profile.profileId}@${protocolizationCase.profile.profileVersion} is catalogued`, {
            tenantId: protocolizationCase.tenantId,
            caseId: protocolizationCase.caseId,
            profile: protocolizationCase.profile,
        });
    }
    if (!(0, case_identifiers_1.protocolizationProfileRefsEqual)(protocolizationCase.profile, {
        profileId: resolved.profileId,
        profileVersion: resolved.version,
    })) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.profileMismatch, 'The catalogued profile is not the version this case pinned', {
            tenantId: protocolizationCase.tenantId,
            caseId: protocolizationCase.caseId,
            profile: protocolizationCase.profile,
        });
    }
    return resolved;
}
/**
 * The aggregate must validate against the profile it claims to be pinned to,
 * and its lifecycle must permit protocolization work.
 *
 * A case can arrive from a store, a message or a test fixture, so it is
 * re-validated on the way in exactly as APV-04's own operations do. The
 * lifecycle check is defence in depth rather than a second policy: APV-09 cannot
 * legitimately produce a current `Ready` for a cancelled case, so reaching this
 * refusal means a reconstructed evaluation got past the shape checks, and it
 * still does not execute. `Draft` and `Active` both pass — APV-09 permits
 * `Ready` on either, and inventing an activation requirement here would tighten
 * a workflow the frozen architecture does not tighten.
 */
function assertCaseIsExecutable(protocolizationCase, profile) {
    const validation = (0, case_validation_1.validateProtocolizationCase)(protocolizationCase, { profile });
    if (!validation.valid) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.caseInvalid, 'This ProtocolizationCase does not validate against its pinned profile', {
            tenantId: protocolizationCase.tenantId,
            caseId: protocolizationCase.caseId,
            profile: protocolizationCase.profile,
            reasonCodes: validation.reasons,
        });
    }
    if (protocolizationCase.state === case_state_1.ProtocolizationCaseState.Cancelled) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.caseNotExecutable, 'A cancelled ProtocolizationCase cannot be protocolized', {
            tenantId: protocolizationCase.tenantId,
            caseId: protocolizationCase.caseId,
            profile: protocolizationCase.profile,
        });
    }
}
/**
 * The readiness gate: supplied, well-formed, `Ready`, and current.
 *
 * The order is deliberate, and each step reports something different:
 *
 * ```text
 * 1  supplied        there is no execution without an APV-09 conclusion
 * 2  well-formed     it is a shape APV-09 could have produced
 * 3  Ready           it is the conclusion that authorizes execution
 * 4  same subject    tenant, case and pin name the case in hand
 * 5  same revision   and it is *this* revision, not one it used to be
 * 6  APV-09 agrees   isProtocolizationReadinessCurrentForCase, the real gate
 * ```
 *
 * Step 5 is the time-of-check / time-of-use boundary and it is exact. An
 * evaluation of an older revision saw strictly less than the case now holds; one
 * carrying a newer revision describes a case this caller is not holding. Neither
 * is "close enough", neither is silently refreshed, and nothing here re-evaluates
 * to make a stale answer current — that would be this slice deciding readiness,
 * which is precisely what it may never do.
 */
function assertReadinessAuthorizesExecution(protocolizationCase, evaluation) {
    if (evaluation === undefined || evaluation === null) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessRequired, 'A ProtocolizationReadinessEvaluation is required to execute protocolization', { tenantId: protocolizationCase.tenantId, caseId: protocolizationCase.caseId });
    }
    const structure = validateProtocolizationReadinessForExecution(evaluation);
    if (!structure.admitted) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessMalformed, `Refusing to execute from a malformed readiness evaluation: ${structure.reasons.join(', ')}`, {
            tenantId: protocolizationCase.tenantId,
            caseId: protocolizationCase.caseId,
            reasonCodes: structure.reasons,
        });
    }
    if (evaluation.state !== readiness_state_1.ProtocolizationReadinessState.Ready) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.notReady, `Protocolization cannot be executed from a ${evaluation.state} readiness evaluation`, {
            tenantId: protocolizationCase.tenantId,
            caseId: protocolizationCase.caseId,
            profile: protocolizationCase.profile,
            reasonCodes: [
                execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.notReady,
                ...evaluation.blockers.map((blocker) => blocker.reasonCode),
            ],
        });
    }
    if (evaluation.tenantId !== protocolizationCase.tenantId ||
        evaluation.caseId !== protocolizationCase.caseId ||
        !(0, case_identifiers_1.protocolizationProfileRefsEqual)(evaluation.profile, protocolizationCase.profile) ||
        evaluation.caseState !== protocolizationCase.state) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessMismatch, 'This readiness evaluation describes another tenant, case, profile version or lifecycle state', {
            tenantId: protocolizationCase.tenantId,
            caseId: protocolizationCase.caseId,
            profile: protocolizationCase.profile,
        });
    }
    if (evaluation.evaluatedCaseRevision !== protocolizationCase.revision) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessStale, `This readiness evaluation describes revision ${evaluation.evaluatedCaseRevision}; the case stands at revision ${protocolizationCase.revision}`, {
            tenantId: protocolizationCase.tenantId,
            caseId: protocolizationCase.caseId,
            profile: protocolizationCase.profile,
            executedCaseRevision: protocolizationCase.revision,
            evaluatedCaseRevision: evaluation.evaluatedCaseRevision,
        });
    }
    // APV-09's own guard, and the authoritative one. The reads above exist to name
    // *which* dimension diverged; this is what decides.
    if (!(0, readiness_projections_1.isProtocolizationReadinessCurrentForCase)(evaluation, protocolizationCase)) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.readinessStale, 'This readiness evaluation is not current for this ProtocolizationCase', {
            tenantId: protocolizationCase.tenantId,
            caseId: protocolizationCase.caseId,
            profile: protocolizationCase.profile,
            executedCaseRevision: protocolizationCase.revision,
            evaluatedCaseRevision: evaluation.evaluatedCaseRevision,
        });
    }
    return evaluation;
}
/**
 * The caller's own revision assertion, when it made one, must be exactly the
 * revision being executed.
 *
 * Compared against the case *and* the evaluation, because agreeing with one of
 * them is not agreeing with the execution.
 */
function assertExpectedRevision(protocolizationCase, evaluation, expectedCaseRevision) {
    if (expectedCaseRevision === undefined)
        return;
    if (expectedCaseRevision !== protocolizationCase.revision ||
        expectedCaseRevision !== evaluation.evaluatedCaseRevision) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.revisionMismatch, `This request expects revision ${expectedCaseRevision}; the case stands at revision ${protocolizationCase.revision}`, {
            tenantId: protocolizationCase.tenantId,
            caseId: protocolizationCase.caseId,
            executedCaseRevision: protocolizationCase.revision,
            evaluatedCaseRevision: evaluation.evaluatedCaseRevision,
        });
    }
}
/** The clock must produce Protocol's canonical instant, or nothing is stamped. */
function readExecutionInstant(context, protocolizationCase) {
    const instant = context.clock.now();
    if (!(0, freshness_1.isValidUtcDateTime)(instant)) {
        fail(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.timestampInvalid, 'The injected clock did not return a canonical UtcDateTime', { tenantId: protocolizationCase.tenantId, caseId: protocolizationCase.caseId });
    }
    return instant;
}
