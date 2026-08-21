import type { CanonicalPrincipalRef, CanonicalRegistryEntryRef } from '@aoc/protocol/claims';
import type { UtcDateTime } from '@aoc/protocol/contracts';
import { verifyContentIdentity } from '@aoc/protocol/identity';

import type { AssetRequirementId } from '../identifiers';
import type { AssetFreshnessConstraint } from '../freshness';
import type { AssetRegistryConstraint } from '../constraints';
import { AssetIdentityStrategy, AssetRequirementKind, AssetRequirementObligation, AssetRequirementSatisfaction } from '../requirements';
import type {
  AssetEvidenceRequirement,
  AssetIdentityRequirement,
  AssetRequirement,
} from '../requirements';
import { ProtocolizationMaterialKind } from '../case/case-material';
import type { ProtocolizationCaseMaterial } from '../case/case-material';
import { ProtocolizationRequirementConditionStatus, ProtocolizationRequirementMaterialStatus } from '../case/case-state';
import type { AssetVerificationCheck, VerificationCheckExecution } from './verification-check';
import type { VerificationCheckContext } from './verification-context';
import { VerificationCheckOutcome } from './verification-outcome';
import { VerificationResolutionStatus } from './verification-ports';
import { VerificationInputKind } from './verification-result';
import type { VerificationInputRef } from './verification-result';

/**
 * The built-in check library.
 *
 * ### Deliberately small, and deliberately generic
 *
 * Every check here evaluates a proposition that is mechanically encoded in
 * APV-03's own vocabulary — obligation, kind, `minimumCount`,
 * `acceptedStrategies`, `satisfaction`, `AssetFreshnessConstraint`,
 * `AssetRegistryConstraint`, `ClaimType`, `ContentIdentity` — and therefore
 * means the same thing for a sound recording, a plot of land, a dataset and a
 * category nobody has invented yet. There is no branch on asset category, no
 * branch on profile id, no branch on jurisdiction, and no check named after a
 * kind of thing.
 *
 * What is emphatically **not** here, and never will be:
 *
 * ```text
 * costa-rica-title-valid    finca-owner        real-estate-*
 * artwork-authentic         song-rights        vehicle-title-valid
 * nft-valid                 spotify-owner      *-legally-transferable
 * ```
 *
 * Those are propositions about particular asset classes and particular legal
 * systems. They belong to future profiles, future adapters and future
 * configured checks — each of which reaches the engine through
 * `VerificationCheckRegistry.register` with no change to this file, no change to
 * the engine, and no change to Soberanía Protocol. That is the property APV-07
 * exists to establish, and shipping a speculative library here would undermine
 * it rather than demonstrate it.
 *
 * ### What every check in this file refuses to do
 *
 * ```text
 * read a declaration's free-text statement      infer meaning from a check id
 * parse prose into a truth value                consult an LLM or an NLP model
 * mutate a case, receipt or declaration record  contact anything over a network
 * conclude that a requirement is satisfied      conclude that a case is ready
 * conclude that anyone owns anything            conclude that anyone is authorized
 * ```
 *
 * ### One outcome per execution, with a declared precedence
 *
 * A check inspects several things and reports one outcome, so each one below
 * states its precedence explicitly. The shared rule is:
 *
 * ```text
 * Fail  >  Unavailable  >  Warning  >  Pass
 * ```
 *
 * `Unavailable` outranks `Warning` and `Pass` on purpose: when part of the basis
 * could not be read, any conclusion weaker than "I could not look" would claim
 * more than the check knows. `Fail` outranks it because a definite negative
 * finding was reached on the part that *was* readable, and hiding it behind an
 * unrelated gap would be worse.
 */

/** `Fail > Unavailable > Warning > Pass`. See the module note above. */
const OUTCOME_PRECEDENCE: Readonly<Record<VerificationCheckOutcome, number>> = Object.freeze({
  [VerificationCheckOutcome.Fail]: 4,
  [VerificationCheckOutcome.Unavailable]: 3,
  [VerificationCheckOutcome.Warning]: 2,
  [VerificationCheckOutcome.ManualReview]: 1,
  [VerificationCheckOutcome.Pass]: 0,
});

/**
 * `ManualReview` sits below `Warning` here because a check that found a concrete
 * concern has said something more specific than one that declined to conclude.
 * A check whose *only* finding is ambiguity still reports `ManualReview`, since
 * nothing outranks it in that case.
 */
function strongest(
  observations: readonly VerificationCheckExecution[],
  fallback: VerificationCheckExecution,
): VerificationCheckExecution {
  let held: VerificationCheckExecution | undefined;
  for (const finding of observations) {
    if (held === undefined || OUTCOME_PRECEDENCE[finding.outcome] > OUTCOME_PRECEDENCE[held.outcome]) {
      held = finding;
    }
  }
  return held ?? fallback;
}

function requirementRefs(requirementIds: readonly AssetRequirementId[]): readonly VerificationInputRef[] {
  return requirementIds.map((requirementId) => ({
    kind: VerificationInputKind.Requirement,
    ref: requirementId,
  }));
}

/** Every material of one kind that names this requirement among its correlations. */
function materialsFor(
  materials: readonly ProtocolizationCaseMaterial[],
  requirementId: AssetRequirementId,
  kind: ProtocolizationMaterialKind,
): readonly ProtocolizationCaseMaterial[] {
  return materials.filter(
    (material) => material.kind === kind && material.requirementIds.includes(requirementId),
  );
}

/**
 * The material kind that mechanically answers one requirement kind.
 *
 * This is the same kind-compatibility discipline APV-06 established, applied to
 * counting: an evidence requirement is answered by evidence material and by
 * nothing else, so a stray declaration correlated to it can never inflate its
 * count toward `minimumCount`. Identity and Verification requirements have no
 * single answering kind — identity accepts three strategies, and verification is
 * answered by check executions rather than by case material — so neither
 * participates.
 */
const COUNTED_MATERIAL_KIND: Readonly<Partial<Record<AssetRequirementKind, ProtocolizationMaterialKind>>> =
  Object.freeze({
    [AssetRequirementKind.Declaration]: ProtocolizationMaterialKind.Declaration,
    [AssetRequirementKind.Evidence]: ProtocolizationMaterialKind.Evidence,
    [AssetRequirementKind.Attestation]: ProtocolizationMaterialKind.Attestation,
  });

// ---------------------------------------------------------------------------
// check.material.present
// ---------------------------------------------------------------------------

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
export const requiredMaterialPresentCheck: AssetVerificationCheck = Object.freeze({
  checkId: 'check.material.present',
  execute(context: VerificationCheckContext): VerificationCheckExecution {
    const considered = context.requirementProgress.filter(
      (progress) => progress.kind !== AssetRequirementKind.Verification,
    );

    const missing = considered
      .filter(
        (progress) =>
          progress.obligation === AssetRequirementObligation.Required &&
          progress.materialStatus === ProtocolizationRequirementMaterialStatus.Pending,
      )
      .map((progress) => progress.requirementId);

    if (missing.length > 0) {
      return {
        outcome: VerificationCheckOutcome.Fail,
        reasonCode: 'material.missing',
        summary: `${missing.length} required requirement(s) of the pinned profile have no material.`,
        inputRefs: requirementRefs(missing),
      };
    }

    const unresolved = considered
      .filter(
        (progress) =>
          progress.conditionStatus === ProtocolizationRequirementConditionStatus.Unresolved &&
          progress.materialStatus === ProtocolizationRequirementMaterialStatus.Pending,
      )
      .map((progress) => progress.requirementId);

    if (unresolved.length > 0) {
      return {
        outcome: VerificationCheckOutcome.ManualReview,
        reasonCode: 'condition.unresolved',
        summary: `${unresolved.length} conditional requirement(s) have no material and no evaluated condition.`,
        inputRefs: requirementRefs(unresolved),
      };
    }

    return {
      outcome: VerificationCheckOutcome.Pass,
      reasonCode: 'material.present',
      summary: 'Every required requirement of the pinned profile has material associated.',
    };
  },
});

// ---------------------------------------------------------------------------
// check.material.minimum-count
// ---------------------------------------------------------------------------

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
export const minimumMaterialCountCheck: AssetVerificationCheck = Object.freeze({
  checkId: 'check.material.minimum-count',
  execute(context: VerificationCheckContext): VerificationCheckExecution {
    const constrained = context.assetProfile.requirements.filter(
      (requirement): requirement is AssetRequirement & { readonly minimumCount: number } =>
        requirement.obligation === AssetRequirementObligation.Required &&
        typeof (requirement as { readonly minimumCount?: number }).minimumCount === 'number' &&
        COUNTED_MATERIAL_KIND[requirement.kind] !== undefined,
    );

    if (constrained.length === 0) {
      return {
        outcome: VerificationCheckOutcome.Pass,
        reasonCode: 'count.not.constrained',
        summary: 'The pinned profile declares no minimum material count.',
      };
    }

    const short = constrained.filter((requirement) => {
      const kind = COUNTED_MATERIAL_KIND[requirement.kind] as ProtocolizationMaterialKind;
      return materialsFor(context.materials, requirement.id, kind).length < requirement.minimumCount;
    });

    if (short.length > 0) {
      return {
        outcome: VerificationCheckOutcome.Fail,
        reasonCode: 'material.count.insufficient',
        summary: `${short.length} requirement(s) hold fewer materials than the pinned profile's minimum.`,
        inputRefs: requirementRefs(short.map((requirement) => requirement.id)),
      };
    }

    return {
      outcome: VerificationCheckOutcome.Pass,
      reasonCode: 'count.satisfied',
      summary: 'Every declared minimum material count is met.',
      inputRefs: requirementRefs(constrained.map((requirement) => requirement.id)),
    };
  },
});

// ---------------------------------------------------------------------------
// check.identity.strategy
// ---------------------------------------------------------------------------

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
export function registryEntryConforms(
  entryRef: CanonicalRegistryEntryRef,
  constraint: AssetRegistryConstraint,
): boolean {
  if (
    constraint.acceptedTypes !== undefined &&
    !constraint.acceptedTypes.includes(entryRef.registryRef.type)
  ) {
    return false;
  }
  if (
    constraint.acceptedAuthorityLevels !== undefined &&
    !constraint.acceptedAuthorityLevels.includes(entryRef.registryRef.authorityLevel)
  ) {
    return false;
  }
  if (
    constraint.acceptedEntryTypes !== undefined &&
    !constraint.acceptedEntryTypes.includes(entryRef.entryType)
  ) {
    return false;
  }
  if (
    constraint.acceptedNamespaces !== undefined &&
    !constraint.acceptedNamespaces.includes(entryRef.registryRef.namespace)
  ) {
    return false;
  }
  return true;
}

/** Which of APV-03's three identity strategies this case can currently evidence for one requirement. */
function evidencedStrategies(
  context: VerificationCheckContext,
  requirement: AssetIdentityRequirement,
): ReadonlySet<AssetIdentityStrategy> {
  const evidenced = new Set<AssetIdentityStrategy>();

  // Identity may be bound on the subject at creation, or supplied later as
  // material correlated to the requirement. Both are legitimate, so both count.
  if (
    context.subject.contentIdentity !== undefined ||
    materialsFor(context.materials, requirement.id, ProtocolizationMaterialKind.ContentIdentity).length > 0
  ) {
    evidenced.add(AssetIdentityStrategy.ContentIdentity);
  }
  if (
    context.subject.subjectRef.externalReference !== undefined ||
    materialsFor(context.materials, requirement.id, ProtocolizationMaterialKind.ExternalReference).length > 0
  ) {
    evidenced.add(AssetIdentityStrategy.ExternalReference);
  }
  if (materialsFor(context.materials, requirement.id, ProtocolizationMaterialKind.RegistryEntry).length > 0) {
    evidenced.add(AssetIdentityStrategy.RegistryEntry);
  }

  return evidenced;
}

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
export const identityStrategyCheck: AssetVerificationCheck = Object.freeze({
  checkId: 'check.identity.strategy',
  execute(context: VerificationCheckContext): VerificationCheckExecution {
    const requirements = context.assetProfile.requirements.filter(
      (requirement): requirement is AssetIdentityRequirement =>
        requirement.kind === AssetRequirementKind.Identity &&
        requirement.obligation === AssetRequirementObligation.Required,
    );

    if (requirements.length === 0) {
      return {
        outcome: VerificationCheckOutcome.Pass,
        reasonCode: 'identity.not.constrained',
        summary: 'The pinned profile requires no identity material.',
      };
    }

    const observations: VerificationCheckExecution[] = [];

    for (const requirement of requirements) {
      const evidenced = evidencedStrategies(context, requirement);
      const satisfied =
        requirement.satisfaction === AssetRequirementSatisfaction.All
          ? requirement.acceptedStrategies.every((strategy) => evidenced.has(strategy))
          : requirement.acceptedStrategies.some((strategy) => evidenced.has(strategy));

      if (!satisfied) {
        observations.push({
          outcome: VerificationCheckOutcome.Fail,
          reasonCode: 'identity.strategy.unsatisfied',
          summary: `Requirement ${requirement.id} is not evidenced by the strategies it accepts.`,
          inputRefs: requirementRefs([requirement.id]),
        });
        continue;
      }

      if (requirement.registry !== undefined) {
        const constraint = requirement.registry;
        const nonConforming = materialsFor(
          context.materials,
          requirement.id,
          ProtocolizationMaterialKind.RegistryEntry,
        ).filter(
          (material) =>
            material.kind === ProtocolizationMaterialKind.RegistryEntry &&
            !registryEntryConforms(material.registryEntryRef, constraint),
        );

        if (nonConforming.length > 0) {
          observations.push({
            outcome: VerificationCheckOutcome.Fail,
            reasonCode: 'identity.registry.mismatch',
            summary: `Requirement ${requirement.id} holds a registry entry outside the registry constraint it declares.`,
            inputRefs: [
              ...requirementRefs([requirement.id]),
              ...nonConforming.map((material) => ({
                kind: VerificationInputKind.Material,
                ref: material.materialId,
              })),
            ],
          });
        }
      }
    }

    return strongest(observations, {
      outcome: VerificationCheckOutcome.Pass,
      reasonCode: 'identity.strategy.satisfied',
      summary: 'Every required identity requirement is evidenced by an accepted strategy.',
      inputRefs: requirementRefs(requirements.map((requirement) => requirement.id)),
    });
  },
});

// ---------------------------------------------------------------------------
// check.evidence.freshness
// ---------------------------------------------------------------------------

function ageSeconds(observedAt: UtcDateTime, now: UtcDateTime): number {
  return (Date.parse(now) - Date.parse(observedAt)) / 1000;
}

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
export const evidenceFreshnessCheck: AssetVerificationCheck = Object.freeze({
  checkId: 'check.evidence.freshness',
  execute(context: VerificationCheckContext): VerificationCheckExecution {
    const requirements = context.assetProfile.requirements.filter(
      (requirement): requirement is AssetEvidenceRequirement =>
        requirement.kind === AssetRequirementKind.Evidence && requirement.freshness !== undefined,
    );

    if (requirements.length === 0) {
      return {
        outcome: VerificationCheckOutcome.Pass,
        reasonCode: 'freshness.not.constrained',
        summary: 'The pinned profile declares no evidence freshness constraint.',
      };
    }

    const observations: VerificationCheckExecution[] = [];
    let evaluated = 0;

    for (const requirement of requirements) {
      const constraint = requirement.freshness as AssetFreshnessConstraint;
      const materials = materialsFor(
        context.materials,
        requirement.id,
        ProtocolizationMaterialKind.Evidence,
      );

      for (const material of materials) {
        if (material.kind !== ProtocolizationMaterialKind.Evidence) continue;
        const refs: readonly VerificationInputRef[] = [
          ...requirementRefs([requirement.id]),
          { kind: VerificationInputKind.EvidenceRecord, ref: material.evidenceRef },
        ];

        const receipt = context.evidenceReceipts.find(
          (candidate) =>
            candidate.materialId === material.materialId ||
            candidate.evidenceRef === material.evidenceRef,
        );
        const observedAt = receipt?.observedAt;

        if (observedAt === undefined) {
          observations.push({
            outcome: VerificationCheckOutcome.Unavailable,
            reasonCode: 'freshness.observation.missing',
            summary: `No observation instant is available for the evidence answering ${requirement.id}.`,
            inputRefs: refs,
          });
          continue;
        }

        const basis: readonly VerificationInputRef[] =
          receipt === undefined
            ? refs
            : [...refs, { kind: VerificationInputKind.IntakeReceipt, ref: receipt.intakeId }];

        if (constraint.mustNotBeExpired === true) {
          observations.push({
            outcome: VerificationCheckOutcome.Unavailable,
            reasonCode: 'dependency.unavailable',
            summary: `Expiry for the evidence answering ${requirement.id} is carried by a Protocol record this check cannot resolve.`,
            inputRefs: basis,
          });
        }

        const age = ageSeconds(observedAt, context.now);
        evaluated += 1;

        if (age < 0) {
          observations.push({
            outcome: VerificationCheckOutcome.Warning,
            reasonCode: 'freshness.observed.in.future',
            summary: `The evidence answering ${requirement.id} records an observation later than the execution instant.`,
            inputRefs: basis,
          });
          continue;
        }
        if (constraint.maxAgeSeconds !== undefined && age > constraint.maxAgeSeconds) {
          observations.push({
            outcome: VerificationCheckOutcome.Fail,
            reasonCode: 'freshness.exceeded',
            summary: `The evidence answering ${requirement.id} was observed longer ago than the pinned profile permits.`,
            inputRefs: basis,
          });
          continue;
        }
        if (
          constraint.observedAfter !== undefined &&
          Date.parse(observedAt) < Date.parse(constraint.observedAfter)
        ) {
          observations.push({
            outcome: VerificationCheckOutcome.Fail,
            reasonCode: 'freshness.exceeded',
            summary: `The evidence answering ${requirement.id} was observed before the instant the pinned profile requires.`,
            inputRefs: basis,
          });
        }
      }
    }

    return strongest(observations, {
      outcome: VerificationCheckOutcome.Pass,
      reasonCode: evaluated > 0 ? 'freshness.satisfied' : 'freshness.no.material',
      summary:
        evaluated > 0
          ? 'Every evaluable observation satisfies the freshness constraint the pinned profile declares.'
          : 'No evidence is associated with the freshness-constrained requirements of the pinned profile.',
    });
  },
});

// ---------------------------------------------------------------------------
// check.declaration.claim-type
// ---------------------------------------------------------------------------

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
export const declarationClaimTypeCheck: AssetVerificationCheck = Object.freeze({
  checkId: 'check.declaration.claim-type',
  async execute(context: VerificationCheckContext): Promise<VerificationCheckExecution> {
    if (context.declarations.length === 0) {
      return {
        outcome: VerificationCheckOutcome.Pass,
        reasonCode: 'declaration.none',
        summary: 'This case holds no declaration to corroborate.',
      };
    }

    const resolver = context.resolvers.claim;
    if (resolver === undefined) {
      return {
        outcome: VerificationCheckOutcome.Unavailable,
        reasonCode: 'claim.resolver.unavailable',
        summary: 'No claim resolver is bound, so the recorded claim types cannot be corroborated.',
      };
    }

    const observations: VerificationCheckExecution[] = [];

    for (const record of context.declarations) {
      const refs: readonly VerificationInputRef[] = [
        { kind: VerificationInputKind.DeclarationRecord, ref: record.declarationId },
        { kind: VerificationInputKind.ClaimRecord, ref: record.claimRef },
      ];
      const resolution = await resolver.resolveClaim(record.claimRef);

      if (resolution.status === VerificationResolutionStatus.Unavailable) {
        observations.push({
          outcome: VerificationCheckOutcome.Unavailable,
          reasonCode: 'dependency.unavailable',
          summary: 'The claim source could not be consulted.',
          inputRefs: refs,
        });
        continue;
      }
      if (resolution.status === VerificationResolutionStatus.NotFound || resolution.claim === undefined) {
        observations.push({
          outcome: VerificationCheckOutcome.Unavailable,
          reasonCode: 'claim.unresolved',
          summary: 'The named claim record could not be resolved, so its type is unchecked.',
          inputRefs: refs,
        });
        continue;
      }
      if (resolution.claim.type !== record.claimType) {
        observations.push({
          outcome: VerificationCheckOutcome.Fail,
          reasonCode: 'claim.type.mismatch',
          summary: 'A resolved claim record is of a different type than the declaration recorded.',
          inputRefs: refs,
        });
      }
    }

    return strongest(observations, {
      outcome: VerificationCheckOutcome.Pass,
      reasonCode: 'claim.type.consistent',
      summary: 'Every resolved claim record carries the type its declaration recorded.',
      inputRefs: context.declarations.map((record) => ({
        kind: VerificationInputKind.DeclarationRecord,
        ref: record.declarationId,
      })),
    });
  },
});

// ---------------------------------------------------------------------------
// check.declaration.competing
// ---------------------------------------------------------------------------

function declarantKey(declarant: CanonicalPrincipalRef): string {
  // Both fields are frozen structured values, so this is a machine-readable
  // identity key and never an interpretation of who somebody is.
  return `${declarant.kind}\n${declarant.id}`;
}

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
export const competingDeclarationCheck: AssetVerificationCheck = Object.freeze({
  checkId: 'check.declaration.competing',
  execute(context: VerificationCheckContext): VerificationCheckExecution {
    const declarationRequirementIds = new Set(
      context.assetProfile.requirements
        .filter((requirement) => requirement.kind === AssetRequirementKind.Declaration)
        .map((requirement) => requirement.id),
    );

    const declarantsByRequirement = new Map<AssetRequirementId, Set<string>>();
    for (const record of context.declarations) {
      for (const requirementId of record.requirementIds) {
        if (!declarationRequirementIds.has(requirementId)) continue;
        const held = declarantsByRequirement.get(requirementId) ?? new Set<string>();
        held.add(declarantKey(record.declarant));
        declarantsByRequirement.set(requirementId, held);
      }
    }

    const competing = [...declarantsByRequirement.entries()]
      .filter(([, declarants]) => declarants.size > 1)
      .map(([requirementId]) => requirementId);

    if (competing.length > 0) {
      return {
        outcome: VerificationCheckOutcome.ManualReview,
        reasonCode: 'declaration.competing',
        summary: `${competing.length} declaration requirement(s) carry assertions from more than one declarant; automation cannot adjudicate between them.`,
        inputRefs: requirementRefs(competing),
      };
    }

    return {
      outcome: VerificationCheckOutcome.Pass,
      reasonCode: 'declaration.uncontested',
      summary: 'No declaration requirement carries assertions from more than one declarant.',
    };
  },
});

// ---------------------------------------------------------------------------
// check.content.digest
// ---------------------------------------------------------------------------

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
export const contentDigestCheck: AssetVerificationCheck = Object.freeze({
  checkId: 'check.content.digest',
  async execute(context: VerificationCheckContext): Promise<VerificationCheckExecution> {
    const refs: readonly VerificationInputRef[] = [
      { kind: VerificationInputKind.Subject, ref: context.subject.subjectRef.sovereignAssetId },
    ];

    const expected = context.subject.contentIdentity;
    if (expected === undefined) {
      return {
        outcome: VerificationCheckOutcome.Unavailable,
        reasonCode: 'content.identity.absent',
        summary: 'This case binds no content identity, so there is no digest to compare.',
        inputRefs: refs,
      };
    }

    const resolver = context.resolvers.content;
    if (resolver === undefined) {
      return {
        outcome: VerificationCheckOutcome.Unavailable,
        reasonCode: 'content.resolver.unavailable',
        summary: 'No content resolver is bound, so the subject bytes cannot be read.',
        inputRefs: refs,
      };
    }

    const resolution = await resolver.readContent(context.subject.subjectRef);
    if (resolution.status === VerificationResolutionStatus.Unavailable) {
      return {
        outcome: VerificationCheckOutcome.Unavailable,
        reasonCode: 'dependency.unavailable',
        summary: 'The content source could not be consulted.',
        inputRefs: refs,
      };
    }
    if (resolution.status === VerificationResolutionStatus.NotFound || resolution.bytes === undefined) {
      return {
        outcome: VerificationCheckOutcome.Unavailable,
        reasonCode: 'content.unavailable',
        summary: 'The subject bytes are not available, so no digest was computed.',
        inputRefs: refs,
      };
    }

    const verified = verifyContentIdentity(resolution.bytes, expected);
    if (verified.valid) {
      return {
        outcome: VerificationCheckOutcome.Pass,
        reasonCode: 'digest.matches',
        summary: 'The subject bytes produce exactly the content identity this case pinned.',
        inputRefs: refs,
      };
    }
    if (verified.reason === 'UNSUPPORTED_CONTENT_DIGEST_ALGORITHM') {
      return {
        outcome: VerificationCheckOutcome.Unavailable,
        reasonCode: 'digest.algorithm.unsupported',
        summary: 'The pinned content identity names a digest algorithm this substrate cannot compute.',
        inputRefs: refs,
      };
    }
    return {
      outcome: VerificationCheckOutcome.Fail,
      reasonCode: 'digest.mismatch',
      summary: 'The subject bytes do not produce the content identity this case pinned.',
      inputRefs: refs,
    };
  },
});

/**
 * Every built-in check, in a stable order.
 *
 * Registering them is a *deployment* decision, not an automatic one: a
 * composition layer passes whichever of these its profiles actually declare,
 * alongside whatever it registers of its own. The engine treats a built-in check
 * exactly as it treats a check somebody else wrote — resolved by id, executed
 * through the same interface, with no special case anywhere.
 */
export const BUILT_IN_VERIFICATION_CHECKS: readonly AssetVerificationCheck[] = Object.freeze([
  requiredMaterialPresentCheck,
  minimumMaterialCountCheck,
  identityStrategyCheck,
  evidenceFreshnessCheck,
  declarationClaimTypeCheck,
  competingDeclarationCheck,
  contentDigestCheck,
]);
