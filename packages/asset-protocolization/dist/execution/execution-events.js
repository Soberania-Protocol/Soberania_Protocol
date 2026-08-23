"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROTOCOLIZATION_EXECUTION_EVENT_TYPES = void 0;
/**
 * The one auditable fact protocolization execution produces.
 *
 * ### Why this slice has an event where APV-09 has none
 *
 * APV-09 emits nothing because a readiness evaluation is a projection: it can be
 * recomputed exactly from records the audit log already holds, so a
 * `ReadinessEvaluated` event would restate a fact nobody created. Execution is
 * the opposite. A `ProtocolizationResult` comes into existence at one instant,
 * for one revision, and could not have been derived from the dossier a moment
 * earlier — nothing in the case, the profile or the evaluation says *this was
 * executed*. That is a genuinely new fact, and it is the only one this slice
 * makes.
 *
 * ### Read the name literally
 *
 * *Executed*, and nothing further:
 *
 * ```text
 * ProtocolizationExecuted  the APV protocolization workflow completed over one
 *                          exact case revision and produced result R
 *
 * NOT  AssetRegistered        NOT  TitleIssued        NOT  OwnershipTransferred
 * NOT  AssetTokenized         NOT  AssetMinted        NOT  CaseApproved
 * NOT  EnterpriseAuthorized   NOT  AssetVerified      NOT  ClaimProven
 * ```
 *
 * Each of those names a conclusion no part of this vertical is entitled to
 * reach, and an event named for something that cannot happen yet is a promise
 * the code does not keep. A subscriber that reads this event as any of them has
 * misread it, and there is deliberately no field anywhere in the payload that
 * would encourage the mistake.
 *
 * ### Emitted only on success
 *
 * A refused execution produces no event, because no execution fact exists to
 * announce. There is no `ProtocolizationExecutionFailed`, no
 * `ProtocolizationAttempted` and no `ProtocolizationStarted`: this slice commits
 * nothing before the result exists, so a failure leaves the world exactly as it
 * was and has nothing to report but its own error.
 *
 * ### Why the payload is narrow
 *
 * An event fans out to subscribers who may have no business reading a dossier.
 * It carries identifiers, the pin, the revision and the instant — never
 * evidence, claims, declarations, reviewer notes, attestation statements,
 * warnings, personal data or secrets. Notably absent is `subject`: the sovereign
 * identity of a protocolized thing is exactly the kind of fact a broadcast
 * payload should not scatter, and a reader entitled to it reads the result.
 *
 * Events are **outputs**, not the source of truth. The result is the record; a
 * dropped event loses a notification, never a protocolization.
 */
exports.PROTOCOLIZATION_EXECUTION_EVENT_TYPES = Object.freeze({
    executed: 'ProtocolizationExecuted',
});
