---
"@aoc/protocol": patch
---

Ship the frozen cross-repository integration contract as package metadata, and add a producer for the
installable release-candidate artifact (P0-PKG-01).

**No public export was added, removed or renamed.** `exports` is byte-identical to the previous
release; protocol semantics and build output are unchanged. This is a packaging and evidence change
only, hence `patch`.

PMFreak's verified Founder journey still consumes repository-local source copies
(`"@aoc/protocol": "file:src/aoc/protocol"`), which proves the code composes but proves nothing about
the three layers composing as independently packaged repositories. This closes the Protocol third of
that gap.

- **`integration-contract.json` now ships at the root of the tarball** as unexported metadata — the
  same class as `LICENSE` and `NOTICE`. It records the frozen contract
  `aoc.cross-repository-integration@1.0.0`: package identity, the complete contracted export set with
  stability classes, allowed and forbidden install forms, and the obligations a consuming repository
  takes on. A consumer reads it by path in CI (`node_modules/@aoc/protocol/integration-contract.json`)
  to verify offline that what it installed is the surface it agreed to depend on.
  `@aoc/protocol/integration-contract.json` deliberately does **not** resolve as a module specifier.
- **`npm run protocol:rc:artifact`** produces the installable candidate into the git-ignored
  `dist-rc/`: the reproducible tarball, a ready-to-vendor `protocol-consumer.lock.json` (repository,
  commit, version, SHA-256/SHA-512, npm integrity, contract version, verified export list),
  `SHA256SUMS`, and consumer install/verify instructions. It refuses to emit anything unless two
  consecutive packs are byte-identical and the contract inside the tarball matches the tree.
- **`npm run check:integration-contract`** enforces the freeze: the contract's declared export set
  must equal the package's export keys in both directions, identity fields must match
  `packages/protocol/package.json`, every contracted code export must be classified in
  `docs/protocol/PUBLIC_API.md`, and the contract must remain shipped **and remain unexported**. It
  runs inside `protocol:rc:check`, `protocol:release:check` and `validate:release`.
- **`npm run fingerprint:public-surface`** emits a deterministic digest of the export map, the
  resolved export targets and the entire build output, so "the public surface did not move" is a
  comparable value rather than a claim.
- A fourth consumer fixture (`test-consumers/contract-verification`) installs the real tarball,
  verifies the contract from a real install, resolves all contracted exports, and asserts that
  undeclared subpaths — including the contract file's own specifier — still do not resolve.

Not published. `packages/protocol/package.json` remains `"private": true`, no registry is configured,
and no tag or GitHub Release exists.
