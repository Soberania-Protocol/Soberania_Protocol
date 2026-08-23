import type { AssetProfile } from '../profile';
import type { ProtocolizationCaseContext } from '../case/case-operations';
import type { ProtocolizationCase } from '../case/protocolization-case';
import type { ProtocolizationReadinessEvaluation } from '../state-machine/readiness-evaluation';
import type { ProtocolizationExecutionRequest } from './execution-request';
import type { ProtocolizationResult } from './protocolization-result';
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
export declare const PROTOCOLIZATION_EXECUTION_VALIDATION_CODES: Readonly<{
    readonly notAnObject: "EXECUTION_NOT_AN_OBJECT";
    readonly unknownField: "EXECUTION_UNKNOWN_FIELD";
    readonly invalidSchemaVersion: "EXECUTION_SCHEMA_VERSION_INVALID";
    readonly invalidResultId: "EXECUTION_RESULT_ID_INVALID";
    readonly invalidTenantId: "EXECUTION_TENANT_ID_INVALID";
    readonly invalidCaseId: "EXECUTION_CASE_ID_INVALID";
    readonly invalidProfileRef: "EXECUTION_PROFILE_REF_INVALID";
    readonly invalidSubject: "EXECUTION_SUBJECT_INVALID";
    readonly invalidCaseRevision: "EXECUTION_CASE_REVISION_INVALID";
    readonly invalidReadinessBasis: "EXECUTION_READINESS_BASIS_INVALID";
    /** The quoted basis describes a different revision from the one executed. */
    readonly basisRevisionMismatch: "EXECUTION_READINESS_BASIS_REVISION_MISMATCH";
    readonly invalidMaterialRefs: "EXECUTION_MATERIAL_REFS_INVALID";
    readonly invalidExecutedAt: "EXECUTION_EXECUTED_AT_INVALID";
    readonly invalidCorrelationId: "EXECUTION_CORRELATION_ID_INVALID";
    readonly invalidExpectedCaseRevision: "EXECUTION_EXPECTED_CASE_REVISION_INVALID";
    readonly readinessNotAnObject: "EXECUTION_READINESS_NOT_AN_OBJECT";
    readonly readinessUnknownField: "EXECUTION_READINESS_UNKNOWN_FIELD";
    readonly readinessSchemaVersionInvalid: "EXECUTION_READINESS_SCHEMA_VERSION_INVALID";
    readonly readinessTenantInvalid: "EXECUTION_READINESS_TENANT_ID_INVALID";
    readonly readinessCaseInvalid: "EXECUTION_READINESS_CASE_ID_INVALID";
    readonly readinessProfileInvalid: "EXECUTION_READINESS_PROFILE_REF_INVALID";
    readonly readinessCaseStateInvalid: "EXECUTION_READINESS_CASE_STATE_INVALID";
    readonly readinessRevisionInvalid: "EXECUTION_READINESS_CASE_REVISION_INVALID";
    readonly readinessStateInvalid: "EXECUTION_READINESS_STATE_INVALID";
    /** `state: Ready` beside `ready: false`, or the reverse. An impossible evaluation. */
    readonly readinessFlagInconsistent: "EXECUTION_READINESS_READY_FLAG_INCONSISTENT";
    /** `state: Ready` beside a non-empty blocker set, on the evaluation or an assessment. */
    readonly readinessBlockersInconsistent: "EXECUTION_READINESS_BLOCKERS_INCONSISTENT";
    readonly readinessReasonsInvalid: "EXECUTION_READINESS_REASONS_INVALID";
    readonly readinessAssessmentsInvalid: "EXECUTION_READINESS_ASSESSMENTS_INVALID";
    readonly readinessEvaluatedAtInvalid: "EXECUTION_READINESS_EVALUATED_AT_INVALID";
}>;
export type ProtocolizationExecutionValidationCode = (typeof PROTOCOLIZATION_EXECUTION_VALIDATION_CODES)[keyof typeof PROTOCOLIZATION_EXECUTION_VALIDATION_CODES];
export interface ProtocolizationExecutionValidationResult {
    /**
     * Structural admissibility only.
     *
     * Named `admitted` rather than `valid`, exactly as APV-05 through APV-08 named
     * theirs. "Valid" is the word that quietly slides from *conforms to a schema*
     * to *is legitimate*, and this layer only ever means the first — which matters
     * most in the slice whose artifact is the record that a protocolization
     * happened.
     */
    readonly admitted: boolean;
    readonly reasons: readonly ProtocolizationExecutionValidationCode[];
}
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
export declare function validateProtocolizationReadinessForExecution(value: unknown): ProtocolizationExecutionValidationResult;
export declare function validateProtocolizationExecutionRequest(value: unknown): ProtocolizationExecutionValidationResult;
export declare function isAdmissibleProtocolizationExecutionRequest(value: unknown): value is ProtocolizationExecutionRequest;
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
export declare function validateProtocolizationResult(value: unknown): ProtocolizationExecutionValidationResult;
export declare function isValidProtocolizationResult(value: unknown): value is ProtocolizationResult;
/**
 * The acting tenant must be well-formed and must be the case's own.
 *
 * The same gate every other slice applies, reused rather than re-invented, and
 * applied *before* anything sensitive about the case is read. Tenant B never
 * learns whether tenant A's case exists, is valid, is ready or has been
 * protocolized: it learns only that this case is not its own.
 */
export declare function assertExecutingTenantOwnsCase(context: ProtocolizationCaseContext, protocolizationCase: ProtocolizationCase): void;
/**
 * Resolves the **exact** pinned profile version from the catalogue.
 *
 * There is no latest, current, newest, default or nearest resolution here or
 * anywhere else in this package: a case pinned to `1.0.0` is executed under
 * `1.0.0` after `2.0.0` is catalogued, and the result records `1.0.0`. The
 * comparison is APV-04's own `protocolizationProfileRefsEqual`, so exactness is
 * one rule in one place rather than a second spelling that could loosen.
 */
export declare function resolveExecutionProfile(context: ProtocolizationCaseContext, protocolizationCase: ProtocolizationCase): AssetProfile;
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
export declare function assertCaseIsExecutable(protocolizationCase: ProtocolizationCase, profile: AssetProfile): void;
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
export declare function assertReadinessAuthorizesExecution(protocolizationCase: ProtocolizationCase, evaluation: ProtocolizationReadinessEvaluation | undefined | null): ProtocolizationReadinessEvaluation;
/**
 * The caller's own revision assertion, when it made one, must be exactly the
 * revision being executed.
 *
 * Compared against the case *and* the evaluation, because agreeing with one of
 * them is not agreeing with the execution.
 */
export declare function assertExpectedRevision(protocolizationCase: ProtocolizationCase, evaluation: ProtocolizationReadinessEvaluation, expectedCaseRevision: number | undefined): void;
/** The clock must produce Protocol's canonical instant, or nothing is stamped. */
export declare function readExecutionInstant(context: ProtocolizationCaseContext, protocolizationCase: ProtocolizationCase): string;
//# sourceMappingURL=execution-validation.d.ts.map