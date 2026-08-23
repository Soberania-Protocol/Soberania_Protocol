import { protocolizationProfileRefsEqual } from '../case/case-identifiers';
import type { ProtocolizationCase } from '../case/protocolization-case';
import type { ProtocolizationResult } from './protocolization-result';

/**
 * Read-only views over protocolization results.
 *
 * Pure and synchronous: no clock, no repository, no I/O, no case mutation, no
 * execution. Nothing here decides anything an execution did not already decide —
 * these are conveniences over values a caller already holds.
 */

/**
 * Whether this result describes the case revision a caller is holding.
 *
 * ### A result does not follow its case
 *
 * ```text
 * revision 20   protocolized, result R1
 * revision 21   a declaration is recorded
 * revision 21   R1 is still true about revision 20, and does NOT describe 21
 * ```
 *
 * R1 is not invalidated, not superseded and not rewritten by the case moving on:
 * it remains the permanent record of what revision `20` was and that it was
 * protocolized. What it stops being is a statement about *now*. Revision `21` is
 * protocolized when — and only when — APV-09 produces a current `Ready` for it
 * and a second execution records a second result beside the first.
 *
 * Tenant, case, pin and revision are all compared, on the same exactness as
 * APV-09's readiness guard: a result of an older revision described strictly
 * less, and one carrying a newer revision describes a case this caller is not
 * holding.
 *
 * Notice what it does not do. It does not decide what a non-current result
 * *means*, does not invalidate one, and does not suggest re-executing — that is
 * the consuming layer's policy, and this answers one question so nobody has to
 * infer it from a timestamp.
 */
export function isProtocolizationResultCurrentForCase(
  result: ProtocolizationResult,
  protocolizationCase: ProtocolizationCase,
): boolean {
  return (
    result.tenantId === protocolizationCase.tenantId &&
    result.caseId === protocolizationCase.caseId &&
    protocolizationProfileRefsEqual(result.profile, protocolizationCase.profile) &&
    result.executedCaseRevision === protocolizationCase.revision
  );
}

/**
 * The results describing one exact case revision, from a set a caller holds.
 *
 * A filter over history, in the order it was given. It answers *was this
 * revision protocolized?* without asking a repository and without implying that
 * an unprotocolized revision is deficient — most revisions of most cases never
 * are, and that is ordinary.
 */
export function listProtocolizationResultsForRevision(
  results: readonly ProtocolizationResult[],
  protocolizationCase: ProtocolizationCase,
): readonly ProtocolizationResult[] {
  return results.filter((result) => isProtocolizationResultCurrentForCase(result, protocolizationCase));
}
