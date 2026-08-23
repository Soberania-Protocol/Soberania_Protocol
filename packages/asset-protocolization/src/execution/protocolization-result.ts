import type { CanonicalAttestationId } from '@aoc/protocol/claims';
import type { CanonicalId, UtcDateTime } from '@aoc/protocol/contracts';

import type { AssetRequirementId } from '../identifiers';
import type {
  ProtocolizationCaseId,
  ProtocolizationMaterialId,
  ProtocolizationProfileRef,
  ProtocolizationTenantId,
} from '../case/case-identifiers';
import type { ProtocolizationCaseState } from '../case/case-state';
import type { ProtocolizationCaseMaterial } from '../case/case-material';
import { ProtocolizationMaterialKind } from '../case/case-material';
import type { ProtocolizationCaseSubject } from '../case/case-subject';
import type { ProfessionalReviewDecisionId } from '../attestation/review-identifiers';
import type { VerificationExecutionId } from '../verification/verification-identifiers';
import { PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION } from '../state-machine/readiness-evaluation';
import type { ProtocolizationReadinessReason } from '../state-machine/readiness-reason';
import { ProtocolizationReadinessState } from '../state-machine/readiness-state';
import type { ProtocolizationResultId } from './execution-identifiers';

/**
 * `ProtocolizationResult` — the immutable record that Asset Protocolization
 * **executed** protocolization over one exact case revision.
 *
 * ### What a result means
 *
 * Exactly this, and reading more into it is the central risk of this slice:
 *
 * ```text
 * this case, belonging to this tenant,
 * about this exact subject,
 * as it stood at this exact revision,
 * under this exact pinned AssetProfile version,
 * from an APV-09 readiness evaluation that was Ready and still current for it,
 * was carried through the Asset Protocolization workflow to completion,
 * at this instant.
 * ```
 *
 * ### What it does not mean
 *
 * ```text
 * PROTOCOLIZED != legal title            PROTOCOLIZED != ownership transfer
 * PROTOCOLIZED != government registration PROTOCOLIZED != statutory compliance
 * PROTOCOLIZED != token                  PROTOCOLIZED != tokenizable
 * PROTOCOLIZED != Enterprise authorization
 * PROTOCOLIZED != investment suitability  PROTOCOLIZED != a claim proven true
 * ```
 *
 * A result is a **technical and product artifact**: it records that a workflow
 * this vertical owns completed over material this vertical assembled. Nothing
 * about it is a legal conclusion, in any jurisdiction, and no field of it may be
 * read as one. Whoever protocolized a subject is recorded; what anybody is
 * entitled to do next is Enterprise governance's question and is asked nowhere
 * in this package.
 *
 * ### And it changes nothing it names
 *
 * Executing rewrites no claim, no evidence record, no verification result, no
 * review decision, no attestation and no readiness evaluation. A declaration
 * that was an assertion before execution is exactly as much an assertion after
 * it; a `Pass` is still one check's finding; an attestation is still one
 * professional's scoped position. Producing this record is the *only* thing a
 * successful execution does.
 *
 * ### It is one revision's artifact, permanently
 *
 * `executedCaseRevision` is what makes that true. A result produced at revision
 * `20` is a statement about revision `20` forever: material added afterwards
 * moves the case to `21` and this record does not follow it, is not rewritten,
 * and does not become false. Revision `21` is simply not protocolized until a
 * new APV-09 evaluation says `Ready` for it and a new execution produces a
 * second result beside this one.
 *
 * ### It is not the APV-02 §2.1 outward envelope
 *
 * `ProtocolizationResultV1` (APV-02 §2.1, schema `aoc-protocolization-result/1`)
 * is the *consumer-facing* envelope: it additionally carries a
 * `SignedSovereignManifest` and the `ResourceRef` handle Enterprise addresses.
 * Producing one needs a registrant and a signing key, and no slice up to and
 * including this one establishes either — inventing them to populate a field
 * would be exactly the fabricated Protocol record this vertical must not put
 * into circulation. So the envelope stays deferred and unmodified, this record
 * carries its own schema version (`aoc-protocolization-execution/1`), and a
 * later slice that gains manifest issuance projects one from the other. The two
 * are deliberately not the same document and deliberately not the same schema
 * identifier.
 */
export const PROTOCOLIZATION_EXECUTION_RESULT_SCHEMA_VERSION =
  'aoc-protocolization-execution/1';

/**
 * The APV-09 conclusion this execution stood on, quoted.
 *
 * ### Why a quote and not the evaluation
 *
 * An evaluation is a pure deterministic projection of records that are already
 * immutable and already audited (APV-09), so copying the whole of one — every
 * assessment, every requirement, every reference — into a permanent artifact
 * would duplicate a document that can be recomputed exactly from the pin and the
 * revision this result already names. What cannot be recomputed by a reader who
 * has only this record is *which conclusion was relied on*, and that is what
 * this quotes: the state, the revision it described, when it was reached, that
 * nothing blocked it, what it warned about, and the workflow records that
 * established the professional and automated half of it.
 *
 * ### It is a quote, never a live readiness state
 *
 * Nothing reads this to decide anything. It is not a persisted readiness — APV-09
 * deliberately persists none — it is not refreshed, it is not compared against a
 * later evaluation, and no operation anywhere treats it as current. It is the
 * historical answer to *what did APV-09 say, at the moment this executed?*
 */
export interface ProtocolizationReadinessBasis {
  /** Which readiness shape was relied on. APV-09's own schema version, quoted. */
  readonly evaluationSchemaVersion: typeof PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION;

  /**
   * The readiness state relied on. Structurally `Ready` and nothing else — a
   * result cannot exist for any other conclusion, and the type says so rather
   * than leaving a reader to infer it.
   */
  readonly state: typeof ProtocolizationReadinessState.Ready;

  /**
   * The revision the evaluation described. Always equal to
   * `executedCaseRevision`; recorded separately so the equality is a readable,
   * validated fact rather than an assumption.
   */
  readonly evaluatedCaseRevision: number;

  /** The APV-04 lifecycle state the evaluation quoted. `Draft` and `Active` both reach here. */
  readonly caseState: ProtocolizationCaseState;

  /** When APV-09 reached this conclusion, from its own injected clock. */
  readonly evaluatedAt: UtcDateTime;

  /**
   * How many blockers the evaluation carried. Always `0`.
   *
   * Recorded because a reader of the artifact alone should not have to trust
   * that the check happened, and because a stored record claiming `Ready`
   * alongside a non-zero count is malformed history that reconstitution must
   * refuse rather than repair.
   */
  readonly blockerCount: number;

  /**
   * Every warning the evaluation carried, in its own order.
   *
   * A `Ready` case may legitimately warn — an unmet `Optional` requirement, a
   * check that returned `Warning`, a constraint APV-09 delegates — and dropping
   * those on the way into a permanent artifact would silently discard exactly
   * the findings a later reader is entitled to weigh. They are carried, and they
   * are carried *unreinterpreted*: this slice does not re-read a warning, does
   * not escalate one, and never turns one into a blocker after APV-09 has
   * legitimately answered `Ready`.
   */
  readonly warnings: readonly ProtocolizationReadinessReason[];

  /**
   * The APV-07 executions the evaluation read, deduplicated, in assessment
   * order.
   *
   * References, never results. An auditor can go and read exactly which
   * executions established the automated half of readiness; nothing about their
   * outcomes is copied here, and a non-empty list asserts that checks ran and
   * never that they passed.
   */
  readonly verificationExecutionIds: readonly VerificationExecutionId[];

  /** The APV-08 decisions the evaluation read, deduplicated, in assessment order. */
  readonly reviewDecisionIds: readonly ProfessionalReviewDecisionId[];

  /**
   * The Protocol attestations the evaluation accepted as qualifying,
   * deduplicated, in assessment order.
   *
   * Identifiers of records Protocol owns. This slice mints none of them, and
   * their presence here is not a re-attestation, a widening of anybody's scope,
   * or a claim that a proof was resolved.
   */
  readonly attestationRefs: readonly CanonicalAttestationId[];
}

/**
 * One APV-04 material association the executed revision held.
 *
 * References, never copies — the same rule APV-04, APV-07 and APV-09 apply. A
 * result that embedded declaration statements, evidence documents or reviewer
 * notes would be a second copy of somebody else's record, free to drift from it
 * and carrying payload and possibly personal data into an artifact that travels
 * further than the material it describes.
 */
export interface ProtocolizationExecutionMaterialRef {
  readonly materialId: ProtocolizationMaterialId;
  readonly kind: ProtocolizationMaterialKind;
  /** The requirements of the pinned profile this material was offered against. */
  readonly requirementIds: readonly AssetRequirementId[];
  /**
   * The Protocol record the association names, where it names one.
   *
   * Present for the kinds whose payload *is* an identifier — `Declaration`,
   * `Evidence`, `Verification`, `Attestation`, `Credential` and `RegistryEntry`
   * — and absent for `ContentIdentity` and `ExternalReference`, whose payloads
   * are structures rather than record identities and which the result already
   * carries, where the case does, on `subject`. Absent is absent: nothing is
   * synthesized to make the field look populated.
   */
  readonly ref?: string;
}

export interface ProtocolizationResult {
  readonly schemaVersion: typeof PROTOCOLIZATION_EXECUTION_RESULT_SCHEMA_VERSION;

  /** Identity of this execution artifact. Unique within the tenant. */
  readonly resultId: ProtocolizationResultId;

  /** The tenant whose workflow this was. Required and non-blank, exactly as on a case. */
  readonly tenantId: ProtocolizationTenantId;

  readonly caseId: ProtocolizationCaseId;

  /**
   * The exact profile version the case pinned.
   *
   * Never re-resolved and never widened. A protocolized result must stay
   * interpretable under the rules that produced it: a case pinned to `1.0.0` is
   * a `1.0.0` result after `2.0.0` is catalogued, even where `2.0.0` redefines
   * the same requirement ids.
   */
  readonly profile: ProtocolizationProfileRef;

  /**
   * The case's subject binding, preserved exactly.
   *
   * Protocolization does not replace a subject with a new asset identity, and
   * this slice mints no identity of any kind. The `SovereignAssetId` inside is
   * the one the case was opened about, and it is Protocol's — the correlation
   * key that lets material, readiness and this artifact all name the same thing.
   */
  readonly subject: ProtocolizationCaseSubject;

  /** The exact case revision that was protocolized. */
  readonly executedCaseRevision: number;

  /** The APV-09 conclusion this execution stood on, quoted. */
  readonly readinessBasis: ProtocolizationReadinessBasis;

  /**
   * Every material association the executed revision held, in the case's own
   * association order.
   *
   * Deterministic by construction: APV-04 appends materials and never reorders
   * or removes one, so the order is the order they arrived in and does not
   * depend on any map, set or insertion accident.
   */
  readonly materialRefs: readonly ProtocolizationExecutionMaterialRef[];

  /** When the execution ran, from the injected clock. Never `Date.now()`. */
  readonly executedAt: UtcDateTime;

  /** Correlates this execution with the request that produced it. */
  readonly correlationId?: CanonicalId;
}

/**
 * The payload key one material kind carries when that payload is a record
 * identifier, or `undefined` when it is a structure.
 *
 * Internal. A branch on *material kind* — the vertical's own closed vocabulary —
 * and never on an asset category, a profile id or a jurisdiction: a new asset
 * class adds no member here, it writes a profile.
 */
const MATERIAL_REFERENCE_KEY: Readonly<
  Partial<Record<ProtocolizationMaterialKind, string>>
> = Object.freeze({
  [ProtocolizationMaterialKind.RegistryEntry]: 'registryEntryRef',
  [ProtocolizationMaterialKind.Declaration]: 'claimRef',
  [ProtocolizationMaterialKind.Evidence]: 'evidenceRef',
  [ProtocolizationMaterialKind.Verification]: 'verificationRef',
  [ProtocolizationMaterialKind.Attestation]: 'attestationRef',
  [ProtocolizationMaterialKind.Credential]: 'credentialRef',
});

/**
 * The stable reference one material association names, when it names one.
 *
 * Exported for reuse *inside* this package only — it is not part of the package
 * facade. A registry entry's reference is the entry's own id, read through
 * Protocol's `CanonicalRegistryEntryRef`; every other id-bearing kind carries
 * its identifier directly.
 */
export function protocolizationMaterialRecordRef(
  material: ProtocolizationCaseMaterial,
): string | undefined {
  const key = MATERIAL_REFERENCE_KEY[material.kind];
  if (key === undefined) return undefined;
  const payload = (material as unknown as Record<string, unknown>)[key];
  if (typeof payload === 'string') return payload;
  if (typeof payload === 'object' && payload !== null) {
    const id = (payload as { readonly id?: unknown }).id;
    if (typeof id === 'string') return id;
  }
  return undefined;
}
