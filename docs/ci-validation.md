# Continuous-integration validation

The repository uses the same frozen package commands locally and in GitHub
Actions. Pull requests and pushes to the protected `main` branch run
deterministic quality gates on Node 22.23.2 and 24.19.0 on Ubuntu 24.04, plus
secure-loopback Playwright smoke on Chromium and Firefox with virtual-media
launch settings.

## Reproduce the pull-request gates locally

Use the pinned Node and pnpm versions from `mise.toml` and install exactly the
lockfile contents:

```sh
pnpm install:frozen
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit:coverage
pnpm build
pnpm package:check
pnpm run validate:lifecycle
```

Install the Playwright browsers once before running browser smoke:

```sh
pnpm exec playwright install chromium firefox
pnpm build
pnpm test:browser:smoke
```

`pnpm test:browser:smoke` runs Chromium and Firefox. To run one project, set
`BROWSER_PROJECT=chromium` or `BROWSER_PROJECT=firefox`. The browser fixture
serves the built package over secure loopback, checks secure-context and media
capability exposure, and verifies that the package remains SSR-safe and
reports its currently unsupported processing foundation explicitly. It does
not claim physical-device quality or a production media implementation.

## Matrix and cadence

`.github/workflows/ci.yml` is the pull-request and protected-branch workflow.
Its quality matrix is Node 22.23.2 and 24.19.0 on Ubuntu 24.04; the browser
matrix runs Chromium and Firefox on every pull request and main branch push.
`pnpm/action-setup` provisions exactly pnpm 11.21.0 before
`actions/setup-node` resolves its pnpm cache, and all installs use
`--frozen-lockfile --ignore-scripts`.

`.github/workflows/browser-matrix.yml` runs weekly and on manual dispatch. It
runs Chromium and Firefox on Ubuntu 24.04, Microsoft Edge on Windows 2022,
and Playwright WebKit on macOS 14. WebKit is a periodic proxy signal and is
not native Safari evidence. Native Safari, Android Chrome, iOS Safari,
physical camera/microphone behavior, accessibility technology, interruption,
thermal behavior, and long endurance remain scheduled reference-device or
release-manual evidence as described by the Cross-Browser Verification
Strategy.

## Failure handling and diagnostics

Playwright uses one bounded retry only in CI, serial workers, and a 30-second
test timeout. Workflow jobs have explicit 20-, 25-, or 35-minute limits and
cancel superseded runs for the same ref. A retry does not hide a deterministic
failure: the final job remains failed and the report retains the raw retry
result. Quality coverage, package artifacts, Playwright JSON/HTML reports,
traces, screenshots, and videos are uploaded when present with 14-day
retention for pull-request jobs and 30-day retention for the periodic matrix.

All workflows grant only `contents: read`, persist no checkout credentials,
and provide no secrets to verification jobs. Every action is pinned to a
full commit SHA and recorded in `supply-chain/policy.json`; dependency caches
are keyed by the lockfile and runtime through `actions/setup-node`. Browser
binaries are installed afresh so a stale browser cache cannot turn an
unverified version into a pass.
