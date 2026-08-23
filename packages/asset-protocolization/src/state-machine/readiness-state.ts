import { PROTOCOLIZATION_READINESS_BLOCKER_CODES } from './readiness-reason';
import type {
  ProtocolizationReadinessBlockerCode,
  ProtocolizationReadinessReason,
} from './readiness-reason';

/**
 * The APV-09 readiness vocabulary.
 *
 * ### This is not `ProtocolizationCaseState`
 *
 * Read that first, because collapsing the two is the single most expensive
 * mistake available in this slice.
 *
 * ```text
 * ProtocolizationCaseState        Draft | Active | Cancelled
 *   the case's *lifecycle*: does this attempt exist, and does it accept work?
 *   Commanded — someone activates or cancels a case — persisted on the
 *   aggregate, and owned by APV-04.
 *
 * ProtocolizationReadinessState   Ineligible | Rejected | Blocked
 *                                 | MoreEvidenceRequired | EvidencePending
 *                                 | VerificationPending | ReviewPending | Ready
 *   the *dossier's* standing against the exact pinned AssetProfile version at
 *   one exact case revision. Derived — nobody commands it — never persisted,
 *   and owned by APV-09.
 * ```
 *
 * They are orthogonal, and both are meaningful at once:
 *
 * ```text
 * lifecycle Active + readiness EvidencePending    a live case still collecting
 * lifecycle Active + readiness Ready              a live case whose dossier is complete
 * lifecycle Draft  + readiness VerificationPending an unactivated case mid-checks
 * lifecycle Cancelled + readiness Ineligible      no amount of material changes this
 * ```
 *
 * APV-04's enum is untouched by this slice. No `Ready`, `Rejected` or
 * `MoreEvidenceRequired` member was added to it, `MaterialPresent` still means
 * exactly what it meant, and nothing here writes to a case.
 *
 * ### And it is not execution
 *
 * There is deliberately no `Protocolizing` and no `Protocolized` member.
 * Readiness is the answer to *may protocolization be attempted?*; whether it was
 * attempted, and what happened, is a third dimension APV-10 owns. A state
 * machine that could report `Protocolized` without anything having executed
 * would be reporting a fact it has no way to know.
 *
 * ### Eight members, each reachable
 *
 * Every member below can be reached from legitimate inputs available today, and
 * every one is exercised by a test. Candidate names from the roadmap that cannot
 * be reached — `ProfileSelected` (a case pins its profile at creation, so the
 * state has no distinct meaning), `Suspended` (no suspension command exists),
 * `Superseded` (no supersession semantics exist), `Archived` (no archive
 * lifecycle exists) — are deliberately absent rather than declared and
 * unreachable.
 */
export const ProtocolizationReadinessState = {
  /**
   * The case's lifecycle forbids protocolization work. Today that is exactly
   * `Cancelled`.
   *
   * Entered when the case is cancelled; left only if the lifecycle itself
   * changes, which APV-04's transition table currently does not permit. It is
   * not a judgement about the dossier: a cancelled case whose every requirement
   * is otherwise satisfied is still `Ineligible`, and its assessments still say
   * so requirement by requirement.
   */
  Ineligible: 'Ineligible',

  /**
   * A professional's current position on a required attestation requirement is
   * `Reject`.
   *
   * ```text
   * Rejected != case cancelled   != fraud   != legal invalidity
   * ```
   *
   * Derived, and therefore never terminal by construction: a later review on a
   * later basis revision changes what "current" means, and the state changes
   * with it. Nothing here closes a case, and nothing here reaches a legal
   * conclusion — the profession declined to attest, and that is all.
   */
  Rejected: 'Rejected',

  /**
   * Current professional positions on one required attestation requirement
   * disagree.
   *
   * APV-08 preserves conflicting decisions and adjudicates none; APV-09 does not
   * adjudicate them either. There is no first-wins, last-wins, majority or
   * most-favourable rule anywhere in this package. Resolution is a human act —
   * a further review on a further basis revision — and until it happens the case
   * is blocked rather than silently decided.
   */
  Blocked: 'Blocked',

  /**
   * The current professional position on a required attestation requirement
   * asks for further material.
   *
   * This is the state APV-08 deliberately did not implement. It is derived from
   * the *current* review history, so an old `RequestMoreEvidence` that a later
   * review superseded stops dominating the moment that later review exists —
   * while remaining, permanently, part of the record.
   */
  MoreEvidenceRequired: 'MoreEvidenceRequired',

  /**
   * Dossier material the pinned profile requires is missing, short of a declared
   * minimum, mechanically incompatible, governed by a condition nobody has
   * resolved, or subject to an explicit profile constraint nothing supplied can
   * establish.
   *
   * The collection stage: identity, declaration and evidence requirements are
   * all answered by material, and this is the state that says some of it — or
   * some of what the profile demands *of* it — is not there yet.
   */
  EvidencePending: 'EvidencePending',

  /**
   * Automated verification work the pinned profile requires is outstanding: a
   * declared check has never run, has not run against this revision, could not
   * run, or ran and failed.
   *
   * A current `Fail` lives here rather than in a state of its own, and that is a
   * deliberate decision. A failing check is a finding about the *material*, and
   * the route out of it is the same route out of every other verification gap —
   * correct the dossier and re-execute. Giving it its own top-level state would
   * have implied a different resolution path that does not exist. The
   * distinction is not lost: the blocker is `verification.fail`, never
   * `verification.missing`.
   */
  VerificationPending: 'VerificationPending',

  /**
   * Human or professional work is outstanding: a required check returned
   * `ManualReview` with nobody having taken it up, a required attestation
   * requirement has no qualifying artifact, an artifact could not be shown to be
   * proof-backed, an otherwise-qualifying attestation no longer demonstrably
   * covers the current revision, or a review was requested and is undecided or
   * abstained.
   */
  ReviewPending: 'ReviewPending',

  /**
   * Every applicable `Required` requirement of the exact pinned profile version
   * is satisfied at the evaluated case revision, and no blocker remains.
   *
   * ```text
   * READY != protocolized          READY != tokenizable
   * READY != legal title           READY != legally transferable
   * READY != government recognition
   * READY != Enterprise authorization
   * ```
   *
   * `Ready` means: *the current revision of this case satisfies the
   * machine-readable protocolization prerequisites of its exact pinned
   * `AssetProfile`, under the evidence, verification and professional-attestation
   * semantics Asset Protocolization represents.* It authorizes nothing, executes
   * nothing and writes nothing. It may coexist with warnings.
   */
  Ready: 'Ready',
} as const;
export type ProtocolizationReadinessState =
  (typeof ProtocolizationReadinessState)[keyof typeof ProtocolizationReadinessState];

/**
 * Whether one requirement of the pinned profile applies to this case.
 *
 * Three members, because collapsing the third into either of the first two is
 * how a requirement silently disappears from — or silently appears in — a
 * readiness decision.
 */
export const ProtocolizationRequirementApplicability = {
  /** The requirement applies. `Required` and `Optional` obligations reach this. */
  Applicable: 'Applicable',
  /**
   * The profile states on the record that this requirement is not demanded —
   * `obligation: 'NotRequired'`. Mechanically resolved, and never a blocker.
   */
  NotApplicable: 'NotApplicable',
  /**
   * The requirement is `Conditional` and nothing available can say whether its
   * condition holds.
   *
   * APV-03 defines a condition as an opaque `conditionId`, and no slice up to
   * and including this one defines a condition evaluator. APV-09 does not invent
   * one: inferring applicability from a requirement's metadata, its id or its
   * presentation text would be deciding a profile's semantics by reading prose.
   * So the honest answer is `Unresolved`, and an unresolved applicable-or-not
   * requirement blocks `Ready` rather than vanishing from it.
   */
  Unresolved: 'Unresolved',
} as const;
export type ProtocolizationRequirementApplicability =
  (typeof ProtocolizationRequirementApplicability)[keyof typeof ProtocolizationRequirementApplicability];

/**
 * What APV-09 concluded about one requirement.
 *
 * ### `MaterialPresent` is not `Satisfied`
 *
 * APV-04's `ProtocolizationRequirementMaterialStatus` answers *was something
 * associated?* — two members, no judgement, and this slice does not rename,
 * widen or reinterpret it. This enum answers a different question: *does what
 * the case holds meet what the pinned profile demanded?* A requirement can sit
 * at `MaterialPresent` and `Blocked` at the same time, and frequently does.
 *
 * Five members. Fewer would erase a distinction a caller acts on; more would be
 * detail that belongs in the blocker codes, where it already lives.
 */
export const ProtocolizationRequirementStatus = {
  /** The profile does not demand this requirement. Never blocks. */
  NotApplicable: 'NotApplicable',
  /** Something the requirement demands is still outstanding. */
  Pending: 'Pending',
  /**
   * The requirement is affirmatively prevented: a current `Fail`, a current
   * professional rejection, or conflicting current professional positions.
   * Distinct from `Pending` because the route out of it is different.
   */
  Blocked: 'Blocked',
  /** Every machine-readable obligation of this requirement is met at this revision. */
  Satisfied: 'Satisfied',
  /**
   * Satisfied, with a non-fatal finding preserved.
   *
   * A `Warning` outcome on a declared check reaches here. It is deliberately not
   * folded into `Satisfied`: the warning travels on the assessment and on the
   * evaluation, all the way to whoever is entitled to weigh it.
   */
  SatisfiedWithWarning: 'SatisfiedWithWarning',
} as const;
export type ProtocolizationRequirementStatus =
  (typeof ProtocolizationRequirementStatus)[keyof typeof ProtocolizationRequirementStatus];

/**
 * The state-derivation table.
 *
 * ### Explicit, and never enum order
 *
 * Precedence is this list, read top to bottom. Nothing anywhere compares enum
 * positions, sorts members, or relies on declaration order in
 * `ProtocolizationReadinessState` — reordering that object changes no behaviour,
 * and reordering this one changes it deliberately and visibly.
 *
 * ### The order, and why
 *
 * ```text
 * 1  Ineligible            the lifecycle question comes first: if the case
 *                          cannot be worked on, no dossier finding matters
 * 2  Rejected              a professional has declined. The strongest current
 *                          human position outranks any amount of pending work
 * 3  Blocked               professionals disagree. Needs a human, not more work
 * 4  MoreEvidenceRequired  a professional has said exactly what they need
 * 5  EvidencePending       material — and the records that establish what the
 *                          profile demands of it — come before checking it
 * 6  VerificationPending   checking comes before asking a person
 * 7  ReviewPending         human work is the last stage before readiness
 * 8  Ready                 no blocker of any kind remains
 * ```
 *
 * Stages 5→6→7 follow the workflow's own order, so the reported state names the
 * earliest unfinished stage rather than an arbitrary one. Stages 1→4 are
 * interventions that outrank the pipeline because a person, not a process, has
 * to move them.
 *
 * ### A state is a summary, never a redaction
 *
 * The winning state never removes a finding. An evaluation reporting
 * `MoreEvidenceRequired` still carries its unresolved condition, its unavailable
 * check and every other blocker in `blockers`, and each still appears on the
 * assessment it came from. A caller that reads only the state has chosen a
 * summary; a caller that needs the whole answer has it.
 */
const READINESS_STATE_PRECEDENCE: readonly {
  readonly state: ProtocolizationReadinessState;
  readonly reasonCodes: readonly ProtocolizationReadinessBlockerCode[];
}[] = Object.freeze([
  Object.freeze({
    state: ProtocolizationReadinessState.Ineligible,
    reasonCodes: Object.freeze([PROTOCOLIZATION_READINESS_BLOCKER_CODES.lifecycleCancelled]),
  }),
  Object.freeze({
    state: ProtocolizationReadinessState.Rejected,
    reasonCodes: Object.freeze([PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewRejected]),
  }),
  Object.freeze({
    state: ProtocolizationReadinessState.Blocked,
    reasonCodes: Object.freeze([PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewConflicting]),
  }),
  Object.freeze({
    state: ProtocolizationReadinessState.MoreEvidenceRequired,
    reasonCodes: Object.freeze([
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewMoreEvidenceRequired,
    ]),
  }),
  Object.freeze({
    state: ProtocolizationReadinessState.EvidencePending,
    reasonCodes: Object.freeze([
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialMissing,
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialInsufficient,
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.materialIncompatible,
      // An unestablished profile constraint is answered by supplying the record
      // that would establish it, which is dossier work like any other.
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.constraintUnevaluated,
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.conditionUnresolved,
    ]),
  }),
  Object.freeze({
    state: ProtocolizationReadinessState.VerificationPending,
    reasonCodes: Object.freeze([
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationMissing,
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationFail,
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationStale,
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationUnavailable,
    ]),
  }),
  Object.freeze({
    state: ProtocolizationReadinessState.ReviewPending,
    reasonCodes: Object.freeze([
      // Automation deferred judgement to a person, so the resolution path is a
      // professional's — not a re-run. That is why it is grouped here rather
      // than with the other verification outcomes.
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.verificationManualReview,
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationMissing,
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationDecisionMissing,
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationUnprovenArtifact,
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationTypeIncompatible,
      // Resolved by a further review on the newer basis, so it is review work.
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.attestationCurrencyUnresolved,
      PROTOCOLIZATION_READINESS_BLOCKER_CODES.reviewPending,
    ]),
  }),
]);

/**
 * Every blocker code, paired with the state it derives, in precedence order.
 *
 * Exported so the derivation table is inspectable rather than folklore: a
 * consumer — or a test — can read exactly which codes produce which state
 * without reimplementing the rule.
 */
export const PROTOCOLIZATION_READINESS_STATE_PRECEDENCE = READINESS_STATE_PRECEDENCE;

/**
 * Derives the top-level state from the complete blocker set.
 *
 * Total over the closed blocker vocabulary: every code appears in exactly one
 * precedence entry, so no blocker can be present while the derivation still
 * reports `Ready`. An empty blocker set — and only an empty blocker set —
 * yields `Ready`.
 *
 * Pure: no clock, no case, no I/O, no randomness. The same blockers always
 * derive the same state.
 */
export function deriveProtocolizationReadinessState(
  blockers: readonly ProtocolizationReadinessReason[],
): ProtocolizationReadinessState {
  const present = new Set(blockers.map((blocker) => blocker.reasonCode));
  for (const entry of READINESS_STATE_PRECEDENCE) {
    if (entry.reasonCodes.some((code) => present.has(code))) return entry.state;
  }
  return ProtocolizationReadinessState.Ready;
}

export function isProtocolizationReadinessState(
  value: unknown,
): value is ProtocolizationReadinessState {
  return (
    typeof value === 'string' && Object.values<string>(ProtocolizationReadinessState).includes(value)
  );
}

export function isProtocolizationRequirementApplicability(
  value: unknown,
): value is ProtocolizationRequirementApplicability {
  return (
    typeof value === 'string' &&
    Object.values<string>(ProtocolizationRequirementApplicability).includes(value)
  );
}

export function isProtocolizationRequirementStatus(
  value: unknown,
): value is ProtocolizationRequirementStatus {
  return (
    typeof value === 'string' &&
    Object.values<string>(ProtocolizationRequirementStatus).includes(value)
  );
}
