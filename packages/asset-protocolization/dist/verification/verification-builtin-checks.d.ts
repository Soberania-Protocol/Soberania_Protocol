import type { CanonicalRegistryEntryRef } from '@aoc/protocol/claims';
import type { AssetRegistryConstraint } from '../constraints';
import type { AssetVerificationCheck } from './verification-check';
/**
 * *Every requirement the pinned profile marks `Required` — other than its
 * verification requirements — has at least one material association.*
 *
 * That sentence is the whole proposition, and the boundary around it matters
 * more than the implementation.
 *
 * ### Presence is not satisfaction, and this is not readiness
 *
 * A `Pass` here means references were recorded where the profile expected them.
 * It does not mean the referenced records exist, are authentic, are current, are
 * adequate, or that any requirement is *satisfied* — APV-04 spent a whole slice
 * making `MaterialPresent` mean the narrow thing it says, and this check inherits
 * that narrowness exactly. It is emphatically not a readiness verdict: it
 * ignores whether other checks passed, whether conditions were resolved, and
 * whether a professional has attested anything. APV-09 owns readiness; this
 * reports one mechanical fact that a readiness evaluation will later need.
 *
 * ### Why verification requirements are excluded
 *
 * They are answered by check *executions*, and executions are never written back
 * as case material (see `verification-operations.ts`). Counting them would make
 * this check fail on every case, forever, for a structural reason having nothing
 * to do with the case.
 *
 * ### Conditional requirements produce `ManualReview`, never a silent `Pass`
 *
 * APV-04 reports an unevaluated condition as `Unresolved`, which is the honest
 * answer and deliberately not a boolean. A conditional requirement with no
 * material might be irrelevant to this case, or might be a genuine gap — and
 * nothing available to this check can tell the two apart. Reporting `Pass` would
 * quietly assume the first; reporting `Fail` would assume the second. So the
 * check declines to conclude and says so.
 *
 * Precedence: a missing `Required` material (`Fail`) outranks an unresolved
 * condition (`ManualReview`), because a definite gap is worth reporting ahead of
 * a possible one.
 */
export declare const requiredMaterialPresentCheck: AssetVerificationCheck;
/**
 * *Every `Required` requirement declaring a `minimumCount` has at least that
 * many materials of the kind that mechanically answers it.*
 *
 * APV-03 encodes `minimumCount` on declaration, evidence and attestation
 * requirements, and APV-04 deliberately refused to evaluate it — `MaterialPresent`
 * means "at least one", and teaching the case aggregate to count would have made
 * it a satisfaction evaluator. This is the layer that was always meant to read
 * it.
 *
 * Counting is by *compatible kind*, never by raw correlation. An evidence
 * requirement demanding two documents is answered by two evidence materials; a
 * declaration correlated to the same requirement contributes nothing to its
 * count, whatever else it may mean.
 *
 * A count met is still not a requirement satisfied. Two evidence references are
 * two references — this check reads no document, judges no quality, and infers
 * nothing about whether the evidence supports anything.
 */
export declare const minimumMaterialCountCheck: AssetVerificationCheck;
/**
 * Whether one registry entry reference conforms to a profile's registry
 * constraint.
 *
 * Exported for reuse *inside* this package only — it is not part of the package
 * facade. APV-09 asks the same mechanical question of the same Protocol
 * vocabulary when it assesses an identity or evidence requirement, and a second
 * copy of this comparison would be free to drift from this one.
 *
 * Structural only: `RegistryType`, `RegistryAuthorityLevel`, `RegistryEntryType`
 * and an opaque namespace allow-list. No registry is named, no jurisdiction is
 * known, and nothing here resolves the entry or establishes that it exists.
 */
export declare function registryEntryConforms(entryRef: CanonicalRegistryEntryRef, constraint: AssetRegistryConstraint): boolean;
/**
 * *Every `Required` identity requirement of the pinned profile is evidenced by
 * the strategies it accepts, and any registry entry offered against it conforms
 * to the registry constraint it declares.*
 *
 * ### What this is not
 *
 * It is not identity *resolution*. Nothing here contacts an identity provider,
 * dereferences an external reference, queries a registry or confirms that anyone
 * is who they say they are — this package builds no identity provider and ships
 * no identity resolver, and APV-00's reuse map places identity *representation*
 * squarely in Protocol. What this check establishes is that the identifying
 * material the profile demanded is present and structurally conforms.
 *
 * Resolving an identity or an entry against a live external source is a genuine
 * and legitimate future check: it arrives as a registered implementation with an
 * injected resolver port, and a resolver that cannot be reached yields
 * `Unavailable` — never a manufactured confirmation. Nothing about that future
 * check requires a change to Protocol, to the case aggregate, or to this file.
 *
 * ### Identity is never authority
 *
 * A `Pass` says the subject carries the identifying material the profile asked
 * for. It does not say that a declarant is that subject's owner, that anyone is
 * entitled to act for it, or that any principal may bind another. Authority is a
 * separate question with a separate owner (Enterprise governance), and no
 * outcome from this check may be read across into it.
 *
 * ### Registry semantics stay generic
 *
 * Conformance is evaluated against `RegistryType`, `RegistryAuthorityLevel`,
 * `RegistryEntryType` and an opaque namespace allow-list — Protocol's own
 * vocabulary, exactly as Gate A0 / `U-2` froze it. No registry is named, no
 * jurisdiction is known, and no national registry is special-cased here or
 * anywhere else in this package.
 */
export declare const identityStrategyCheck: AssetVerificationCheck;
/**
 * *Every observation behind this case's evidence satisfies the freshness
 * constraint the pinned profile declares for the requirement it answers.*
 *
 * ### Only what the profile actually says
 *
 * `AssetFreshnessConstraint` carries `maxAgeSeconds`, `observedAfter` and
 * `mustNotBeExpired`, and this check evaluates exactly those. It invents no
 * validity period of its own: no "documents older than six months are stale", no
 * jurisdictional expiry rule, no default. A profile that declares no freshness
 * constraint gets `Pass` with `freshness.not.constrained`, which says precisely
 * that nothing was constrained — not that anything is fresh.
 *
 * ### The instant it compares
 *
 * `EvidenceIntakeReceipt.observedAt` — *when the source observed what the
 * evidence describes* — which APV-05 preserved verbatim and deliberately
 * refused to judge, default or repair. Notably not `receivedAt`: when the
 * vertical was told about something says nothing about how old the observation
 * was, and comparing against it would make every stale document look fresh the
 * moment it was submitted.
 *
 * Evidence whose receipt carries no `observedAt` cannot be evaluated at all, so
 * the check reports `Unavailable` rather than assuming an instant. APV-05 chose
 * absence over a default for exactly this reason.
 *
 * `mustNotBeExpired` reads expiry from the referenced Protocol record, and this
 * package holds no evidence resolver — so it too reports `Unavailable`, and
 * names the missing dependency rather than guessing.
 *
 * ### Future-dated observations
 *
 * An observation later than the execution instant satisfies any maximum age
 * arithmetically while meaning nothing. APV-05 and APV-06 deliberately admitted
 * structurally canonical future timestamps without adjudicating plausibility,
 * and this check does not retroactively reject them — it reports `Warning`, so
 * the anomaly stays visible without being called a failure.
 *
 * ### A failing freshness check deletes nothing
 *
 * The evidence remains in the case, the receipt remains in its repository, and
 * neither is marked invalid. A stale observation is a finding about *this check
 * at this revision*, not a judgement on the material — which may be perfectly
 * good evidence of something else, and will still be there when a newer
 * observation arrives.
 */
export declare const evidenceFreshnessCheck: AssetVerificationCheck;
/**
 * *Every declaration this case holds names a `CanonicalClaim` whose actual
 * `type` is the one the declaration recorded.*
 *
 * ### This closes APV-06's open item
 *
 * On the `Reference` pathway a caller names a claim by id and states its
 * `ClaimType`. APV-06 checked that statement against the profile and — having no
 * way to dereference a Protocol record — could not check it against the record
 * itself, and said so rather than pretending otherwise. With a
 * `VerificationClaimResolver` bound, this check does the comparison APV-06 could
 * not.
 *
 * The caller is never assumed to have been right. Without a resolver, or when
 * the resolver cannot answer, the outcome is `Unavailable` — never `Pass`. A
 * declared type is promoted to a checked type only by actually reading the
 * record.
 *
 * ### What a match proves, and what it does not
 *
 * A match proves the claim record is of the type the declaration said it was.
 * It does not prove the proposition the claim asserts, that the declarant is who
 * they say, that they were entitled to assert it, or that the evidence they
 * pointed at supports them. `ClaimType.Authorship` resolving as
 * `ClaimType.Authorship` establishes that somebody made an authorship claim —
 * exactly what APV-06 already recorded, now corroborated against the record.
 *
 * ### A mismatch rewrites nothing
 *
 * The declaration record is immutable and this check holds only a read-only
 * view. A `Fail` produces a finding; it does not correct the record, retract it,
 * flag it, or delete it. Whoever reads the finding sees both the original
 * declaration and the mismatch, which is the point.
 */
export declare const declarationClaimTypeCheck: AssetVerificationCheck;
/**
 * *No declaration requirement of the pinned profile carries assertions from two
 * or more distinct declarants.*
 *
 * ### Why the outcome is `ManualReview` and never `Fail`
 *
 * Because nothing in the frozen vocabulary encodes negation, polarity or
 * equivalence between two propositions. `ClaimType`, `claimSubtype`, declarant,
 * subject and claim reference are all this check may read — and none of them can
 * express "X" and "not X". Two principals asserting into the same requirement
 * slot is therefore a *competing* pair that automation can detect and cannot
 * adjudicate: both may be true, one may be a correction, one may be fraudulent,
 * and deciding which is a human judgement.
 *
 * Returning `Fail` would be that judgement, made without the semantics to make
 * it. Returning `Pass` would hide a genuine question. `ManualReview` says
 * exactly what happened: something was found that a person needs to look at.
 *
 * ### No free text is read, ever
 *
 * `ProtocolizationDeclarationRecord.statement` is not consulted here or anywhere
 * else in this package. Parsing prose into a truth value — by pattern, by
 * heuristic, by language model or by any other means — would make the outcome
 * non-deterministic and would dress an inference up as a mechanical finding.
 * APV-06 kept the statement presentational precisely so that no later slice
 * could be tempted, and this check honours that.
 *
 * ### Competing declarations stay
 *
 * Both remain in the case, both remain in the declaration repository, and
 * neither is rewritten, withdrawn or marked superseded. Preserving contradiction
 * is what makes the log worth reading.
 *
 * ### `ManualReview` starts no workflow
 *
 * It assigns no reviewer, creates no attestation, opens no queue and grants no
 * approval. APV-08 owns professional review; this records that a question exists.
 */
export declare const competingDeclarationCheck: AssetVerificationCheck;
/**
 * *The subject's content bytes produce exactly the `ContentIdentity` the case
 * pinned.*
 *
 * ### It uses Protocol's primitives, and invents none
 *
 * The comparison is Protocol's own `verifyContentIdentity`, over Protocol's own
 * `ContentIdentity` and `ContentDigestAlgorithm`. No hashing algorithm,
 * signature format, key model or proof format is defined anywhere in this
 * package, and an algorithm Protocol does not support yields `Unavailable`
 * rather than a silently skipped check — the same fail-closed choice Protocol
 * itself makes.
 *
 * ### The bytes come from a port, because this package has none
 *
 * APV-05 stores references, never content: there is no blob store, no
 * filesystem access, no object storage, no content-addressed network and no
 * upload path anywhere in this vertical, and acquiring one to make a digest
 * check convenient is precisely the infrastructure APV-07 must not add. Bytes
 * therefore arrive through `VerificationContentResolver`, and a deployment that
 * has not bound one gets `Unavailable`.
 *
 * ### `Unavailable` is not `Fail`
 *
 * A resolver that cannot be reached, a subject whose content is not retrievable,
 * and an unsupported algorithm are all reported as `Unavailable` with distinct
 * reason codes. Only a digest that was actually computed and actually differs is
 * `Fail`. Turning an outage into a mismatch would manufacture a finding of
 * tampering out of an infrastructure event.
 *
 * ### Subjects with no bytes are not failures
 *
 * A plot of land has no canonical byte representation, and APV-04 made a subject
 * without a `ContentIdentity` a first-class subject rather than a deficient one.
 * There is nothing here to compare, so the check reports `Unavailable` and names
 * why — never `Fail`.
 */
export declare const contentDigestCheck: AssetVerificationCheck;
/**
 * Every built-in check, in a stable order.
 *
 * Registering them is a *deployment* decision, not an automatic one: a
 * composition layer passes whichever of these its profiles actually declare,
 * alongside whatever it registers of its own. The engine treats a built-in check
 * exactly as it treats a check somebody else wrote — resolved by id, executed
 * through the same interface, with no special case anywhere.
 */
export declare const BUILT_IN_VERIFICATION_CHECKS: readonly AssetVerificationCheck[];
//# sourceMappingURL=verification-builtin-checks.d.ts.map