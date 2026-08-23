"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION = void 0;
/**
 * `ProtocolizationReadinessEvaluation` — the complete, explainable answer to
 * *may protocolization be attempted for this case, right now?*
 *
 * ### What an evaluation means
 *
 * Exactly this, and reading more into it is the central risk of this slice:
 *
 * ```text
 * this case, belonging to this tenant,
 * as it stood at this exact revision,
 * assessed against this exact pinned AssetProfile version,
 * over the evidence receipts, declarations, verification results, review
 *   requests, review decisions and attestations supplied,
 * at this instant,
 * stands in this readiness state, for these reasons.
 * ```
 *
 * ### What it does not mean
 *
 * ```text
 * Ready != protocolized            Ready != tokenizable
 * Ready != legal title             Ready != legally transferable
 * Ready != statutory compliance    Ready != Enterprise authorization
 * Ready != investment suitability  Ready != government recognition
 * ```
 *
 * `READY` means the current revision of this `ProtocolizationCase` satisfies the
 * machine-readable protocolization prerequisites of its exact pinned
 * `AssetProfile`, under the evidence, verification and professional-attestation
 * semantics Asset Protocolization represents. It is a technical protocolization
 * state. It is not an approved asset, a legally valid asset, or certified
 * ownership, and it is never a synonym for any of those.
 *
 * ### Returning it executes nothing
 *
 * An evaluation is a value. Producing one writes nothing, anchors nothing,
 * mints nothing, signs nothing, notifies nobody, contacts no registry and
 * transitions no case. A `Ready` evaluation is exactly as inert as a
 * `VerificationPending` one.
 *
 * ### `ready` is derived, never authoritative
 *
 * The boolean is `state === Ready` and nothing else. It exists because callers
 * ask that question constantly, and it is deliberately not something anyone can
 * set: this slice exposes exactly one operation, that operation only derives,
 * and there is no persisted `ready` flag anywhere that could disagree with the
 * assessments justifying it.
 *
 * ### It is bound to one revision, and that is what protects APV-10
 *
 * `evaluatedCaseRevision` is the whole TOCTOU story. A result computed at
 * revision `20` is a statement about revision `20` forever; a declaration
 * recorded afterwards moves the case to `21` and the old result does not follow
 * it. APV-10 compares the two before acting — see
 * `isProtocolizationReadinessCurrentForCase` — and refuses on a mismatch rather
 * than executing on a readiness nobody re-established.
 *
 * ### It is not persisted
 *
 * There is no readiness repository, no stored state field, no evaluation id and
 * no readiness event in this slice. An evaluation is a pure deterministic
 * projection of records that are already immutable and already audited: storing
 * a second, mutable copy of a conclusion that can be recomputed exactly would
 * create a value free to drift from the facts it summarizes, with no mechanism
 * anywhere to explain the divergence. Where an audit obligation for readiness
 * history is later established, append-only, tenant-scoped, revision-bound
 * records are an additive amendment — not a silent reinterpretation of this one.
 */
exports.PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION = 'aoc-protocolization-readiness/1';
