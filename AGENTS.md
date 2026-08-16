# Agent Instructions

## Scope and task management

- Work only on the request and its relevant Backlog task.
- Record important findings in the task.
- Mark a task complete only after its acceptance criteria are satisfied.

## Architecture and design

- Record significant or difficult-to-reverse architecture decisions with Backlog.md Decisions.
- Before making a decision, search existing Backlog.md Decisions.
- Create a new decision when no existing decision applies. Supersede accepted decisions instead of rewriting their history.
- Keep design reasoning in the repository; do not rely on chat history as the sole source of architectural context.

## Decision authority

- The user retains final authority over significant product, scope, public API, compatibility, and architecture decisions.
- Agents may research options and make recommendations, but must present the alternatives, evidence, and tradeoffs before requesting approval.
- Do not treat a proposal as accepted, record it as an accepted Backlog.md Decision, or begin dependent implementation until the user explicitly approves it.
- Record the approved decision and its relationship to relevant tasks in the repository.
- Routine, reversible implementation choices within an already approved scope do not require separate approval.

## Communication

- Use the user's native language when communicating with the user.
- Use English for documentation, pull requests, issues, and agent-to-agent communication.
- Write commit messages in English using the Conventional Commits format.

<!-- BACKLOG.MD GUIDELINES START -->
<!-- backlog.md-instructions-version: 1.50.1 -->
<CRITICAL_INSTRUCTION>

## Backlog.md Workflow

This project uses Backlog.md for task and project management.

**For every user request in this project, run `backlog instructions overview` before answering or taking action.**

Use the overview to decide whether to search, read, create, or update Backlog tasks.

Before task lifecycle actions, read the matching detailed guide:
- `backlog instructions task-creation` before creating or splitting tasks
- `backlog instructions task-execution` before planning, changing status or assignee, adding a plan or implementation notes, or implementing task work
- `backlog instructions task-finalization` before checking acceptance criteria, writing final summaries, or moving tasks to terminal statuses

Use `backlog <command> --help` before running unfamiliar commands. Help shows options, fields, and examples.

Do not edit Backlog task, draft, document, decision, or milestone markdown files directly, except for the narrowly scoped Decision-body capability exception below. Use the `backlog` CLI so metadata, relationships, and history stay consistent.

</CRITICAL_INSTRUCTION>
<!-- BACKLOG.MD GUIDELINES END -->

### Decision-body capability exception

The installed Backlog CLI is the first choice for creating and tracking every Decision. If the installed CLI cannot populate or update Decision body sections, a narrowly scoped direct-edit exception is allowed:

- Confirm the limitation with `backlog --version`, `backlog decision --help`, and `backlog decision create --help`; record the CLI version and limitation in the relevant task notes.
- Create the Decision and its metadata through `backlog decision create` first. Direct editing is limited to the body sections `Context`, `Decision Drivers`, `Considered Options`, `Decision`, `Consequences`, `Related Tasks`, and `Supersedes`.
- Preserve the frontmatter exactly: do not change the Decision ID, title, date, status, or other metadata. Do not create a second Decision to hide a correction.
- A previously accepted Decision must not have its meaning rewritten. A user-approved, one-time restorative fill is allowed only when an accepted Decision's body is empty because the CLI generated a skeleton; record that exception and keep the accepted metadata unchanged.
- Never use this exception for task, draft, document, or milestone files; those remain CLI-only.
- Before commit or PR review, verify every required body section is non-empty, confirm the frontmatter is unchanged, run `git diff --check`, and record the validation evidence in the related Backlog task.

### Supervised task-to-PR workflow

The task-to-PR workflow is repository operating policy, not product work. Keep its rules in this section and `.orca/task-pr-lifecycle.json`; do not create a Backlog task, Decision, or Backlog document solely to describe or maintain this workflow.

- Start each worker from a tracked Orca Run and Dispatch. The worker owns changes to its Backlog task and records task status, notes, comments, and final summary through the Backlog CLI in the task worktree before opening the Draft PR.
- Dispatchable task selection is leaf-only. Run `pnpm run backlog:dispatchable`, which starts from Backlog's `To Do` and `--ready` results and rejects every task whose `subtasks` array is non-empty. Parent/roll-up tasks must never be dispatched directly, even when Backlog reports them as ready.
- Select exactly one remaining task in priority and ordinal order. If no leaf task remains, report that no dispatchable task exists and do not create a Run, Dispatch, worktree, or worker. Do not add artificial dependencies or change a parent status solely to hide it from dispatch candidates.
- Worktree creation is single-flight and must be polled to completion. After `orca-ide worktree create ... --json`, if the wrapper returns a session handle or continues without final JSON, poll that exact command session until it exits and returns the final result. Empty output, a timeout, or `runtime_unavailable` is indeterminate, not permission to retry; inspect `orca-ide worktree list` and `git worktree list` first, and never issue a second create for the same task/name while the first request may still be running.
- Lifecycle review has two lanes. The automatic lane may complete and merge `spike`, `docs`, `bug`, `chore`, and small implementation `task` work when the change is small (at most 10 files and 300 changed lines), creates or changes no Backlog Decision, touches no protected workflow, dependency, CI, or release paths, changes no public API, compatibility contract, or distribution contract, has no unresolved user decision, and all current-head checks pass. Feature, enhancement, public API, compatibility, distribution, dependency, release, Decision-related, or uncertain work must use the manual approval lane.
- Automatic completion still requires the worker-owned Backlog task update, validated Draft PR, current-head checks, and exact post-merge cleanup. If any automatic-lane condition cannot be proven, fall back to manual review; never infer approval from silence.
- The coordinator's repository `main` worktree is read-only for task records. It must not edit Backlog task files, append completion or merge comments, or commit workflow bookkeeping. The coordinator may inspect state, fetch, and fast-forward only when `main` is clean; never overwrite existing user changes.
- The machine policy's `forbid_post_merge_backlog_updates` guard is enabled; merge and cleanup evidence belongs to the merged PR and Orca Run/Dispatch, not a post-merge task edit.
- Accept completion only from the active Dispatch, validate the task and checks, and publish one Draft PR that contains the worker's task-record changes. Use the automatic lane only after its eligibility evidence is recorded; otherwise pause for explicit user approval bound to the task, Run, Dispatch, PR, and current head SHA.
- Build PR bodies with `gh pr create/edit --body-file` containing real newline bytes (or shell ANSI-C quoting such as `$'line 1\nline 2'`); ordinary double-quoted `\n` is sent as a literal backslash-n. After publishing, inspect `gh pr view <number> --json body` and reject any body containing the literal `\n` sequence.
- In the manual lane, merge only after approval and successful current-head checks; in the automatic lane, merge only after eligibility and the same checks are recorded. Use the repository-approved strategy. Do not write Backlog task records after merge; the merged PR and Orca Run/Dispatch provide the completion and cleanup evidence.
- After verified merge, release only the exact Dispatch-owned worker session and remove only its exact worktree and branch. Retain all artifacts for failures, requested changes, rejected approval, interruptions, or unknown outcomes.

Significant architectural decisions must be recorded with
`backlog decision create`.

Before creating a decision, search existing decisions.

Do not modify historical accepted decisions to reflect a new choice.

If a new decision replaces an existing decision, create a new decision
and explicitly reference the old decision in a "Supersedes" section.

Use the following sections:
- Context
- Decision Drivers
- Considered Options
- Decision
- Consequences
- Related Tasks
- Supersedes, when applicable
