# Agent Instructions

This repository uses `docs/harness.md` as the working harness for agent-driven changes.

Before changing code:
- Read `docs/harness.md`.
- Check the current branch and dirty worktree with `git status --short`.
- Start feature work from an updated `main` unless the user explicitly says otherwise.
- Keep changes scoped to the requested feature or fix.

Required validation before handoff:
- Run the targeted tests for the changed area.
- Run `npm run check`.
- Run `npm run build:server` when server code changed.
- Summarize what changed, what was verified, and anything not verified.

Git workflow:
- Do not commit directly to `main`.
- Use short feature branches from `main`.
- Prefer small, reviewable commits.
- Open PRs against `main` with a concise summary and validation notes.
