# Supply-chain controls

This directory is the repository-owned record for dependency, license,
vulnerability, third-party-input, and publication controls. The policy is
machine-readable in [`policy.json`](./policy.json); current direct dependency
provenance is in [`dependencies.json`](./dependencies.json), distributed
assets are tracked in [`assets.json`](./assets.json), and time-bounded
exceptions are recorded in [`exceptions.json`](./exceptions.json).

The package uses the exact pnpm version in `package.json` and a frozen,
integrity-pinned `pnpm-lock.yaml`. `pnpm run supply-chain:check` validates the
static policy, inventory, lockfile, action pins, and installed license metadata.
The CI workflow additionally runs production moderate-severity and development
high-severity vulnerability audits plus npm registry signature verification.

Update proposals remain service-neutral until a separate repository
configuration is reviewed. A bot may propose only grouped manifest/lockfile
changes within the policy bounds; maintainers review compatibility evidence,
licenses, vulnerabilities, and provenance before merging. No automation may
merge updates or publish artifacts.
