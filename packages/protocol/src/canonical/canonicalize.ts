/**
 * AOC Canonical JSON — the single authoritative deterministic serialization
 * contract for cryptographic material (hashing, signing) across the AOC
 * Protocol runtime.
 *
 * Profile: aoc-canonical-json/1
 *
 * Any conforming implementation (in any language) MUST reproduce these
 * rules exactly, byte for byte:
 *
 * - Object keys are sorted by ASCII/UTF-16 code unit ordering and rendered
 *   as `"key":value` pairs joined by `,`, wrapped in `{}`.
 * - Arrays preserve input order and are rendered as comma-joined elements
 *   wrapped in `[]`.
 * - Strings are rendered via JSON string-escaping (`JSON.stringify`).
 * - Finite numbers -- integer or not -- render via
 *   `Number.prototype.toString()`, verbatim. That is the shortest decimal
 *   string which reads back as exactly the same double (ECMA-262 selects the
 *   fewest digits for which `Number(s) === x`), so it carries no leading
 *   zeros, no trailing decimal point, and no trailing fractional zeros. It is
 *   therefore already canonical, and NO further normalization is applied.
 *   Exponential forms such as `7.9e-10` are emitted unchanged, exponent
 *   included.
 * - `true`, `false`, and `null` render as the literals `true`, `false`,
 *   `null`.
 * - No insignificant whitespace is ever emitted.
 *
 * Deliberately unsupported — canonicalization MUST throw rather than
 * silently produce ambiguous cryptographic material:
 * - `undefined`, at the top level, as an array element, or as an object
 *   property value (no property-dropping, unlike `JSON.stringify`).
 * - Non-finite numbers (`NaN`, `Infinity`, `-Infinity`).
 * - Any other type not representable in JSON (functions, symbols,
 *   bigints, etc).
 *
 * This module has no dependency on the rest of the AOC runtime and is the
 * single import every canonicalization-relevant consumer must use — the
 * `@aoc/protocol` sovereign asset/manifest/claim contracts, the crypto
 * engine's signing/hashing primitives (via `crypto/canonicalize.ts`, which
 * re-exports this module), and the root-level legacy asset/content layer
 * (content, pack, field, storage, capability, consent canonical payload
 * builders, via the root `canonicalize.ts` re-export). Do not reimplement
 * canonicalization elsewhere — import `canonicalizeJSON` from here.
 *
 * Ownership note (AOC Protocol Slice 1 / SAP-GAP-001..004,006,009): this
 * implementation moved here from `crypto/canonicalize.ts` (its Slice 0
 * home) with byte-identical behavior — no algorithm change, no output
 * change for any previously-valid input. It had to move because `@aoc/
 * protocol` must have zero runtime-package dependencies (see
 * `docs/release/RELEASE_CANDIDATE_READINESS.md` and the `role === 'protocol'`
 * rule in `scripts/check-version-graph.mjs`, which forbids `@aoc/protocol`
 * from depending on any `@aoc-runtime/*` package), while the new
 * `SovereignManifestV1` contract defined in `@aoc/protocol/manifest` is
 * required to canonicalize under `aoc-canonical-json/1`. Since `@aoc-
 * runtime/crypto` is a runtime package, it is architecturally free to
 * depend on `@aoc/protocol` (runtime → protocol is an allowed edge; the
 * reverse is not), so `crypto/canonicalize.ts` now re-exports this module
 * instead of the other way around. See
 * `docs/architecture/sovereign-asset-core.md` §"Canonicalization ownership".
 *
 * Repair note (P0-CANON-01): this module previously applied a trailing-zero
 * strip -- `numberString.replace(/0+$/, '')` -- to any rendered form
 * containing a `.`. The intent was to remove trailing fractional zeros. The
 * effect, for a number rendered in exponential notation, was to remove the
 * trailing zero of the EXPONENT:
 *
 *     canonicalizeJSON(7.9e-10)   ->  "7.9e-1"
 *     canonicalizeJSON(7.9e-100)  ->  "7.9e-1"
 *
 * Two values ninety orders of magnitude apart produced identical canonical
 * bytes and therefore identical cryptographic material, and neither form read
 * back as its input (`"7.9e-1"` parses as `0.79`). Found downstream by Live
 * Data Rail while consuming `@aoc/protocol@0.2.0-rc.0` and reported as UG-003.
 *
 * The step was not merely mis-scoped, it was dead for its stated purpose:
 * `Number.prototype.toString()` never emits a trailing fractional zero, so the
 * only inputs it could ever alter were the ones it corrupted. It has been
 * removed rather than narrowed. The invariant that makes the entire class of
 * defect impossible -- every finite number canonicalizes to a form that parses
 * back to itself -- is enforced by
 * `crypto/__tests__/canonicalize-numeric-fidelity.test.ts`, which is blocking.
 *
 * `-0` renders as `"0"` and is therefore not distinguishable from `0` in
 * canonical form. That is pre-existing behaviour, deliberately left unchanged:
 * altering it would change the bytes of every already-signed payload
 * containing `-0`. Making `-0` distinguishable would be a separate, breaking
 * profile decision.
 */

export const CANONICAL_JSON_PROFILE = 'aoc-canonical-json/1' as const;

export function canonicalizeJSON(value: any): string {
  if (value === null) {
    return 'null';
  }

  const valueType = typeof value;

  if (valueType === 'string') {
    return JSON.stringify(value);
  }

  if (valueType === 'number') {
    if (!Number.isFinite(value)) {
      throw new Error('Non-finite numbers are not supported in canonical JSON');
    }

    // No post-processing. `Number.prototype.toString()` is already the
    // canonical decimal form; see the P0-CANON-01 repair note in the module
    // header for what happened the last time this path did more than this.
    return value.toString();
  }

  if (valueType === 'boolean') {
    return value ? 'true' : 'false';
  }

  if (Array.isArray(value)) {
    const items = value.map((item) => canonicalizeJSON(item));
    return `[${items.join(',')}]`;
  }

  if (valueType === 'object') {
    const keys = Object.keys(value).sort();
    const pairs = keys.map((key) => {
      const keyString = JSON.stringify(key);
      const valueString = canonicalizeJSON(value[key]);
      return `${keyString}:${valueString}`;
    });
    return `{${pairs.join(',')}}`;
  }

  throw new Error(`Unsupported type in canonical JSON: ${valueType}`);
}
