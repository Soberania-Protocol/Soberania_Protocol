import { isProtocolizationInstanceIdentifier } from '../case/case-identifiers';

/**
 * Identifier vocabulary for protocolization execution.
 *
 * One identifier, and deliberately only one. APV-05 minted an intake id, APV-06
 * a declaration id, APV-07 an execution id and APV-08 a request and a decision
 * id, because each of those slices produces more than one kind of record. This
 * slice produces exactly one: the immutable artifact of a successful
 * protocolization execution. Everything else it needs — the case, the tenant,
 * the pin, the requirement, the material, the Protocol records — is already
 * named by somebody else, and naming any of them a second time here would be
 * this slice claiming custody of a record it did not create.
 *
 * ### What is deliberately not declared here
 *
 * There is no `ProtocolizationExecutionId` separate from the result id: this
 * slice commits nothing before the result exists, so an attempt has no identity
 * of its own to carry (see `execution-operations.ts` on why there is no
 * execution status enum either). There is no `SovereignAssetId` spelling — that
 * is Protocol's, and it reaches a result through the case's own subject binding.
 * And there is no protocolization *artifact* identifier, because this slice
 * mints no artifact: a `SignedSovereignManifest` is Protocol's record, produced
 * by whoever holds a registrant and a signing key, and neither exists anywhere
 * in the APV chain today.
 */

/**
 * Stable identity of one successful protocolization execution.
 *
 * Caller-provided, never generated here — minting needs a UUID source or a
 * counter, and a pure domain layer that mints its own identifiers cannot be
 * tested by asserting on its output. What this package owns is the *rule* the
 * value must satisfy: APV-04's instance grammar, exactly like a case id, a
 * material id, an intake id, a declaration id, a verification execution id and a
 * review decision id.
 *
 * ### Uniqueness scope
 *
 * `(tenantId, resultId)`, exactly like every other instance identifier in this
 * package. Result ids are minted by tenants, so a globally unique constraint
 * would let one tenant's choice of identifier collide with another's — which
 * both leaks the existence of a protocolization across a tenant boundary and
 * makes a legitimate `save` fail for a reason its caller can neither see nor
 * fix.
 *
 * That scope is *identity* uniqueness and nothing more. It is emphatically not
 * the rule that stops a case revision being protocolized twice: two distinct
 * result ids naming the same tenant, case, pin and revision are two identities
 * for one execution basis, and it is the **basis** uniqueness rule in
 * `execution-repository.ts` that refuses the second.
 *
 * ### What it is not
 *
 * Not a correlation id — a correlation id groups the work of one request and
 * many records may share one, while this names exactly one artifact. Not a
 * `SovereignAssetId` — the subject's identity belongs to Protocol and long
 * predates any protocolization of it. Not a `CanonicalVerificationId`, a
 * `CanonicalAttestationId` or any other Protocol record id: writing a vertical
 * workflow identifier into a Protocol field would be a type-level lie every
 * downstream reader would inherit.
 */
export type ProtocolizationResultId = string;

export function isValidProtocolizationResultId(value: unknown): value is ProtocolizationResultId {
  return isProtocolizationInstanceIdentifier(value);
}
