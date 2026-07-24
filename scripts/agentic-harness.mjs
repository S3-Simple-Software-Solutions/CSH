#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync, execFileSync } from "node:child_process";

const DEFAULT_CONFIG_PATH = "scripts/agentic-harness.config.json";

function parseArgs(argv) {
  const args = {
    command: "run",
    task: "",
    taskFile: "",
    provider: "",
    model: "",
    base: "",
    branch: "",
    configPath: DEFAULT_CONFIG_PATH,
    dryRun: false,
    allowDirty: false,
    autoPr: null,
    autoPush: null,
    notify: null,
    skipValidation: false
  };

  const commands = new Set(["run", "plan", "notify-test", "status"]);
  if (argv[0] && commands.has(argv[0])) {
    args.command = argv.shift();
  }

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--task" || key === "-t") {
      args.task = value || "";
      i += 1;
    } else if (key === "--task-file") {
      args.taskFile = value || "";
      i += 1;
    } else if (key === "--provider" || key === "-p") {
      args.provider = value || "";
      i += 1;
    } else if (key === "--model" || key === "-m") {
      args.model = value || "";
      i += 1;
    } else if (key === "--base") {
      args.base = value || "";
      i += 1;
    } else if (key === "--branch") {
      args.branch = value || "";
      i += 1;
    } else if (key === "--config") {
      args.configPath = value || DEFAULT_CONFIG_PATH;
      i += 1;
    } else if (key === "--dry-run") {
      args.dryRun = true;
    } else if (key === "--allow-dirty") {
      args.allowDirty = true;
    } else if (key === "--auto-pr") {
      args.autoPr = true;
    } else if (key === "--no-auto-pr") {
      args.autoPr = false;
    } else if (key === "--auto-push") {
      args.autoPush = true;
    } else if (key === "--no-auto-push") {
      args.autoPush = false;
    } else if (key === "--notify") {
      args.notify = true;
    } else if (key === "--no-notify") {
      args.notify = false;
    } else if (key === "--skip-validation") {
      args.skipValidation = true;
    } else if (key === "--help" || key === "-h") {
      args.command = "help";
    } else if (!args.task) {
      args.task = key;
    } else {
      args.task += ` ${key}`;
    }
  }

  if (args.taskFile) {
    args.task = fs.readFileSync(path.resolve(args.taskFile), "utf8").trim();
  }

  if (args.command === "plan" && !args.provider) {
    args.provider = "openai";
  }

  return args;
}

function usage() {
  console.log(`Usage:
  npm run agentic -- run --task "..." [--provider codex|claude|openai|noop]
  npm run agentic -- plan --task "..."
  npm run agentic -- notify-test
  npm run agentic -- status

Common options:
  --base dev              Base branch for branch and PR creation.
  --branch name           Feature branch name. Defaults to agent/<task>-<timestamp>.
  --auto-pr / --no-auto-pr
  --auto-push / --no-auto-push
  --notify / --no-notify
  --dry-run
  --allow-dirty
  --skip-validation`);
}

function loadConfig(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: options.cwd || process.cwd(),
    encoding: "utf8",
    stdio: options.stdio || ["ignore", "pipe", "pipe"]
  }).trim();
}

function runCommand(command, options = {}) {
  const startedAt = Date.now();
  const result = spawnSync(command, {
    cwd: options.cwd || process.cwd(),
    shell: true,
    input: options.input,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
    env: { ...process.env, ...(options.env || {}) }
  });
  return {
    command,
    status: result.status ?? 1,
    ok: result.status === 0,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    durationMs: Date.now() - startedAt
  };
}

function nowId() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "Z");
}

function slugify(value) {
  return String(value || "task")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 54) || "task";
}

function statusEntries() {
  const raw = git(["status", "--porcelain"]);
  if (!raw) return [];
  return raw.split("\n").filter(Boolean).map((line) => {
    const pathStart = line[2] === " " ? 3 : line[1] === " " ? 2 : 3;
    return {
      status: line.slice(0, 2).trim() || "?",
      path: line.slice(pathStart).trim()
    };
  });
}

function matchGlob(pattern, filePath) {
  let source = "";
  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i];
    const next = pattern[i + 1];
    if (char === "*" && next === "*") {
      source += ".*";
      i += 1;
    } else if (char === "*") {
      source += "[^/]*";
    } else {
      source += char.replace(/[.+^${}()|[\]\\]/g, "\\$&");
    }
  }
  return new RegExp(`^${source}$`).test(filePath);
}

function isAllowedDirty(entry, config) {
  return (config.allowedExistingDirtyGlobs || []).some((pattern) => matchGlob(pattern, entry.path));
}

function diffNewEntries(before, after) {
  const beforeKeys = new Set(before.map((entry) => `${entry.status}\t${entry.path}`));
  return after.filter((entry) => !beforeKeys.has(`${entry.status}\t${entry.path}`));
}

function ensureRunDir(config, runId) {
  const dir = path.resolve(config.runRoot || ".agentic-runs", runId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function notify(enabled, payload) {
  if (!enabled) return;
  if (!process.env.DISCORD_WEBHOOK_URL) {
    console.log(`[notify skipped] ${payload.title}`);
    return;
  }

  const args = [
    "scripts/agentic-discord.mjs",
    "--title", payload.title,
    "--description", payload.description || "",
    "--status", payload.status || "info"
  ];
  if (payload.runId) args.push("--run-id", payload.runId);
  for (const field of payload.fields || []) {
    args.push("--field", `${field.name}=${field.value}`);
  }

  const result = spawnSync("node", args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024
  });
  if (result.status !== 0) {
    console.error(result.stderr || result.stdout || "Discord notification failed.");
  }
}

function buildPrompt({ task, config, providerName, runId, baseBranch }) {
  const readList = (config.readBeforeEditing || []).map((item) => `- ${item}`).join("\n");
  const validationList = (config.validationCommands || []).map((item) => `- ${item}`).join("\n");
  return [
    "# CSH Agentic Harness Task",
    "",
    `Run id: ${runId}`,
    `Provider: ${providerName}`,
    `Base branch: ${baseBranch}`,
    "",
    "## Task",
    task,
    "",
    "## Repository Rules",
    "- Read repository instructions before editing.",
    "- Keep changes scoped to the requested task.",
    "- Preserve existing user changes and untracked docs.",
    "- Do not commit, push, create PRs, or deploy; the harness performs those steps.",
    "- Do not print secrets or environment values.",
    "- Prefer existing project patterns and avoid new dependencies unless necessary.",
    "",
    "## Read Before Editing",
    readList || "- AGENTS.md\n- docs/harness.md",
    "",
    "## Validation Expected",
    validationList || "- Run the smallest relevant checks.",
    "",
    "## Final Response Required",
    "Return a concise change summary, changed files, validation run, and residual risks."
  ].join("\n");
}

function runProvider({ providerName, provider, prompt, runDir, model }) {
  const outputPath = path.join(runDir, "provider-output.md");
  const eventPath = path.join(runDir, "provider-events.log");

  if (provider.type === "noop") {
    fs.writeFileSync(outputPath, "Noop provider: no model execution.\n");
    return { ok: true, providerName, outputPath, eventPath, command: "noop" };
  }

  if (provider.type === "codex-cli") {
    const args = [
      "exec",
      "--cd", process.cwd(),
      "--sandbox", provider.sandbox || "workspace-write",
      "--ask-for-approval", provider.approval || "never",
      "--output-last-message", outputPath,
      "--json",
      "-m", model || provider.model || "gpt-5.6-sol",
      "-"
    ];
    const result = spawnSync(provider.command || "codex", args, {
      cwd: process.cwd(),
      input: prompt,
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 50
    });
    fs.writeFileSync(eventPath, `${result.stdout || ""}\n${result.stderr || ""}`);
    return { ok: result.status === 0, status: result.status, providerName, outputPath, eventPath, command: `${provider.command || "codex"} ${args.join(" ")}` };
  }

  if (provider.type === "claude-cli") {
    const args = [
      "--print",
      "--output-format", "stream-json",
      "--model", model || provider.model || "sonnet",
      "--allowedTools", (provider.allowedTools || []).join(","),
      prompt
    ];
    const result = spawnSync(provider.command || "claude", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      maxBuffer: 1024 * 1024 * 50
    });
    fs.writeFileSync(eventPath, `${result.stdout || ""}\n${result.stderr || ""}`);
    fs.writeFileSync(outputPath, extractClaudeText(result.stdout) || result.stdout || result.stderr || "");
    return { ok: result.status === 0, status: result.status, providerName, outputPath, eventPath, command: `${provider.command || "claude"} --print ...` };
  }

  if (provider.type === "openai-responses") {
    return runOpenAiProvider({ providerName, provider, prompt, outputPath, eventPath, model });
  }

  throw new Error(`Unsupported provider type: ${provider.type}`);
}

function extractClaudeText(stdout) {
  const lines = String(stdout || "").split("\n").filter(Boolean);
  const text = [];
  for (const line of lines) {
    try {
      const event = JSON.parse(line);
      const content = event?.message?.content || event?.delta?.text || event?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "text" && block.text) text.push(block.text);
        }
      } else if (typeof content === "string") {
        text.push(content);
      }
    } catch {
      // Ignore non-JSON progress lines.
    }
  }
  return text.join("\n").trim();
}

function extractOpenAiText(responseJson) {
  if (typeof responseJson.output_text === "string") return responseJson.output_text;
  const output = [];
  for (const item of responseJson.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && content.text) output.push(content.text);
      if (content.type === "text" && content.text) output.push(content.text);
    }
  }
  return output.join("\n").trim();
}

function runOpenAiProvider({ providerName, provider, prompt, outputPath, eventPath, model }) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is required for the openai provider.");
  }
  const body = {
    model: model || provider.model || "gpt-5.6-sol",
    input: prompt,
    reasoning: { effort: provider.reasoningEffort || "medium" },
    text: { verbosity: provider.verbosity || "medium" }
  };
  const result = spawnSync("node", [
    "-e",
    `
      const body = JSON.parse(process.argv[1]);
      const res = await fetch(process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify(body)
      });
      const text = await res.text();
      if (!res.ok) {
        console.error(text);
        process.exit(1);
      }
      console.log(text);
    `,
    JSON.stringify(body)
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024 * 20
  });
  fs.writeFileSync(eventPath, `${result.stdout || ""}\n${result.stderr || ""}`);
  if (result.status !== 0) {
    return { ok: false, status: result.status, providerName, outputPath, eventPath, command: "OpenAI Responses API" };
  }
  const parsed = JSON.parse(result.stdout);
  fs.writeFileSync(outputPath, `${extractOpenAiText(parsed) || result.stdout}\n`);
  return { ok: true, status: 0, providerName, outputPath, eventPath, command: "OpenAI Responses API" };
}

function runValidation(config, runDir, skipValidation) {
  if (skipValidation) {
    return [{ command: "validation skipped", ok: true, status: 0, stdout: "", stderr: "", durationMs: 0 }];
  }
  return (config.validationCommands || []).map((command, index) => {
    const result = runCommand(command);
    fs.writeFileSync(path.join(runDir, `validation-${index + 1}.log`), [
      `$ ${command}`,
      "",
      result.stdout,
      result.stderr
    ].join("\n"));
    return result;
  });
}

function titleFromTask(config, task) {
  const prefix = config.commitPrefix || "chore";
  return `${prefix}: ${slugify(task).replace(/-/g, " ").slice(0, 72)}`;
}

function writePrBody({ runDir, task, providerName, validation, changedPaths, runId }) {
  const body = [
    "## Summary",
    `- ${task}`,
    `- Provider: ${providerName}`,
    `- Harness run: ${runId}`,
    "",
    "## Changed Files",
    ...changedPaths.map((filePath) => `- \`${filePath}\``),
    "",
    "## Validation",
    ...(validation.length ? validation.map((item) => `- ${item.ok ? "PASS" : "FAIL"} \`${item.command}\``) : ["- Dry run, no validation executed."]),
    "",
    "## Notes",
    "- Generated by the CSH agentic harness.",
    "- Existing untracked docs were intentionally left untouched."
  ].join("\n");
  const filePath = path.join(runDir, "pr-body.md");
  fs.writeFileSync(filePath, `${body}\n`);
  return filePath;
}

function writeScorecard({ runDir, runId, task, providerName, providerResult, validation, beforeStatus, afterStatus, branch, baseBranch, prUrl }) {
  const scorecard = {
    runId,
    task,
    provider: providerName,
    branch,
    baseBranch,
    prUrl: prUrl || null,
    providerResult,
    validation: validation.map((item) => ({
      command: item.command,
      ok: item.ok,
      status: item.status,
      durationMs: item.durationMs
    })),
    git: {
      before: beforeStatus,
      after: afterStatus
    },
    completedAt: new Date().toISOString()
  };
  fs.writeFileSync(path.join(runDir, "scorecard.json"), `${JSON.stringify(scorecard, null, 2)}\n`);
}

function prepareBranch({ config, args, baseBranch, runId }) {
  const currentBranch = git(["branch", "--show-current"]);
  if (args.dryRun) return currentBranch;
  if (currentBranch === baseBranch) {
    const branch = args.branch || `${config.branchPrefix || "agent"}/${slugify(args.task)}-${runId}`;
    git(["switch", "-c", branch], { stdio: "inherit" });
    return branch;
  }
  return currentBranch;
}

function commitChanges({ changedPaths, title }) {
  if (changedPaths.length === 0) {
    return { committed: false, message: "No changes to commit." };
  }
  git(["add", ...changedPaths], { stdio: "inherit" });
  git(["commit", "-m", title], { stdio: "inherit" });
  return { committed: true, message: title };
}

function pushAndPr({ branch, baseBranch, title, prBodyPath, config, autoPush, autoPr }) {
  let prUrl = "";
  if (autoPush) {
    git(["push", "-u", "origin", branch], { stdio: "inherit" });
  }
  if (autoPr) {
    const args = ["pr", "create", "--base", baseBranch, "--head", branch, "--title", title, "--body-file", prBodyPath];
    for (const label of config.prLabels || []) {
      args.push("--label", label);
    }
    prUrl = execFileSync("gh", args, { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  }
  return prUrl;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.command === "help") {
    usage();
    return;
  }

  const config = loadConfig(args.configPath);
  const notifyEnabled = args.notify ?? config.notify ?? false;
  const providerName = args.provider || config.defaultProvider || "codex";
  const provider = config.providers?.[providerName];
  const baseBranch = args.base || config.baseBranch || "dev";
  const autoPr = args.autoPr ?? config.autoPr ?? true;
  const autoPush = args.autoPush ?? config.autoPush ?? true;
  const runId = `${nowId()}-${slugify(args.task || args.command)}`;
  const runDir = ensureRunDir(config, runId);

  if (args.command === "status") {
    console.log(JSON.stringify({ branch: git(["branch", "--show-current"]), status: statusEntries() }, null, 2));
    return;
  }

  if (args.command === "notify-test") {
    await notify(true, {
      title: "CSH agentic harness notification test",
      description: "Discord notifications are wired.",
      status: "success",
      runId
    });
    return;
  }

  if (!args.task) {
    throw new Error("Missing --task or --task-file.");
  }
  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}`);
  }

  const beforeStatus = statusEntries();
  const blockingDirty = beforeStatus.filter((entry) => !isAllowedDirty(entry, config));
  if (blockingDirty.length > 0 && !args.allowDirty) {
    throw new Error(`Worktree has non-allowed dirty files. Use --allow-dirty if expected:\n${blockingDirty.map((entry) => `${entry.status} ${entry.path}`).join("\n")}`);
  }

  await notify(notifyEnabled, {
    title: "Agentic run started",
    description: args.task,
    status: "info",
    runId,
    fields: [{ name: "Provider", value: providerName }, { name: "Base", value: baseBranch }]
  });

  const branch = prepareBranch({ config, args, baseBranch, runId });
  const prompt = buildPrompt({ task: args.task, config, providerName, runId, baseBranch });
  fs.writeFileSync(path.join(runDir, "prompt.md"), `${prompt}\n`);

  let providerResult = { ok: true, providerName, command: "dry-run" };
  if (!args.dryRun) {
    await notify(notifyEnabled, { title: "Provider started", description: providerName, status: "info", runId });
    providerResult = runProvider({ providerName, provider, prompt, runDir, model: args.model });
    await notify(notifyEnabled, {
      title: providerResult.ok ? "Provider finished" : "Provider failed",
      description: providerName,
      status: providerResult.ok ? "success" : "failure",
      runId
    });
    if (!providerResult.ok) {
      throw new Error(`Provider failed: ${providerName}. See ${providerResult.eventPath}`);
    }
  }

  await notify(notifyEnabled, { title: "Validation started", description: "Running configured checks.", status: "info", runId });
  const validation = args.dryRun ? [] : runValidation(config, runDir, args.skipValidation);
  const validationOk = validation.every((item) => item.ok);
  await notify(notifyEnabled, {
    title: validationOk ? "Validation passed" : "Validation failed",
    description: validation.map((item) => `${item.ok ? "PASS" : "FAIL"} ${item.command}`).join("\n") || "Dry run.",
    status: validationOk ? "success" : "failure",
    runId
  });
  if (!validationOk) {
    throw new Error(`Validation failed. See logs in ${runDir}`);
  }

  const afterStatus = statusEntries();
  const newEntries = diffNewEntries(beforeStatus, afterStatus);
  const changedPaths = [...new Set(newEntries.map((entry) => entry.path))];
  const title = titleFromTask(config, args.task);
  const prBodyPath = writePrBody({ runDir, task: args.task, providerName, validation, changedPaths, runId });

  let prUrl = "";
  if (!args.dryRun) {
    const commit = commitChanges({ changedPaths, title });
    if (commit.committed && (autoPush || autoPr)) {
      await notify(notifyEnabled, { title: "Push/PR started", description: branch, status: "info", runId });
      prUrl = pushAndPr({ branch, baseBranch, title, prBodyPath, config, autoPush, autoPr });
      await notify(notifyEnabled, {
        title: "PR created",
        description: prUrl || branch,
        status: "success",
        runId
      });
    }
  }

  writeScorecard({ runDir, runId, task: args.task, providerName, providerResult, validation, beforeStatus, afterStatus, branch, baseBranch, prUrl });
  console.log(JSON.stringify({ ok: true, runId, runDir, branch, prUrl }, null, 2));
}

main().catch(async (error) => {
  const configPath = process.argv.includes("--config")
    ? process.argv[process.argv.indexOf("--config") + 1]
    : DEFAULT_CONFIG_PATH;
  let config = { notify: false };
  try {
    config = loadConfig(configPath);
  } catch {
    // Ignore config load errors while reporting the original failure.
  }
  await notify(config.notify && Boolean(process.env.DISCORD_WEBHOOK_URL), {
    title: "Agentic run failed",
    description: error.message || String(error),
    status: "failure"
  });
  console.error(error.message || error);
  process.exitCode = 1;
});
