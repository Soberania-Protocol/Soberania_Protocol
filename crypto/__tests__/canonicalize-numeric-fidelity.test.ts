/**
 * Numeric fidelity of `aoc-canonical-json/1` — the security regression gate.
 *
 * WHAT THIS EXISTS TO PREVENT
 *
 * Canonicalization is the substrate every hash and signature in this protocol
 * is computed over. If two distinct values can produce the same canonical
 * bytes, then two distinct values share a digest, and every integrity claim
 * built on that digest is void for those inputs.
 *
 * That is not hypothetical. `canonicalizeJSON` shipped in
 * `@aoc/protocol@0.2.0-rc.0` with exactly that defect: trailing-zero
 * normalization was applied to the whole `Number.prototype.toString()` output
 * rather than to the fractional part, so a number rendered in exponential
 * notation lost the trailing zero of its EXPONENT.
 *
 *     canonicalizeJSON(7.9e-10)   ->  "7.9e-1"
 *     canonicalizeJSON(7.9e-100)  ->  "7.9e-1"     <- same bytes, same SHA-256
 *
 * The canonical form did not round-trip either: `"7.9e-1"` parses back as
 * `0.79`, a value ninety orders of magnitude away from the input. Reported
 * downstream by Live Data Rail as UG-003.
 *
 * THE INVARIANT
 *
 * Every finite number the profile accepts must canonicalize to a form that
 * parses back to the same value. That single property makes the whole class of
 * defect impossible, not just this instance of it: any future change that
 * truncates, rounds, reformats or otherwise loses numeric information fails
 * here, whatever mechanism it uses.
 *
 * This suite is part of the normal blocking test path (`npm test`, and
 * therefore `npm run validate:release`). It must never be skipped, marked
 * `todo`, or made non-blocking.
 */
import { canonicalizeJSON } from '@aoc/protocol/canonical';
import { createHash } from 'crypto';

/** The canonical bytes, digested exactly as a signing path would. */
const digestOf = (value: unknown): string =>
  createHash('sha256').update(canonicalizeJSON(value), 'utf8').digest('hex');

/**
 * The round-trip invariant, stated once.
 *
 * `Number(...)` rather than `Object.is(...)`: the profile renders `-0` as
 * `"0"` (integers go through `Number.prototype.toString()`, and `(-0)
 * .toString()` is `"0"`). That is long-standing documented behaviour, asserted
 * by the existing golden-vector suite, and this repair does not change it.
 * `-0 === 0` is true, so `Number(canonical) === value` holds for `-0` while
 * `Object.is` would not. See the `-0` test below, which pins the rule
 * explicitly rather than leaving it implied.
 */
const roundTrips = (value: number): boolean =>
  Number(canonicalizeJSON(value)) === value;

describe('UG-003 regression: exponent digits are never truncated', () => {
  it('renders the exact reported collision pair faithfully', () => {
    expect(canonicalizeJSON(7.9e-10)).toBe('7.9e-10');
    expect(canonicalizeJSON(7.9e-100)).toBe('7.9e-100');
  });

  it('does not collide two distinct numbers into one canonical form', () => {
    expect(7.9e-10).not.toBe(7.9e-100);
    expect(canonicalizeJSON(7.9e-10)).not.toBe(canonicalizeJSON(7.9e-100));
  });

  it('does not collide their digests, which is what actually matters', () => {
    // The canonical string is an implementation detail; the digest computed
    // over it is what a signature commits to.
    expect(digestOf(7.9e-10)).not.toBe(digestOf(7.9e-100));
  });

  it('keeps the collision closed inside a document, not only at top level', () => {
    expect(canonicalizeJSON({ amount: 7.9e-10 })).toBe('{"amount":7.9e-10}');
    expect(canonicalizeJSON({ amount: 7.9e-100 })).toBe('{"amount":7.9e-100}');
    expect(digestOf({ amount: 7.9e-10 })).not.toBe(digestOf({ amount: 7.9e-100 }));
  });

  it('round-trips every explicitly reported case', () => {
    const reported = [7.9e-10, 7.9e-100, 1.5e-100, 1.25e-10, 1e-10, 2e-10, 0.79, 1e21, 1e100, 5e-324];
    for (const value of reported) {
      expect(Number(canonicalizeJSON(value))).toBe(value);
    }
  });

  it('renders each reported case as its shortest faithful form', () => {
    // Pinned as golden vectors so a future "harmless reformatting" of numbers
    // is a test failure rather than a silent change to signed bytes.
    const vectors: ReadonlyArray<readonly [number, string]> = [
      [7.9e-10, '7.9e-10'],
      [7.9e-100, '7.9e-100'],
      [1.5e-100, '1.5e-100'],
      [1.25e-10, '1.25e-10'],
      [1e-10, '1e-10'],
      [2e-10, '2e-10'],
      [0.79, '0.79'],
      [1e21, '1e+21'],
      [1e100, '1e+100'],
      [5e-324, '5e-324'],
    ];
    for (const [value, expected] of vectors) {
      expect(canonicalizeJSON(value)).toBe(expected);
    }
  });

  it('rejects any exponent-bearing form whose exponent lost a digit', () => {
    // The specific failure shape, asserted directly: an exponent ending in
    // zero must survive intact.
    const exponentEndingInZero = [1.5e-10, 1.5e-20, 1.5e-100, 2.25e-30, 3.75e-40, 9.5e-110];
    for (const value of exponentEndingInZero) {
      const canonical = canonicalizeJSON(value);
      expect(Number(canonical)).toBe(value);
      expect(canonical).toBe(value.toString());
    }
  });
});

describe('canonical numbers round-trip across the whole accepted domain', () => {
  it('holds for ordinary decimals, positive and negative', () => {
    const values = [0.1, -0.1, 3.14, -3.14, 0.79, -0.79, 1.5, -1.5, 0.1 + 0.2, 1 / 3];
    for (const value of values) expect(roundTrips(value)).toBe(true);
  });

  it('holds for integers and integer-valued numbers', () => {
    const values = [
      0, 1, -1, 42, -42, 100, 1e21, -1e21, 1e100,
      Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER,
      Number.MAX_VALUE,
    ];
    for (const value of values) expect(roundTrips(value)).toBe(true);
  });

  it('holds for very small magnitudes, including subnormals', () => {
    const values = [
      1e-7, 1e-10, 1e-20, 1e-100, 1e-300,
      Number.MIN_VALUE, 5e-324, 2.5e-323, 1.5e-310,
      -1e-10, -5e-324,
    ];
    for (const value of values) expect(roundTrips(value)).toBe(true);
  });

  it('holds for very large magnitudes', () => {
    const values = [1e21, 1e50, 1e100, 1e308, 1.7976931348623157e308, -1e308];
    for (const value of values) expect(roundTrips(value)).toBe(true);
  });

  it('holds across a deterministic sweep of every exponent the format allows', () => {
    // Mantissas chosen to include forms whose exponent ends in zero -- the
    // affected class -- at every reachable decimal exponent.
    const mantissas = [1, 1.5, 2.25, 3.75, 7.9, 9.125];
    let checked = 0;
    for (let exponent = -320; exponent <= 308; exponent++) {
      for (const mantissa of mantissas) {
        const value = Number(`${mantissa}e${exponent}`);
        if (!Number.isFinite(value) || value === 0) continue;
        expect(Number(canonicalizeJSON(value))).toBe(value);
        expect(Number(canonicalizeJSON(-value))).toBe(-value);
        checked += 2;
      }
    }
    // A sweep that silently degenerated to nothing would pass vacuously.
    expect(checked).toBeGreaterThan(3000);
  });

  it('holds across a seeded pseudo-random battery', () => {
    // Deterministic: a fuzz that cannot be reproduced is not evidence.
    let seed = 20260825;
    const next = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;

    let checked = 0;
    for (let i = 0; i < 50_000; i++) {
      const mantissa = next() * 10;
      const exponent = Math.floor(next() * 640) - 320;
      const sign = next() < 0.5 ? -1 : 1;
      const value = sign * Number(`${mantissa}e${exponent}`);
      if (!Number.isFinite(value)) continue;
      expect(Number(canonicalizeJSON(value))).toBe(value);
      checked++;
    }
    expect(checked).toBeGreaterThan(45_000);
  });

  it('holds for numbers nested inside documents, not only in isolation', () => {
    const document = {
      small: 7.9e-100,
      large: 1e308,
      list: [1.5e-10, -2.25e-30, 0.1, 42],
      nested: { deep: { value: 5e-324 } },
    };
    const canonical = canonicalizeJSON(document);
    expect(JSON.parse(canonical)).toEqual(document);
  });

  it('never emits a canonical form that JSON.parse reads as a different value', () => {
    // The general statement of the defect: canonical output is meant to BE the
    // value, in bytes. Anything JSON.parse disagrees with is ambiguous material.
    const values = [7.9e-10, 7.9e-100, 1.25e-10, 0.1, 1e21, 5e-324, -1.5e-100];
    for (const value of values) {
      expect(JSON.parse(canonicalizeJSON(value))).toBe(value);
    }
  });
});

describe('distinct numbers never share canonical bytes', () => {
  it('separates every pair in a sweep that previously collided', () => {
    // Before the repair, all of these mapped onto a handful of strings.
    const mantissas = [1.5, 2.25, 7.9, 9.125];
    const exponents = [-10, -20, -30, -100, -110, -200, -300];
    const seen = new Map<string, number>();
    for (const mantissa of mantissas) {
      for (const exponent of exponents) {
        const value = Number(`${mantissa}e${exponent}`);
        const canonical = canonicalizeJSON(value);
        const previous = seen.get(canonical);
        if (previous !== undefined && previous !== value) {
          throw new Error(
            `canonical collision: ${previous} and ${value} both render as ${canonical}`,
          );
        }
        seen.set(canonical, value);
      }
    }
    expect(seen.size).toBe(mantissas.length * exponents.length);
  });

  it('gives distinct digests to a large deterministic set of distinct values', () => {
    const digests = new Map<string, number>();
    for (let exponent = -300; exponent <= 300; exponent += 7) {
      for (const mantissa of [1.5, 7.9]) {
        const value = Number(`${mantissa}e${exponent}`);
        if (!Number.isFinite(value) || value === 0) continue;
        const digest = digestOf(value);
        const previous = digests.get(digest);
        expect(previous === undefined || previous === value).toBe(true);
        digests.set(digest, value);
      }
    }
    expect(digests.size).toBeGreaterThan(100);
  });
});

describe('the repair changed nothing outside the affected class', () => {
  it('leaves the documented golden vectors byte-identical', () => {
    // These are the values the pre-existing suite pins. Restating them here
    // makes the blast radius of the repair explicit: none of them moved.
    expect(canonicalizeJSON(42)).toBe('42');
    expect(canonicalizeJSON(-42)).toBe('-42');
    expect(canonicalizeJSON(0)).toBe('0');
    expect(canonicalizeJSON(3.14)).toBe('3.14');
    expect(canonicalizeJSON(1.5)).toBe('1.5');
    expect(canonicalizeJSON(0.1)).toBe('0.1');
    expect(canonicalizeJSON(0.1 + 0.2)).toBe('0.30000000000000004');
    expect(canonicalizeJSON(9007199254740991)).toBe('9007199254740991');
    expect(canonicalizeJSON(1e21)).toBe((1e21).toString());
  });

  it('preserves the existing -0 rule rather than inventing a new one', () => {
    // `-0` is an integer by `Number.isInteger`, so it renders via
    // `Number.prototype.toString()`, which yields "0". Negative zero is
    // therefore NOT distinguishable from positive zero in canonical form.
    //
    // That is pre-existing, documented behaviour asserted by the golden-vector
    // suite, and changing it would change the bytes of every already-signed
    // payload containing -0. This repair deliberately leaves it alone; if the
    // protocol ever wants -0 to be distinguishable, that is a separate,
    // breaking profile decision.
    expect(canonicalizeJSON(-0)).toBe('0');
    expect(canonicalizeJSON(-0)).toBe(canonicalizeJSON(0));
    expect(Object.is(-0, 0)).toBe(false);
    // The round-trip invariant still holds under `===`, which is why it is
    // stated with `Number(...) === value` and not `Object.is`.
    expect(Number(canonicalizeJSON(-0)) === -0).toBe(true);
  });

  it('renders every non-integer through Number#toString unchanged', () => {
    // The stripping step the repair removed was dead for its stated purpose:
    // `Number.prototype.toString()` already emits the shortest round-trippable
    // decimal, which never carries a trailing fractional zero. This asserts
    // that equivalence directly across a wide sweep, so the removal is
    // evidenced rather than argued.
    let seed = 424242;
    const next = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 20_000; i++) {
      const value = (next() - 0.5) * Math.pow(10, Math.floor(next() * 40) - 20);
      if (!Number.isFinite(value) || Number.isInteger(value)) continue;
      expect(canonicalizeJSON(value)).toBe(value.toString());
    }
  });

  it('never emits a trailing fractional zero or a bare trailing point', () => {
    // The behaviours the removed step was written to prevent. They cannot
    // occur, and this proves it across the sweep rather than by assertion.
    let seed = 991;
    const next = (): number => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
    for (let i = 0; i < 20_000; i++) {
      const value = (next() - 0.5) * Math.pow(10, Math.floor(next() * 60) - 30);
      if (!Number.isFinite(value)) continue;
      const canonical = canonicalizeJSON(value);
      expect(canonical.endsWith('.')).toBe(false);
      const mantissa = canonical.split('e')[0];
      if (mantissa.includes('.')) {
        expect(mantissa.endsWith('0')).toBe(false);
      }
    }
  });

  it('leaves non-numeric canonicalization untouched', () => {
    // Key ordering, strings, arrays, booleans and null are outside the repair,
    // and a numeric change that disturbed them would be a far worse defect
    // than the one being fixed.
    expect(canonicalizeJSON({ b: 1, a: 2, c: 3 })).toBe('{"a":2,"b":1,"c":3}');
    expect(canonicalizeJSON({ outer: { z: 1, a: 2 } })).toBe('{"outer":{"a":2,"z":1}}');
    expect(canonicalizeJSON([3, 1, 2])).toBe('[3,1,2]');
    expect(canonicalizeJSON('héllo 世界 🎉')).toBe(JSON.stringify('héllo 世界 🎉'));
    expect(canonicalizeJSON('a"b\\c\nd\tf')).toBe(JSON.stringify('a"b\\c\nd\tf'));
    expect(canonicalizeJSON(true)).toBe('true');
    expect(canonicalizeJSON(false)).toBe('false');
    expect(canonicalizeJSON(null)).toBe('null');
    expect(canonicalizeJSON({})).toBe('{}');
    expect(canonicalizeJSON([])).toBe('[]');
  });

  it('still refuses every unsupported value', () => {
    expect(() => canonicalizeJSON(NaN)).toThrow(
      'Non-finite numbers are not supported in canonical JSON',
    );
    expect(() => canonicalizeJSON(Infinity)).toThrow(
      'Non-finite numbers are not supported in canonical JSON',
    );
    expect(() => canonicalizeJSON(-Infinity)).toThrow(
      'Non-finite numbers are not supported in canonical JSON',
    );
    expect(() => canonicalizeJSON(undefined)).toThrow(
      'Unsupported type in canonical JSON: undefined',
    );
    expect(() => canonicalizeJSON({ a: undefined })).toThrow(
      'Unsupported type in canonical JSON: undefined',
    );
    expect(() => canonicalizeJSON([1, undefined])).toThrow(
      'Unsupported type in canonical JSON: undefined',
    );
    expect(() => canonicalizeJSON(Symbol('x'))).toThrow(
      /Unsupported type in canonical JSON: symbol/,
    );
    expect(() => canonicalizeJSON(BigInt(1))).toThrow(
      /Unsupported type in canonical JSON: bigint/,
    );
  });
});
