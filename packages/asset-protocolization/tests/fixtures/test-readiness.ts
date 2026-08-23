import {
  AttestationType,
  ClaimType,
  EvidenceType,
  PrincipalKind,
  ReferenceSourceKind,
  RegistryAuthorityLevel,
  RegistryEntryType,
  RegistryType,
} from '@aoc/protocol/claims';
import type {
  CanonicalAttestation,
  CanonicalEvidence,
  CanonicalPrincipalRef,
  CanonicalRegistryEntryRef,
} from '@aoc/protocol/claims';
import { ContentDigestAlgorithm } from '@aoc/protocol/identity';

import {
  ASSET_PROFILE_SCHEMA_VERSION,
  AssetIdentityStrategy,
  AssetProfileScope,
  AssetRequirementKind,
  AssetRequirementObligation,
  AssetRequirementSatisfaction,
  BUILT_IN_VERIFICATION_CHECKS,
  DeclarationPathway,
  EvidenceIntakePathway,
  ProfessionalReviewAction,
  ProfessionalReviewBasisKind,
  addProtocolizationCaseMaterial,
  createAssetProfileCatalog,
  createProfessionalReviewRequest,
  createProtocolizationCase,
  createVerificationCheckRegistry,
  evidenceFreshnessCheck,
  intakeProtocolizationEvidence,
  listProtocolizationVerificationPlan,
  recordProfessionalReviewDecision,
  recordProtocolizationDeclaration,
  runProtocolizationVerification,
} from '@aoc/asset-protocolization';
import type {
  AssetProfile,
  AssetProfileCatalog,
  AssetRequirement,
  EvidenceIntakeReceipt,
  ProfessionalReviewContext,
  ProfessionalReviewDecision,
  ProfessionalReviewRequest,
  ProfessionalReviewScope,
  ProtocolizationCase,
  ProtocolizationCaseMaterialInput,
  ProtocolizationCaseSubject,
  ProtocolizationDeclarationRecord,
  ProtocolizationReadinessInputs,
  ProtocolizationVerificationResult,
} from '@aoc/asset-protocolization';

import { TENANT_A, createTestClock } from './test-cases';
import type { TestClock } from './test-cases';
import { createTestAttestationSigner } from './test-attestation';
import {
  TEST_CHECK_ALPHA,
  TEST_CHECK_BETA,
  TEST_CHECK_FAIL,
  TEST_CHECK_MANUAL_REVIEW,
  TEST_CHECK_PASS,
  TEST_CHECK_UNAVAILABLE,
  TEST_CHECK_WARNING,
  TEST_VERIFICATION_CHECKS,
} from './test-verification';

/**
 * Test-only fixtures for the protocolization state machine.
 *
 * Every profile below is an **abstract shape**. There is no asset class, no
 * jurisdiction, no profession, no registry and no product profile anywhere in
 * this file, and none of the tests that use it names one. Two fundamentally
 * different subjects — one with a canonical byte representation, one named only
 * inside an external namespace — reach the same readiness engine, and the engine
 * cannot tell which it is holding. That is the point.
 *
 * Dossiers are assembled through the **real** operations of APV-04 through
 * APV-08 rather than hand-written records, so a readiness proof rests on reuse
 * rather than on resemblance.
 */

// ---------------------------------------------------------------------------
// Identifiers
// ---------------------------------------------------------------------------

export const READINESS_IDENTITY = 'identity.subject.required';
export const READINESS_DECLARATION = 'declaration.subject.required';
export const READINESS_EVIDENCE = 'evidence.supporting.required';
export const READINESS_VERIFICATION = 'verification.checks.required';
export const READINESS_ATTESTATION = 'attestation.primary.required';
export const READINESS_SECOND_ATTESTATION = 'attestation.secondary.required';
export const READINESS_OPTIONAL_EVIDENCE = 'evidence.supporting.optional';
export const READINESS_NOT_REQUIRED_EVIDENCE = 'evidence.supporting.not-required';
export const READINESS_CONDITIONAL_EVIDENCE = 'evidence.supporting.conditional';

export const READINESS_CLAIM_ID = 'aoc:claim:readiness-0001';
export const READINESS_SECOND_CLAIM_ID = 'aoc:claim:readiness-0002';
export const READINESS_EVIDENCE_ID = 'aoc:evidence:readiness-0001';
export const READINESS_SECOND_EVIDENCE_ID = 'aoc:evidence:readiness-0002';
export const READINESS_CATEGORY = 'test.category.readiness';

export const READINESS_CONTENT_ASSET_ID = 'aoc:sovereign-asset:c1111111-1111-4111-8111-111111111111';
export const READINESS_EXTERNAL_ASSET_ID = 'aoc:sovereign-asset:d2222222-2222-4222-8222-222222222222';

export const READINESS_DECLARANT: CanonicalPrincipalRef = {
  id: 'aoc:principal:readiness-declarant-0001',
  kind: PrincipalKind.Human,
};

export const READINESS_REVIEWER: CanonicalPrincipalRef = {
  id: 'aoc:principal:readiness-reviewer-0001',
  kind: PrincipalKind.Human,
};

export const READINESS_SECOND_REVIEWER: CanonicalPrincipalRef = {
  id: 'aoc:principal:readiness-reviewer-0002',
  kind: PrincipalKind.Human,
};

// ---------------------------------------------------------------------------
// Subjects — the two shapes the engine must handle without branching
// ---------------------------------------------------------------------------

/** Shape A — a subject with a canonical byte representation. */
export const READINESS_CONTENT_SUBJECT: ProtocolizationCaseSubject = {
  subjectRef: { sovereignAssetId: READINESS_CONTENT_ASSET_ID },
  contentIdentity: { algorithm: ContentDigestAlgorithm.Sha256, digest: 'c'.repeat(64) },
};

/** Shape B — a subject named only inside an external namespace. Deliberately no bytes. */
export const READINESS_EXTERNAL_SUBJECT: ProtocolizationCaseSubject = {
  subjectRef: {
    sovereignAssetId: READINESS_EXTERNAL_ASSET_ID,
    externalReference: { namespace: 'test.namespace.readiness', id: 'test-entry-9001' },
  },
};

// ---------------------------------------------------------------------------
// Requirement builders
// ---------------------------------------------------------------------------

export const identityRequirement = (
  id: string,
  obligation: AssetRequirementObligation,
  acceptedStrategies: readonly AssetIdentityStrategy[],
  satisfaction: AssetRequirementSatisfaction = AssetRequirementSatisfaction.Any,
): AssetRequirement =>
  ({
    id,
    kind: AssetRequirementKind.Identity,
    obligation,
    acceptedStrategies,
    satisfaction,
  }) as AssetRequirement;

export const declarationRequirement = (
  id: string,
  obligation: AssetRequirementObligation,
  options: { readonly claimType?: ClaimType; readonly minimumCount?: number } = {},
): AssetRequirement =>
  ({
    id,
    kind: AssetRequirementKind.Declaration,
    obligation,
    claimType: options.claimType ?? ClaimType.Authorship,
    ...(options.minimumCount === undefined ? {} : { minimumCount: options.minimumCount }),
  }) as AssetRequirement;

export const evidenceRequirement = (
  id: string,
  obligation: AssetRequirementObligation,
  options: {
    readonly minimumCount?: number;
    readonly conditionId?: string;
  } = {},
): AssetRequirement =>
  ({
    id,
    kind: AssetRequirementKind.Evidence,
    obligation,
    acceptedTypes: [EvidenceType.Document, EvidenceType.Certification],
    ...(options.minimumCount === undefined ? {} : { minimumCount: options.minimumCount }),
    ...(options.conditionId === undefined ? {} : { condition: { conditionId: options.conditionId } }),
  }) as AssetRequirement;

export const verificationRequirement = (
  id: string,
  obligation: AssetRequirementObligation,
  checkIds: readonly string[],
  satisfaction: AssetRequirementSatisfaction = AssetRequirementSatisfaction.All,
): AssetRequirement =>
  ({
    id,
    kind: AssetRequirementKind.Verification,
    obligation,
    checkIds,
    satisfaction,
  }) as AssetRequirement;

export const attestationRequirement = (
  id: string,
  obligation: AssetRequirementObligation,
  options: {
    readonly acceptedTypes?: readonly AttestationType[];
    readonly minimumCount?: number;
  } = {},
): AssetRequirement =>
  ({
    id,
    kind: AssetRequirementKind.Attestation,
    obligation,
    acceptedTypes: options.acceptedTypes ?? [AttestationType.Human],
    ...(options.minimumCount === undefined ? {} : { minimumCount: options.minimumCount }),
  }) as AssetRequirement;

export function readinessProfile(
  profileId: string,
  version: string,
  requirements: readonly AssetRequirement[],
): AssetProfile {
  return {
    schemaVersion: ASSET_PROFILE_SCHEMA_VERSION,
    profileId,
    version,
    assetCategory: 'test.category.readiness',
    scope: AssetProfileScope.Global,
    requirements,
    metadata: { label: 'Test readiness shape', description: 'Test-only fixture.' },
  };
}

// ---------------------------------------------------------------------------
// The named shapes
// ---------------------------------------------------------------------------

/**
 * One requirement of every APV-03 kind, all `Required`, plus one `Optional`.
 *
 * The full path: material, then checks, then a professional. It is what the
 * end-to-end `Ready` proof walks, and what proof T uses to show that satisfying
 * four of five requirements is not readiness.
 */
export const READINESS_FULL_V1: AssetProfile = readinessProfile('test.readiness.v1', '1.0.0', [
  identityRequirement(READINESS_IDENTITY, AssetRequirementObligation.Required, [
    AssetIdentityStrategy.ContentIdentity,
    AssetIdentityStrategy.ExternalReference,
  ]),
  declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
    minimumCount: 1,
  }),
  evidenceRequirement(READINESS_EVIDENCE, AssetRequirementObligation.Required, { minimumCount: 2 }),
  verificationRequirement(READINESS_VERIFICATION, AssetRequirementObligation.Required, [
    TEST_CHECK_PASS,
  ]),
  attestationRequirement(READINESS_ATTESTATION, AssetRequirementObligation.Required, {
    minimumCount: 1,
  }),
  evidenceRequirement(READINESS_OPTIONAL_EVIDENCE, AssetRequirementObligation.Optional, {
    minimumCount: 1,
  }),
]);

/**
 * The same profile *line*, later version, one extra `Required` evidence
 * requirement.
 *
 * This is what makes the pinning proof meaningful: a `1.0.0`-pinned case must
 * keep being evaluated under `1.0.0` while `2.0.0` sits beside it in the
 * catalogue demanding more.
 */
export const READINESS_FULL_V2: AssetProfile = readinessProfile('test.readiness.v1', '2.0.0', [
  ...READINESS_FULL_V1.requirements,
  evidenceRequirement('evidence.additional.required', AssetRequirementObligation.Required, {
    minimumCount: 1,
  }),
]);

/** A `Conditional` requirement whose applicability nothing can resolve, beside a `NotRequired` one. */
export const READINESS_CONDITIONAL_V1: AssetProfile = readinessProfile(
  'test.readiness-conditional.v1',
  '1.0.0',
  [
    declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
      minimumCount: 1,
    }),
    evidenceRequirement(READINESS_CONDITIONAL_EVIDENCE, AssetRequirementObligation.Conditional, {
      conditionId: 'test.condition.subject-has-external-registry-entry',
    }),
    evidenceRequirement(READINESS_NOT_REQUIRED_EVIDENCE, AssetRequirementObligation.NotRequired),
  ],
);

/** A `NotRequired` requirement beside a satisfiable `Required` one. Proof S. */
export const READINESS_NOT_REQUIRED_V1: AssetProfile = readinessProfile(
  'test.readiness-not-required.v1',
  '1.0.0',
  [
    declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
      minimumCount: 1,
    }),
    evidenceRequirement(READINESS_NOT_REQUIRED_EVIDENCE, AssetRequirementObligation.NotRequired),
  ],
);

/** A `Required` declaration beside an unsatisfied `Optional` evidence requirement. Proof Q. */
export const READINESS_OPTIONAL_V1: AssetProfile = readinessProfile(
  'test.readiness-optional.v1',
  '1.0.0',
  [
    declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
      minimumCount: 1,
    }),
    evidenceRequirement(READINESS_OPTIONAL_EVIDENCE, AssetRequirementObligation.Optional, {
      minimumCount: 1,
    }),
  ],
);

/** One profile per APV-07 outcome, so each is exercised in isolation. */
export const readinessOutcomeProfile = (suffix: string, checkIds: readonly string[]): AssetProfile =>
  readinessProfile(`test.readiness-${suffix}.v1`, '1.0.0', [
    declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
      minimumCount: 1,
    }),
    verificationRequirement(READINESS_VERIFICATION, AssetRequirementObligation.Required, checkIds),
  ]);

export const READINESS_PASS_V1 = readinessOutcomeProfile('pass', [TEST_CHECK_PASS]);
export const READINESS_FAIL_V1 = readinessOutcomeProfile('fail', [TEST_CHECK_FAIL]);
export const READINESS_WARNING_V1 = readinessOutcomeProfile('warning', [TEST_CHECK_WARNING]);
export const READINESS_MANUAL_V1 = readinessOutcomeProfile('manual', [TEST_CHECK_MANUAL_REVIEW]);
export const READINESS_UNAVAILABLE_V1 = readinessOutcomeProfile('unavailable', [
  TEST_CHECK_UNAVAILABLE,
]);
export const READINESS_MULTI_CHECK_V1 = readinessOutcomeProfile('multi', [
  TEST_CHECK_ALPHA,
  TEST_CHECK_BETA,
  TEST_CHECK_FAIL,
]);

/** Two independent `Required` attestation requirements. Proof for §52. */
export const READINESS_TWO_ATTESTATIONS_V1: AssetProfile = readinessProfile(
  'test.readiness-two-attestations.v1',
  '1.0.0',
  [
    declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
      minimumCount: 1,
    }),
    attestationRequirement(READINESS_ATTESTATION, AssetRequirementObligation.Required),
    attestationRequirement(READINESS_SECOND_ATTESTATION, AssetRequirementObligation.Required, {
      acceptedTypes: [AttestationType.Human, AttestationType.Organization],
    }),
  ],
);

/** One `Required` attestation requirement, and nothing else to get in the way. */
export const READINESS_ATTESTATION_V1: AssetProfile = readinessProfile(
  'test.readiness-attestation.v1',
  '1.0.0',
  [
    declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
      minimumCount: 1,
    }),
    attestationRequirement(READINESS_ATTESTATION, AssetRequirementObligation.Required),
  ],
);

/**
 * A `Required` attestation requirement beside a `Required` check that fails.
 *
 * The shape behind the hard proof that complete professional material is not
 * readiness while automation says otherwise.
 */
export const READINESS_ATTESTATION_FAIL_V1: AssetProfile = readinessProfile(
  'test.readiness-attestation-fail.v1',
  '1.0.0',
  [
    declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
      minimumCount: 1,
    }),
    verificationRequirement(READINESS_VERIFICATION, AssetRequirementObligation.Required, [
      TEST_CHECK_FAIL,
    ]),
    attestationRequirement(READINESS_ATTESTATION, AssetRequirementObligation.Required),
  ],
);

/** An Optional attestation requirement, for the Required-vs-Optional currency proof. */
export const READINESS_OPTIONAL_ATTESTATION_V1: AssetProfile = readinessProfile(
  'test.readiness-optional-attestation.v1',
  '1.0.0',
  [
    declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
      minimumCount: 1,
    }),
    attestationRequirement(READINESS_ATTESTATION, AssetRequirementObligation.Optional),
  ],
);

/** The same shape, accepting only a type the fixture reviewer never attests. */
export const READINESS_ATTESTATION_TYPE_V1: AssetProfile = readinessProfile(
  'test.readiness-attestation-type.v1',
  '1.0.0',
  [
    declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
      minimumCount: 1,
    }),
    attestationRequirement(READINESS_ATTESTATION, AssetRequirementObligation.Required, {
      acceptedTypes: [AttestationType.Organization],
    }),
  ],
);

/** A subject named only externally, assessed by the same engine. */
export const READINESS_EXTERNAL_V1: AssetProfile = readinessProfile(
  'test.readiness-external.v1',
  '1.0.0',
  [
    identityRequirement(READINESS_IDENTITY, AssetRequirementObligation.Required, [
      AssetIdentityStrategy.ExternalReference,
    ]),
    declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
      minimumCount: 1,
    }),
    verificationRequirement(READINESS_VERIFICATION, AssetRequirementObligation.Required, [
      TEST_CHECK_PASS,
    ]),
  ],
);

/** Abstract registry entries — no jurisdiction, no named registry, no authority. */
export const READINESS_CONFORMING_REGISTRY_ENTRY: CanonicalRegistryEntryRef = {
  id: 'aoc:registry-entry:readiness-0001',
  entryType: RegistryEntryType.Custom,
  locator: 'test-locator-0001',
  registryRef: {
    id: 'aoc:registry:readiness-0001',
    type: RegistryType.Custom,
    authorityLevel: RegistryAuthorityLevel.External,
    namespace: 'test.namespace.registry-accepted',
  },
};

export const READINESS_NONCONFORMING_REGISTRY_ENTRY: CanonicalRegistryEntryRef = {
  ...READINESS_CONFORMING_REGISTRY_ENTRY,
  id: 'aoc:registry-entry:readiness-0002',
  registryRef: {
    ...READINESS_CONFORMING_REGISTRY_ENTRY.registryRef,
    namespace: 'test.namespace.registry-other',
  },
};

/** A Required evidence requirement declaring a registry constraint. */
export const READINESS_REGISTRY_V1: AssetProfile = readinessProfile(
  'test.readiness-registry.v1',
  '1.0.0',
  [
    {
      id: READINESS_EVIDENCE,
      kind: AssetRequirementKind.Evidence,
      obligation: AssetRequirementObligation.Required,
      acceptedTypes: [EvidenceType.Document, EvidenceType.Certification],
      minimumCount: 1,
      registry: { acceptedNamespaces: ['test.namespace.registry-accepted'] },
    } as AssetRequirement,
  ],
);

/** The id of the one built-in that evaluates an evidence freshness constraint. */
export const READINESS_FRESHNESS_CHECK_ID = evidenceFreshnessCheck.checkId;

/** The maximum age the freshness fixtures declare: thirty days. */
export const READINESS_MAX_AGE_SECONDS = 2592000;

const freshEvidenceRequirement = (
  obligation: AssetRequirementObligation,
): AssetRequirement =>
  ({
    id: READINESS_EVIDENCE,
    kind: AssetRequirementKind.Evidence,
    obligation,
    acceptedTypes: [EvidenceType.Document, EvidenceType.Certification],
    minimumCount: 1,
    freshness: { maxAgeSeconds: READINESS_MAX_AGE_SECONDS },
  }) as AssetRequirement;

/**
 * A Required evidence requirement declaring `freshness`, and **no** verification
 * requirement anywhere.
 *
 * The delegation has been made to nobody: APV-07 executes only the checkIds a
 * verification requirement of the pinned profile declares, and this profile
 * declares none.
 */
export const READINESS_FRESHNESS_V1: AssetProfile = readinessProfile(
  'test.readiness-freshness.v1',
  '1.0.0',
  [freshEvidenceRequirement(AssetRequirementObligation.Required)],
);

/** The same, but the profile explicitly declares the check that evaluates it. */
export const READINESS_FRESHNESS_CHECKED_V1: AssetProfile = readinessProfile(
  'test.readiness-freshness-checked.v1',
  '1.0.0',
  [
    freshEvidenceRequirement(AssetRequirementObligation.Required),
    verificationRequirement(READINESS_VERIFICATION, AssetRequirementObligation.Required, [
      READINESS_FRESHNESS_CHECK_ID,
    ]),
  ],
);

/** An Optional evidence requirement whose freshness delegation is undischarged. */
export const READINESS_OPTIONAL_FRESHNESS_V1: AssetProfile = readinessProfile(
  'test.readiness-optional-freshness.v1',
  '1.0.0',
  [
    declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
      minimumCount: 1,
    }),
    freshEvidenceRequirement(AssetRequirementObligation.Optional),
  ],
);

/**
 * A Required *identity* requirement declaring `freshness`.
 *
 * No built-in evaluates identity freshness, so there is no check a profile could
 * declare that would discharge it — which is exactly the case that must not be
 * silently treated as satisfied.
 */
export const READINESS_IDENTITY_FRESHNESS_V1: AssetProfile = readinessProfile(
  'test.readiness-identity-freshness.v1',
  '1.0.0',
  [
    {
      id: READINESS_IDENTITY,
      kind: AssetRequirementKind.Identity,
      obligation: AssetRequirementObligation.Required,
      acceptedStrategies: [AssetIdentityStrategy.ContentIdentity],
      satisfaction: AssetRequirementSatisfaction.Any,
      freshness: { maxAgeSeconds: READINESS_MAX_AGE_SECONDS },
    } as AssetRequirement,
  ],
);

/** A Required evidence requirement declaring the one unestablishable constraint. */
export const READINESS_SUBTYPE_V1: AssetProfile = readinessProfile(
  'test.readiness-subtype.v1',
  '1.0.0',
  [
    {
      id: READINESS_EVIDENCE,
      kind: AssetRequirementKind.Evidence,
      obligation: AssetRequirementObligation.Required,
      acceptedTypes: [EvidenceType.Document, EvidenceType.Certification],
      acceptedSubtypes: ['test.subtype.opaque'],
      minimumCount: 1,
    } as AssetRequirement,
  ],
);

/** A declaration-only shape, for the smallest possible proofs. */
export const READINESS_DECLARATION_V1: AssetProfile = readinessProfile(
  'test.readiness-declaration.v1',
  '1.0.0',
  [
    declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
      minimumCount: 1,
    }),
  ],
);

/** A declaration shape demanding two distinct claims, for the count proofs. */
export const READINESS_DECLARATION_COUNT_V1: AssetProfile = readinessProfile(
  'test.readiness-declaration-count.v1',
  '1.0.0',
  [
    declarationRequirement(READINESS_DECLARATION, AssetRequirementObligation.Required, {
      minimumCount: 2,
    }),
  ],
);

export const READINESS_PROFILES: readonly AssetProfile[] = [
  READINESS_FULL_V1,
  READINESS_FULL_V2,
  READINESS_CONDITIONAL_V1,
  READINESS_NOT_REQUIRED_V1,
  READINESS_OPTIONAL_V1,
  READINESS_PASS_V1,
  READINESS_FAIL_V1,
  READINESS_WARNING_V1,
  READINESS_MANUAL_V1,
  READINESS_UNAVAILABLE_V1,
  READINESS_MULTI_CHECK_V1,
  READINESS_TWO_ATTESTATIONS_V1,
  READINESS_ATTESTATION_V1,
  READINESS_ATTESTATION_FAIL_V1,
  READINESS_ATTESTATION_TYPE_V1,
  READINESS_EXTERNAL_V1,
  READINESS_DECLARATION_V1,
  READINESS_DECLARATION_COUNT_V1,
  READINESS_FRESHNESS_V1,
  READINESS_FRESHNESS_CHECKED_V1,
  READINESS_OPTIONAL_FRESHNESS_V1,
  READINESS_IDENTITY_FRESHNESS_V1,
];

export function createReadinessCatalog(): AssetProfileCatalog {
  return createAssetProfileCatalog([...READINESS_PROFILES]);
}

// ---------------------------------------------------------------------------
// Contexts and dossiers
// ---------------------------------------------------------------------------

export interface ReadinessTestContext extends ProfessionalReviewContext {
  readonly clock: TestClock;
}

export function createReadinessContext(
  options: {
    readonly tenantId?: string;
    readonly catalog?: AssetProfileCatalog;
    readonly clock?: TestClock;
  } = {},
): ReadinessTestContext {
  return {
    catalog: options.catalog ?? createReadinessCatalog(),
    clock: options.clock ?? createTestClock(),
    tenantId: options.tenantId ?? TENANT_A,
    signer: createTestAttestationSigner(),
  };
}

/** Everything one evaluation may be handed, accumulated as the dossier is built. */
export interface ReadinessDossier {
  protocolizationCase: ProtocolizationCase;
  /**
   * Rebuilt rather than pushed into on every addition. The earlier slices
   * deep-freeze the collections they are handed, which is exactly the
   * source-immutability property their own tests assert — so a dossier that
   * mutated in place would be fighting a guarantee it wants.
   */
  evidenceReceipts: readonly EvidenceIntakeReceipt[];
  declarations: readonly ProtocolizationDeclarationRecord[];
  verificationResults: readonly ProtocolizationVerificationResult[];
  reviewRequests: readonly ProfessionalReviewRequest[];
  reviewDecisions: readonly ProfessionalReviewDecision[];
  attestations: readonly CanonicalAttestation[];
  evidence: readonly CanonicalEvidence[];
}

export function newDossier(
  context: ReadinessTestContext,
  options: {
    readonly caseId?: string;
    readonly profile?: AssetProfile;
    readonly profileVersion?: string;
    readonly subject?: ProtocolizationCaseSubject;
  } = {},
): ReadinessDossier {
  const profile = options.profile ?? READINESS_FULL_V1;
  const created = createProtocolizationCase(context, {
    caseId: options.caseId ?? 'case-readiness-0001',
    profile: {
      profileId: profile.profileId,
      profileVersion: options.profileVersion ?? profile.version,
    },
    subject: options.subject ?? READINESS_CONTENT_SUBJECT,
  });
  return {
    protocolizationCase: created.protocolizationCase,
    evidenceReceipts: [],
    declarations: [],
    verificationResults: [],
    reviewRequests: [],
    reviewDecisions: [],
    attestations: [],
    evidence: [],
  };
}

/** The bounded input bundle for one evaluation. */
export function readinessInputs(dossier: ReadinessDossier): ProtocolizationReadinessInputs {
  return {
    evidenceReceipts: dossier.evidenceReceipts,
    declarations: dossier.declarations,
    verificationResults: dossier.verificationResults,
    reviewRequests: dossier.reviewRequests,
    reviewDecisions: dossier.reviewDecisions,
    attestations: dossier.attestations,
    evidence: dossier.evidence,
  };
}

export function addDeclaration(
  context: ReadinessTestContext,
  dossier: ReadinessDossier,
  options: {
    readonly declarationId?: string;
    readonly materialId?: string;
    readonly claimRef?: string;
    readonly claimType?: ClaimType;
    readonly requirementIds?: readonly string[];
  } = {},
): void {
  context.clock.advance(60);
  const recorded = recordProtocolizationDeclaration(context, dossier.protocolizationCase, {
    declarationId: options.declarationId ?? 'declaration-readiness-0001',
    caseId: dossier.protocolizationCase.caseId,
    materialId: options.materialId ?? 'material-declaration-0001',
    declarant: READINESS_DECLARANT,
    pathway: DeclarationPathway.Reference,
    claimRef: options.claimRef ?? READINESS_CLAIM_ID,
    claimType: options.claimType ?? ClaimType.Authorship,
    requirementIds: options.requirementIds ?? [READINESS_DECLARATION],
  } as never);
  dossier.protocolizationCase = recorded.protocolizationCase;
  dossier.declarations = [...dossier.declarations, recorded.record];
}

/**
 * Associates material through APV-04's own public operation, bypassing APV-05
 * and APV-06.
 *
 * A legitimate pathway — the aggregate operation is public — and the one that
 * makes APV-09's own de-duplication observable: APV-05 and APV-06 already
 * refuse a replayed canonical reference at intake, so the only way to hold two
 * associations naming one record is to associate them directly, which is
 * exactly the reconstructed-history shape the counting rules exist for.
 */
export function addRawMaterial(
  context: ReadinessTestContext,
  dossier: ReadinessDossier,
  material: ProtocolizationCaseMaterialInput,
): void {
  context.clock.advance(60);
  const added = addProtocolizationCaseMaterial(context, dossier.protocolizationCase, material);
  dossier.protocolizationCase = added.protocolizationCase;
}

/**
 * A Protocol evidence record for one reference.
 *
 * Test-only, and deliberately a real `CanonicalEvidence` rather than a
 * hand-written stand-in: an evidence requirement's `acceptedTypes`, `registry`
 * and `credential` constraints are established from Protocol's own record, so a
 * fixture that faked one would prove nothing about the rule that reads it.
 */
export function readinessEvidenceRecord(
  evidenceRef: string,
  options: {
    readonly type?: EvidenceType;
    readonly registryRefs?: CanonicalEvidence['registryRefs'];
    readonly credentialRefs?: CanonicalEvidence['credentialRefs'];
  } = {},
): CanonicalEvidence {
  return {
    id: evidenceRef,
    type: options.type ?? EvidenceType.Document,
    subject: READINESS_CONTENT_ASSET_ID,
    issuer: { id: 'aoc:principal:readiness-issuer-0001', kind: PrincipalKind.Organization },
    source: { kind: ReferenceSourceKind.InternalId, value: `test-source:${evidenceRef}` },
    description: 'Test-only evidence record. Establishes nothing about the world.',
    createdAt: '2026-01-01T00:00:00.000Z',
    ...(options.registryRefs === undefined ? {} : { registryRefs: options.registryRefs }),
    ...(options.credentialRefs === undefined ? {} : { credentialRefs: options.credentialRefs }),
  };
}

/**
 * Admits evidence through APV-05's **canonical** pathway, so the dossier carries
 * the Protocol record as well as the receipt.
 *
 * `withRecord: false` admits the same evidence by reference only, leaving the
 * case holding a reference nothing can establish anything about — which is what
 * the "constraint unevaluated" proofs need.
 */
export function addEvidence(
  context: ReadinessTestContext,
  dossier: ReadinessDossier,
  options: {
    readonly intakeId?: string;
    readonly materialId?: string;
    readonly evidenceRef?: string;
    readonly requirementIds?: readonly string[];
    readonly type?: EvidenceType;
    readonly registryRefs?: CanonicalEvidence['registryRefs'];
    readonly credentialRefs?: CanonicalEvidence['credentialRefs'];
    /** When the source observed what the evidence describes. APV-05 keeps it verbatim. */
    readonly observedAt?: string;
    /** Admit by reference only, so no Protocol record reaches the evaluation. */
    readonly withRecord?: false;
  } = {},
): void {
  const evidenceRef = options.evidenceRef ?? READINESS_EVIDENCE_ID;
  const record = readinessEvidenceRecord(evidenceRef, options);

  context.clock.advance(60);
  const received = intakeProtocolizationEvidence(context, dossier.protocolizationCase, {
    intakeId: options.intakeId ?? 'intake-readiness-0001',
    caseId: dossier.protocolizationCase.caseId,
    materialId: options.materialId ?? 'material-evidence-0001',
    categoryId: READINESS_CATEGORY,
    ...(options.withRecord === false
      ? { pathway: EvidenceIntakePathway.Reference, evidenceRef }
      : { pathway: EvidenceIntakePathway.Canonical, evidence: record }),
    ...(options.observedAt === undefined ? {} : { observedAt: options.observedAt }),
    requirementIds: options.requirementIds ?? [READINESS_EVIDENCE],
  } as never);

  dossier.protocolizationCase = received.protocolizationCase;
  dossier.evidenceReceipts = [...dossier.evidenceReceipts, received.receipt];
  if (options.withRecord !== false) dossier.evidence = [...dossier.evidence, record];
}

/**
 * Runs every check the pinned profile declares, through APV-07's real engine.
 *
 * Results accumulate: a previous batch is never discarded, so a re-run leaves
 * the older results in history exactly as APV-07 wrote them and the readiness
 * evaluator gets to decide for itself which of them is current.
 */
export async function runChecks(
  context: ReadinessTestContext,
  dossier: ReadinessDossier,
  options: { readonly idPrefix?: string } = {},
): Promise<void> {
  const verificationContext = {
    catalog: context.catalog,
    clock: context.clock,
    tenantId: context.tenantId,
    checks: createVerificationCheckRegistry([
      ...BUILT_IN_VERIFICATION_CHECKS,
      ...TEST_VERIFICATION_CHECKS,
    ]),
  };
  const plan = listProtocolizationVerificationPlan(verificationContext, dossier.protocolizationCase);
  if (plan.length === 0) return;
  const prefix = options.idPrefix ?? `execution-r${dossier.protocolizationCase.revision}`;
  context.clock.advance(60);
  const run = await runProtocolizationVerification(verificationContext, dossier.protocolizationCase, {
    executionIds: plan.map((_entry, index) => `${prefix}-${index + 1}`),
    evidenceReceipts: dossier.evidenceReceipts,
    declarations: dossier.declarations,
  });
  dossier.verificationResults = [...dossier.verificationResults, ...run.results];
}

export function readinessScope(
  dossier: ReadinessDossier,
  requirementId: string,
  overrides: Partial<ProfessionalReviewScope> = {},
): ProfessionalReviewScope {
  return {
    requirementId,
    attestationType: AttestationType.Human,
    subjectRef: dossier.protocolizationCase.subject.subjectRef,
    caseRevision: dossier.protocolizationCase.revision,
    propositionRefs: [
      { kind: ProfessionalReviewBasisKind.ClaimRecord, ref: READINESS_CLAIM_ID },
    ],
    ...overrides,
  };
}

/**
 * Opens a review request and records a decision through APV-08's real
 * operations, optionally producing a legitimate proof-backed
 * `CanonicalAttestation`.
 */
export async function review(
  context: ReadinessTestContext,
  dossier: ReadinessDossier,
  options: {
    readonly requirementId?: string;
    readonly requestId?: string;
    readonly decisionId?: string;
    readonly action?: ProfessionalReviewAction;
    readonly reviewer?: CanonicalPrincipalRef;
    readonly attestationType?: AttestationType;
    readonly attestationId?: string;
    readonly materialId?: string;
    readonly claimRef?: string;
    /** Ask APV-08 to construct and associate the Protocol artifact. */
    readonly withArtifact?: boolean;
    readonly decideOnly?: false;
  } = {},
): Promise<void> {
  const requirementId = options.requirementId ?? READINESS_ATTESTATION;
  const action = options.action ?? ProfessionalReviewAction.Attest;
  const attestationType = options.attestationType ?? AttestationType.Human;
  const scope = readinessScope(dossier, requirementId, { attestationType });

  context.clock.advance(60);
  const { request } = createProfessionalReviewRequest(context, dossier.protocolizationCase, {
    reviewRequestId: options.requestId ?? `review-request-${requirementId}`,
    attestationRequirementId: requirementId,
    requestedAttestationType: attestationType,
    requestedScope: scope,
  });
  dossier.reviewRequests = [...dossier.reviewRequests, request];

  context.clock.advance(60);
  const recorded = await recordProfessionalReviewDecision(
    context,
    dossier.protocolizationCase,
    request,
    {
      decisionId: options.decisionId ?? `review-decision-${requirementId}`,
      reviewer: options.reviewer ?? READINESS_REVIEWER,
      action,
      ...(action === ProfessionalReviewAction.Attest
        ? {
            scope,
            reviewedRefs: [
              { kind: ProfessionalReviewBasisKind.Requirement, ref: requirementId },
            ],
          }
        : { reasonCode: 'test.reason.recorded' }),
      ...(action === ProfessionalReviewAction.RequestMoreEvidence
        ? { requestedMaterial: [{ requirementId, reasonCode: 'test.reason.more-evidence' }] }
        : {}),
      ...(options.withArtifact === true
        ? {
            attestation: {
              attestationId: options.attestationId ?? `aoc:attestation:readiness-${requirementId}`,
              claimRef: options.claimRef ?? READINESS_CLAIM_ID,
              statement: 'Test-only attested statement. Establishes nothing outside this scope.',
              materialId: options.materialId ?? `material-attestation-${requirementId}`,
            },
          }
        : {}),
    } as never,
  );

  dossier.reviewDecisions = [...dossier.reviewDecisions, recorded.decision];
  if (recorded.protocolizationCase !== undefined) {
    dossier.protocolizationCase = recorded.protocolizationCase;
  }
  if (recorded.attestation !== undefined) {
    dossier.attestations = [...dossier.attestations, recorded.attestation];
  }
}

/** Opens a review request and records no decision. Leaves the review outstanding. */
export function openReview(
  context: ReadinessTestContext,
  dossier: ReadinessDossier,
  requirementId: string = READINESS_ATTESTATION,
  requestId = `review-request-open-${requirementId}`,
): void {
  context.clock.advance(60);
  const { request } = createProfessionalReviewRequest(context, dossier.protocolizationCase, {
    reviewRequestId: requestId,
    attestationRequirementId: requirementId,
    requestedAttestationType: AttestationType.Human,
    requestedScope: readinessScope(dossier, requirementId),
  });
  dossier.reviewRequests = [...dossier.reviewRequests, request];
}
