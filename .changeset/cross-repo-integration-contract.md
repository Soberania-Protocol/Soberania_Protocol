---
"@aoc/protocol": minor
---

Ship the frozen cross-repository integration contract inside the package, and add a producer for the
installable release-candidate artifact (P0-PKG-01).

PMFreak's verified Founder journey still consumes repository-local source copies
(`"@aoc/protocol": "file:src/aoc/protocol"`), which proves the code composes but proves nothing about
the three layers composing as independently packaged repositories. This closes the Protocol third of
that gap.

- **New export `@aoc/protocol/integration-contract.json`** (additive; nothing removed or renamed) —
  the frozen contract `aoc.cross-repository-integration@1.0.0`: package identity, the complete
  contracted export set with stability classes, allowed and forbidden install forms, and the
  obligations a consuming repository takes on. It ships inside the tarball, so a downstream
  repository can verify offline that what it installed is the surface it agreed to depend on.
- **`npm run protocol:rc:artifact`** produces the installable candidate into the git-ignored
  `dist-rc/`: the reproducible tarball, a ready-to-vendor `protocol-consumer.lock.json` (repository,
  commit, version, SHA-256/SHA-512, npm integrity, contract version, verified export list),
  `SHA256SUMS`, and consumer install/verify instructions. It refuses to emit anything unless two
  consecutive packs are byte-identical and the contract inside the tarball matches the tree.
- **`npm run check:integration-contract`** enforces the freeze: the contract's declared export set
  must equal the package's export keys in both directions, identity fields must match
  `packages/protocol/package.json`, every contracted code export must be classified in
  `docs/protocol/PUBLIC_API.md`, and the contract must remain shipped. It runs inside
  `protocol:rc:check`, `protocol:release:check` and `validate:release`.
- A fourth consumer fixture (`test-consumers/contract-verification`) installs the real tarball,
  verifies the contract from `node_modules`, resolves all sixteen contracted exports, and asserts
  that undeclared subpaths still do not resolve.

Not published. `packages/protocol/package.json` remains `"private": true`, no registry is configured,
and no version was cut — publication stays founder-gated.
