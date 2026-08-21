import type { ProtocolizationReadinessBlockerCode, ProtocolizationReadinessReason } from './readiness-reason';
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
export declare const ProtocolizationReadinessState: {
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
    readonly Ineligible: "Ineligible";
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
    readonly Rejected: "Rejected";
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
    readonly Blocked: "Blocked";
    /**
     * The current professional position on a required attestation requirement
     * asks for further material.
     *
     * This is the state APV-08 deliberately did not implement. It is derived from
     * the *current* review history, so an old `RequestMoreEvidence` that a later
     * review superseded stops dominating the moment that later review exists —
     * while remaining, permanently, part of the record.
     */
    readonly MoreEvidenceRequired: "MoreEvidenceRequired";
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
    readonly EvidencePending: "EvidencePending";
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
    readonly VerificationPending: "VerificationPending";
    /**
     * Human or professional work is outstanding: a required check returned
     * `ManualReview` with nobody having taken it up, a required attestation
     * requirement has no qualifying artifact, an artifact could not be shown to be
     * proof-backed, an otherwise-qualifying attestation no longer demonstrably
     * covers the current revision, or a review was requested and is undecided or
     * abstained.
     */
    readonly ReviewPending: "ReviewPending";
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
    readonly Ready: "Ready";
};
export type ProtocolizationReadinessState = (typeof ProtocolizationReadinessState)[keyof typeof ProtocolizationReadinessState];
/**
 * Whether one requirement of the pinned profile applies to this case.
 *
 * Three members, because collapsing the third into either of the first two is
 * how a requirement silently disappears from — or silently appears in — a
 * readiness decision.
 */
export declare const ProtocolizationRequirementApplicability: {
    /** The requirement applies. `Required` and `Optional` obligations reach this. */
    readonly Applicable: "Applicable";
    /**
     * The profile states on the record that this requirement is not demanded —
     * `obligation: 'NotRequired'`. Mechanically resolved, and never a blocker.
     */
    readonly NotApplicable: "NotApplicable";
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
    readonly Unresolved: "Unresolved";
};
export type ProtocolizationRequirementApplicability = (typeof ProtocolizationRequirementApplicability)[keyof typeof ProtocolizationRequirementApplicability];
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
export declare const ProtocolizationRequirementStatus: {
    /** The profile does not demand this requirement. Never blocks. */
    readonly NotApplicable: "NotApplicable";
    /** Something the requirement demands is still outstanding. */
    readonly Pending: "Pending";
    /**
     * The requirement is affirmatively prevented: a current `Fail`, a current
     * professional rejection, or conflicting current professional positions.
     * Distinct from `Pending` because the route out of it is different.
     */
    readonly Blocked: "Blocked";
    /** Every machine-readable obligation of this requirement is met at this revision. */
    readonly Satisfied: "Satisfied";
    /**
     * Satisfied, with a non-fatal finding preserved.
     *
     * A `Warning` outcome on a declared check reaches here. It is deliberately not
     * folded into `Satisfied`: the warning travels on the assessment and on the
     * evaluation, all the way to whoever is entitled to weigh it.
     */
    readonly SatisfiedWithWarning: "SatisfiedWithWarning";
};
export type ProtocolizationRequirementStatus = (typeof ProtocolizationRequirementStatus)[keyof typeof ProtocolizationRequirementStatus];
/**
 * Every blocker code, paired with the state it derives, in precedence order.
 *
 * Exported so the derivation table is inspectable rather than folklore: a
 * consumer — or a test — can read exactly which codes produce which state
 * without reimplementing the rule.
 */
export declare const PROTOCOLIZATION_READINESS_STATE_PRECEDENCE: readonly {
    readonly state: ProtocolizationReadinessState;
    readonly reasonCodes: readonly ProtocolizationReadinessBlockerCode[];
}[];
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
export declare function deriveProtocolizationReadinessState(blockers: readonly ProtocolizationReadinessReason[]): ProtocolizationReadinessState;
export declare function isProtocolizationReadinessState(value: unknown): value is ProtocolizationReadinessState;
export declare function isProtocolizationRequirementApplicability(value: unknown): value is ProtocolizationRequirementApplicability;
export declare function isProtocolizationRequirementStatus(value: unknown): value is ProtocolizationRequirementStatus;
//# sourceMappingURL=readiness-state.d.ts.map