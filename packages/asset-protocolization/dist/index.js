"use strict";
/**
 * `@aoc/asset-protocolization` — the Asset Protocolization Vertical.
 *
 * A vertical built **on** AOC Protocol. It is not AOC Protocol, it is not AOC
 * Enterprise, and it does not tokenize
 * (`docs/architecture/adr-asset-protocolization-vertical-boundary.md` §1).
 *
 * APV-03 delivers the first slice: the **asset profile framework** — how the
 * vertical states what a category of asset requires. Everything it describes is
 * a requirement *over* Protocol primitives; it defines no evidence, claim,
 * attestation, verification or identity type of its own, and nothing here
 * governs an action or executes one.
 *
 * APV-04 delivers the second: the **`ProtocolizationCase`** aggregate — one
 * tenant's attempt to satisfy one profile version for one subject. It records
 * what a case was given and where it is in its lifecycle; it verifies nothing,
 * decides no readiness, resolves no authority and states no legal conclusion.
 *
 * APV-05 delivers the third: the **evidence intake layer** — how a case is told
 * about evidence. It receives a submission, admits it *structurally*, correlates
 * it to requirements of the pinned profile, records an immutable receipt, and
 * associates it through APV-04's own evidence material pathway. It reuses
 * Protocol's `CanonicalEvidence`/`EvidenceType` and defines no evidence
 * substrate of its own. Evidence received is never evidence verified; evidence
 * associated is never a requirement satisfied; evidence complete is never a case
 * ready.
 *
 * APV-06 delivers the fourth: the **declaration / claim preparation layer** —
 * how a participant asserts something into a case. It records that a named
 * declarant asserted a proposition, carried by a Protocol `CanonicalClaim` the
 * caller names or supplies, correlated to declaration requirements of the
 * pinned profile, optionally pointing at evidence APV-05 already admitted. It
 * constructs no claim substrate of its own and prepares no `CanonicalClaim`.
 * A declaration recorded is never a declaration true; a claim named is never a
 * claim verified; evidence linked is never a claim proven; a declarant is never
 * an authority; and all declarations present is never a case ready.
 *
 * APV-07 delivers the fifth: the **verification pipeline** — how the automated
 * checks a pinned `AssetProfile` version declares are actually executed. It
 * resolves an `AssetVerificationCheckId` to a registered implementation, hands
 * it a bounded read-only view of one case, and records an immutable result
 * carrying an explicit outcome, a machine-readable reason, the references it
 * evaluated, the exact profile pin and the case revision it evaluated. It
 * mutates no case, so recording a finding can never become the input to the next
 * one, and it declares its own outcome vocabulary rather than widening
 * Protocol's `VerificationStatus`, which is a different concept.
 *
 * An APV check outcome is never Protocol's `VerificationStatus`; a `Pass` is
 * never universal truth; a `Fail` is never a case rejection; a `Warning` is never
 * a `Pass`; a `ManualReview` is never an attestation; an `Unavailable` is never a
 * `Fail`; and every check passing is never a case ready.
 *
 * APV-08 delivers the sixth: the **professional attestation workflow** — how an
 * identified reviewer receives a bounded, revision-bound snapshot of one case and
 * records a scoped professional position on one attestation requirement of the
 * pinned profile. It declares its own four-member action vocabulary (`Attest`,
 * `Reject`, `RequestMoreEvidence`, `Abstain`) rather than widening any Protocol
 * enum, keeps the vertical `ProfessionalReviewDecision` strictly distinct from
 * Protocol's `CanonicalAttestation`, and constructs the latter only where every
 * mandatory field — including the `claimRef` of a claim the case already holds —
 * can be established without invention.
 *
 * Professional review is never automated verification; a review decision is never
 * a `CanonicalAttestation`; an `Attest` is never universal truth and never a case
 * ready; a `Reject` is never a case rejected; a `RequestMoreEvidence` is never a
 * state transition; an `Abstain` is never a failure; a credential reference
 * present is never a credential valid; and a credential valid is never authority
 * over this subject.
 *
 * APV-09 delivers the seventh: the **protocolization state machine and readiness
 * evaluation** — the first slice permitted to interpret everything above and say
 * whether a case may proceed. It derives, from the exact pinned profile version
 * at the exact current case revision, one explainable
 * `ProtocolizationReadinessEvaluation`: an assessment per requirement, a
 * machine-readable blocker and warning set, and a top-level readiness state. It
 * introduces the semantic *requirement satisfied*, which no earlier slice was
 * allowed to state, and it introduces it here rather than in Protocol.
 *
 * Readiness is orthogonal to APV-04's lifecycle and is never persisted: nothing
 * is stored, no case is mutated, no event is emitted and no state is commanded.
 * `MaterialPresent` is never `Satisfied`; a declaration satisfied as a workflow
 * requirement is never a proposition true; a `Pass` is never universal truth; a
 * `Warning` is never a `Pass`; an `Unavailable` is never a `Fail`; a stale
 * `Pass` never satisfies a newer revision; an `Attest` decision is never
 * attestation material; a proof reference present is never a proof verified; a
 * professional `Reject` is never legal invalidity; and `READY` is never
 * protocolized, tokenizable, legally transferable or an Enterprise
 * authorization.
 *
 * APV-10 delivers the eighth: **protocolization execution** — the act APV-09's
 * answer authorizes. It takes one case, one APV-09 readiness evaluation and one
 * request, refuses unless that evaluation is well-formed, `Ready` and still
 * current for the exact tenant, case, pinned profile version and case revision
 * in hand, and produces one immutable `ProtocolizationResult`: the auditable
 * record that this exact revision was carried through the workflow, quoting the
 * conclusion it stood on and naming the dossier it rested on. It evaluates no
 * readiness of its own, mutates no case, adds no lifecycle state, mints no
 * Protocol record and touches nothing outside memory.
 *
 * `Ready` is never executed; `Ready` at revision N is never `Ready` at revision
 * N+1; a stale `Ready` never authorizes an execution; a warning never becomes a
 * blocker after APV-09 has answered `Ready`; a second result id never buys a
 * second protocolization of one basis; a later revision is never automatically
 * protocolized by an earlier result; and a `ProtocolizationResult` is never legal
 * title, never an ownership transfer, never a government registration, never a
 * token and never an Enterprise authorization.
 *
 * See `docs/asset-protocolization/APV_03_ASSET_PROFILE_FRAMEWORK.md`,
 * `docs/asset-protocolization/APV_04_PROTOCOLIZATION_CASE.md`,
 * `docs/asset-protocolization/APV_05_EVIDENCE_INTAKE.md`,
 * `docs/asset-protocolization/APV_06_DECLARATION_CLAIM_PREPARATION.md`,
 * `docs/asset-protocolization/APV_07_VERIFICATION_PIPELINE.md`,
 * `docs/asset-protocolization/APV_08_PROFESSIONAL_ATTESTATION_WORKFLOW.md` and
 * `docs/asset-protocolization/APV_09_PROTOCOLIZATION_STATE_MACHINE.md` and
 * `docs/asset-protocolization/APV_10_PROTOCOLIZATION_EXECUTION.md`.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtocolizationRequirementConditionStatus = exports.ProtocolizationCaseState = exports.INITIAL_PROTOCOLIZATION_CASE_STATE = exports.protocolizationMaterialPayloadKey = exports.isValidProtocolizationCaseMaterial = exports.isProtocolizationMaterialKind = exports.ProtocolizationMaterialKind = exports.isValidProtocolizationCaseSubject = exports.protocolizationProfileRefsEqual = exports.isValidProtocolizationTenantId = exports.isValidProtocolizationProfileRef = exports.isValidProtocolizationMaterialId = exports.isValidProtocolizationCaseId = exports.PROTOCOLIZATION_IDENTIFIER_MAX_LENGTH = exports.AssetProfileError = exports.ASSET_PROFILE_ERROR_CODES = exports.createAssetProfileCatalog = exports.listAssetProfileRequirements = exports.listAssetProfileReadinessRequirements = exports.hasAssetProfileRequirement = exports.getAssetProfileRequirement = exports.validateAssetProfile = exports.isValidAssetProfile = exports.isAssetRequirementOfKind = exports.ASSET_PROFILE_VALIDATION_CODES = exports.AssetProfileScope = exports.ASSET_PROFILE_SCHEMA_VERSION = exports.AssetRequirementSatisfaction = exports.AssetRequirementObligation = exports.AssetRequirementKind = exports.AssetIdentityStrategy = exports.isValidAssetRegistryConstraint = exports.isValidAssetCredentialConstraint = exports.isValidAssetAttesterConstraint = exports.isValidUtcDateTime = exports.isValidAssetFreshnessConstraint = exports.isValidAssetProfileMetadata = exports.jurisdictionRefsEqual = exports.isValidJurisdictionRef = exports.isValidJurisdictionCode = exports.GLOBAL_JURISDICTION_CODE = exports.isValidAssetVerificationCheckId = exports.isValidAssetRequirementId = exports.isValidAssetRequirementConditionId = exports.isValidAssetProfileVersion = exports.isValidAssetProfileId = exports.isValidAssetCategoryId = exports.compareAssetProfileVersions = exports.assetProfileVersionKey = exports.ASSET_IDENTIFIER_MAX_LENGTH = void 0;
exports.createInMemoryDeclarationRepository = exports.reconstituteProtocolizationDeclarationRecord = exports.recordProtocolizationDeclaration = exports.PROTOCOLIZATION_DECLARATION_EVENT_TYPES = exports.validateProtocolizationDeclarationSubmission = exports.validateProtocolizationDeclarationRecord = exports.isValidProtocolizationDeclarationRecord = exports.isAdmissibleProtocolizationDeclarationSubmission = exports.DECLARATION_VALIDATION_CODES = exports.PROTOCOLIZATION_DECLARATION_RECORD_SCHEMA_VERSION = exports.isDeclarationPathway = exports.DeclarationPathway = exports.isValidDeclarationId = exports.EvidenceIntakeError = exports.EVIDENCE_INTAKE_ERROR_CODES = exports.createInMemoryEvidenceIntakeRepository = exports.reconstituteEvidenceIntakeReceipt = exports.intakeProtocolizationEvidence = exports.PROTOCOLIZATION_EVIDENCE_EVENT_TYPES = exports.validateProtocolizationEvidenceSubmission = exports.validateEvidenceIntakeReceipt = exports.isValidEvidenceIntakeReceipt = exports.isAdmissibleProtocolizationEvidenceSubmission = exports.EVIDENCE_INTAKE_VALIDATION_CODES = exports.EVIDENCE_INTAKE_RECEIPT_SCHEMA_VERSION = exports.isEvidenceIntakePathway = exports.EvidenceIntakePathway = exports.isValidEvidenceIntakeId = exports.isValidEvidenceIntakeCategoryId = exports.ProtocolizationCaseError = exports.PROTOCOLIZATION_CASE_ERROR_CODES = exports.createInMemoryProtocolizationCaseRepository = exports.listProtocolizationCaseRequirementProgress = exports.listProtocolizationCasePendingMaterialRequirements = exports.getProtocolizationCaseRequirementProgress = exports.reconstituteProtocolizationCase = exports.createProtocolizationCase = exports.cancelProtocolizationCase = exports.associateProtocolizationCaseMaterial = exports.addProtocolizationCaseMaterial = exports.activateProtocolizationCase = exports.PROTOCOLIZATION_CASE_EVENT_TYPES = exports.validateProtocolizationCase = exports.isValidProtocolizationCase = exports.PROTOCOLIZATION_CASE_VALIDATION_CODES = exports.PROTOCOLIZATION_CASE_SCHEMA_VERSION = exports.isProtocolizationCaseState = exports.isAllowedProtocolizationCaseTransition = exports.acceptsProtocolizationMaterial = exports.ProtocolizationRequirementMaterialStatus = void 0;
exports.PROFESSIONAL_REVIEW_VALIDATION_CODES = exports.PROFESSIONAL_REVIEW_DECISION_SCHEMA_VERSION = exports.ProfessionalReviewParticipantRole = exports.PROFESSIONAL_REVIEW_PACKET_SCHEMA_VERSION = exports.PROFESSIONAL_REVIEW_REQUEST_SCHEMA_VERSION = exports.isProfessionalReviewBasisKind = exports.ProfessionalReviewBasisKind = exports.isValidProfessionalReviewRequestId = exports.isValidProfessionalReviewReasonCode = exports.isValidProfessionalReviewDecisionId = exports.isProfessionalReviewAction = exports.ProfessionalReviewAction = exports.PROFESSIONAL_REVIEW_ACTIONS = exports.VerificationError = exports.VERIFICATION_ERROR_CODES = exports.requiredMaterialPresentCheck = exports.minimumMaterialCountCheck = exports.identityStrategyCheck = exports.evidenceFreshnessCheck = exports.declarationClaimTypeCheck = exports.contentDigestCheck = exports.competingDeclarationCheck = exports.BUILT_IN_VERIFICATION_CHECKS = exports.listVerificationResultsForRevision = exports.listLatestVerificationResults = exports.isVerificationResultCurrentForRevision = exports.countVerificationOutcomes = exports.createInMemoryVerificationResultRepository = exports.runProtocolizationVerification = exports.reconstituteProtocolizationVerificationResult = exports.listProtocolizationVerificationPlan = exports.executeProtocolizationVerificationCheck = exports.PROTOCOLIZATION_VERIFICATION_EVENT_TYPES = exports.validateVerificationCheckExecution = exports.validateProtocolizationVerificationResult = exports.isValidProtocolizationVerificationResult = exports.isAdmissibleVerificationCheckExecution = exports.VERIFICATION_VALIDATION_CODES = exports.isVerificationInputKind = exports.VerificationInputKind = exports.PROTOCOLIZATION_VERIFICATION_RESULT_SCHEMA_VERSION = exports.createVerificationCheckRegistry = exports.VerificationResolutionStatus = exports.isValidVerificationReasonCode = exports.isValidVerificationExecutionId = exports.isVerificationCheckOutcome = exports.VerificationCheckOutcome = exports.VERIFICATION_CHECK_OUTCOMES = exports.DeclarationError = exports.DECLARATION_ERROR_CODES = void 0;
exports.reconstituteProtocolizationResult = exports.executeProtocolization = exports.PROTOCOLIZATION_EXECUTION_EVENT_TYPES = exports.validateProtocolizationResult = exports.validateProtocolizationReadinessForExecution = exports.validateProtocolizationExecutionRequest = exports.isValidProtocolizationResult = exports.isAdmissibleProtocolizationExecutionRequest = exports.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES = exports.PROTOCOLIZATION_EXECUTION_RESULT_SCHEMA_VERSION = exports.isValidProtocolizationResultId = exports.ProtocolizationReadinessError = exports.PROTOCOLIZATION_READINESS_ERROR_CODES = exports.listProtocolizationReadinessWarnings = exports.listProtocolizationReadinessBlockers = exports.isProtocolizationReadinessCurrentForCase = exports.getProtocolizationRequirementAssessment = exports.evaluateProtocolizationReadiness = exports.PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION = exports.isProtocolizationRequirementStatus = exports.isProtocolizationRequirementApplicability = exports.isProtocolizationReadinessState = exports.deriveProtocolizationReadinessState = exports.ProtocolizationRequirementStatus = exports.ProtocolizationRequirementApplicability = exports.ProtocolizationReadinessState = exports.PROTOCOLIZATION_READINESS_STATE_PRECEDENCE = exports.isProtocolizationReadinessWarningCode = exports.isProtocolizationReadinessBlockerCode = exports.PROTOCOLIZATION_READINESS_WARNING_CODE_LIST = exports.PROTOCOLIZATION_READINESS_WARNING_CODES = exports.PROTOCOLIZATION_READINESS_BLOCKER_CODE_LIST = exports.PROTOCOLIZATION_READINESS_BLOCKER_CODES = exports.ProfessionalReviewError = exports.PROFESSIONAL_REVIEW_ERROR_CODES = exports.createInMemoryProfessionalReviewRequestRepository = exports.createInMemoryProfessionalReviewDecisionRepository = exports.prepareCanonicalAttestationFromReview = exports.reconstituteProfessionalReviewRequest = exports.reconstituteProfessionalReviewDecision = exports.recordProfessionalReviewDecision = exports.createProfessionalReviewRequest = exports.buildProfessionalReviewPacket = exports.PROFESSIONAL_REVIEW_EVENT_TYPES = exports.validateProfessionalReviewScope = exports.validateProfessionalReviewRequest = exports.validateProfessionalReviewDecision = exports.isValidProfessionalReviewScope = exports.isValidProfessionalReviewRequest = exports.isValidProfessionalReviewDecision = void 0;
exports.ProtocolizationExecutionError = exports.PROTOCOLIZATION_EXECUTION_ERROR_CODES = exports.listProtocolizationResultsForRevision = exports.isProtocolizationResultCurrentForCase = exports.createInMemoryProtocolizationResultRepository = void 0;
var identifiers_1 = require("./identifiers");
Object.defineProperty(exports, "ASSET_IDENTIFIER_MAX_LENGTH", { enumerable: true, get: function () { return identifiers_1.ASSET_IDENTIFIER_MAX_LENGTH; } });
Object.defineProperty(exports, "assetProfileVersionKey", { enumerable: true, get: function () { return identifiers_1.assetProfileVersionKey; } });
Object.defineProperty(exports, "compareAssetProfileVersions", { enumerable: true, get: function () { return identifiers_1.compareAssetProfileVersions; } });
Object.defineProperty(exports, "isValidAssetCategoryId", { enumerable: true, get: function () { return identifiers_1.isValidAssetCategoryId; } });
Object.defineProperty(exports, "isValidAssetProfileId", { enumerable: true, get: function () { return identifiers_1.isValidAssetProfileId; } });
Object.defineProperty(exports, "isValidAssetProfileVersion", { enumerable: true, get: function () { return identifiers_1.isValidAssetProfileVersion; } });
Object.defineProperty(exports, "isValidAssetRequirementConditionId", { enumerable: true, get: function () { return identifiers_1.isValidAssetRequirementConditionId; } });
Object.defineProperty(exports, "isValidAssetRequirementId", { enumerable: true, get: function () { return identifiers_1.isValidAssetRequirementId; } });
Object.defineProperty(exports, "isValidAssetVerificationCheckId", { enumerable: true, get: function () { return identifiers_1.isValidAssetVerificationCheckId; } });
var jurisdiction_1 = require("./jurisdiction");
Object.defineProperty(exports, "GLOBAL_JURISDICTION_CODE", { enumerable: true, get: function () { return jurisdiction_1.GLOBAL_JURISDICTION_CODE; } });
Object.defineProperty(exports, "isValidJurisdictionCode", { enumerable: true, get: function () { return jurisdiction_1.isValidJurisdictionCode; } });
Object.defineProperty(exports, "isValidJurisdictionRef", { enumerable: true, get: function () { return jurisdiction_1.isValidJurisdictionRef; } });
Object.defineProperty(exports, "jurisdictionRefsEqual", { enumerable: true, get: function () { return jurisdiction_1.jurisdictionRefsEqual; } });
var metadata_1 = require("./metadata");
Object.defineProperty(exports, "isValidAssetProfileMetadata", { enumerable: true, get: function () { return metadata_1.isValidAssetProfileMetadata; } });
var freshness_1 = require("./freshness");
Object.defineProperty(exports, "isValidAssetFreshnessConstraint", { enumerable: true, get: function () { return freshness_1.isValidAssetFreshnessConstraint; } });
Object.defineProperty(exports, "isValidUtcDateTime", { enumerable: true, get: function () { return freshness_1.isValidUtcDateTime; } });
var constraints_1 = require("./constraints");
Object.defineProperty(exports, "isValidAssetAttesterConstraint", { enumerable: true, get: function () { return constraints_1.isValidAssetAttesterConstraint; } });
Object.defineProperty(exports, "isValidAssetCredentialConstraint", { enumerable: true, get: function () { return constraints_1.isValidAssetCredentialConstraint; } });
Object.defineProperty(exports, "isValidAssetRegistryConstraint", { enumerable: true, get: function () { return constraints_1.isValidAssetRegistryConstraint; } });
var requirements_1 = require("./requirements");
Object.defineProperty(exports, "AssetIdentityStrategy", { enumerable: true, get: function () { return requirements_1.AssetIdentityStrategy; } });
Object.defineProperty(exports, "AssetRequirementKind", { enumerable: true, get: function () { return requirements_1.AssetRequirementKind; } });
Object.defineProperty(exports, "AssetRequirementObligation", { enumerable: true, get: function () { return requirements_1.AssetRequirementObligation; } });
Object.defineProperty(exports, "AssetRequirementSatisfaction", { enumerable: true, get: function () { return requirements_1.AssetRequirementSatisfaction; } });
var profile_1 = require("./profile");
Object.defineProperty(exports, "ASSET_PROFILE_SCHEMA_VERSION", { enumerable: true, get: function () { return profile_1.ASSET_PROFILE_SCHEMA_VERSION; } });
Object.defineProperty(exports, "AssetProfileScope", { enumerable: true, get: function () { return profile_1.AssetProfileScope; } });
var profile_validation_1 = require("./profile-validation");
Object.defineProperty(exports, "ASSET_PROFILE_VALIDATION_CODES", { enumerable: true, get: function () { return profile_validation_1.ASSET_PROFILE_VALIDATION_CODES; } });
Object.defineProperty(exports, "isAssetRequirementOfKind", { enumerable: true, get: function () { return profile_validation_1.isAssetRequirementOfKind; } });
Object.defineProperty(exports, "isValidAssetProfile", { enumerable: true, get: function () { return profile_validation_1.isValidAssetProfile; } });
Object.defineProperty(exports, "validateAssetProfile", { enumerable: true, get: function () { return profile_validation_1.validateAssetProfile; } });
var profile_selectors_1 = require("./profile-selectors");
Object.defineProperty(exports, "getAssetProfileRequirement", { enumerable: true, get: function () { return profile_selectors_1.getAssetProfileRequirement; } });
Object.defineProperty(exports, "hasAssetProfileRequirement", { enumerable: true, get: function () { return profile_selectors_1.hasAssetProfileRequirement; } });
Object.defineProperty(exports, "listAssetProfileReadinessRequirements", { enumerable: true, get: function () { return profile_selectors_1.listAssetProfileReadinessRequirements; } });
Object.defineProperty(exports, "listAssetProfileRequirements", { enumerable: true, get: function () { return profile_selectors_1.listAssetProfileRequirements; } });
var profile_catalog_1 = require("./profile-catalog");
Object.defineProperty(exports, "createAssetProfileCatalog", { enumerable: true, get: function () { return profile_catalog_1.createAssetProfileCatalog; } });
var errors_1 = require("./errors");
Object.defineProperty(exports, "ASSET_PROFILE_ERROR_CODES", { enumerable: true, get: function () { return errors_1.ASSET_PROFILE_ERROR_CODES; } });
Object.defineProperty(exports, "AssetProfileError", { enumerable: true, get: function () { return errors_1.AssetProfileError; } });
// ---------------------------------------------------------------------------
// APV-04 — ProtocolizationCase
// ---------------------------------------------------------------------------
var case_identifiers_1 = require("./case/case-identifiers");
Object.defineProperty(exports, "PROTOCOLIZATION_IDENTIFIER_MAX_LENGTH", { enumerable: true, get: function () { return case_identifiers_1.PROTOCOLIZATION_IDENTIFIER_MAX_LENGTH; } });
Object.defineProperty(exports, "isValidProtocolizationCaseId", { enumerable: true, get: function () { return case_identifiers_1.isValidProtocolizationCaseId; } });
Object.defineProperty(exports, "isValidProtocolizationMaterialId", { enumerable: true, get: function () { return case_identifiers_1.isValidProtocolizationMaterialId; } });
Object.defineProperty(exports, "isValidProtocolizationProfileRef", { enumerable: true, get: function () { return case_identifiers_1.isValidProtocolizationProfileRef; } });
Object.defineProperty(exports, "isValidProtocolizationTenantId", { enumerable: true, get: function () { return case_identifiers_1.isValidProtocolizationTenantId; } });
Object.defineProperty(exports, "protocolizationProfileRefsEqual", { enumerable: true, get: function () { return case_identifiers_1.protocolizationProfileRefsEqual; } });
var case_subject_1 = require("./case/case-subject");
Object.defineProperty(exports, "isValidProtocolizationCaseSubject", { enumerable: true, get: function () { return case_subject_1.isValidProtocolizationCaseSubject; } });
var case_material_1 = require("./case/case-material");
Object.defineProperty(exports, "ProtocolizationMaterialKind", { enumerable: true, get: function () { return case_material_1.ProtocolizationMaterialKind; } });
Object.defineProperty(exports, "isProtocolizationMaterialKind", { enumerable: true, get: function () { return case_material_1.isProtocolizationMaterialKind; } });
Object.defineProperty(exports, "isValidProtocolizationCaseMaterial", { enumerable: true, get: function () { return case_material_1.isValidProtocolizationCaseMaterial; } });
Object.defineProperty(exports, "protocolizationMaterialPayloadKey", { enumerable: true, get: function () { return case_material_1.protocolizationMaterialPayloadKey; } });
var case_state_1 = require("./case/case-state");
Object.defineProperty(exports, "INITIAL_PROTOCOLIZATION_CASE_STATE", { enumerable: true, get: function () { return case_state_1.INITIAL_PROTOCOLIZATION_CASE_STATE; } });
Object.defineProperty(exports, "ProtocolizationCaseState", { enumerable: true, get: function () { return case_state_1.ProtocolizationCaseState; } });
Object.defineProperty(exports, "ProtocolizationRequirementConditionStatus", { enumerable: true, get: function () { return case_state_1.ProtocolizationRequirementConditionStatus; } });
Object.defineProperty(exports, "ProtocolizationRequirementMaterialStatus", { enumerable: true, get: function () { return case_state_1.ProtocolizationRequirementMaterialStatus; } });
Object.defineProperty(exports, "acceptsProtocolizationMaterial", { enumerable: true, get: function () { return case_state_1.acceptsProtocolizationMaterial; } });
Object.defineProperty(exports, "isAllowedProtocolizationCaseTransition", { enumerable: true, get: function () { return case_state_1.isAllowedProtocolizationCaseTransition; } });
Object.defineProperty(exports, "isProtocolizationCaseState", { enumerable: true, get: function () { return case_state_1.isProtocolizationCaseState; } });
var protocolization_case_1 = require("./case/protocolization-case");
Object.defineProperty(exports, "PROTOCOLIZATION_CASE_SCHEMA_VERSION", { enumerable: true, get: function () { return protocolization_case_1.PROTOCOLIZATION_CASE_SCHEMA_VERSION; } });
var case_validation_1 = require("./case/case-validation");
Object.defineProperty(exports, "PROTOCOLIZATION_CASE_VALIDATION_CODES", { enumerable: true, get: function () { return case_validation_1.PROTOCOLIZATION_CASE_VALIDATION_CODES; } });
Object.defineProperty(exports, "isValidProtocolizationCase", { enumerable: true, get: function () { return case_validation_1.isValidProtocolizationCase; } });
Object.defineProperty(exports, "validateProtocolizationCase", { enumerable: true, get: function () { return case_validation_1.validateProtocolizationCase; } });
var case_events_1 = require("./case/case-events");
Object.defineProperty(exports, "PROTOCOLIZATION_CASE_EVENT_TYPES", { enumerable: true, get: function () { return case_events_1.PROTOCOLIZATION_CASE_EVENT_TYPES; } });
var case_operations_1 = require("./case/case-operations");
Object.defineProperty(exports, "activateProtocolizationCase", { enumerable: true, get: function () { return case_operations_1.activateProtocolizationCase; } });
Object.defineProperty(exports, "addProtocolizationCaseMaterial", { enumerable: true, get: function () { return case_operations_1.addProtocolizationCaseMaterial; } });
Object.defineProperty(exports, "associateProtocolizationCaseMaterial", { enumerable: true, get: function () { return case_operations_1.associateProtocolizationCaseMaterial; } });
Object.defineProperty(exports, "cancelProtocolizationCase", { enumerable: true, get: function () { return case_operations_1.cancelProtocolizationCase; } });
Object.defineProperty(exports, "createProtocolizationCase", { enumerable: true, get: function () { return case_operations_1.createProtocolizationCase; } });
Object.defineProperty(exports, "reconstituteProtocolizationCase", { enumerable: true, get: function () { return case_operations_1.reconstituteProtocolizationCase; } });
var case_progress_1 = require("./case/case-progress");
Object.defineProperty(exports, "getProtocolizationCaseRequirementProgress", { enumerable: true, get: function () { return case_progress_1.getProtocolizationCaseRequirementProgress; } });
Object.defineProperty(exports, "listProtocolizationCasePendingMaterialRequirements", { enumerable: true, get: function () { return case_progress_1.listProtocolizationCasePendingMaterialRequirements; } });
Object.defineProperty(exports, "listProtocolizationCaseRequirementProgress", { enumerable: true, get: function () { return case_progress_1.listProtocolizationCaseRequirementProgress; } });
var case_repository_1 = require("./case/case-repository");
Object.defineProperty(exports, "createInMemoryProtocolizationCaseRepository", { enumerable: true, get: function () { return case_repository_1.createInMemoryProtocolizationCaseRepository; } });
var case_errors_1 = require("./case/case-errors");
Object.defineProperty(exports, "PROTOCOLIZATION_CASE_ERROR_CODES", { enumerable: true, get: function () { return case_errors_1.PROTOCOLIZATION_CASE_ERROR_CODES; } });
Object.defineProperty(exports, "ProtocolizationCaseError", { enumerable: true, get: function () { return case_errors_1.ProtocolizationCaseError; } });
// ---------------------------------------------------------------------------
// APV-05 — Evidence intake
// ---------------------------------------------------------------------------
var evidence_intake_identifiers_1 = require("./evidence/evidence-intake-identifiers");
Object.defineProperty(exports, "isValidEvidenceIntakeCategoryId", { enumerable: true, get: function () { return evidence_intake_identifiers_1.isValidEvidenceIntakeCategoryId; } });
Object.defineProperty(exports, "isValidEvidenceIntakeId", { enumerable: true, get: function () { return evidence_intake_identifiers_1.isValidEvidenceIntakeId; } });
var evidence_submission_1 = require("./evidence/evidence-submission");
Object.defineProperty(exports, "EvidenceIntakePathway", { enumerable: true, get: function () { return evidence_submission_1.EvidenceIntakePathway; } });
Object.defineProperty(exports, "isEvidenceIntakePathway", { enumerable: true, get: function () { return evidence_submission_1.isEvidenceIntakePathway; } });
var evidence_intake_receipt_1 = require("./evidence/evidence-intake-receipt");
Object.defineProperty(exports, "EVIDENCE_INTAKE_RECEIPT_SCHEMA_VERSION", { enumerable: true, get: function () { return evidence_intake_receipt_1.EVIDENCE_INTAKE_RECEIPT_SCHEMA_VERSION; } });
var evidence_intake_validation_1 = require("./evidence/evidence-intake-validation");
Object.defineProperty(exports, "EVIDENCE_INTAKE_VALIDATION_CODES", { enumerable: true, get: function () { return evidence_intake_validation_1.EVIDENCE_INTAKE_VALIDATION_CODES; } });
Object.defineProperty(exports, "isAdmissibleProtocolizationEvidenceSubmission", { enumerable: true, get: function () { return evidence_intake_validation_1.isAdmissibleProtocolizationEvidenceSubmission; } });
Object.defineProperty(exports, "isValidEvidenceIntakeReceipt", { enumerable: true, get: function () { return evidence_intake_validation_1.isValidEvidenceIntakeReceipt; } });
Object.defineProperty(exports, "validateEvidenceIntakeReceipt", { enumerable: true, get: function () { return evidence_intake_validation_1.validateEvidenceIntakeReceipt; } });
Object.defineProperty(exports, "validateProtocolizationEvidenceSubmission", { enumerable: true, get: function () { return evidence_intake_validation_1.validateProtocolizationEvidenceSubmission; } });
var evidence_intake_events_1 = require("./evidence/evidence-intake-events");
Object.defineProperty(exports, "PROTOCOLIZATION_EVIDENCE_EVENT_TYPES", { enumerable: true, get: function () { return evidence_intake_events_1.PROTOCOLIZATION_EVIDENCE_EVENT_TYPES; } });
var evidence_intake_operations_1 = require("./evidence/evidence-intake-operations");
Object.defineProperty(exports, "intakeProtocolizationEvidence", { enumerable: true, get: function () { return evidence_intake_operations_1.intakeProtocolizationEvidence; } });
Object.defineProperty(exports, "reconstituteEvidenceIntakeReceipt", { enumerable: true, get: function () { return evidence_intake_operations_1.reconstituteEvidenceIntakeReceipt; } });
var evidence_intake_repository_1 = require("./evidence/evidence-intake-repository");
Object.defineProperty(exports, "createInMemoryEvidenceIntakeRepository", { enumerable: true, get: function () { return evidence_intake_repository_1.createInMemoryEvidenceIntakeRepository; } });
var evidence_intake_errors_1 = require("./evidence/evidence-intake-errors");
Object.defineProperty(exports, "EVIDENCE_INTAKE_ERROR_CODES", { enumerable: true, get: function () { return evidence_intake_errors_1.EVIDENCE_INTAKE_ERROR_CODES; } });
Object.defineProperty(exports, "EvidenceIntakeError", { enumerable: true, get: function () { return evidence_intake_errors_1.EvidenceIntakeError; } });
// ---------------------------------------------------------------------------
// APV-06 — Declaration / claim preparation
// ---------------------------------------------------------------------------
var declaration_identifiers_1 = require("./declarations/declaration-identifiers");
Object.defineProperty(exports, "isValidDeclarationId", { enumerable: true, get: function () { return declaration_identifiers_1.isValidDeclarationId; } });
var declaration_submission_1 = require("./declarations/declaration-submission");
Object.defineProperty(exports, "DeclarationPathway", { enumerable: true, get: function () { return declaration_submission_1.DeclarationPathway; } });
Object.defineProperty(exports, "isDeclarationPathway", { enumerable: true, get: function () { return declaration_submission_1.isDeclarationPathway; } });
var declaration_record_1 = require("./declarations/declaration-record");
Object.defineProperty(exports, "PROTOCOLIZATION_DECLARATION_RECORD_SCHEMA_VERSION", { enumerable: true, get: function () { return declaration_record_1.PROTOCOLIZATION_DECLARATION_RECORD_SCHEMA_VERSION; } });
var declaration_validation_1 = require("./declarations/declaration-validation");
Object.defineProperty(exports, "DECLARATION_VALIDATION_CODES", { enumerable: true, get: function () { return declaration_validation_1.DECLARATION_VALIDATION_CODES; } });
Object.defineProperty(exports, "isAdmissibleProtocolizationDeclarationSubmission", { enumerable: true, get: function () { return declaration_validation_1.isAdmissibleProtocolizationDeclarationSubmission; } });
Object.defineProperty(exports, "isValidProtocolizationDeclarationRecord", { enumerable: true, get: function () { return declaration_validation_1.isValidProtocolizationDeclarationRecord; } });
Object.defineProperty(exports, "validateProtocolizationDeclarationRecord", { enumerable: true, get: function () { return declaration_validation_1.validateProtocolizationDeclarationRecord; } });
Object.defineProperty(exports, "validateProtocolizationDeclarationSubmission", { enumerable: true, get: function () { return declaration_validation_1.validateProtocolizationDeclarationSubmission; } });
var declaration_events_1 = require("./declarations/declaration-events");
Object.defineProperty(exports, "PROTOCOLIZATION_DECLARATION_EVENT_TYPES", { enumerable: true, get: function () { return declaration_events_1.PROTOCOLIZATION_DECLARATION_EVENT_TYPES; } });
var declaration_operations_1 = require("./declarations/declaration-operations");
Object.defineProperty(exports, "recordProtocolizationDeclaration", { enumerable: true, get: function () { return declaration_operations_1.recordProtocolizationDeclaration; } });
Object.defineProperty(exports, "reconstituteProtocolizationDeclarationRecord", { enumerable: true, get: function () { return declaration_operations_1.reconstituteProtocolizationDeclarationRecord; } });
var declaration_repository_1 = require("./declarations/declaration-repository");
Object.defineProperty(exports, "createInMemoryDeclarationRepository", { enumerable: true, get: function () { return declaration_repository_1.createInMemoryDeclarationRepository; } });
var declaration_errors_1 = require("./declarations/declaration-errors");
Object.defineProperty(exports, "DECLARATION_ERROR_CODES", { enumerable: true, get: function () { return declaration_errors_1.DECLARATION_ERROR_CODES; } });
Object.defineProperty(exports, "DeclarationError", { enumerable: true, get: function () { return declaration_errors_1.DeclarationError; } });
// ---------------------------------------------------------------------------
// APV-07 — Verification pipeline
// ---------------------------------------------------------------------------
var verification_outcome_1 = require("./verification/verification-outcome");
Object.defineProperty(exports, "VERIFICATION_CHECK_OUTCOMES", { enumerable: true, get: function () { return verification_outcome_1.VERIFICATION_CHECK_OUTCOMES; } });
Object.defineProperty(exports, "VerificationCheckOutcome", { enumerable: true, get: function () { return verification_outcome_1.VerificationCheckOutcome; } });
Object.defineProperty(exports, "isVerificationCheckOutcome", { enumerable: true, get: function () { return verification_outcome_1.isVerificationCheckOutcome; } });
var verification_identifiers_1 = require("./verification/verification-identifiers");
Object.defineProperty(exports, "isValidVerificationExecutionId", { enumerable: true, get: function () { return verification_identifiers_1.isValidVerificationExecutionId; } });
Object.defineProperty(exports, "isValidVerificationReasonCode", { enumerable: true, get: function () { return verification_identifiers_1.isValidVerificationReasonCode; } });
var verification_ports_1 = require("./verification/verification-ports");
Object.defineProperty(exports, "VerificationResolutionStatus", { enumerable: true, get: function () { return verification_ports_1.VerificationResolutionStatus; } });
var verification_check_registry_1 = require("./verification/verification-check-registry");
Object.defineProperty(exports, "createVerificationCheckRegistry", { enumerable: true, get: function () { return verification_check_registry_1.createVerificationCheckRegistry; } });
var verification_result_1 = require("./verification/verification-result");
Object.defineProperty(exports, "PROTOCOLIZATION_VERIFICATION_RESULT_SCHEMA_VERSION", { enumerable: true, get: function () { return verification_result_1.PROTOCOLIZATION_VERIFICATION_RESULT_SCHEMA_VERSION; } });
Object.defineProperty(exports, "VerificationInputKind", { enumerable: true, get: function () { return verification_result_1.VerificationInputKind; } });
Object.defineProperty(exports, "isVerificationInputKind", { enumerable: true, get: function () { return verification_result_1.isVerificationInputKind; } });
var verification_validation_1 = require("./verification/verification-validation");
Object.defineProperty(exports, "VERIFICATION_VALIDATION_CODES", { enumerable: true, get: function () { return verification_validation_1.VERIFICATION_VALIDATION_CODES; } });
Object.defineProperty(exports, "isAdmissibleVerificationCheckExecution", { enumerable: true, get: function () { return verification_validation_1.isAdmissibleVerificationCheckExecution; } });
Object.defineProperty(exports, "isValidProtocolizationVerificationResult", { enumerable: true, get: function () { return verification_validation_1.isValidProtocolizationVerificationResult; } });
Object.defineProperty(exports, "validateProtocolizationVerificationResult", { enumerable: true, get: function () { return verification_validation_1.validateProtocolizationVerificationResult; } });
Object.defineProperty(exports, "validateVerificationCheckExecution", { enumerable: true, get: function () { return verification_validation_1.validateVerificationCheckExecution; } });
var verification_events_1 = require("./verification/verification-events");
Object.defineProperty(exports, "PROTOCOLIZATION_VERIFICATION_EVENT_TYPES", { enumerable: true, get: function () { return verification_events_1.PROTOCOLIZATION_VERIFICATION_EVENT_TYPES; } });
var verification_operations_1 = require("./verification/verification-operations");
Object.defineProperty(exports, "executeProtocolizationVerificationCheck", { enumerable: true, get: function () { return verification_operations_1.executeProtocolizationVerificationCheck; } });
Object.defineProperty(exports, "listProtocolizationVerificationPlan", { enumerable: true, get: function () { return verification_operations_1.listProtocolizationVerificationPlan; } });
Object.defineProperty(exports, "reconstituteProtocolizationVerificationResult", { enumerable: true, get: function () { return verification_operations_1.reconstituteProtocolizationVerificationResult; } });
Object.defineProperty(exports, "runProtocolizationVerification", { enumerable: true, get: function () { return verification_operations_1.runProtocolizationVerification; } });
var verification_repository_1 = require("./verification/verification-repository");
Object.defineProperty(exports, "createInMemoryVerificationResultRepository", { enumerable: true, get: function () { return verification_repository_1.createInMemoryVerificationResultRepository; } });
var verification_projections_1 = require("./verification/verification-projections");
Object.defineProperty(exports, "countVerificationOutcomes", { enumerable: true, get: function () { return verification_projections_1.countVerificationOutcomes; } });
Object.defineProperty(exports, "isVerificationResultCurrentForRevision", { enumerable: true, get: function () { return verification_projections_1.isVerificationResultCurrentForRevision; } });
Object.defineProperty(exports, "listLatestVerificationResults", { enumerable: true, get: function () { return verification_projections_1.listLatestVerificationResults; } });
Object.defineProperty(exports, "listVerificationResultsForRevision", { enumerable: true, get: function () { return verification_projections_1.listVerificationResultsForRevision; } });
var verification_builtin_checks_1 = require("./verification/verification-builtin-checks");
Object.defineProperty(exports, "BUILT_IN_VERIFICATION_CHECKS", { enumerable: true, get: function () { return verification_builtin_checks_1.BUILT_IN_VERIFICATION_CHECKS; } });
Object.defineProperty(exports, "competingDeclarationCheck", { enumerable: true, get: function () { return verification_builtin_checks_1.competingDeclarationCheck; } });
Object.defineProperty(exports, "contentDigestCheck", { enumerable: true, get: function () { return verification_builtin_checks_1.contentDigestCheck; } });
Object.defineProperty(exports, "declarationClaimTypeCheck", { enumerable: true, get: function () { return verification_builtin_checks_1.declarationClaimTypeCheck; } });
Object.defineProperty(exports, "evidenceFreshnessCheck", { enumerable: true, get: function () { return verification_builtin_checks_1.evidenceFreshnessCheck; } });
Object.defineProperty(exports, "identityStrategyCheck", { enumerable: true, get: function () { return verification_builtin_checks_1.identityStrategyCheck; } });
Object.defineProperty(exports, "minimumMaterialCountCheck", { enumerable: true, get: function () { return verification_builtin_checks_1.minimumMaterialCountCheck; } });
Object.defineProperty(exports, "requiredMaterialPresentCheck", { enumerable: true, get: function () { return verification_builtin_checks_1.requiredMaterialPresentCheck; } });
var verification_errors_1 = require("./verification/verification-errors");
Object.defineProperty(exports, "VERIFICATION_ERROR_CODES", { enumerable: true, get: function () { return verification_errors_1.VERIFICATION_ERROR_CODES; } });
Object.defineProperty(exports, "VerificationError", { enumerable: true, get: function () { return verification_errors_1.VerificationError; } });
// ---------------------------------------------------------------------------
// APV-08 — Professional attestation workflow
// ---------------------------------------------------------------------------
var review_actions_1 = require("./attestation/review-actions");
Object.defineProperty(exports, "PROFESSIONAL_REVIEW_ACTIONS", { enumerable: true, get: function () { return review_actions_1.PROFESSIONAL_REVIEW_ACTIONS; } });
Object.defineProperty(exports, "ProfessionalReviewAction", { enumerable: true, get: function () { return review_actions_1.ProfessionalReviewAction; } });
Object.defineProperty(exports, "isProfessionalReviewAction", { enumerable: true, get: function () { return review_actions_1.isProfessionalReviewAction; } });
var review_identifiers_1 = require("./attestation/review-identifiers");
Object.defineProperty(exports, "isValidProfessionalReviewDecisionId", { enumerable: true, get: function () { return review_identifiers_1.isValidProfessionalReviewDecisionId; } });
Object.defineProperty(exports, "isValidProfessionalReviewReasonCode", { enumerable: true, get: function () { return review_identifiers_1.isValidProfessionalReviewReasonCode; } });
Object.defineProperty(exports, "isValidProfessionalReviewRequestId", { enumerable: true, get: function () { return review_identifiers_1.isValidProfessionalReviewRequestId; } });
var review_scope_1 = require("./attestation/review-scope");
Object.defineProperty(exports, "ProfessionalReviewBasisKind", { enumerable: true, get: function () { return review_scope_1.ProfessionalReviewBasisKind; } });
Object.defineProperty(exports, "isProfessionalReviewBasisKind", { enumerable: true, get: function () { return review_scope_1.isProfessionalReviewBasisKind; } });
var review_request_1 = require("./attestation/review-request");
Object.defineProperty(exports, "PROFESSIONAL_REVIEW_REQUEST_SCHEMA_VERSION", { enumerable: true, get: function () { return review_request_1.PROFESSIONAL_REVIEW_REQUEST_SCHEMA_VERSION; } });
var review_packet_1 = require("./attestation/review-packet");
Object.defineProperty(exports, "PROFESSIONAL_REVIEW_PACKET_SCHEMA_VERSION", { enumerable: true, get: function () { return review_packet_1.PROFESSIONAL_REVIEW_PACKET_SCHEMA_VERSION; } });
Object.defineProperty(exports, "ProfessionalReviewParticipantRole", { enumerable: true, get: function () { return review_packet_1.ProfessionalReviewParticipantRole; } });
var review_decision_1 = require("./attestation/review-decision");
Object.defineProperty(exports, "PROFESSIONAL_REVIEW_DECISION_SCHEMA_VERSION", { enumerable: true, get: function () { return review_decision_1.PROFESSIONAL_REVIEW_DECISION_SCHEMA_VERSION; } });
var review_validation_1 = require("./attestation/review-validation");
Object.defineProperty(exports, "PROFESSIONAL_REVIEW_VALIDATION_CODES", { enumerable: true, get: function () { return review_validation_1.PROFESSIONAL_REVIEW_VALIDATION_CODES; } });
Object.defineProperty(exports, "isValidProfessionalReviewDecision", { enumerable: true, get: function () { return review_validation_1.isValidProfessionalReviewDecision; } });
Object.defineProperty(exports, "isValidProfessionalReviewRequest", { enumerable: true, get: function () { return review_validation_1.isValidProfessionalReviewRequest; } });
Object.defineProperty(exports, "isValidProfessionalReviewScope", { enumerable: true, get: function () { return review_validation_1.isValidProfessionalReviewScope; } });
Object.defineProperty(exports, "validateProfessionalReviewDecision", { enumerable: true, get: function () { return review_validation_1.validateProfessionalReviewDecision; } });
Object.defineProperty(exports, "validateProfessionalReviewRequest", { enumerable: true, get: function () { return review_validation_1.validateProfessionalReviewRequest; } });
Object.defineProperty(exports, "validateProfessionalReviewScope", { enumerable: true, get: function () { return review_validation_1.validateProfessionalReviewScope; } });
var review_events_1 = require("./attestation/review-events");
Object.defineProperty(exports, "PROFESSIONAL_REVIEW_EVENT_TYPES", { enumerable: true, get: function () { return review_events_1.PROFESSIONAL_REVIEW_EVENT_TYPES; } });
var review_operations_1 = require("./attestation/review-operations");
Object.defineProperty(exports, "buildProfessionalReviewPacket", { enumerable: true, get: function () { return review_operations_1.buildProfessionalReviewPacket; } });
Object.defineProperty(exports, "createProfessionalReviewRequest", { enumerable: true, get: function () { return review_operations_1.createProfessionalReviewRequest; } });
Object.defineProperty(exports, "recordProfessionalReviewDecision", { enumerable: true, get: function () { return review_operations_1.recordProfessionalReviewDecision; } });
Object.defineProperty(exports, "reconstituteProfessionalReviewDecision", { enumerable: true, get: function () { return review_operations_1.reconstituteProfessionalReviewDecision; } });
Object.defineProperty(exports, "reconstituteProfessionalReviewRequest", { enumerable: true, get: function () { return review_operations_1.reconstituteProfessionalReviewRequest; } });
var attestation_preparation_1 = require("./attestation/attestation-preparation");
Object.defineProperty(exports, "prepareCanonicalAttestationFromReview", { enumerable: true, get: function () { return attestation_preparation_1.prepareCanonicalAttestationFromReview; } });
var review_repository_1 = require("./attestation/review-repository");
Object.defineProperty(exports, "createInMemoryProfessionalReviewDecisionRepository", { enumerable: true, get: function () { return review_repository_1.createInMemoryProfessionalReviewDecisionRepository; } });
Object.defineProperty(exports, "createInMemoryProfessionalReviewRequestRepository", { enumerable: true, get: function () { return review_repository_1.createInMemoryProfessionalReviewRequestRepository; } });
var review_errors_1 = require("./attestation/review-errors");
Object.defineProperty(exports, "PROFESSIONAL_REVIEW_ERROR_CODES", { enumerable: true, get: function () { return review_errors_1.PROFESSIONAL_REVIEW_ERROR_CODES; } });
Object.defineProperty(exports, "ProfessionalReviewError", { enumerable: true, get: function () { return review_errors_1.ProfessionalReviewError; } });
// ---------------------------------------------------------------------------
// APV-09 — Protocolization state machine and readiness evaluation
// ---------------------------------------------------------------------------
var readiness_reason_1 = require("./state-machine/readiness-reason");
Object.defineProperty(exports, "PROTOCOLIZATION_READINESS_BLOCKER_CODES", { enumerable: true, get: function () { return readiness_reason_1.PROTOCOLIZATION_READINESS_BLOCKER_CODES; } });
Object.defineProperty(exports, "PROTOCOLIZATION_READINESS_BLOCKER_CODE_LIST", { enumerable: true, get: function () { return readiness_reason_1.PROTOCOLIZATION_READINESS_BLOCKER_CODE_LIST; } });
Object.defineProperty(exports, "PROTOCOLIZATION_READINESS_WARNING_CODES", { enumerable: true, get: function () { return readiness_reason_1.PROTOCOLIZATION_READINESS_WARNING_CODES; } });
Object.defineProperty(exports, "PROTOCOLIZATION_READINESS_WARNING_CODE_LIST", { enumerable: true, get: function () { return readiness_reason_1.PROTOCOLIZATION_READINESS_WARNING_CODE_LIST; } });
Object.defineProperty(exports, "isProtocolizationReadinessBlockerCode", { enumerable: true, get: function () { return readiness_reason_1.isProtocolizationReadinessBlockerCode; } });
Object.defineProperty(exports, "isProtocolizationReadinessWarningCode", { enumerable: true, get: function () { return readiness_reason_1.isProtocolizationReadinessWarningCode; } });
var readiness_state_1 = require("./state-machine/readiness-state");
Object.defineProperty(exports, "PROTOCOLIZATION_READINESS_STATE_PRECEDENCE", { enumerable: true, get: function () { return readiness_state_1.PROTOCOLIZATION_READINESS_STATE_PRECEDENCE; } });
Object.defineProperty(exports, "ProtocolizationReadinessState", { enumerable: true, get: function () { return readiness_state_1.ProtocolizationReadinessState; } });
Object.defineProperty(exports, "ProtocolizationRequirementApplicability", { enumerable: true, get: function () { return readiness_state_1.ProtocolizationRequirementApplicability; } });
Object.defineProperty(exports, "ProtocolizationRequirementStatus", { enumerable: true, get: function () { return readiness_state_1.ProtocolizationRequirementStatus; } });
Object.defineProperty(exports, "deriveProtocolizationReadinessState", { enumerable: true, get: function () { return readiness_state_1.deriveProtocolizationReadinessState; } });
Object.defineProperty(exports, "isProtocolizationReadinessState", { enumerable: true, get: function () { return readiness_state_1.isProtocolizationReadinessState; } });
Object.defineProperty(exports, "isProtocolizationRequirementApplicability", { enumerable: true, get: function () { return readiness_state_1.isProtocolizationRequirementApplicability; } });
Object.defineProperty(exports, "isProtocolizationRequirementStatus", { enumerable: true, get: function () { return readiness_state_1.isProtocolizationRequirementStatus; } });
var readiness_evaluation_1 = require("./state-machine/readiness-evaluation");
Object.defineProperty(exports, "PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION", { enumerable: true, get: function () { return readiness_evaluation_1.PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION; } });
var readiness_operations_1 = require("./state-machine/readiness-operations");
Object.defineProperty(exports, "evaluateProtocolizationReadiness", { enumerable: true, get: function () { return readiness_operations_1.evaluateProtocolizationReadiness; } });
var readiness_projections_1 = require("./state-machine/readiness-projections");
Object.defineProperty(exports, "getProtocolizationRequirementAssessment", { enumerable: true, get: function () { return readiness_projections_1.getProtocolizationRequirementAssessment; } });
Object.defineProperty(exports, "isProtocolizationReadinessCurrentForCase", { enumerable: true, get: function () { return readiness_projections_1.isProtocolizationReadinessCurrentForCase; } });
Object.defineProperty(exports, "listProtocolizationReadinessBlockers", { enumerable: true, get: function () { return readiness_projections_1.listProtocolizationReadinessBlockers; } });
Object.defineProperty(exports, "listProtocolizationReadinessWarnings", { enumerable: true, get: function () { return readiness_projections_1.listProtocolizationReadinessWarnings; } });
var readiness_errors_1 = require("./state-machine/readiness-errors");
Object.defineProperty(exports, "PROTOCOLIZATION_READINESS_ERROR_CODES", { enumerable: true, get: function () { return readiness_errors_1.PROTOCOLIZATION_READINESS_ERROR_CODES; } });
Object.defineProperty(exports, "ProtocolizationReadinessError", { enumerable: true, get: function () { return readiness_errors_1.ProtocolizationReadinessError; } });
// ---------------------------------------------------------------------------
// APV-10 — Protocolization execution
// ---------------------------------------------------------------------------
var execution_identifiers_1 = require("./execution/execution-identifiers");
Object.defineProperty(exports, "isValidProtocolizationResultId", { enumerable: true, get: function () { return execution_identifiers_1.isValidProtocolizationResultId; } });
var protocolization_result_1 = require("./execution/protocolization-result");
Object.defineProperty(exports, "PROTOCOLIZATION_EXECUTION_RESULT_SCHEMA_VERSION", { enumerable: true, get: function () { return protocolization_result_1.PROTOCOLIZATION_EXECUTION_RESULT_SCHEMA_VERSION; } });
var execution_validation_1 = require("./execution/execution-validation");
Object.defineProperty(exports, "PROTOCOLIZATION_EXECUTION_VALIDATION_CODES", { enumerable: true, get: function () { return execution_validation_1.PROTOCOLIZATION_EXECUTION_VALIDATION_CODES; } });
Object.defineProperty(exports, "isAdmissibleProtocolizationExecutionRequest", { enumerable: true, get: function () { return execution_validation_1.isAdmissibleProtocolizationExecutionRequest; } });
Object.defineProperty(exports, "isValidProtocolizationResult", { enumerable: true, get: function () { return execution_validation_1.isValidProtocolizationResult; } });
Object.defineProperty(exports, "validateProtocolizationExecutionRequest", { enumerable: true, get: function () { return execution_validation_1.validateProtocolizationExecutionRequest; } });
Object.defineProperty(exports, "validateProtocolizationReadinessForExecution", { enumerable: true, get: function () { return execution_validation_1.validateProtocolizationReadinessForExecution; } });
Object.defineProperty(exports, "validateProtocolizationResult", { enumerable: true, get: function () { return execution_validation_1.validateProtocolizationResult; } });
var execution_events_1 = require("./execution/execution-events");
Object.defineProperty(exports, "PROTOCOLIZATION_EXECUTION_EVENT_TYPES", { enumerable: true, get: function () { return execution_events_1.PROTOCOLIZATION_EXECUTION_EVENT_TYPES; } });
var execution_operations_1 = require("./execution/execution-operations");
Object.defineProperty(exports, "executeProtocolization", { enumerable: true, get: function () { return execution_operations_1.executeProtocolization; } });
Object.defineProperty(exports, "reconstituteProtocolizationResult", { enumerable: true, get: function () { return execution_operations_1.reconstituteProtocolizationResult; } });
var execution_repository_1 = require("./execution/execution-repository");
Object.defineProperty(exports, "createInMemoryProtocolizationResultRepository", { enumerable: true, get: function () { return execution_repository_1.createInMemoryProtocolizationResultRepository; } });
var execution_projections_1 = require("./execution/execution-projections");
Object.defineProperty(exports, "isProtocolizationResultCurrentForCase", { enumerable: true, get: function () { return execution_projections_1.isProtocolizationResultCurrentForCase; } });
Object.defineProperty(exports, "listProtocolizationResultsForRevision", { enumerable: true, get: function () { return execution_projections_1.listProtocolizationResultsForRevision; } });
var execution_errors_1 = require("./execution/execution-errors");
Object.defineProperty(exports, "PROTOCOLIZATION_EXECUTION_ERROR_CODES", { enumerable: true, get: function () { return execution_errors_1.PROTOCOLIZATION_EXECUTION_ERROR_CODES; } });
Object.defineProperty(exports, "ProtocolizationExecutionError", { enumerable: true, get: function () { return execution_errors_1.ProtocolizationExecutionError; } });
