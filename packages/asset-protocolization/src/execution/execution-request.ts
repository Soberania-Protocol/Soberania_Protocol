import type { CanonicalId } from '@aoc/protocol/contracts';

import type { ProtocolizationResultId } from './execution-identifiers';
import type { ProtocolizationResult } from './protocolization-result';
import type { ProtocolizationExecutedEvent } from './execution-events';

/**
 * What a caller asks for, beyond the case and the readiness evaluation it
 * already holds.
 *
 * ### Deliberately almost empty
 *
 * Every fact execution needs is already on something the caller passes: the
 * tenant is on the operation context, the case supplies its own id, subject,
 * pin, lifecycle and revision, and the readiness evaluation supplies the
 * conclusion. Re-declaring any of them here would create a second spelling that
 * could disagree with the first, and the operation would then have to decide
 * which one it believed. So the request carries only what nothing else can
 * supply: the identity to mint the artifact under, an optional assertion about
 * which revision the caller thinks it is executing, and the correlation handle.
 *
 * There is no `subject`, no `profile`, no `tenantId`, no `caseId`, no
 * `readiness`, no `force`, no `skip`, no `override` and no `reason`. The last
 * four are worth naming as absences: this slice has no mechanism to execute
 * anything APV-09 has not independently found `Ready`, and adding a parameter
 * that bypassed it would be a waiver mechanism wearing a convenience flag's
 * clothes.
 */
export interface ProtocolizationExecutionRequest {
  /** The identity the resulting artifact will carry. Caller-minted, tenant-scoped. */
  readonly resultId: ProtocolizationResultId;

  /**
   * The revision the caller believes it is protocolizing. Optional.
   *
   * A caller that knows which revision it read can say so, and execution then
   * refuses on **exact** inequality against both the case's own revision and the
   * evaluation's `evaluatedCaseRevision`. There is no `>=`, no `<=`, no
   * tolerance and no "at least as new": a caller asserting revision `20` while
   * the case stands at `21` has read something that has since moved, which is
   * the same time-of-check / time-of-use failure the currency guard exists for,
   * arriving through a different door.
   *
   * Omitting it is not a weaker execution. The currency guard is mandatory
   * either way; this is a second, caller-supplied statement of the same fact,
   * for callers in a position to make it.
   */
  readonly expectedCaseRevision?: number;

  /**
   * Correlates this execution with the request that produced it.
   *
   * A correlation handle and never an identity: many records legitimately share
   * one, so it can neither name this artifact nor stand in for `resultId`.
   */
  readonly correlationId?: CanonicalId;
}

/**
 * What one successful execution produced.
 *
 * ### Why a compound value, and why it is not persisted here
 *
 * The domain operation is pure: it holds no repository, opens no connection and
 * writes nothing, exactly as APV-05, APV-06, APV-07 and APV-08's operations hold
 * none. It returns the artifact and the fact together so a composition layer can
 * commit them as one coherent outcome under whatever transaction it actually
 * has. This package deliberately does not pretend that two independent writes
 * are atomic, and it does not emit the event itself — an event dispatched before
 * a store commit would announce a protocolization that may not exist.
 *
 * Both members describe the same execution and cannot disagree: the event is
 * derived from the result, not assembled beside it.
 */
export interface ProtocolizationExecutionOutcome {
  readonly result: ProtocolizationResult;
  readonly event: ProtocolizationExecutedEvent;
}
