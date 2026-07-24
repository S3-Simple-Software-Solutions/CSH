# Agentic Harness

This repository has a local multi-provider harness for agent-led work. It starts
from `dev`, runs a provider, validates, commits, pushes, opens a PR back to
`dev`, and sends Discord status notifications when `DISCORD_WEBHOOK_URL` is set.

## Providers

- `codex`: default implementation provider through `codex exec`.
- `claude`: implementation provider through Claude Code CLI.
- `openai`: planning provider through the OpenAI Responses API.
- `noop`: no model execution, useful for smoke tests.

The OpenAI provider is intentionally planner-only in this harness. Use `codex`
or `claude` when the run must edit files.

## Issue Intake

GitHub issues are converted into user stories by `.github/workflows/issue-userstory.yml`.
The workflow runs on a self-hosted runner so the selected agent starts on the
host, creates a branch from `dev`, expands the issue, writes a user story under
`docs/user-stories/`, comments back on the issue, labels it, and sends a Discord
notification.

Manual runs:

```bash
npm run issue:userstory -- --issue-number 123 --provider codex
npm run issue:userstory -- --all-open --provider noop
```

Project setup:

```bash
gh auth refresh -s read:project -s project
npm run issue:project:setup
```

The setup command creates or reuses `CSH User Stories`, adds the configured
`CSH Stage` field with `Backlog`, `Planning`, `Building`, `Tests`, and
`TestDeploy`, and writes the project number into
`scripts/issue-userstory.config.json`.

For GitHub Actions to add issues to the Project, add this repository secret:

```text
GH_PROJECT_TOKEN
```

The token needs project access. Without it, the story branch, markdown file,
issue comment, labels, and Discord notification still work; the Project update
is reported as pending setup.

## Usage

```bash
npm run agentic:status
npm run agentic -- run --task "fix login redirect"
npm run agentic -- run --provider claude --task "add ticket audit log"
npm run agentic -- plan --task "scope pagos P1"
npm run agentic -- notify-test
```

The default flow is automatic:

1. Check git state.
2. Create a branch from `dev` when currently on `dev`.
3. Run the selected provider.
4. Run `npm run check` and `npm run build:server`.
5. Commit changed files created by the run.
6. Push the branch and open a PR against `dev`.
7. Write run artifacts under `.agentic-runs/`.

Existing untracked proposal documents under `docs/` are treated as pre-existing
local work and are not committed by the harness.

## Secrets

Do not commit webhooks or API keys. Use environment variables:

```bash
DISCORD_WEBHOOK_URL=...
OPENAI_API_KEY=...
```

`DISCORD_WEBHOOK_URL` enables start, provider, validation, push, PR, and failure
notifications. `OPENAI_API_KEY` is only needed for `--provider openai`.

GitHub Actions uses the same webhook name. Add this repository secret:

```text
DISCORD_WEBHOOK_URL
```

The deploy, rollback, and CI workflows call `scripts/agentic-discord.mjs` and
skip notifications safely when the secret is absent.

## Configuration

The harness config is in:

```text
scripts/agentic-harness.config.json
```

Important fields:

- `baseBranch`: PR target branch, currently `dev`.
- `defaultProvider`: provider used by `run`.
- `validationCommands`: commands that must pass before commit/push.
- `allowedExistingDirtyGlobs`: local files the harness may ignore when deciding
  whether the worktree is safe.
- `autoPush` and `autoPr`: automatic delivery gates.

## GitHub Auth

PR creation uses GitHub CLI:

```bash
gh auth status
gh auth login -h github.com
```

If `gh` is not authenticated, the harness can still create local commits, but
push and PR creation will fail until the token is fixed.
