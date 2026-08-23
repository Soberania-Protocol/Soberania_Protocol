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
export { ASSET_IDENTIFIER_MAX_LENGTH, assetProfileVersionKey, compareAssetProfileVersions, isValidAssetCategoryId, isValidAssetProfileId, isValidAssetProfileVersion, isValidAssetRequirementConditionId, isValidAssetRequirementId, isValidAssetVerificationCheckId, } from './identifiers';
export type { AssetCategoryId, AssetProfileId, AssetProfileVersion, AssetRequirementConditionId, AssetRequirementId, AssetVerificationCheckId, } from './identifiers';
export { GLOBAL_JURISDICTION_CODE, isValidJurisdictionCode, isValidJurisdictionRef, jurisdictionRefsEqual } from './jurisdiction';
export type { JurisdictionRef } from './jurisdiction';
export { isValidAssetProfileMetadata } from './metadata';
export type { AssetProfileMetadata } from './metadata';
export { isValidAssetFreshnessConstraint, isValidUtcDateTime } from './freshness';
export type { AssetFreshnessConstraint } from './freshness';
export { isValidAssetAttesterConstraint, isValidAssetCredentialConstraint, isValidAssetRegistryConstraint, } from './constraints';
export type { AssetAttesterConstraint, AssetCredentialConstraint, AssetRegistryConstraint, } from './constraints';
export { AssetIdentityStrategy, AssetRequirementKind, AssetRequirementObligation, AssetRequirementSatisfaction, } from './requirements';
export type { AssetAttestationRequirement, AssetDeclarationRequirement, AssetEvidenceRequirement, AssetIdentityRequirement, AssetRequirement, AssetRequirementCondition, AssetVerificationRequirement, } from './requirements';
export { ASSET_PROFILE_SCHEMA_VERSION, AssetProfileScope } from './profile';
export type { AssetProfile } from './profile';
export { ASSET_PROFILE_VALIDATION_CODES, isAssetRequirementOfKind, isValidAssetProfile, validateAssetProfile, } from './profile-validation';
export type { AssetProfileValidationCode, AssetProfileValidationIssue, AssetProfileValidationResult, } from './profile-validation';
export { getAssetProfileRequirement, hasAssetProfileRequirement, listAssetProfileReadinessRequirements, listAssetProfileRequirements, } from './profile-selectors';
export type { AssetRequirementFilter } from './profile-selectors';
export { createAssetProfileCatalog } from './profile-catalog';
export type { AssetProfileCatalog, AssetProfileCatalogFilter } from './profile-catalog';
export { ASSET_PROFILE_ERROR_CODES, AssetProfileError } from './errors';
export type { AssetProfileErrorCode, AssetProfileErrorDetails } from './errors';
export { PROTOCOLIZATION_IDENTIFIER_MAX_LENGTH, isValidProtocolizationCaseId, isValidProtocolizationMaterialId, isValidProtocolizationProfileRef, isValidProtocolizationTenantId, protocolizationProfileRefsEqual, } from './case/case-identifiers';
export type { ProtocolizationCaseId, ProtocolizationMaterialId, ProtocolizationProfileRef, ProtocolizationTenantId, } from './case/case-identifiers';
export type { ProtocolizationClock } from './case/case-clock';
export { isValidProtocolizationCaseSubject } from './case/case-subject';
export type { ProtocolizationCaseSubject } from './case/case-subject';
export { ProtocolizationMaterialKind, isProtocolizationMaterialKind, isValidProtocolizationCaseMaterial, protocolizationMaterialPayloadKey, } from './case/case-material';
export type { ProtocolizationAttestationMaterial, ProtocolizationCaseMaterial, ProtocolizationContentIdentityMaterial, ProtocolizationCredentialMaterial, ProtocolizationDeclarationMaterial, ProtocolizationEvidenceMaterial, ProtocolizationExternalReferenceMaterial, ProtocolizationRegistryEntryMaterial, ProtocolizationVerificationMaterial, } from './case/case-material';
export { INITIAL_PROTOCOLIZATION_CASE_STATE, ProtocolizationCaseState, ProtocolizationRequirementConditionStatus, ProtocolizationRequirementMaterialStatus, acceptsProtocolizationMaterial, isAllowedProtocolizationCaseTransition, isProtocolizationCaseState, } from './case/case-state';
export { PROTOCOLIZATION_CASE_SCHEMA_VERSION } from './case/protocolization-case';
export type { ProtocolizationCase, ProtocolizationCaseRequirementState } from './case/protocolization-case';
export { PROTOCOLIZATION_CASE_VALIDATION_CODES, isValidProtocolizationCase, validateProtocolizationCase, } from './case/case-validation';
export type { ProtocolizationCaseValidationCode, ProtocolizationCaseValidationIssue, ProtocolizationCaseValidationOptions, ProtocolizationCaseValidationResult, } from './case/case-validation';
export { PROTOCOLIZATION_CASE_EVENT_TYPES } from './case/case-events';
export type { ProtocolizationCaseActivatedEvent, ProtocolizationCaseCancelledEvent, ProtocolizationCaseCreatedEvent, ProtocolizationCaseEvent, ProtocolizationCaseEventType, ProtocolizationMaterialAddedEvent, ProtocolizationMaterialAssociatedEvent, } from './case/case-events';
export { activateProtocolizationCase, addProtocolizationCaseMaterial, associateProtocolizationCaseMaterial, cancelProtocolizationCase, createProtocolizationCase, reconstituteProtocolizationCase, } from './case/case-operations';
export type { AssociateProtocolizationMaterialInput, CancelProtocolizationCaseInput, CreateProtocolizationCaseInput, ProtocolizationCaseContext, ProtocolizationCaseMaterialInput, ProtocolizationCaseTransition, } from './case/case-operations';
export { getProtocolizationCaseRequirementProgress, listProtocolizationCasePendingMaterialRequirements, listProtocolizationCaseRequirementProgress, } from './case/case-progress';
export type { ProtocolizationCaseProgressFilter, ProtocolizationCaseRequirementProgress, } from './case/case-progress';
export { createInMemoryProtocolizationCaseRepository } from './case/case-repository';
export type { ProtocolizationCaseRepository } from './case/case-repository';
export { PROTOCOLIZATION_CASE_ERROR_CODES, ProtocolizationCaseError } from './case/case-errors';
export type { ProtocolizationCaseErrorCode, ProtocolizationCaseErrorDetails } from './case/case-errors';
export { isValidEvidenceIntakeCategoryId, isValidEvidenceIntakeId, } from './evidence/evidence-intake-identifiers';
export type { EvidenceIntakeCategoryId, EvidenceIntakeId } from './evidence/evidence-intake-identifiers';
export { EvidenceIntakePathway, isEvidenceIntakePathway, } from './evidence/evidence-submission';
export type { CanonicalEvidenceSubmission, ProtocolizationEvidenceSubmission, ReferencedEvidenceSubmission, } from './evidence/evidence-submission';
export { EVIDENCE_INTAKE_RECEIPT_SCHEMA_VERSION } from './evidence/evidence-intake-receipt';
export type { EvidenceIntakeReceipt } from './evidence/evidence-intake-receipt';
export { EVIDENCE_INTAKE_VALIDATION_CODES, isAdmissibleProtocolizationEvidenceSubmission, isValidEvidenceIntakeReceipt, validateEvidenceIntakeReceipt, validateProtocolizationEvidenceSubmission, } from './evidence/evidence-intake-validation';
export type { EvidenceIntakeValidationCode, EvidenceIntakeValidationResult, } from './evidence/evidence-intake-validation';
export { PROTOCOLIZATION_EVIDENCE_EVENT_TYPES } from './evidence/evidence-intake-events';
export type { ProtocolizationEvidenceEvent, ProtocolizationEvidenceEventType, ProtocolizationEvidenceReceivedEvent, } from './evidence/evidence-intake-events';
export { intakeProtocolizationEvidence, reconstituteEvidenceIntakeReceipt, } from './evidence/evidence-intake-operations';
export type { ProtocolizationEvidenceIntakeTransition } from './evidence/evidence-intake-operations';
export { createInMemoryEvidenceIntakeRepository } from './evidence/evidence-intake-repository';
export type { EvidenceIntakeRepository } from './evidence/evidence-intake-repository';
export { EVIDENCE_INTAKE_ERROR_CODES, EvidenceIntakeError } from './evidence/evidence-intake-errors';
export type { EvidenceIntakeErrorCode, EvidenceIntakeErrorDetails } from './evidence/evidence-intake-errors';
export { isValidDeclarationId } from './declarations/declaration-identifiers';
export type { DeclarationId } from './declarations/declaration-identifiers';
export { DeclarationPathway, isDeclarationPathway } from './declarations/declaration-submission';
export type { CanonicalClaimDeclarationSubmission, ProtocolizationDeclarationSubmission, ReferencedDeclarationSubmission, } from './declarations/declaration-submission';
export { PROTOCOLIZATION_DECLARATION_RECORD_SCHEMA_VERSION } from './declarations/declaration-record';
export type { ProtocolizationDeclarationRecord } from './declarations/declaration-record';
export { DECLARATION_VALIDATION_CODES, isAdmissibleProtocolizationDeclarationSubmission, isValidProtocolizationDeclarationRecord, validateProtocolizationDeclarationRecord, validateProtocolizationDeclarationSubmission, } from './declarations/declaration-validation';
export type { DeclarationValidationCode, DeclarationValidationResult, } from './declarations/declaration-validation';
export { PROTOCOLIZATION_DECLARATION_EVENT_TYPES } from './declarations/declaration-events';
export type { ProtocolizationDeclarationEvent, ProtocolizationDeclarationEventType, ProtocolizationDeclarationRecordedEvent, } from './declarations/declaration-events';
export { recordProtocolizationDeclaration, reconstituteProtocolizationDeclarationRecord, } from './declarations/declaration-operations';
export type { ProtocolizationDeclarationTransition } from './declarations/declaration-operations';
export { createInMemoryDeclarationRepository } from './declarations/declaration-repository';
export type { DeclarationRepository } from './declarations/declaration-repository';
export { DECLARATION_ERROR_CODES, DeclarationError } from './declarations/declaration-errors';
export type { DeclarationErrorCode, DeclarationErrorDetails } from './declarations/declaration-errors';
export { VERIFICATION_CHECK_OUTCOMES, VerificationCheckOutcome, isVerificationCheckOutcome, } from './verification/verification-outcome';
export { isValidVerificationExecutionId, isValidVerificationReasonCode, } from './verification/verification-identifiers';
export type { VerificationExecutionId, VerificationReasonCode, } from './verification/verification-identifiers';
export { VerificationResolutionStatus } from './verification/verification-ports';
export type { VerificationClaimResolution, VerificationClaimResolver, VerificationContentResolution, VerificationContentResolver, VerificationResolvers, } from './verification/verification-ports';
export type { VerificationCheckContext } from './verification/verification-context';
export type { AssetVerificationCheck, VerificationCheckExecution, } from './verification/verification-check';
export { createVerificationCheckRegistry } from './verification/verification-check-registry';
export type { VerificationCheckRegistry } from './verification/verification-check-registry';
export { PROTOCOLIZATION_VERIFICATION_RESULT_SCHEMA_VERSION, VerificationInputKind, isVerificationInputKind, } from './verification/verification-result';
export type { ProtocolizationVerificationResult, VerificationInputRef, } from './verification/verification-result';
export { VERIFICATION_VALIDATION_CODES, isAdmissibleVerificationCheckExecution, isValidProtocolizationVerificationResult, validateProtocolizationVerificationResult, validateVerificationCheckExecution, } from './verification/verification-validation';
export type { VerificationValidationCode, VerificationValidationResult, } from './verification/verification-validation';
export { PROTOCOLIZATION_VERIFICATION_EVENT_TYPES } from './verification/verification-events';
export type { ProtocolizationVerificationCheckExecutedEvent, ProtocolizationVerificationEvent, ProtocolizationVerificationEventType, } from './verification/verification-events';
export { executeProtocolizationVerificationCheck, listProtocolizationVerificationPlan, reconstituteProtocolizationVerificationResult, runProtocolizationVerification, } from './verification/verification-operations';
export type { ExecuteProtocolizationVerificationInput, ProtocolizationVerificationContext, ProtocolizationVerificationInputs, ProtocolizationVerificationPlanEntry, ProtocolizationVerificationRun, ProtocolizationVerificationTransition, RunProtocolizationVerificationInput, } from './verification/verification-operations';
export { createInMemoryVerificationResultRepository } from './verification/verification-repository';
export type { VerificationResultRepository } from './verification/verification-repository';
export { countVerificationOutcomes, isVerificationResultCurrentForRevision, listLatestVerificationResults, listVerificationResultsForRevision, } from './verification/verification-projections';
export type { VerificationOutcomeCounts, VerificationResultKey, } from './verification/verification-projections';
export { BUILT_IN_VERIFICATION_CHECKS, competingDeclarationCheck, contentDigestCheck, declarationClaimTypeCheck, evidenceFreshnessCheck, identityStrategyCheck, minimumMaterialCountCheck, requiredMaterialPresentCheck, } from './verification/verification-builtin-checks';
export { VERIFICATION_ERROR_CODES, VerificationError } from './verification/verification-errors';
export type { VerificationErrorCode, VerificationErrorDetails, } from './verification/verification-errors';
export { PROFESSIONAL_REVIEW_ACTIONS, ProfessionalReviewAction, isProfessionalReviewAction, } from './attestation/review-actions';
export { isValidProfessionalReviewDecisionId, isValidProfessionalReviewReasonCode, isValidProfessionalReviewRequestId, } from './attestation/review-identifiers';
export type { ProfessionalReviewDecisionId, ProfessionalReviewReasonCode, ProfessionalReviewRequestId, } from './attestation/review-identifiers';
export { ProfessionalReviewBasisKind, isProfessionalReviewBasisKind, } from './attestation/review-scope';
export type { ProfessionalReviewBasisRef, ProfessionalReviewScope } from './attestation/review-scope';
export { PROFESSIONAL_REVIEW_REQUEST_SCHEMA_VERSION } from './attestation/review-request';
export type { ProfessionalReviewRequest } from './attestation/review-request';
export { PROFESSIONAL_REVIEW_PACKET_SCHEMA_VERSION, ProfessionalReviewParticipantRole, } from './attestation/review-packet';
export type { ProfessionalReviewAttestationRequest, ProfessionalReviewCheckEntry, ProfessionalReviewDeclarationEntry, ProfessionalReviewEvidenceEntry, ProfessionalReviewExceptions, ProfessionalReviewPacket, ProfessionalReviewPacketSubject, ProfessionalReviewParticipant, ProfessionalReviewUnexecutedCheck, } from './attestation/review-packet';
export { PROFESSIONAL_REVIEW_DECISION_SCHEMA_VERSION } from './attestation/review-decision';
export type { ProfessionalReviewDecision, ProfessionalReviewMaterialRequest, } from './attestation/review-decision';
export { PROFESSIONAL_REVIEW_VALIDATION_CODES, isValidProfessionalReviewDecision, isValidProfessionalReviewRequest, isValidProfessionalReviewScope, validateProfessionalReviewDecision, validateProfessionalReviewRequest, validateProfessionalReviewScope, } from './attestation/review-validation';
export type { ProfessionalReviewValidationCode, ProfessionalReviewValidationResult, } from './attestation/review-validation';
export { PROFESSIONAL_REVIEW_EVENT_TYPES } from './attestation/review-events';
export type { ProfessionalAttestationRecordedEvent, ProfessionalReviewDecisionRecordedEvent, ProfessionalReviewEvent, ProfessionalReviewEventType, ProfessionalReviewRequestedEvent, } from './attestation/review-events';
export { buildProfessionalReviewPacket, createProfessionalReviewRequest, recordProfessionalReviewDecision, reconstituteProfessionalReviewDecision, reconstituteProfessionalReviewRequest, } from './attestation/review-operations';
export type { CreateProfessionalReviewRequestInput, ProfessionalAttestationInput, ProfessionalReviewContext, ProfessionalReviewDecisionTransition, ProfessionalReviewPacketInputs, ProfessionalReviewRequestTransition, RecordProfessionalReviewDecisionInput, } from './attestation/review-operations';
export { prepareCanonicalAttestationFromReview } from './attestation/attestation-preparation';
export type { PrepareCanonicalAttestationInput } from './attestation/attestation-preparation';
export type { AttestationSigner, AttestationSigningRequest } from './attestation/attestation-signer';
export { createInMemoryProfessionalReviewDecisionRepository, createInMemoryProfessionalReviewRequestRepository, } from './attestation/review-repository';
export type { ProfessionalReviewDecisionRepository, ProfessionalReviewRequestRepository, } from './attestation/review-repository';
export { PROFESSIONAL_REVIEW_ERROR_CODES, ProfessionalReviewError, } from './attestation/review-errors';
export type { ProfessionalReviewErrorCode, ProfessionalReviewErrorDetails, } from './attestation/review-errors';
export { PROTOCOLIZATION_READINESS_BLOCKER_CODES, PROTOCOLIZATION_READINESS_BLOCKER_CODE_LIST, PROTOCOLIZATION_READINESS_WARNING_CODES, PROTOCOLIZATION_READINESS_WARNING_CODE_LIST, isProtocolizationReadinessBlockerCode, isProtocolizationReadinessWarningCode, } from './state-machine/readiness-reason';
export type { ProtocolizationReadinessBlockerCode, ProtocolizationReadinessReason, ProtocolizationReadinessReasonCode, ProtocolizationReadinessWarningCode, } from './state-machine/readiness-reason';
export { PROTOCOLIZATION_READINESS_STATE_PRECEDENCE, ProtocolizationReadinessState, ProtocolizationRequirementApplicability, ProtocolizationRequirementStatus, deriveProtocolizationReadinessState, isProtocolizationReadinessState, isProtocolizationRequirementApplicability, isProtocolizationRequirementStatus, } from './state-machine/readiness-state';
export type { ProtocolizationRequirementAssessment } from './state-machine/requirement-assessment';
export { PROTOCOLIZATION_READINESS_EVALUATION_SCHEMA_VERSION } from './state-machine/readiness-evaluation';
export type { ProtocolizationReadinessEvaluation, ProtocolizationReadinessInputs, } from './state-machine/readiness-evaluation';
export { evaluateProtocolizationReadiness } from './state-machine/readiness-operations';
export { getProtocolizationRequirementAssessment, isProtocolizationReadinessCurrentForCase, listProtocolizationReadinessBlockers, listProtocolizationReadinessWarnings, } from './state-machine/readiness-projections';
export type { ProtocolizationReadinessReasonFilter } from './state-machine/readiness-projections';
export { PROTOCOLIZATION_READINESS_ERROR_CODES, ProtocolizationReadinessError, } from './state-machine/readiness-errors';
export type { ProtocolizationReadinessErrorCode, ProtocolizationReadinessErrorDetails, } from './state-machine/readiness-errors';
export { isValidProtocolizationResultId } from './execution/execution-identifiers';
export type { ProtocolizationResultId } from './execution/execution-identifiers';
export { PROTOCOLIZATION_EXECUTION_RESULT_SCHEMA_VERSION } from './execution/protocolization-result';
export type { ProtocolizationExecutionMaterialRef, ProtocolizationReadinessBasis, ProtocolizationResult, } from './execution/protocolization-result';
export type { ProtocolizationExecutionOutcome, ProtocolizationExecutionRequest, } from './execution/execution-request';
export { PROTOCOLIZATION_EXECUTION_VALIDATION_CODES, isAdmissibleProtocolizationExecutionRequest, isValidProtocolizationResult, validateProtocolizationExecutionRequest, validateProtocolizationReadinessForExecution, validateProtocolizationResult, } from './execution/execution-validation';
export type { ProtocolizationExecutionValidationCode, ProtocolizationExecutionValidationResult, } from './execution/execution-validation';
export { PROTOCOLIZATION_EXECUTION_EVENT_TYPES } from './execution/execution-events';
export type { ProtocolizationExecutedEvent, ProtocolizationExecutionEvent, ProtocolizationExecutionEventType, } from './execution/execution-events';
export { executeProtocolization, reconstituteProtocolizationResult, } from './execution/execution-operations';
export { createInMemoryProtocolizationResultRepository } from './execution/execution-repository';
export type { ProtocolizationResultRepository } from './execution/execution-repository';
export { isProtocolizationResultCurrentForCase, listProtocolizationResultsForRevision, } from './execution/execution-projections';
export { PROTOCOLIZATION_EXECUTION_ERROR_CODES, ProtocolizationExecutionError, } from './execution/execution-errors';
export type { ProtocolizationExecutionErrorCode, ProtocolizationExecutionErrorDetails, } from './execution/execution-errors';
//# sourceMappingURL=index.d.ts.map