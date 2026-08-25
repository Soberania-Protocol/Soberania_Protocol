---
"@aoc/protocol": patch
---

Fix a canonical-JSON defect that produced colliding cryptographic material for a class of numbers.

`canonicalizeJSON` applied its trailing-zero normalization — `numberString.replace(/0+$/, '')` — to
the whole `Number.prototype.toString()` output whenever that output contained a `.`. For a number
rendered in exponential notation, the trailing zero being stripped belonged to the **exponent**:

```
canonicalizeJSON(7.9e-10)   ->  "7.9e-1"
canonicalizeJSON(7.9e-100)  ->  "7.9e-1"
```

Two values ninety orders of magnitude apart produced identical canonical bytes and therefore
identical SHA-256 material. The canonical form did not round-trip either: `"7.9e-1"` parses back as
`0.79`. Any hash or signature computed over a value in this class committed to something other than
the value it was given.

The affected class is narrow — a fractional mantissa in exponential notation whose exponent ends in
`0` — which is why it survived the existing golden-vector suite: `1e-10` and `0.79` are both
unaffected, and every hand-written fixture landed outside it. It was found by Live Data Rail, which
differentially fuzzed the shipped `0.2.0-rc.0` artifact against its own independent implementation
while adopting the package, and reported it as UG-003.

The normalization step is **removed**, not narrowed. It was dead for its stated purpose:
`Number.prototype.toString()` already emits the shortest decimal string that reads back as the same
double (ECMA-262 selects the fewest digits for which `Number(s) === x`), so it never produces a
trailing fractional zero. The only inputs the step could ever alter were the ones it corrupted.
Finite numbers now render via `toString()` verbatim.

Behaviour outside the affected class is byte-identical, and this is measured rather than asserted:
the public export map (`a67d65b1…`, 15 keys) and the runtime symbol set (`53ce2a00…`, 259 symbols)
are unchanged, the full suite passes with no committed golden hash moving, and the existing numeric
golden vectors (`3.14`, `1.5`, `0.1`, `0.1 + 0.2`, `9007199254740991`, `1e21`) all still hold.

`-0` continues to render as `"0"` and remains indistinguishable from `0` in canonical form. That is
pre-existing documented behaviour, deliberately left alone: changing it would change the bytes of
every already-signed payload containing `-0`, and making `-0` distinguishable would be a separate,
breaking profile decision.

A blocking regression gate — `crypto/__tests__/canonicalize-numeric-fidelity.test.ts` — enforces the
general invariant that makes this whole class of defect impossible rather than just this instance of
it: **every finite number must canonicalize to a form that parses back to the same value.** It
covers the reported cases as golden vectors, a full sweep of every decimal exponent the format
allows, a seeded 50,000-case battery, subnormals, and explicit no-collision checks.

No publication, tag, release, or `private: false` flip. The frozen
`aoc.cross-repository-integration@1.0.0` contract and its export set are untouched. The already-
distributed `@aoc/protocol@0.2.0-rc.0` internal tarball
(`sha256:dbe8a08f…`) and its release evidence are **immutable and unmodified**: this fix changes the
source, so it must ship under a new candidate identity, which requires its own founder
authorization. See `docs/release/RELEASE_CANDIDATE_READINESS.md` §8.
