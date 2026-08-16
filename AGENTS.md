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
