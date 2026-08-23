import type { AssetProfile } from '../profile';
import type { ProtocolizationCaseContext } from '../case/case-operations';
import type { ProtocolizationCase } from '../case/protocolization-case';
import type { ProtocolizationReadinessInputs } from './readiness-evaluation';
/**
 * The acting tenant must be well-formed and must be the case's own.
 *
 * Tenant B evaluating tenant A's case fails here, before the case is read for
 * anything else — the same gate every other slice applies, reused rather than
 * re-invented.
 */
export declare function assertActingTenantOwnsCase(context: ProtocolizationCaseContext, protocolizationCase: ProtocolizationCase): void;
/**
 * The aggregate must validate against the profile it claims to be pinned to.
 *
 * A case can arrive from a store, a message or a test fixture, so it is
 * re-validated on the way in exactly as APV-04's own operations do. A malformed
 * case yields no readiness answer at all: a conclusion drawn from a broken
 * aggregate would be indistinguishable, downstream, from a sound one.
 */
export declare function assertCaseIsValid(protocolizationCase: ProtocolizationCase, profile: AssetProfile): void;
/**
 * Resolves the **exact** pinned profile version from the catalogue.
 *
 * There is no latest, current, newest, default or nearest resolution here or
 * anywhere else in this slice. A case pinned to `1.0.0` is evaluated under
 * `1.0.0` after `2.0.0` exists, and a `2.0.0` that adds a requirement changes
 * nothing about it.
 */
export declare function resolvePinnedProfile(context: ProtocolizationCaseContext, protocolizationCase: ProtocolizationCase): AssetProfile;
/**
 * Every supplied record must belong to the acting tenant, to this case, and to
 * this case's exact pinned profile version.
 *
 * All three are hard boundaries, and each fails loudly rather than being
 * filtered away — a caller who handed over a foreign record has a bug, and
 * silently ignoring it would hide the bug behind a readiness answer that looks
 * complete:
 *
 * ```text
 * another tenant's evidence         can never satisfy this case
 * another case's verification result can never satisfy this case
 * another profile version's decision can never satisfy this case
 * ```
 */
export declare function assertInputsBelongToCase(context: ProtocolizationCaseContext, protocolizationCase: ProtocolizationCase, inputs: ProtocolizationReadinessInputs): void;
/** The clock must produce Protocol's canonical instant, or nothing is stamped. */
export declare function readEvaluationInstant(context: ProtocolizationCaseContext, protocolizationCase: ProtocolizationCase): string;
/**
 * Drops records bound to a case revision the case has not reached.
 *
 * A record can only describe a state the case actually passed through, so a
 * receipt claiming revision `40` on a case at revision `12` describes nothing
 * this evaluation is looking at. It is filtered rather than refused, matching
 * APV-08's own basis filtering: the record may be perfectly legitimate and
 * simply belong to a future the evaluation has not reached.
 */
export declare function withinEvaluatedRevision(recordRevision: number, evaluatedRevision: number): boolean;
//# sourceMappingURL=readiness-validation.d.ts.map