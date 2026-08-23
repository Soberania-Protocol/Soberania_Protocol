"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.compareProtocolizationResults = compareProtocolizationResults;
exports.createInMemoryProtocolizationResultRepository = createInMemoryProtocolizationResultRepository;
const case_freeze_1 = require("../case/case-freeze");
const case_identifiers_1 = require("../case/case-identifiers");
const execution_errors_1 = require("./execution-errors");
const execution_validation_1 = require("./execution-validation");
function storageKey(tenantId, id) {
    // A tenant id cannot contain whitespace or a control character and an instance
    // identifier cannot contain `\n`, so a newline separator is never ambiguous
    // between two distinct pairs.
    return `${tenantId}\n${id}`;
}
/**
 * The execution basis, as one storage key.
 *
 * Tenant, case, the exact pin and the exact revision — the four dimensions that
 * together identify one protocolization act. A profile version is `\d+.\d+.\d+`
 * and a case id carries no newline, so the composed key is unambiguous.
 */
function basisKey(tenantId, caseId, profile, executedCaseRevision) {
    return `${tenantId}\n${caseId}\n${profile.profileId}\n${profile.profileVersion}\n${executedCaseRevision}`;
}
function assertTenant(tenantId) {
    if (!(0, case_identifiers_1.isValidProtocolizationTenantId)(tenantId)) {
        throw new execution_errors_1.ProtocolizationExecutionError(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.tenantRequired, 'A non-blank tenantId is required to address protocolization history', { reasonCodes: [execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.tenantRequired] });
    }
}
/**
 * Total order over results: execution instant, then identifier.
 *
 * Exported for reuse *inside* this package only. Two copies of an ordering rule
 * are two orders waiting to disagree.
 */
function compareProtocolizationResults(left, right) {
    const byInstant = Date.parse(left.executedAt) - Date.parse(right.executedAt);
    if (byInstant !== 0)
        return byInstant < 0 ? -1 : 1;
    if (left.resultId === right.resultId)
        return 0;
    return left.resultId < right.resultId ? -1 : 1;
}
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
function createInMemoryProtocolizationResultRepository() {
    const entries = new Map();
    const byBasis = new Map();
    return {
        get(tenantId, resultId) {
            assertTenant(tenantId);
            return entries.get(storageKey(tenantId, resultId));
        },
        exists(tenantId, resultId) {
            assertTenant(tenantId);
            return entries.has(storageKey(tenantId, resultId));
        },
        listByCase(tenantId, caseId) {
            assertTenant(tenantId);
            return [...entries.values()]
                .filter((result) => result.tenantId === tenantId && result.caseId === caseId)
                .sort(compareProtocolizationResults);
        },
        getByBasis(tenantId, caseId, profile, executedCaseRevision) {
            assertTenant(tenantId);
            const resultId = byBasis.get(basisKey(tenantId, caseId, profile, executedCaseRevision));
            if (resultId === undefined)
                return undefined;
            const stored = entries.get(storageKey(tenantId, resultId));
            // Belt and braces: the basis index is only ever written beside an entry,
            // and the pin is re-compared here so a caller can never be handed a result
            // recorded under a different profile version by an index bug.
            if (stored === undefined)
                return undefined;
            return (0, case_identifiers_1.protocolizationProfileRefsEqual)(stored.profile, profile) ? stored : undefined;
        },
        save(result) {
            const validation = (0, execution_validation_1.validateProtocolizationResult)(result);
            if (!validation.admitted) {
                throw new execution_errors_1.ProtocolizationExecutionError(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.resultInvalid, `Refusing to store an invalid ProtocolizationResult: ${validation.reasons.join(', ')}`, { reasonCodes: validation.reasons });
            }
            const key = storageKey(result.tenantId, result.resultId);
            if (entries.has(key)) {
                throw new execution_errors_1.ProtocolizationExecutionError(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.duplicateResult, 'A ProtocolizationResult with this (tenantId, resultId) already exists', {
                    reasonCodes: [execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.duplicateResult],
                    tenantId: result.tenantId,
                    caseId: result.caseId,
                    resultId: result.resultId,
                });
            }
            const basis = basisKey(result.tenantId, result.caseId, result.profile, result.executedCaseRevision);
            if (byBasis.has(basis)) {
                throw new execution_errors_1.ProtocolizationExecutionError(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.duplicateBasis, 'This tenant, case, profile version and case revision were already protocolized; a further protocolization needs a new case revision and a new Ready evaluation', {
                    reasonCodes: [execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.duplicateBasis],
                    tenantId: result.tenantId,
                    caseId: result.caseId,
                    profile: result.profile,
                    resultId: result.resultId,
                    executedCaseRevision: result.executedCaseRevision,
                });
            }
            entries.set(key, (0, case_freeze_1.deepFreeze)(result));
            byBasis.set(basis, result.resultId);
        },
    };
}
