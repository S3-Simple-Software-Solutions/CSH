# Agent Harness

This harness is the default workflow for agent-led changes in this repository. It is intentionally lightweight: use it as a repeatable path from request to reviewed PR, not as a large process document.

## Principles

- Work from repository truth, not memory.
- Keep one branch focused on one concern.
- Prefer small, reviewable diffs over broad rewrites.
- Preserve user changes you did not make.
- Verify behavior before claiming success.
- Leave enough context for the next agent or human to continue.

## Standard Feature Flow

### 1. Inspect State

```bash
git status --short
git branch --show-current
git fetch origin
```

If the worktree is dirty, identify whether the changes are yours, the user's, or part of the requested task. Do not discard unrelated changes.

### 2. Start From Main

Unless the user explicitly asks to continue from another branch:

```bash
git switch main
git pull --ff-only origin main
git switch -c feature-name
```

Use short branch names in kebab/camel style that match the feature, for example `logEventos`, `fix-login-cookie`, or `event-log`.

### 3. Understand The Local Pattern

Before editing:

- Find the existing module, route, schema, component, and style patterns.
- Read neighboring files before creating abstractions.
- Prefer existing helpers, routes, repository patterns, and UI conventions.
- Identify the smallest useful change set.

Useful commands:

```bash
find server src -type f | sort
grep -RIn "search-term" server src --exclude-dir=node_modules
```

Use `rg` if available.

### 4. Implement In Small Slices

- Make backend, frontend, schema, and style changes separately when practical.
- Keep unrelated cleanup out of the feature.
- Add migrations/schema guards with `if not exists` where the app bootstrap pattern expects it.
- Avoid new dependencies unless they clearly reduce risk or match the project.

### 5. Validate

Run targeted checks first, then project checks.

For frontend or shared changes:

```bash
npm run check
```

For server changes:

```bash
npm run build:server
```

For focused unit tests:

```bash
npx vitest run <test-file> --exclude=dist-server/** --exclude=current/** --exclude=releases/**
```

For behavior that depends on the app running, start a temporary server on a non-conflicting port:

```bash
PORT=8091 npm start
```

Then verify with browser or API calls. Stop any foreground server before finishing.

### 6. Review The Diff

```bash
git diff --stat
git diff --check
git diff
```

Confirm:

- Only intended files changed.
- No secrets or generated noise were added.
- No unrelated user changes were reverted.
- The diff is understandable to a reviewer.

### 7. Commit

Use a descriptive conventional-style message:

```bash
git add <files>
git commit -m "feat: add event ticket log"
```

Good prefixes:

- `feat:` new user-facing behavior
- `fix:` bug fix
- `chore:` tooling or maintenance
- `docs:` documentation only
- `test:` tests only

### 8. Push And Open PR

```bash
git push -u origin feature-name
gh pr create --base main --head feature-name --title "feat: short title" --body-file /tmp/pr-body.md
```

The PR body should include:

- Summary
- Validation commands and outcomes
- Screenshots or local URL for UI changes when useful
- Known risks or follow-ups

Template:

```md
## Summary
- ...

## Validation
- `npm run check`
- `npm run build:server`

## Notes
- ...
```

### 9. Watch CI

```bash
gh pr view --json statusCheckRollup,mergeStateStatus,reviewDecision
gh run list --branch feature-name --limit 5
```

If CI fails:

1. Read the failing job log.
2. Fix the root cause.
3. Re-run local validation.
4. Commit and push again.

Do not dismiss CodeQL or security findings unless the user explicitly approves and there is a written rationale.

## Done Definition

A task is done when:

- The requested behavior is implemented.
- Relevant tests/builds pass.
- The app behavior was verified when practical.
- Changes are committed on a feature branch, if the user requested PR-ready work.
- A PR is opened or the user is told exactly what remains.

## Long-Running Work

For work that spans multiple sessions, keep a short progress note in the PR body or a temporary planning file. Include:

- Current objective
- Completed steps
- Remaining steps
- Validation status
- Known blockers

Remove temporary planning files before merge unless they are useful project documentation.

## Harness Maintenance

Update this file when an agent repeats a mistake or when the repo's workflow changes. The harness should stay short enough to read quickly and specific enough to prevent common failures.

References:

- Anthropic recommends persistent project instructions via `CLAUDE.md`, plus structured handoff/progress artifacts for long-running agents.
- OpenAI describes `AGENTS.md` as a concise map that points agents to deeper sources of truth.
- Community harness guidance generally favors small reviewable PRs, deterministic validation loops, hooks/skills for repeated procedures, and keeping process docs short.
