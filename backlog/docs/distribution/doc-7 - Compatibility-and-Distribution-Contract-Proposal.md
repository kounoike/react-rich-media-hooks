---
id: doc-7
title: Compatibility and Distribution Contract Proposal
type: specification
created_date: '2026-08-20 15:31'
updated_date: '2026-08-20 15:41'
tags:
  - compatibility
  - distribution
  - contract
  - proposal
---
# Compatibility and Distribution Contract Proposal

Status: Proposal for explicit user review; not an accepted compatibility, distribution, dependency, release, public API, or architecture decision.

Date: 2026-08-21 (Asia/Tokyo)

Task: TASK-1.8 — Define the compatibility and distribution contract

## Authority and evidence boundary

The accepted product boundary is decision-1 / [Initial Product and Quality Contract](../product/initial-product-quality-contract/doc-1 - Initial-Product-and-Quality-Contract.md). The accepted public API and resource-lifecycle boundary is decision-2 / [Public API and Resource-Lifecycle Contract](../api/doc-6 - Public-API-and-Resource-Lifecycle-Contract.md). This proposal consumes those decisions and does not rewrite, supersede, or extend them.

The proposal is also informed by:

- [Public API Ecosystem Prior Art](../api/doc-2 - Public-API-Ecosystem-Prior-Art.md) (TASK-1.16);
- [Media Output and Transport Interoperability](../research/media/doc-3 - Media-Output-and-Transport-Interoperability.md) (TASK-1.17);
- [Capture Lifecycle Experiment Findings](../experiments/capture-lifecycle/doc-4 - Capture-Lifecycle-Experiment-Findings.md) (TASK-1.3);
- [Cross-Browser Verification Strategy](../verification/doc-6 - Cross-Browser-Verification-Strategy.md) (TASK-1.6);
- [Browser Video-Processing Feasibility](../research/video/doc-5 - Browser-Video-Processing-Feasibility.md) (TASK-1.4);
- [Browser Audio Processing Feasibility](../research/media/doc-5 - Browser-Audio-Processing-Feasibility.md) (TASK-1.5);
- the browser capability and support-risk record in TASK-1.2.

Words such as “must”, “should”, and “may” below describe the proposal submitted for approval. They do not make a choice accepted. No implementation, package bootstrap, CI gate, dependency, release workflow, or public compatibility claim may treat this proposal as normative until the user explicitly approves it and the approved choice is recorded in a Backlog.md Decision.

The repository currently contains a private pnpm package shell, experiments, lifecycle scripts, and Backlog records, but no production package entry points, build output, or publish metadata. This contract therefore specifies consumer-visible obligations before selecting build tooling.

## Contract goals and non-goals

The proposed distribution must let a consumer:

1. install a small base package for capture and lifecycle use without downloading optional effect models or runtimes;
2. import the accepted session/controller and React adapter safely in a hydrated SSR application;
3. use standard MediaStreamTrack and MediaStream outputs with previews and application-owned downstream adapters;
4. opt into first-party video and audio effects without importing unused effect code or assets;
5. run a supported effect path only after a real capability/configuration check succeeds in the actual browser context;
6. self-host or pre-cache optional workers, worklets, WebAssembly, and model assets when CSP, offline, or enterprise hosting rules require it;
7. identify the exact package, runtime, and asset versions used by a running processor;
8. distinguish stable lifecycle/type contracts from experimental processor backends and model behavior.

This contract does not add WebRTC signaling, recording/transcoding/storage, cloud media processing, React Native, Node-side media processing, arbitrary user-supplied ML/plugin guarantees, or a first-release mobile guarantee. It does not select a bundler, compiler, model, inference runtime, worker placement, GPU backend, processing order, or CDN provider.

## 1. Proposed support and maintenance policy

### 1.1 Environment matrix

The following is the recommended support policy for user review. A row is supported only after the exact version, OS/device, security context, execution context, capability configuration, lifecycle, output handoff, fallback, and cleanup checks pass. Constructor or interface presence alone is never support evidence.

| Area | Proposed supported environment | Required behavior | Boundary and evidence status |
| --- | --- | --- | --- |
| React | React 18.2 and React 19; development Strict Mode is supported and tested | Render remains pure; hooks read stable snapshots; media starts only after hydration and explicit application action; mount, rerender, unmount, and Strict Mode cleanup are idempotent | Accepted in decision-1 and decision-2; exact peer range remains an approval question |
| React adapter | Current React DOM web applications using the accepted thin adapter | The adapter uses a framework-neutral session/controller and an SSR-capable server snapshot; it does not own hardware merely because a component mounted | Accepted semantic direction; exact export names remain implementation-reviewable |
| TypeScript | Proposal: TypeScript 5.2 and newer, with declarations tested against the minimum and current supported compiler | Public declarations use stable, documented types; no private implementation types leak through an entry point; DOM media types are declared explicitly | Minimum compiler and declaration-generation configuration require approval with TASK-1.9 |
| SSR/import | Proposal: Node 20 and Node 22 active/maintenance LTS fixtures, plus equivalent server runtimes that provide standard module evaluation but no DOM/media objects | Root and supported subpath imports evaluate without window, document, navigator.mediaDevices, AudioContext, Worker, WebAssembly, model fetch, or permission prompts; inert server rendering is deterministic | Node is an SSR execution fixture, not a server-side media-processing guarantee; exact Node floor requires approval |
| Chrome desktop | Current stable and the previous stable major on the approved desktop OS matrix | Capture and the approved effect fallback/path pass secure-context, lifecycle, output, and cleanup checks | Chrome 151.0.7922.137 was observed locally in Window; that exact probe is not a release-wide guarantee |
| Edge desktop | Current stable and previous stable major on a supported Windows runner | Edge is tested independently; Chromium similarity is not substituted for an Edge result | No Edge binary/runner is present in this worktree; status remains unknown until tested |
| Firefox desktop | Current stable and previous stable major on the approved desktop OS matrix | Browser-specific capability gates and rendered-output/audio fallbacks are exercised where raw transform paths are absent | Firefox 153.0.3/153.0.4 probes are recorded locally; exact release support remains approval-bound |
| Safari desktop | Current stable and previous stable major on the approved macOS runner | WebKit behavior, interruption, output handoff, asset loading, and cleanup are tested on exact Safari builds | No Safari runner is present in this worktree; status remains unknown until tested |
| Mobile browsers | Feasibility/manual evidence only for initial release | Mobile evidence may inform later promotion but does not create a support guarantee, performance promise, or release gate | Consistent with accepted decision-1; promotion requires a new explicit scope decision |
| Security context | HTTPS or a trustworthy loopback origin for browser media; no promise for file/data origins | getUserMedia, Web Audio, and relevant workers/effects fail with an observable capability/policy category when the context is not eligible | Secure Contexts and Permissions Policy are runtime conditions, not install-time browser checks |
| Iframe context | Top-level documents and explicitly authorized same-origin/cross-origin frames when the release matrix includes them | Camera/microphone Permissions Policy and iframe allow attributes are configured by the host; a denied frame is not silently treated as a browser defect | Exact iframe rows and policy headers require release evidence |
| Worker context | Only a worker path whose constructors, transfer, queue, output, and cleanup checks pass in that browser | Window capability does not imply DedicatedWorker capability; a missing worker path selects an approved fallback or an observable unsupported/degraded result | Chrome 151 exposed legacy raw-track names in Window but none of the tested raw-track constructors in a worker; Firefox exposed none in either tested context |

The initial browser support hypothesis comes from decision-1 and doc-1. The current local evidence proves only the dated Chrome and Firefox observations above; Edge and Safari are explicitly unverified. TASK-1.6 requires exact browser, OS/device, flags, context, secure policy, fixture, and fallback evidence before a support row is promoted.

### 1.2 Maintenance rules

The proposed maintenance window is current stable plus one previous stable major for each supported desktop engine, with the exact release/build recorded in the versioned matrix. A browser row is refreshed when a supported engine releases a major version, when a security or media behavior change is material, and before each release candidate. Scheduled checks may run more often than the support window.

The following maintenance rules are proposed:

- A supported row is pass, fail, unknown, or blocked; unavailable runners never become an implied pass.
- A row that fails a deterministic lifecycle, SSR, output, or cleanup invariant blocks support until fixed or explicitly removed.
- A browser-specific missing optional capability may pass only when the documented fallback meets its own contract and the result is recorded.
- Removing a previously supported browser, React, TypeScript, or SSR runtime range is a breaking contract change and requires a major release, unless the user explicitly approves a documented exception tied to vendor end-of-life.
- Adding a supported environment is a minor release or documentation correction when it introduces no breaking API behavior; it still requires evidence.
- Release claims name the exact tested minimum and current build rather than saying “all modern browsers.”
- Mobile, hardware acceleration, background-tab always-on operation, and physical sensor quality remain outside the initial guarantee unless separately promoted.

The exact browser minimums, release cadence, React peer upper bound, TypeScript minimum, Node SSR fixture floor, and whether one or two previous browser majors are retained are unresolved approval questions.

## 2. Proposed package shape and entry points

### 2.1 Entry-point proposal

The package is expected to remain named react-rich-media-hooks. The following explicit subpaths are a proposed shape; names are illustrative until approved and implemented:

| Subpath | Proposed role | Loading and stability rule |
| --- | --- | --- |
| . | Stable React-facing entry point plus the accepted session/controller types that are intended for normal React consumers | Must be SSR-safe at evaluation; must not fetch or initialize media, effects, models, workers, or worklets |
| ./core | Stable framework-neutral session/controller and lifecycle contracts for non-React adapters and tests | Must have no React runtime dependency and must remain browser-inert until an action is invoked |
| ./effects/video | Optional first-party video effect factories and capability/state types | Imported explicitly; must not load models/WASM until an effect is created or started |
| ./effects/audio | Optional first-party audio effect factories and capability/state types | Imported explicitly; must not create AudioContext/AudioWorklet or load models until an effect is created or started |
| ./assets | Versioned asset manifest/resolver helpers, only if the approved asset strategy needs a public helper | Must expose hashes, versions, URLs, and requirements without fetching at import |
| ./package.json | Package metadata for tooling that explicitly needs it | Read-only metadata; no runtime side effect |
| ./internal/* and unlisted paths | No public contract | Must not be importable through the export map or a published-file promise |

The root may re-export selected stable core and React symbols for ergonomics, but it must not turn optional effects into mandatory root dependencies. Exact root composition and subpath names remain approval questions. A future generic processor/plugin surface is not implied.

### 2.2 Conditional exports and type exposure

The recommended package metadata is ESM-first with explicit conditions for TypeScript and CommonJS interoperability. A representative, non-final export map is:

~~~json
{
  "type": "module",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "default": "./dist/index.js"
    },
    "./core": {
      "types": "./dist/core/index.d.ts",
      "import": "./dist/core/index.js",
      "require": "./dist/core/index.cjs",
      "default": "./dist/core/index.js"
    },
    "./effects/video": {
      "types": "./dist/effects/video/index.d.ts",
      "import": "./dist/effects/video/index.js",
      "require": "./dist/effects/video/index.cjs",
      "default": "./dist/effects/video/index.js"
    },
    "./effects/audio": {
      "types": "./dist/effects/audio/index.d.ts",
      "import": "./dist/effects/audio/index.js",
      "require": "./dist/effects/audio/index.cjs",
      "default": "./dist/effects/audio/index.js"
    },
    "./package.json": "./package.json"
  }
}
~~~

This is a proposal, not permission to publish these names. The implementation and package bootstrap must verify:

- every public subpath has an emitted ESM file and declaration file;
- the types condition is available to modern TypeScript and bundlers before runtime conditions;
- CommonJS consumers either receive a tested wrapper or the package is explicitly declared ESM-only; no accidental dual-package resolution is allowed;
- legacy main, module, or typesVersions compatibility fields are added only when their behavior is tested and they do not bypass the export map;
- declaration files expose stable semantic state, operation, error, ownership, and standard media-output types without internal worker/model types;
- the package can be imported from ESM, CommonJS, a TypeScript consumer, a bundler, and an SSR process with no browser globals;
- optional effect modules are not reachable through an unbounded wildcard that defeats file boundaries or makes tree-shaking claims unverifiable.

The base contract uses standard DOM media types such as MediaStream, MediaStreamTrack, AudioContext-related state, and browser capability records. A TypeScript consumer compiling media consumers therefore needs the DOM library in its tsconfig; the runtime package must not assume that DOM objects exist during server evaluation.

### 2.3 Module interoperability alternatives

| Option | Advantages | Costs and risks | Proposal status |
| --- | --- | --- | --- |
| ESM-only exports | Smallest build/test surface, best alignment with modern browser bundlers, avoids dual-package hazard | Breaks older CommonJS test/build consumers and some server tooling; requires migration guidance | Viable alternative; not selected |
| ESM-first plus explicit CJS wrappers | Broad React ecosystem compatibility while keeping ESM tree-shaking primary; each condition can be tested | More output files, wrapper maintenance, and risk of divergent CJS/ESM behavior | Leading proposal; requires approval |
| Separate core/React packages with one module format each | Clear dependency ownership and smaller installs per package | More package/version alignment and discovery burden; can fragment the accepted public contract | Viable alternative; not selected |
| Legacy main/module fields without exports | Familiar to old tools | Ambiguous resolution, weak subpath/file protection, and poorer SSR/asset guarantees | Rejected for this proposal |

The recommendation is ESM-first with explicit, behaviorally equivalent CJS wrappers for stable entry points if the supported consumer matrix demonstrates a meaningful CommonJS need. This recommendation is approval-bound.

### 2.4 Tree-shaking and side effects

The proposal requires:

- production ESM modules to be statically analyzable and tree-shakeable;
- root/core import to contain only lifecycle/controller code and types, not effect algorithms, model bytes, WASM, worker code, worklet registration, or asset fetch;
- optional effects to be imported from explicit subpaths and initialized lazily;
- no module-level permission request, media-device enumeration, AudioContext, worker, WebAssembly compile, model fetch, telemetry, polyfill, or global registration;
- explicit factory/action calls for any observable work;
- package metadata to use sideEffects: false only after verifying that all emitted modules are safe under that declaration; if an asset loader must execute an import-time side effect, it must be isolated and listed rather than hidden behind a blanket claim;
- tree-shaking fixtures to compare a capture-only consumer, a video-effect consumer, and an audio-effect consumer, with compressed JavaScript and optional assets reported separately;
- dynamic imports to be visible in the effect entry points so bundlers can split code without guessing at arbitrary file paths.

This side-effect policy is consistent with doc-1’s capture-only and optional-asset budgets. It does not guarantee that a specific bundler will optimize every application; it defines what the package must expose for a supported bundler to do so.

### 2.5 Peer and runtime dependencies

The proposal is intentionally conservative:

- react is the only mandatory runtime peer for the React-facing entry point, proposed as >=18.2.0 <20.0.0; the exact upper bound requires approval and React 19 fixture validation.
- ./core has no React runtime peer or dependency.
- react-dom is not a runtime peer of the headless library; application frameworks own rendering and hydration. It may be a development dependency of fixtures.
- React and TypeScript declaration packages are development/test inputs unless a package bootstrap review proves a peer declaration is necessary for the published type surface.
- The base package has no mandatory ML, WebAssembly, worker, worklet, GPU, codec, telemetry, or cloud runtime dependency.
- Optional feature runtimes or asset packages must be declared by the exact optional entry point that uses them, with version, license, provenance, integrity, and update ownership documented. They must not appear as hidden transitive requirements of the base import.
- No package install script may download models, WASM, browsers, or other executable assets. Any optional asset install/copy step must be explicit, reproducible, and reviewed under the dependency/supply-chain task.
- Peer dependency warnings are not a compatibility policy. A supported React range must be exercised in a consumer fixture and in SSR/Strict Mode checks.

The React peer range, declaration-package publication strategy, and whether optional runtimes are companion packages, optional dependencies, or application-supplied loaders are unresolved approval questions.

### 2.6 Published-file boundary

The proposed npm tarball allowlist is:

- dist/** emitted JavaScript, declarations, and any intentionally published source maps;
- explicitly versioned optional asset directories or companion-asset package files, only when the user approves in-package assets;
- README.md;
- LICENSE, NOTICE, and other required third-party attribution files;
- CHANGELOG.md;
- package.json.

The tarball must exclude:

- repository source, tests, fixtures, experiments, Backlog tasks/docs/decisions, CI files, development scripts, browser binaries, local probes, training corpora, raw model checkpoints, credentials, lockfiles, editor files, and package-manager caches;
- private implementation entry points not listed in exports;
- unversioned worker/worklet/model/WASM files;
- any executable or data file whose license, hash, provenance, or runtime contract is not recorded.

Source maps are optional and require an explicit release decision because they improve debugging while exposing source and increasing package size. The package must use a positive files allowlist and a pnpm pack --dry-run/tarball inspection check; an accidental file inclusion is a release failure.

## 3. Browser-only behavior and SSR-safe imports

### 3.1 Import and construction rules

Every supported root and subpath import must be safe in an environment with no window, document, navigator, mediaDevices, MediaStream, AudioContext, Worker, OffscreenCanvas, WebAssembly, fetch, or permission APIs. Module evaluation must not:

- read browser globals in a way that throws on the server;
- request permission or enumerate devices;
- construct a MediaStream, track, AudioContext, worker, worklet, canvas, GPU object, model, or runtime;
- fetch an asset or load a remote URL;
- register global event listeners or mutate browser globals;
- emit telemetry or inspect media input.

The framework-neutral session/controller may be constructed inertly on a server if that is useful to SSR applications. Its server snapshot must be stable and deterministic. Browser-required operations invoked in a non-browser environment must return a documented unsupported/inactive result or a typed error without probing unrelated globals. They must not silently switch to Node media processing.

### 3.2 Hydration and explicit activation

The React adapter must use a stable server snapshot and a browser snapshot that can transition after hydration without a hydration mismatch. Render reads state; user actions or explicitly documented client effects invoke capture/effect actions. A component mount, provider mount, subscription, or Strict Mode probe is not sufficient permission to start hardware.

The proposed lifecycle is:

1. server render imports the package and reads an inert snapshot;
2. hydration attaches the React subscription and keeps resources idle;
3. an application-owned event or explicit action calls start/configuration;
4. the controller performs secure-context, Permissions Policy, capability, and configuration checks in the actual browser context;
5. capture and processors acquire resources, publish loading/active/degraded/failed state, and expose standard outputs;
6. stop/dispose and stale-operation invalidation release only controller-owned resources.

SSR-safe import does not mean that media processing works on the server. It means server evaluation and rendering are safe and observable.

### 3.3 Browser capability and policy checks

A supported path must feature-test the actual execution context and then run a minimal operational check. The check should cover:

- secure context and browser permission/policy state;
- mediaDevices/getUserMedia availability and selected constraints;
- Permissions Policy for top-level and iframe contexts;
- exact Window versus DedicatedWorker constructor and transfer exposure where relevant;
- codec/adapter configuration, not just constructor presence;
- output track/stream creation and consumer handoff;
- queue/backpressure, cancellation, and cleanup.

The capability result must be versioned and observable. An absent raw-track transform constructor may select a rendered-output or original-media fallback; it must not make the package claim that all video processing is unsupported. A path that is present but fails operationally is unsupported for that row until the fallback is validated.

### 3.4 Secure context, Permissions Policy, and application ownership

The host application is responsible for serving capture pages from HTTPS or a trustworthy loopback origin and for configuring permissions. The proposal documents:

- top-level pages that use camera/microphone should be served with the appropriate Permissions Policy, for example camera=(self), microphone=(self);
- cross-origin iframes require an explicit header policy plus matching iframe allow="camera; microphone" attributes;
- a policy denial is surfaced as an observable denied/unsupported capability result and never retried in a loop;
- device IDs, permission state, visibility, and browser lifecycle can change; an earlier successful call is not a permanent capability grant;
- media output assignment to a preview, recorder, or future transport adapter does not transfer ownership; the controller stops only resources it acquired or created under the accepted decision-2 contract.

## 4. Optional runtime assets and distribution

### 4.1 Asset classes and alignment

Optional runtime assets include:

- module workers for video processing or model inference;
- AudioWorklet modules and any associated worker code;
- WebAssembly binaries and JavaScript glue/runtime files;
- video segmentation, face-detection, tracking, or other model files;
- audio noise-reduction model files;
- first-party replacement-image or effect support files when the package intentionally supplies them.

Every asset used by a published effect must be described by a versioned manifest containing at least:

| Field | Requirement |
| --- | --- |
| Package/effect version | Must identify the compatible library major and asset release |
| Asset kind | worker, worklet, wasm, model, runtime, or other explicit class |
| URL/path | Must be deterministic and configurable; no hidden network endpoint |
| Content hash/integrity | SHA-256 or an equivalent release-approved integrity record |
| Byte size | Compressed and uncompressed size where useful for budgets |
| License/provenance | Source, license, attribution, and update owner |
| Requirements | Browser/context, secure context, isolation, codec, or feature gates |
| Fallback | Original-media, bypass, degraded, unsupported, or fail-closed behavior |
| Cache identity | Immutable content-addressed or versioned cache key |

The running code must verify package/asset compatibility before attaching a worker, worklet, model, or runtime. A mismatch must produce a typed asset-version/integrity failure and must not be silently used. Worker/worklet/runtime/model changes that alter quality, startup, memory, or output behavior require a release note and the same evidence class as code changes.

The base package must not fetch any optional asset on import. An effect may lazy-load its asset only after explicit effect activation and capability checks. Asset loading is distinct from media transfer: the default remains local/on-device processing with no media upload or telemetry.

### 4.2 Hosting and packaging alternatives

| Strategy | Benefits | Costs and risks | Proposal status |
| --- | --- | --- | --- |
| Include versioned assets in the main package | Simple package-relative URLs; works with an offline install; one version to inspect | Large install for capture-only consumers; npm tarball/cache cost; bundler URL and CSP behavior vary | Viable alternative; not selected |
| Publish companion versioned asset packages | Keeps the base install small; assets can be installed only for selected effects; package integrity is inspectable | Multiple package versions and licenses must align; app bundlers still need a URL/public-path strategy | Leading proposal; requires approval |
| Application-hosted assets with explicit URLs | Best fit for strict CSP, offline pre-cache, enterprise mirrors, and custom cache policy | Consumer must copy/serve assets, keep versions aligned, configure URLs, and preserve integrity headers | Leading proposal; requires approval |
| CDN default | Small install and shared cache; convenient for examples | Network availability, privacy, CORS/CSP, supply-chain, cache invalidation, and offline failures; can surprise SSR/enterprise deployments | Not recommended as a default |
| Runtime download from an undocumented endpoint | Minimal package metadata | Violates deterministic distribution, CSP, offline, privacy, provenance, and release alignment requirements | Rejected |

The recommended distribution contract supports companion asset packages or application-hosted assets, selected explicitly by the application, and does not require a third-party CDN. A package-relative default may be offered only if its URL, manifest, integrity, cache policy, and bundler behavior are documented. No offline guarantee is made unless the application or package installation provisions the exact assets locally.

### 4.3 Worker, worklet, WASM, and model loading constraints

The following constraints are proposed:

- Worker and worklet code must use explicit module/classic semantics and a documented URL resolution mechanism; bundler helpers may generate URLs, but the public contract cannot rely on an undocumented bundler transformation.
- A worker must have bounded queues, observable cancellation, frame/AudioData closure, and deterministic termination. Window support never implies worker support.
- An AudioWorklet module must be loaded only as part of an explicit audio-effect activation; the contract exposes loading, suspension, processor error, bypass, and cleanup states. AudioContext close is terminal and must not be hidden behind a React unmount.
- WebAssembly loading must support the approved runtime’s CSP and CORS requirements. If streaming compilation is unavailable or blocked, a documented fetch/compile fallback may be used; compile failures become an asset/runtime failure with original-media fallback where possible.
- Model files must be immutable/versioned, integrity checked, licensed, and loaded only after explicit activation. The package does not promise model availability from a network at runtime.
- A threaded WASM or SharedArrayBuffer optimization is optional and must be gated by cross-origin isolation. The no-isolation path must remain available if the effect contract promises that fallback.
- No install or import path may execute arbitrary downloaded JavaScript or use eval-like code generation unless a separately approved runtime requires it and the CSP/security contract explicitly names it.
- A failed optional effect must not take down unrelated capture or the other media kind. Video and audio assets have independent loading, retry, bypass, and disposal domains.

### 4.4 CSP, CORS, isolation, and offline requirements

The package documentation must publish a deployment matrix, not merely say “configure your CSP”:

| Deployment concern | Proposed requirement |
| --- | --- |
| Page script | script-src must allow the application and any explicitly self-hosted module assets; no hidden remote script source |
| Worker | worker-src must allow the chosen worker URL/origin; older browser fallback directives are documented only if tested |
| AudioWorklet | The worklet URL must be permitted by the browser’s script/worklet policy; failure is observable and does not loop |
| WASM | If the selected runtime requires wasm-unsafe-eval or an equivalent policy, that requirement is explicit; a no-code-generation fallback is preferred |
| Asset fetch | connect-src must allow only the application’s configured asset origin; default credentials are not sent cross-origin |
| Model/runtime CORS | Cross-origin assets require an explicit CORS response for the application origin and a stable cache policy; same-origin hosting is the simplest default |
| User assets | Background images or media used in a rendered-output path must satisfy img-src/media-src, CORS, and origin-clean canvas rules |
| Media permission | HTTPS/loopback plus camera/microphone Permissions Policy and iframe allow attributes where applicable |
| Cross-origin isolation | COOP/COEP and crossOriginIsolated are required only for an explicitly selected threaded/SAB path; they are not a default package requirement |
| Offline | Applications that need offline behavior pre-install or pre-cache the exact asset manifest; an unavailable asset causes a documented bypass/degraded result, not a cloud fallback |
| Integrity | Published or mirrored assets carry release-approved hashes/manifest data; a changed asset under the same version is a distribution failure |

The proposal recommends no default CDN, no hidden telemetry, no media upload, no cross-origin credentials, and no mandatory COOP/COEP. These recommendations preserve the local-first privacy boundary and the embedding/authentication compatibility concerns recorded in TASK-1.2 and the feasibility reports.

## 5. Stability and versioning

### 5.1 Stable versus experimental surface

The proposal divides the contract as follows:

| Surface | Proposed stability | What consumers may rely on |
| --- | --- | --- |
| Root/core import safety, SSR snapshot behavior, React peer range, entry-point names once approved | Stable | No browser work at import; documented server behavior; compatibility and module rules are semver-governed |
| Session/controller lifecycle, ownership, cancellation/supersession, typed state/error categories, and standard output handoff accepted by decision-2 | Stable semantic contract | Observable invariants, idempotent disposal, no hidden ownership transfer, and output-change visibility |
| First-party effect factory names and semantic configuration after explicit API approval | Stable once promoted | Documented effect states, fallback, retry, asset/version errors, and supported browser rows |
| Specific processing backend, worker placement, WebGL/WebGPU/WASM path, raw frame bridge, model architecture, model weights, and transform order | Experimental until separately validated/promoted | Capability-gated behavior only; no cross-browser or performance guarantee from constructor presence |
| Optional asset URL/resolver helpers and companion asset package names | Proposed/experimental until distribution approval | Version/integrity metadata and explicit loading behavior; no implicit network source |
| Generic processor/plugin API, raw frame/tensor exposure, Node processing, React Native, mobile support | Out of scope | No compatibility promise |

Experimental code must live behind clearly labeled experimental entry points or opt-in configuration and must not be re-exported from the stable root by accident. An experimental feature may change or be removed in a minor release only when the release notes and migration path make that status explicit; a feature promoted to stable thereafter follows the stable SemVer policy.

### 5.2 SemVer and deprecation proposal

The recommended versioning rules are:

- Patch: backwards-compatible bug, type, documentation, or packaging fixes that do not change observable lifecycle, browser scope, asset compatibility, or output semantics.
- Minor: backwards-compatible stable additions, new optional entry points, new supported browser rows, or new effect capabilities that do not alter existing states/ownership; experimental additions must be visibly labeled.
- Major: breaking changes to stable exports, types, state discriminants, ownership, output replacement behavior, SSR safety, peer ranges, browser/Node support floor, package conditions, asset manifest compatibility, or published-file guarantees.
- Prereleases: use prerelease identifiers for a new stable surface or a materially changed processor/asset contract; prereleases are not supported production rows unless explicitly documented.
- Experimental processors/models: carry explicit experimental labels and independent asset/runtime version metadata; do not use a stable entry-point name for an experimental implementation.
- Deprecations: document the reason, replacement, affected subpaths, and earliest removal release. The proposed default is at least one minor release and one release note cycle before removal, with a longer window for stable root exports.
- Asset releases: code package, worker/worklet/runtime package, and model package versions must declare compatibility. A major mismatch is rejected; minor/patch compatibility must be stated in the manifest rather than inferred from semver alone.
- Release alignment: a published package version, changelog, tag, asset manifest, and any companion asset package version must be produced from one approved release record. TASK-1.21 owns the detailed release workflow and must not assume this proposal is accepted.

Quality or model changes that alter output behavior, performance, asset size, or privacy/security requirements are release-significant even when TypeScript signatures do not change. They require changelog entries, evidence, and user-approved contract review when the support boundary changes.

### 5.3 Alternatives and tradeoffs

| Policy | Benefits | Costs and risks |
| --- | --- | --- |
| Stable root plus labeled experimental subpaths | Protects consumers from backend churn while preserving research velocity | More entry points and documentation; promotion requires migration work |
| Everything experimental until 1.0 | Maximum freedom to change processors and assets | Consumers cannot tell whether SSR, ownership, or package behavior is safe; undermines the accepted lifecycle contract |
| Stable all-in-one effects from first publish | Simple marketing and install story | Locks model/runtime/worker/browser behavior before feasibility, asset, quality, and license evidence exists |
| Independent package versioning with a compatibility manifest | Allows asset/runtime updates without rebuilding all code | Requires release tooling, manifests, integrity checks, and clear upgrade errors |

The recommendation is stable semantic lifecycle/package foundations plus explicitly experimental processor implementations and assets. This is a recommendation for approval, not an accepted stability boundary.

## 6. Approval-bound alternatives and unresolved questions

### 6.1 Compatibility alternatives for explicit user choice

1. Evergreen policy: support current stable desktop Chrome, Edge, Firefox, and Safari plus one previous major, with mobile feasibility only. This minimizes stale-browser burden and makes a rolling matrix practical, but may drop installed enterprise browsers sooner.
2. Fixed minimum versions: publish exact minimum Chrome/Edge/Firefox/Safari versions and retain them until the next major library release. This makes support reproducible but increases testing and maintenance cost and can freeze old browser workarounds.
3. Capability policy: support any browser that passes the documented capability/configuration/output/fallback checks, with no fixed engine-version promise. This adapts to browser diversity but weakens consumer planning and support triage.

Recommendation: evergreen policy with exact version evidence in each release matrix; user approval is required.

### 6.2 Distribution and module alternatives for explicit user choice

1. ESM-only package with app-hosted optional assets: smallest and cleanest build, but CommonJS compatibility and old SSR tools suffer.
2. ESM-first dual package plus companion asset packages: broadest module compatibility while keeping optional installs small, but creates wrapper and version-alignment maintenance.
3. Separate core, React, video, audio, and asset packages: clear dependency boundaries and independently cacheable assets, but increases package discovery, release, and compatibility surface.
4. Single package with all optional assets: easiest offline install and URL resolution, but penalizes every consumer’s install/cache size and can make tarball review harder.

Recommendation: retain one package identity with explicit core/React/effect subpaths, ESM-first interoperability, and either companion asset packages or explicit application-hosted assets; do not make a CDN or all-assets install mandatory.

### 6.3 Approval questions

The user must explicitly approve, revise, or reject:

- the browser maintenance window and exact minimum desktop versions;
- the initial TypeScript minimum and Node SSR fixture floor;
- the React peer range and whether any React DOM peer is needed;
- the ESM-only versus ESM-first/CJS module strategy;
- the exact root, core, effect, and asset entry-point names;
- whether root re-exports the framework-neutral controller or keeps it under a core subpath;
- the positive published-file allowlist and source-map policy;
- companion asset packages versus application-hosted assets versus in-package assets;
- whether the package may provide a package-relative asset default and how bundler/public-path resolution is tested;
- the CSP/CORS requirements and whether any selected runtime needs wasm-unsafe-eval;
- whether cross-origin isolation is optional with a no-isolation fallback or required for a particular promoted effect;
- whether bypass/original-media is the default for every loading/failure class or effect-specific policy is required;
- the stable/experimental entry-point boundary and SemVer/deprecation windows;
- release-time asset/version alignment rules delegated to TASK-1.21;
- the release evidence required before Edge/Safari rows can be claimed supported.

Until these are approved, TASK-1.9 must not publish a package contract, TASK-1.20 must not enforce support rows as release gates, TASK-1.21 must not encode release behavior from this proposal, and no implementation may treat an experimental backend as a stable browser guarantee.

## 7. Evidence and validation links

### Backlog evidence

- [decision-1 — Adopt the initial product and quality contract](../../decisions/decision-1 - Adopt-the-initial-product-and-quality-contract.md)
- [decision-2 — Accept the public API and resource-lifecycle contract](../../decisions/decision-2 - Accept-the-public-API-and-resource-lifecycle-contract.md)
- [doc-1 — Initial Product and Quality Contract](../product/initial-product-quality-contract/doc-1 - Initial-Product-and-Quality-Contract.md)
- [doc-2 — Public API Ecosystem Prior Art](../api/doc-2 - Public-API-Ecosystem-Prior-Art.md)
- [doc-3 — Media Output and Transport Interoperability](../research/media/doc-3 - Media-Output-and-Transport-Interoperability.md)
- [doc-4 — Capture Lifecycle Experiment Findings](../experiments/capture-lifecycle/doc-4 - Capture-Lifecycle-Experiment-Findings.md)
- [doc-5 — Browser Video-Processing Feasibility](../research/video/doc-5 - Browser-Video-Processing-Feasibility.md)
- [doc-5 — Browser Audio Processing Feasibility](../research/media/doc-5 - Browser-Audio-Processing-Feasibility.md)
- [doc-6 — Cross-Browser Verification Strategy](../verification/doc-6 - Cross-Browser-Verification-Strategy.md)
- TASK-1.2 — browser capability and support-risk map
- TASK-1.7 — accepted public API and resource-lifecycle contract

### Primary technical sources

- [Media Capture and Streams](https://www.w3.org/TR/mediacapture-streams/)
- [Media Capture Transform](https://www.w3.org/TR/mediacapture-transform/)
- [Media Capture from DOM Elements](https://www.w3.org/TR/mediacapture-fromelement/)
- [Web Audio API](https://www.w3.org/TR/webaudio-1.1/)
- [WebCodecs](https://www.w3.org/TR/webcodecs/)
- [WebRTC 1.0](https://www.w3.org/TR/webrtc/)
- [MediaStream Recording](https://www.w3.org/TR/mediastream-recording/)
- [Secure Contexts](https://www.w3.org/TR/secure-contexts/)
- [Permissions Policy](https://www.w3.org/TR/permissions-policy-1/)
- [WHATWG Page Visibility](https://html.spec.whatwg.org/multipage/interaction.html#page-visibility)
- [React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [React useEffect and Strict Mode behavior](https://react.dev/reference/react/useEffect)
- [Node package exports](https://nodejs.org/api/packages.html)
- [TypeScript publishing and declaration guidance](https://www.typescriptlang.org/docs/handbook/declaration-files/publishing.html)
- [WebAssembly portability](https://webassembly.org/docs/portability/)
- [WebAssembly security](https://webassembly.org/docs/security/)

The dated local probes are evidence for exact binaries and contexts, not release-wide support claims: Chrome 151.0.7922.137 and Firefox 153.x were run on secure loopback with Window and DedicatedWorker observations; Edge, Safari, and mobile were unavailable in this worktree. The feasibility reports also record the Chrome AudioWorklet/MediaStreamAudioDestinationNode smoke path, the video canvas/worker/raw-track measurements, and their cleanup and asset-security limitations.

## 8. Acceptance-evidence map

| Acceptance criterion | Evidence in this proposal |
| --- | --- |
| #1 React, TypeScript, browser, and SSR environments with maintenance policy | Sections 1.1 and 1.2 state React, TypeScript, Node SSR, desktop browser, mobile boundary, secure-context, iframe, worker, release, and unknown-row policy. |
| #2 Entry points, types, module interoperability, tree-shaking, side effects, peers, published files | Sections 2.1–2.6 define proposed entry points, conditional exports, declaration behavior, ESM/CJS alternatives, side-effect/tree-shaking rules, peer/runtime dependency rules, and an allowlisted tarball boundary. |
| #3 Browser-only behavior and safe non-browser imports | Section 3 defines import/construction invariants, inert server behavior, hydration/action lifecycle, capability checks, secure context, Permissions Policy, and ownership. |
| #4 Versioning and stability for experimental processing versus stable contracts | Section 5 separates stable lifecycle/package semantics from experimental backends/assets and defines proposed SemVer, prerelease, deprecation, and promotion rules. |
| #5 Version-aligned optional assets plus hosting/offline/CSP/CORS constraints | Section 4 defines manifest fields, worker/worklet/WASM/model alignment, hosting alternatives, CORS/CSP/isolation/offline rules, and failure/fallback behavior. |
| #6 Significant architectural decisions recorded with evaluated alternatives/consequences | A proposed Decision is created for TASK-1.8 with the required Context, Decision Drivers, Considered Options, Decision, Consequences, Related Tasks, and Supersedes sections. It remains proposed and does not accept a new boundary. |
| #7 Alternatives presented and explicit approval required | Sections 2.3, 4.2, 5.3, and 6 list alternatives/tradeoffs; the authority note and unresolved approval questions explicitly prevent treating this proposal as approved. |

## Related work

- TASK-1.8 — Define the compatibility and distribution contract.
- TASK-1.2 — Map browser media capabilities and support risks.
- TASK-1.6 — Define the cross-browser verification strategy.
- TASK-1.7 — Define the accepted public API and resource-lifecycle contract.
- TASK-1.9 — Bootstrap an installable and verifiable library package.
- TASK-1.20 — Establish continuous integration validation.
- TASK-1.21 — Define the release, versioning, and changelog contract.
- TASK-1.22 — Establish dependency and supply-chain maintenance.
- TASK-1.23 — Automate tags, GitHub Releases, and package publishing.
