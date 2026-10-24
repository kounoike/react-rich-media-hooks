---
id: TASK-1.24
title: Create a runnable React capture example project
status: Done
assignee:
  - '@codex'
created_date: '2026-09-08 07:28'
updated_date: '2026-10-03 01:31'
labels: []
dependencies:
  - TASK-1.10
modified_files:
  - examples/capture/README.md
  - examples/capture/index.html
  - examples/capture/package.json
  - examples/capture/pnpm-lock.yaml
  - examples/capture/src/main.tsx
  - examples/capture/src/styles.css
  - examples/capture/tsconfig.json
  - examples/capture/vite.config.ts
parent_task_id: TASK-1
priority: medium
type: task
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add a standalone, runnable React example project that demonstrates the approved browser capture flow for library consumers. The example should remain application-owned UI rather than production library logic: create and dispose a MediaSession, render capture state and output, provide an application-owned device picker, demonstrate initial device discovery and automatic devicechange updates, and document setup, secure-context/permission requirements, and the run command. Keep the example aligned with the published package boundary and existing repository toolchain without introducing unrelated API or architecture changes.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A clearly documented example project exists in the repository and can be installed and started from a clean checkout with a documented command.
- [x] #2 The example demonstrates the React-facing API, including session creation, MediaSessionProvider or useMediaSession, useMediaOutput, client-side start, stop, retry, and disposal.
- [x] #3 The example provides an application-owned video or audio device picker that renders from session state, performs an initial refreshDevices call, reacts to devicechange updates, and invokes switchDevice through the public API.
- [x] #4 The example displays capture phase, device discovery, permission or device errors, and recovery actions without duplicating production media-session logic.
- [x] #5 The example attaches the session-owned output to a preview and documents resource ownership, secure-context and permission prerequisites, and limitations.
- [x] #6 Example-specific typecheck/build or equivalent automated validation passes, and the example does not require changes to the library public API.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Inspect the accepted capture API and package boundary, then choose a minimal standalone React example layout without changing library exports.
2. Implement session ownership, state and recovery UI, a device picker initialized with refreshDevices and switchDevice, and a video preview using the session-owned output.
3. Add isolated example install/build/typecheck scripts and document setup, secure-context and permission requirements, ownership, and limitations.
4. Run the example validation and required repository checks, record acceptance evidence, finalize this task through Backlog CLI, then commit and push the scoped branch.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Initial dispatch branch cce08d0 did not include TASK-1.24, although local main contained its standalone record commit 5ecbaa2. Cherry-picked that one-file task creation commit to restore the Backlog record in this worker branch; task plan and lifecycle updates will use Backlog CLI.

2026-10-03 implementation: Added a standalone React/Vite/TypeScript app under examples/capture, linked to the root package through link:../.. and importing only its public package entry. The app owns MediaSession creation/disposal, starts capture only on a client button action, exposes phase/activity/availability/discovery/errors, retries retryable failures, lets users stop/dispose, lists session devices, switches an active camera, and attaches the session-owned output to a preview. The project README documents root and example frozen installs, the dev command, secure-context and permission requirements, local ownership, redacted device names, and compatibility limits.

2026-10-03 validation: Root and example pnpm install --frozen-lockfile completed; pnpm --dir examples/capture typecheck and build, pnpm exec oxfmt --check examples/capture, and pnpm exec oxlint --config .oxlintrc.json examples/capture/src passed. pnpm verify passed (14/14 unit tests, package consumers under React 18.2 and 19, lifecycle policy); pnpm run backlog:dispatchable and git diff --check passed. The documented dev command served on localhost and returned the app HTML; a headless Chromium fake-camera run exercised initial discovery, retry after a simulated NotReadableError, preview attachment, devicechange update, switchDevice request, stop, and disposal with no page errors. No library public API or production source files changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a standalone, runnable React camera example with documented install/start commands, session controls, observable capture and error state, device discovery and switching, and a session-owned preview. Verified root and example frozen installs, example typecheck/build/lint/format, headless Chromium camera-flow interactions, and pnpm verify; no library public API changes were needed.
<!-- SECTION:FINAL_SUMMARY:END -->
