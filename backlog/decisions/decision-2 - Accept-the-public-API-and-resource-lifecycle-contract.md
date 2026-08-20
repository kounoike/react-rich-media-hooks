---
id: decision-2
title: Accept the public API and resource-lifecycle contract
date: '2026-08-20 14:57'
status: accepted
---
## Context

TASK-1.7's narrowed doc-6 proposal was explicitly approved by the user on 2026-08-20. This Decision records the approved public API and resource-lifecycle direction while preserving the deliberate exclusion of caller-supplied external `MediaStreamTrack`/`MediaStream` capture input, borrowed-input ownership, and input adoption or transfer operations. The semantic contract is accepted, but illustrative export and type names remain subject to implementation review and are not silently final.

## Decision Drivers

- Keep resource identity and ownership in a framework-neutral session/controller so React render and subscription lifecycles cannot implicitly control hardware.
- Preserve standard browser media interoperability through current `MediaStreamTrack`/`MediaStream` outputs and explicit output-change notifications.
- Make cleanup, cancellation, replacement, processor failure, and SSR behavior observable and deterministic.
- Keep video and audio processor domains independently replaceable, recoverable, and disposable.
- Bound the initial release to first-party effect factories, SSR-safe imports, browser-only activation, and the accepted product contract.
- Avoid inferring ownership or expanding the public input surface from attachments, React identity, clones, or implementation details.

## Considered Options

1. **Framework-neutral controller core with thin React hooks and an optional provider (accepted).** This keeps ownership outside render, supports non-React consumers, and permits shared React subscriptions without making context the resource identity.
2. **Hooks-only or provider/store-only composition (not accepted).** These make resource identity follow component or provider lifecycles and increase Strict Mode, remount, and sharing hazards.
3. **Standard current track/stream outputs with output-change events (accepted).** Opaque effect handles and an in-place stable-track promise were not selected because they weaken standard interoperability or cannot be implemented consistently; consumers must handle visible replacement changes.
4. **Explicit session ownership with application-owned output clones (accepted).** Automatic cloning or reference counting was not selected as the default because hidden retention and surprising stop timing are harder to reason about. The contract does not add caller-supplied capture inputs, borrowed ownership, or input adoption/transfer semantics.
5. **Bypass to original media during recoverable processor loading/failure (accepted default).** Buffering or fail-closed behavior may be effect-specific future policy, but the default preserves continuity while exposing degraded/unsupported/failed state and error evidence.
6. **Tagged operation results for cancellation and supersession (accepted).** Rejection details remain implementation-reviewable, but expected cancellation/supersession must be distinguishable from real failure without unhandled-rejection noise.
7. **First-party effect factories only for the initial release (accepted).** A generic third-party processor/plugin contract is deferred until a separate compatibility and API review.
8. **SSR-safe base import with browser-only activation (accepted).** Node and React Native media processing remain out of scope; module evaluation and inert server construction must not touch browser globals or media resources.

## Decision

Adopt the following semantic public API and lifecycle contract for TASK-1.7 and doc-6:

- A framework-neutral session/controller is the sole owner of acquired capture resources, generated output tracks/streams, processor resources, and cleanup. Thin React hooks subscribe to that session, and an optional provider only supplies subtree access.
- The session exposes standard current `MediaStreamTrack`/`MediaStream` views and an output-change event/record whenever replacement changes the current track. Session identity remains stable; consumers reattach or use transport-specific replacement operations.
- Attaching an output to a preview, recorder, sender, or other browser API does not change session ownership. `MediaOutput.clone()` creates an application-owned output clone with an independent track lifetime; stopping the clone does not stop the session graph. No caller-supplied external capture input, borrowed-input ownership, input adoption, or input transfer API is part of this contract.
- Video and audio processors have independent lifecycle, readiness, failure, retry, replacement, and disposal domains. Recoverable loading/failure bypasses to the original media by default when possible and publishes observable bypassed/degraded/unsupported/failed state and error information.
- Asynchronous start, stop, replacement, asset, and processor operations use tagged results or equivalent discriminants so cancellation and supersession are deterministic and distinguishable from failure.
- The initial release exposes first-party effect factories only, keeps imports and inert server behavior SSR-safe, activates media only in the browser after hydration and explicit action, and keeps Node/React Native out of scope.
- The semantic choices above are accepted; exact export names, generic parameters, discriminant spellings, promise signatures, and internal processor interfaces remain implementation-reviewable and must not be published as final merely by this Decision. Any material change requires explicit review and, where appropriate, a follow-up Decision.

## Consequences

Implementation may proceed against a stable ownership, output-interoperability, replacement, processor-failure, operation-settlement, release-scope, and SSR contract without selecting a particular backend or transform order. Consumers must observe output changes and transport-specific replacement gaps, while applications retain control only over their own output clones and product UI. A future caller-input, input-adoption/transfer, generic plugin, Node, or React Native surface would require separate user approval rather than being inferred from this Decision. The accepted baseline in decision-1 remains in force and is not superseded.

## Related Tasks

- TASK-1.7 — Define the public API and resource-lifecycle contract.
- doc-6 — Public API and Resource-Lifecycle Contract.
- TASK-1.3, TASK-1.4, TASK-1.5, TASK-1.16, and TASK-1.17 — Lifecycle, processor, prior-art, and output-interoperability evidence used by the contract.
