---
id: decision-12
title: Qualify audio latency targets through approved scenarios and baseline evidence
date: '2026-11-22 01:53'
status: proposed
---

## Context

The owner authorized a TASK-1.12 AC3 prerequisite to investigate the 40 ms target before more latency optimization/qualification, without changing production behavior or accepting a new target. Decision-1/doc-1 document a user-approved provisional hypothesis, but the audited introduction/history/PR2 supplies no numerical derivation or user-study validation. Audio doc-5 and verification doc-6 inherit it. Later scripts measure signed processed lag minus same-trial original median, which is not the unspecified browser-reported baseline in the original prose. This difference is material and must not become an implicit contract amendment.

This record is PROPOSED ONLY. Approval to investigate is not approval of the protocol, metric, scenarios, new threshold or support scope. Detailed evidence, source links and proposed gates are in [the provenance/protocol report](../../docs/measurements/audio/latency-target-provenance.md).

## Decision Drivers

- Establish the user outcome and timing endpoints before selecting a performance limit or optimizing toward it.
- Preserve old 40 ms verdicts, failed cells, signed baselines, exclusions and accepted Decision history.
- Distinguish track-output added delay, physical total delay, browser telemetry, Worklet deadlines and end-user tolerance.
- Require representative browser/device, contention, uncertainty, quality and continuity evidence before a numerical/support decision.

## Considered Options

1. Retain universal 40 ms and its current legacy gate while collecting rationale. Preserves comparability but leaves the missing scenario/metric justification unresolved.
2. Approve scenario/metric/reference/study design first, retain 40 meanwhile, and decide the number after evidence (recommended proposal). More work and owner input; supports a defensible choice to retain, tighten, increase or explicitly narrow scope.
3. Raise to 50/60 ms because the present implementation misses 40. Not supported by current evidence of user tolerance; risks moving the goalposts.
4. Substitute 150/400 ms conversational/network guidance. Reject direct substitution: those are different boundaries/statistics, not this denoiser's incremental p95 budget.

## Decision

Pending owner approval: select the report's process alternative B, with S1 standard processed-track handoff as the candidate primary scenario and an explicit owner choice on whether S2 physical headphone self-monitoring is included. S3 metering cannot substitute for denoised-output latency. Exact consumers, physical low/middle reference tiers, browser builds, device/power/input settings and study resources must be selected rather than inferred from the available embedding.

Preregister paired baseline/processed endpoints and uncertainty calibration, absolute and added p50/p95/p99/max, independent repeated runs and tail sample/coverage goals, fixed idle/UI/CPU/composed-load conditions, and separate blinded quality/interactive-delay evaluation. Any future paired estimator has a new metric ID and parallel legacy results. Maintain continuity, speech-quality, callback, memory, asset, privacy and ownership guardrails independently.

Until explicit approval, keep the current 40 ms gate and all measurement/production/CI/PR behavior unchanged, AC3 open, and TASK-1.12 In Progress. Approval of this process would not select a replacement numeric threshold or automatically authorize unsupported product scope. After evidence, any change to T, its metric or support envelope requires a separate explicit numerical decision naming the affected old clauses; even retaining 40 requires recording the evidence-based rationale.

## Consequences

This proposal makes the unresolved authority and measurement boundaries reviewable without erasing prior work. It requires owner input and access to reference devices/representative users; current headless/embedding cells and the existing listening packet cannot establish a universal delay tolerance. Future measurement implementation, new qualification/optimization and threshold adoption remain gated by approval. No API, backend, artifact, dependency, quality-limit or fallback-only support change is proposed here.

## Related Tasks

- [TASK-1.12](<../tasks/task-1.12 - Deliver-a-composable-audio-processing-vertical-slice.md>): existing AC3 prerequisite; no new Backlog task.
- [Decision-1](<decision-1 - Adopt-the-initial-product-and-quality-contract.md>) and doc-1: retain current approved provisional product contract.
- Decisions 8/10/11: retain backend/lifecycle boundaries and existing gates; this proposal does not adopt a different architecture.
- [Provenance and proposed validation gates](../../docs/measurements/audio/latency-target-provenance.md).

## Supersedes

None while proposed. This process proposal does not replace Decision-1, rewrite doc-1, or alter the 40 ms references in Decisions 8/10/11. A later owner-approved metric/numeric/support revision must identify the exact superseded audio clauses in a new accepted record and preserve the old measurements/history.
