"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.executeProtocolization = executeProtocolization;
exports.reconstituteProtocolizationResult = reconstituteProtocolizationResult;
const case_freeze_1 = require("../case/case-freeze");
const readiness_state_1 = require("../state-machine/readiness-state");
const execution_events_1 = require("./execution-events");
const execution_errors_1 = require("./execution-errors");
const execution_validation_1 = require("./execution-validation");
const protocolization_result_1 = require("./protocolization-result");
/**
 * The APV-10 operation: **one** function, and it performs an act.
 *
 * ### What success means
 *
 * ```text
 * executeProtocolization
 *   Asset Protocolization carried this exact case revision, under this exact
 *   pinned AssetProfile version, from an APV-09 evaluation that was Ready and
 *   still current for it, through to completion — and produced the immutable
 *   artifact that records it.
 * ```
 *
 * Success is *the act was performed*. There is no partial success, no
 * conditional success and no "executed with reservations": either every
 * precondition held and a `ProtocolizationResult` exists, or nothing happened at
 * all and an error says why.
 *
 * ### It does not decide readiness, and that is the whole invariant
 *
 * ```text
 * APV-09   evaluates the dossier and says whether the case may proceed
 * APV-10   verifies that answer is legitimate, Ready and current — then acts
 * ```
 *
 * Nothing here counts evidence, inspects a verification outcome, weighs an
 * attestation, resolves a condition, re-checks a profile constraint or re-derives
 * a readiness state. There is no code path by which this function could conclude
 * `Ready` on its own, and there is no parameter — no `force`, no `override`, no
 * `skipReadiness` — by which a caller could ask it to. A case is executable
 * because APV-09 independently said so about the exact revision in hand, or it is
 * not executable.
 *
 * ### What this operation never does
 *
 * ```text
 * re-evaluate readiness           re-run an APV-07 check
 * contact a professional          contact a registry or any external system
 * mutate the case                 transition a lifecycle state
 * rewrite an evidence receipt     rewrite a declaration record
 * rewrite a verification result   rewrite a review decision
 * rewrite an attestation          rewrite a readiness evaluation
 * mint a CanonicalClaim           mint a CanonicalEvidence
 * mint a CanonicalVerification    mint a CanonicalAttestation
 * mint a SovereignAssetId         build or sign a SovereignManifest
 * anchor, tokenize or mint        ask Enterprise anything
 * persist anything                dispatch an event
 * take a payment                  resolve an authority
 * ```
 *
 * Every input it reads it leaves byte-for-byte as it found it, and every output
 * it produces is a new value. That is also the complete list of operations the
 * slice exposes: there is no second entry point that protocolizes a case by
 * hand, no administrative promotion, and no way to record a protocolization that
 * did not satisfy every precondition below.
 *
 * ### Why there is no execution status enum
 *
 * `Pending`, `Running`, `Failed` and `Succeeded` model a workflow that outlives a
 * single call — one that commits something before it finishes and therefore needs
 * a persisted place to say how far it got. This slice is atomic, synchronous,
 * deterministic and side-effect-free: it validates, it builds two values, it
 * returns. A failed attempt writes nothing, so there is nothing for a `Failed`
 * state to describe; a successful one produces the result, so `Succeeded` would
 * be a second spelling of "the result exists". Declaring the enum now would mean
 * either leaving members unreachable or, far worse, making one reachable on a
 * rule that only looks like the real one. When external execution genuinely
 * arrives — a registry write, an anchor, a signature — the state it needs is an
 * additive amendment made by whoever owns that step.
 *
 * ### Pure and synchronous
 *
 * The only injected dependency that does anything is the clock; the catalogue is
 * an in-memory lookup of the exact pinned version. Determinism is total — the
 * same case, evaluation and request always produce the same result, and the only
 * non-constant is `executedAt`, which comes from the injected clock rather than
 * from `Date.now()`.
 */
function failExecution(code, message, details = {}) {
    throw new execution_errors_1.ProtocolizationExecutionError(code, message, {
        ...details,
        reasonCodes: details.reasonCodes ?? [code],
    });
}
/**
 * Collects one reference list across the evaluation's assessments,
 * deduplicated, in the profile's declaration order.
 *
 * First occurrence wins and order is the assessments' own, so the list is a
 * function of the evaluation and not of any map, set or iteration accident. Two
 * executions over the same evaluation produce byte-identical lists.
 */
function collectRefs(evaluation, select) {
    const seen = new Set();
    const collected = [];
    for (const assessment of evaluation.requirementAssessments) {
        for (const ref of select(assessment) ?? []) {
            if (seen.has(ref))
                continue;
            seen.add(ref);
            collected.push(ref);
        }
    }
    return collected;
}
/**
 * Quotes the APV-09 conclusion, without reinterpreting any part of it.
 *
 * Warnings travel across verbatim — same codes, same order, same references.
 * This slice does not re-read them, does not escalate one to a blocker, and does
 * not drop the ones it finds uninteresting: APV-09 already decided that a case
 * carrying these findings is `Ready`, and a second opinion here would be a
 * second readiness policy by another name.
 */
function quoteReadiness(evaluation) {
    return {
        evaluationSchemaVersion: evaluation.schemaVersion,
        state: readiness_state_1.ProtocolizationReadinessState.Ready,
        evaluatedCaseRevision: evaluation.evaluatedCaseRevision,
        caseState: evaluation.caseState,
        evaluatedAt: evaluation.evaluatedAt,
        blockerCount: evaluation.blockers.length,
        warnings: evaluation.warnings.map((warning) => ({ ...warning })),
        verificationExecutionIds: collectRefs(evaluation, (assessment) => assessment.verificationExecutionIds),
        reviewDecisionIds: collectRefs(evaluation, (assessment) => assessment.reviewDecisionIds),
        attestationRefs: collectRefs(evaluation, (assessment) => assessment.attestationRefs),
    };
}
/**
 * Projects the executed revision's material associations as references.
 *
 * The case's own order, which APV-04 defines as association order and never
 * reorders. Nothing is dereferenced, nothing is validated against the world, and
 * no payload is copied.
 */
function quoteMaterial(protocolizationCase) {
    return protocolizationCase.materials.map((material) => {
        const ref = (0, protocolization_result_1.protocolizationMaterialRecordRef)(material);
        return {
            materialId: material.materialId,
            kind: material.kind,
            requirementIds: [...material.requirementIds],
            ...(ref === undefined ? {} : { ref }),
        };
    });
}
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
function executeProtocolization(context, protocolizationCase, readinessEvaluation, request) {
    (0, execution_validation_1.assertExecutingTenantOwnsCase)(context, protocolizationCase);
    const profile = (0, execution_validation_1.resolveExecutionProfile)(context, protocolizationCase);
    (0, execution_validation_1.assertCaseIsExecutable)(protocolizationCase, profile);
    const requestValidation = (0, execution_validation_1.validateProtocolizationExecutionRequest)(request);
    if (!requestValidation.admitted) {
        failExecution(requestValidation.reasons.includes(execution_validation_1.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES.invalidResultId)
            ? execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.resultIdInvalid
            : execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.requestInvalid, `Refusing an inadmissible protocolization execution request: ${requestValidation.reasons.join(', ')}`, {
            reasonCodes: requestValidation.reasons,
            tenantId: protocolizationCase.tenantId,
            caseId: protocolizationCase.caseId,
        });
    }
    const evaluation = (0, execution_validation_1.assertReadinessAuthorizesExecution)(protocolizationCase, readinessEvaluation);
    (0, execution_validation_1.assertExpectedRevision)(protocolizationCase, evaluation, request.expectedCaseRevision);
    const executedAt = (0, execution_validation_1.readExecutionInstant)(context, protocolizationCase);
    const result = {
        schemaVersion: protocolization_result_1.PROTOCOLIZATION_EXECUTION_RESULT_SCHEMA_VERSION,
        resultId: request.resultId,
        tenantId: protocolizationCase.tenantId,
        caseId: protocolizationCase.caseId,
        profile: { ...protocolizationCase.profile },
        subject: {
            subjectRef: { ...protocolizationCase.subject.subjectRef },
            ...(protocolizationCase.subject.contentIdentity === undefined
                ? {}
                : { contentIdentity: { ...protocolizationCase.subject.contentIdentity } }),
        },
        executedCaseRevision: protocolizationCase.revision,
        readinessBasis: quoteReadiness(evaluation),
        materialRefs: quoteMaterial(protocolizationCase),
        executedAt,
        ...(request.correlationId === undefined ? {} : { correlationId: request.correlationId }),
    };
    // The artifact is validated before it is handed back, on the same terms a
    // stored one is validated on the way in. An operation that produced a record
    // its own reconstitution would refuse is a bug that must not reach a store.
    const resultValidation = (0, execution_validation_1.validateProtocolizationResult)(result);
    if (!resultValidation.admitted) {
        failExecution(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.resultInvalid, `Refusing to return an invalid ProtocolizationResult: ${resultValidation.reasons.join(', ')}`, {
            reasonCodes: resultValidation.reasons,
            tenantId: protocolizationCase.tenantId,
            caseId: protocolizationCase.caseId,
            resultId: request.resultId,
        });
    }
    const event = {
        eventType: execution_events_1.PROTOCOLIZATION_EXECUTION_EVENT_TYPES.executed,
        resultId: result.resultId,
        tenantId: result.tenantId,
        caseId: result.caseId,
        profile: result.profile,
        executedCaseRevision: result.executedCaseRevision,
        occurredAt: result.executedAt,
        ...(result.correlationId === undefined ? {} : { correlationId: result.correlationId }),
    };
    return (0, case_freeze_1.deepFreeze)({ result, event });
}
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
function reconstituteProtocolizationResult(value) {
    const validation = (0, execution_validation_1.validateProtocolizationResult)(value);
    if (!validation.admitted) {
        failExecution(execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES.resultInvalid, `Refusing to reconstitute an invalid ProtocolizationResult: ${validation.reasons.join(', ')}`, { reasonCodes: validation.reasons });
    }
    return (0, case_freeze_1.deepFreeze)(value);
}
