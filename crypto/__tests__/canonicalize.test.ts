/**
 * Golden-vector and negative tests for the single authoritative
 * canonicalization implementation (AOC Protocol Slice 0 / SAP-GAP-010).
 *
 * These vectors were captured by diffing this implementation against the
 * crypto engine's former inline canonicalizer before it was removed. The
 * two implementations were byte-identical for every realistic payload
 * (strings, numbers, booleans, null, nested objects/arrays, Unicode) and
 * diverged only on unsupported/edge values (undefined, non-finite
 * numbers, unsupported types) — see "unsupported values" below for the
 * behavior this implementation now enforces everywhere.
 */
import { canonicalizeJSON, CANONICAL_JSON_PROFILE } from '../canonicalize';
import { canonicalizeJSON as rootCanonicalizeJSON } from '../../canonicalize';
import { canonicalSerialize } from '../engine';

describe('canonicalizeJSON: deterministic property ordering', () => {
  it('sorts top-level keys regardless of insertion order', () => {
    expect(canonicalizeJSON({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}');
    expect(canonicalizeJSON({ c: 3, a: 2, b: 1 })).toBe('{"a":2,"b":1,"c":3}');
  });

  it('sorts nested object keys independently at each level', () => {
    const insertionOrderA = { b: { z: 1, a: 2 }, a: 1 };
    const insertionOrderB = { a: 1, b: { a: 2, z: 1 } };
    expect(canonicalizeJSON(insertionOrderA)).toBe(canonicalizeJSON(insertionOrderB));
    expect(canonicalizeJSON(insertionOrderA)).toBe('{"a":1,"b":{"a":2,"z":1}}');
  });

  it('treats two objects with same keys in different insertion order as equal canonical output', () => {
    const objA = { z: 1, a: 2, m: 3 };
    const objB = { a: 2, m: 3, z: 1 };
    expect(canonicalizeJSON(objA)).toBe(canonicalizeJSON(objB));
  });

  it('treats nested order changes as canonically equal', () => {
    const nestedA = { outer: { inner: { z: 1, a: 2 } } };
    const nestedB = { outer: { inner: { a: 2, z: 1 } } };
    expect(canonicalizeJSON(nestedA)).toBe(canonicalizeJSON(nestedB));
  });

  it('detects altered content as canonically different', () => {
    const original = { subject: 'a', value: 1 };
    const altered = { subject: 'a', value: 2 };
    expect(canonicalizeJSON(original)).not.toBe(canonicalizeJSON(altered));
  });
});

describe('canonicalizeJSON: repeatability', () => {
  it('produces identical output across repeated calls with the same input', () => {
    const input = { a: [1, 2, { b: 'x' }], c: null, d: true };
    const first = canonicalizeJSON(input);
    const second = canonicalizeJSON(input);
    const third = canonicalizeJSON(JSON.parse(JSON.stringify(input)));
    expect(first).toBe(second);
    expect(first).toBe(third);
  });
});

describe('canonicalizeJSON: nested structures', () => {
  it('canonicalizes empty objects and arrays', () => {
    expect(canonicalizeJSON({})).toBe('{}');
    expect(canonicalizeJSON([])).toBe('[]');
  });

  it('canonicalizes arrays preserving element order', () => {
    expect(canonicalizeJSON([{ b: 1, a: 2 }, { d: 1, c: 2 }])).toBe(
      '[{"a":2,"b":1},{"c":2,"d":1}]'
    );
  });

  it('canonicalizes deeply nested structures', () => {
    const deep = { a: { b: { c: { d: [1, 2, { e: 'f' }] } } } };
    expect(canonicalizeJSON(deep)).toBe('{"a":{"b":{"c":{"d":[1,2,{"e":"f"}]}}}}');
  });
});

describe('canonicalizeJSON: numeric behavior', () => {
  it('renders integers without a decimal point', () => {
    expect(canonicalizeJSON(42)).toBe('42');
    expect(canonicalizeJSON(-42)).toBe('-42');
    expect(canonicalizeJSON(0)).toBe('0');
    expect(canonicalizeJSON(-0)).toBe('0');
  });

  it('renders finite floats verbatim via Number#toString', () => {
    // Formerly titled "...with trailing-zero stripping". The stripping step was
    // removed in P0-CANON-01: `toString()` never emits a trailing fractional
    // zero, so the step could only ever alter forms it corrupted. None of the
    // vectors below moved -- see canonicalize-numeric-fidelity.test.ts.
    expect(canonicalizeJSON(3.14)).toBe('3.14');
    expect(canonicalizeJSON(1.5)).toBe('1.5');
    expect(canonicalizeJSON(0.1)).toBe('0.1');
    expect(canonicalizeJSON(0.1 + 0.2)).toBe('0.30000000000000004');
  });

  it('renders large integers, including scientific-notation magnitudes, identically to Number#toString', () => {
    expect(canonicalizeJSON(9007199254740991)).toBe('9007199254740991');
    expect(canonicalizeJSON(1e21)).toBe((1e21).toString());
  });

  it('rejects non-finite numbers deterministically instead of silently coercing to null', () => {
    expect(() => canonicalizeJSON(NaN)).toThrow('Non-finite numbers are not supported in canonical JSON');
    expect(() => canonicalizeJSON(Infinity)).toThrow('Non-finite numbers are not supported in canonical JSON');
    expect(() => canonicalizeJSON(-Infinity)).toThrow('Non-finite numbers are not supported in canonical JSON');
    expect(() => canonicalizeJSON({ a: NaN })).toThrow('Non-finite numbers are not supported in canonical JSON');
  });
});

describe('canonicalizeJSON: Unicode behavior', () => {
  it('preserves and correctly escapes Unicode strings', () => {
    expect(canonicalizeJSON('héllo 世界 🎉')).toBe(JSON.stringify('héllo 世界 🎉'));
  });

  it('escapes control characters and quotes like JSON.stringify', () => {
    const value = 'a"b\\c\nd\tf';
    expect(canonicalizeJSON(value)).toBe(JSON.stringify(value));
  });
});

describe('canonicalizeJSON: booleans and null', () => {
  it('renders booleans and null as literals', () => {
    expect(canonicalizeJSON(true)).toBe('true');
    expect(canonicalizeJSON(false)).toBe('false');
    expect(canonicalizeJSON(null)).toBe('null');
  });
});

describe('canonicalizeJSON: undefined and unsupported-value negative tests', () => {
  it('rejects top-level undefined', () => {
    expect(() => canonicalizeJSON(undefined)).toThrow('Unsupported type in canonical JSON: undefined');
  });

  it('rejects undefined as an object property value rather than silently dropping the key', () => {
    expect(() => canonicalizeJSON({ a: 1, b: undefined })).toThrow(
      'Unsupported type in canonical JSON: undefined'
    );
  });

  it('rejects deeply nested undefined', () => {
    expect(() => canonicalizeJSON({ a: { b: { c: undefined } } })).toThrow(
      'Unsupported type in canonical JSON: undefined'
    );
  });

  it('rejects undefined array elements rather than silently coercing to null', () => {
    expect(() => canonicalizeJSON([1, undefined, 2])).toThrow(
      'Unsupported type in canonical JSON: undefined'
    );
  });

  it('rejects functions and symbols', () => {
    expect(() => canonicalizeJSON(function foo() {})).toThrow(/Unsupported type in canonical JSON: function/);
    expect(() => canonicalizeJSON(Symbol('x'))).toThrow(/Unsupported type in canonical JSON: symbol/);
  });

  it('rejects bigint', () => {
    expect(() => canonicalizeJSON(BigInt(10))).toThrow(/Unsupported type in canonical JSON: bigint/);
  });

  it('fails deterministically (throws) rather than producing ambiguous output for every unsupported vector', () => {
    const unsupported: unknown[] = [undefined, NaN, Infinity, -Infinity, Symbol('x'), BigInt(1)];
    for (const value of unsupported) {
      expect(() => canonicalizeJSON(value)).toThrow();
    }
  });
});

describe('canonicalizeJSON: cross-module equivalence', () => {
  it('is the exact same function whether imported from crypto/canonicalize or the root re-export', () => {
    expect(rootCanonicalizeJSON).toBe(canonicalizeJSON);
  });

  it('produces output identical to the crypto engine canonicalSerialize path', () => {
    const payload = { z: 1, a: { nested: true, values: [1, 2, 3] }, m: 'text' };
    expect(canonicalSerialize(payload)).toBe(canonicalizeJSON(payload));
  });

  it('exposes a stable, documented canonicalization profile identifier', () => {
    expect(CANONICAL_JSON_PROFILE).toBe('aoc-canonical-json/1');
  });
});
