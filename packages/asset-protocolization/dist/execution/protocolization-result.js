"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PROTOCOLIZATION_EXECUTION_RESULT_SCHEMA_VERSION = void 0;
exports.protocolizationMaterialRecordRef = protocolizationMaterialRecordRef;
const case_material_1 = require("../case/case-material");
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
exports.PROTOCOLIZATION_EXECUTION_RESULT_SCHEMA_VERSION = 'aoc-protocolization-execution/1';
/**
 * The payload key one material kind carries when that payload is a record
 * identifier, or `undefined` when it is a structure.
 *
 * Internal. A branch on *material kind* — the vertical's own closed vocabulary —
 * and never on an asset category, a profile id or a jurisdiction: a new asset
 * class adds no member here, it writes a profile.
 */
const MATERIAL_REFERENCE_KEY = Object.freeze({
    [case_material_1.ProtocolizationMaterialKind.RegistryEntry]: 'registryEntryRef',
    [case_material_1.ProtocolizationMaterialKind.Declaration]: 'claimRef',
    [case_material_1.ProtocolizationMaterialKind.Evidence]: 'evidenceRef',
    [case_material_1.ProtocolizationMaterialKind.Verification]: 'verificationRef',
    [case_material_1.ProtocolizationMaterialKind.Attestation]: 'attestationRef',
    [case_material_1.ProtocolizationMaterialKind.Credential]: 'credentialRef',
});
/**
 * The stable reference one material association names, when it names one.
 *
 * Exported for reuse *inside* this package only — it is not part of the package
 * facade. A registry entry's reference is the entry's own id, read through
 * Protocol's `CanonicalRegistryEntryRef`; every other id-bearing kind carries
 * its identifier directly.
 */
function protocolizationMaterialRecordRef(material) {
    const key = MATERIAL_REFERENCE_KEY[material.kind];
    if (key === undefined)
        return undefined;
    const payload = material[key];
    if (typeof payload === 'string')
        return payload;
    if (typeof payload === 'object' && payload !== null) {
        const id = payload.id;
        if (typeof id === 'string')
            return id;
    }
    return undefined;
}
