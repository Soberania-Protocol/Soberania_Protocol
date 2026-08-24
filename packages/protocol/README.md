# Soberanía Protocol

`@aoc/protocol` is the versioned, public contract layer of the Soberanía Protocol architecture:

```text
Soberanía Protocol    (this package — versioned public contracts)
    ↓
Soberanía Enterprise  (proprietary implementation and runtime)
    ↓
PMFreak               (commercial vertical product)
```

## What it is

`@aoc/protocol` publishes:

- capability, consent, policy-decision, and audit-envelope contracts (`./contracts`);
- the RFC-005 claims/evidence/attestation/credential/registry/proof contract family (`./claims`);
- the public protocol error surface (`./errors`);
- adapter interfaces that runtime implementations may implement — verification, revocation,
  registry lookup, audit/security event sinks, policy and governance decisions, execution
  authorization, observability (`./adapters`);
- an in-process adapter token/registry/bootstrap toolkit used to wire adapter implementations
  into a runtime (`./runtime-registry`).
- the Sovereign Asset Core identity, byte-identity, canonical manifest, Ed25519 proof, verification,
  and storage-neutral registry contracts (`./identity`, `./canonical`, and `./manifest`).

Everything here is implementation-neutral: shapes, references, and adapter interfaces only.

## What it is not

`@aoc/protocol` is **not**:

- Soberanía Enterprise (the proprietary runtime/persistence/orchestration implementation);
- PMFreak (the commercial vertical product built on top of Enterprise);
- a hosted service, API, or network client;
- a persistence layer, database, or storage adapter;
- a billing, metering, or tenant-management system;
- a complete enterprise runtime.

Enterprise and PMFreak consume this package's public exports; this package never depends on them.

## Installation

This package is not yet published to a registry. During this packaging sprint, install it from a
locally built tarball:

```bash
npm run build --workspace @aoc/protocol
npm pack ./packages/protocol
npm install ./aoc-protocol-0.1.0.tgz
```

If a future release publishes this package to a registry, installation will be:

```bash
npm install @aoc/protocol
```

That has **not** happened yet — do not assume the name is reserved or the package is available
until a founder-approved publish decision is made (see
[`docs/release/PACKAGE_DISTRIBUTION_STRATEGY.md`](../../docs/release/PACKAGE_DISTRIBUTION_STRATEGY.md)).

## Usage

Root import (re-exports the stable `contracts` surface):

```ts
import type { CapabilityToken, ConsentGrant } from "@aoc/protocol";
```

Subpath imports:

```ts
import type { AuditEventEnvelope, CapabilityToken, ConsentGrant, ScopedAccessRequest } from "@aoc/protocol/contracts";
import { ClaimType } from "@aoc/protocol/claims";
import type { CanonicalClaim } from "@aoc/protocol/claims";
import type { ProtocolError } from "@aoc/protocol/errors";
import type { VerificationProvider, RevocationLookup } from "@aoc/protocol/adapters";
import { AdapterRegistry, AdapterTokens } from "@aoc/protocol/runtime-registry";
import { computeContentIdentity, mintSovereignAssetId, parseSovereignAssetId } from "@aoc/protocol/identity";
import { canonicalizeJSON, CANONICAL_JSON_PROFILE } from "@aoc/protocol/canonical";
import {
  buildSovereignManifestV1,
  computeManifestDigest,
  signSovereignManifest,
  verifySovereignManifest,
  resolveSovereignAsset,
} from "@aoc/protocol/manifest";
import type { SovereignAssetRegistry, SignedSovereignManifest } from "@aoc/protocol/manifest";

const registry = new AdapterRegistry();
registry.register(AdapterTokens.RevocationLookup, myRevocationLookupImpl, { implementation: "example" });
```

`ClaimType`, `AdapterRegistry`, and `AdapterTokens` are real runtime values (not type-only); most of
`contracts`, `errors`, and `adapters` are type-only and erase completely at compile time.

## Public exports

| Path | Contents | Runtime or type-only |
| --- | --- | --- |
| `@aoc/protocol` (root) | Alias of `./contracts` | Type-only |
| `@aoc/protocol/contracts` | Canonical IDs, capability token/grant, consent grant, policy decision, scoped access request, audit envelope, trust domain identifier | Type-only |
| `@aoc/protocol/errors` | Public protocol error contract surface | Type-only |
| `@aoc/protocol/claims` | RFC-005 claim/evidence/attestation/credential/registry/vocabulary contracts, plus `ClaimType`/`EvidenceType`/`AttestationType`/etc. enum objects | Mixed (enums are runtime values; contract shapes are types) |
| `@aoc/protocol/adapters` | Adapter interfaces (verification, revocation, registry, audit/security event sinks, policy/governance decision, execution authorization, observability) | Type-only |
| `@aoc/protocol/runtime-registry` | `AdapterRegistry`, `RuntimeAdapterBootstrap`, `RuntimeBootstrapEngine`, adapter tokens, and related error classes | Runtime |
| `@aoc/protocol/identity` | Independent `SovereignAssetId` minting/parsing and SHA-256 `ContentIdentity` calculation/verification | Mixed |
| `@aoc/protocol/canonical` | Deterministic `aoc-canonical-json/1` representation | Runtime |
| `@aoc/protocol/manifest` | Versioned manifests, Ed25519 signing/verification, claims, and the storage-neutral version-preserving registry port | Mixed |

See [`docs/protocol/PUBLIC_API.md`](../../docs/protocol/PUBLIC_API.md) for the full symbol-level table
and stability classification.

The tarball also ships `integration-contract.json` at its root — the frozen cross-repository
integration contract. It records this package's identity, the complete contracted export set with
stability classes, the install forms a consumer may use, and what a consumer owes in return, so a
downstream repository can verify offline that what it installed is what it agreed to depend on.

It is **package metadata, not an export** — the same class as `LICENSE` and `NOTICE`. Read it by
path from a CI verification step; `@aoc/protocol/integration-contract.json` does not resolve as a
module specifier, by design:

```js
const { readFileSync } = require('node:fs');
const { dirname, join } = require('node:path');

const root = dirname(require.resolve('@aoc/protocol/package.json'));
const contract = JSON.parse(readFileSync(join(root, 'integration-contract.json'), 'utf8'));
// contract.contractVersion === '1.0.0', contract.status === 'frozen'
```

See [`docs/integration/CROSS_REPO_INTEGRATION_CONTRACT.md`](../../docs/integration/CROSS_REPO_INTEGRATION_CONTRACT.md).

Deep imports (`@aoc/protocol/dist/...`, `@aoc/protocol/src/...`, `@aoc/protocol/internal/...`) are not
supported and are verified to fail to resolve (see `scripts/assert-invalid-imports.mjs`).

## Compatibility

- **Node.js**: `>=20` (matches the monorepo `engines` constraint and CI).
- **TypeScript**: authored and built against TypeScript `~6.0.2`; declarations are emitted with
  `strict: true`.
- **Module system**: the package declares `"type": "commonjs"` and ships CommonJS output only.
  `require("@aoc/protocol/...")` is tested directly. `import ... from "@aoc/protocol/..."` from an
  ESM consumer is also tested and works, because Node's ESM loader statically analyzes the emitted
  CommonJS named exports (`cjs-module-lexer`) — this is **not** a declared dual-package (there are no
  separate `import`/`require` export conditions), it is CJS interop. See
  [`docs/versioning-and-stability.md`](../../docs/versioning-and-stability.md) for the tested matrix.
- **Protocol/contract version**: `0.2.0-rc.0`, pre-1.0 release candidate. Breaking changes are still possible.

## Stability

- **Stable**: `@aoc/protocol/contracts` (documented stable surface since the package's inception).
- **Stable, expanding**: `@aoc/protocol/claims`, `@aoc/protocol/errors`.
- **Experimental**: `@aoc/protocol/adapters`, `@aoc/protocol/runtime-registry` — public, but newer and
  more likely to evolve as real runtime implementations (Enterprise) start consuming them.
- **Deprecated**: `Claim`/`LegacyClaim` in `./claims`, `legacy-contracts` re-exports in `./contracts`,
  and the `*Port`-suffixed adapter aliases in `./adapters` — retained for migration only, will be
  removed in a future major per [`docs/versioning-and-stability.md`](../../docs/versioning-and-stability.md).

## Protocol–Enterprise boundary

Soberanía Protocol owns semantic shapes, references, and adapter interfaces only. It never imports
Enterprise, PMFreak, persistence, transport, or observability implementations. See
[`docs/architecture/protocol-enterprise-separation-report.md`](../../docs/architecture/protocol-enterprise-separation-report.md)
and [`docs/architecture/protocol-runtime-dependency-report.md`](../../docs/architecture/protocol-runtime-dependency-report.md)
for the enforced rules and the automated tests in `__tests__/architecture/` that verify them.

## License

MIT — see [`LICENSE`](./LICENSE).
