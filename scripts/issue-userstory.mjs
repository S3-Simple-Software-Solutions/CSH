#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";

const DEFAULT_CONFIG_PATH = "scripts/issue-userstory.config.json";
const REPO = process.env.GITHUB_REPOSITORY || "S3-Simple-Software-Solutions/CSH";

function parseArgs(argv) {
  const args = {
    issueNumber: "",
    issueUrl: "",
    issueTitle: "",
    issueBody: "",
    issueAuthor: "",
    provider: "",
    configPath: DEFAULT_CONFIG_PATH,
    dryRun: false,
    noPush: false,
    noComment: false,
    noProject: false,
    noNotify: false,
    allOpen: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--issue-number") {
      args.issueNumber = value || "";
      i += 1;
    } else if (key === "--issue-url") {
      args.issueUrl = value || "";
      i += 1;
    } else if (key === "--issue-title") {
      args.issueTitle = value || "";
      i += 1;
    } else if (key === "--issue-body") {
      args.issueBody = value || "";
      i += 1;
    } else if (key === "--issue-author") {
      args.issueAuthor = value || "";
      i += 1;
    } else if (key === "--provider") {
      args.provider = value || "";
      i += 1;
    } else if (key === "--config") {
      args.configPath = value || DEFAULT_CONFIG_PATH;
      i += 1;
    } else if (key === "--all-open") {
      args.allOpen = true;
    } else if (key === "--dry-run") {
      args.dryRun = true;
    } else if (key === "--no-push") {
      args.noPush = true;
    } else if (key === "--no-comment") {
      args.noComment = true;
    } else if (key === "--no-project") {
      args.noProject = true;
    } else if (key === "--no-notify") {
      args.noNotify = true;
    }
  }

  if (args.issueNumber === "all") {
    args.allOpen = true;
  }
  return args;
}

function loadConfig(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(filePath), "utf8"));
}

function run(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...(options.env || {}) },
    encoding: "utf8",
    stdio: options.stdio || ["ignore", "pipe", "pipe"]
  });
  return typeof output === "string" ? output.trim() : "";
}

function spawn(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || process.cwd(),
    env: { ...process.env, ...(options.env || {}) },
    input: options.input,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 30
  });
  return {
    ok: result.status === 0,
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || ""
  };
}

function slugify(value) {
  return String(value || "issue")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 58) || "issue";
}

function issueId(number) {
  return `US-${String(number).padStart(4, "0")}`;
}

function readIssue(issueNumber) {
  const json = run("gh", [
    "issue",
    "view",
    String(issueNumber),
    "--repo",
    REPO,
    "--json",
    "number,title,body,author,url,labels,state"
  ]);
  const issue = JSON.parse(json);
  return {
    number: issue.number,
    title: issue.title || `Issue ${issue.number}`,
    body: issue.body || "",
    author: issue.author?.login || "",
    url: issue.url,
    labels: (issue.labels || []).map((label) => label.name),
    state: issue.state
  };
}

function listOpenIssues() {
  const json = run("gh", [
    "issue",
    "list",
    "--repo",
    REPO,
    "--state",
    "open",
    "--limit",
    "200",
    "--json",
    "number,title,labels"
  ]);
  return JSON.parse(json).map((issue) => issue.number);
}

function promptForIssue(issue, storyId) {
  return [
    "# User Story Intake",
    "",
    "Expand this GitHub issue into a product-ready user story for Club Sport Herediano.",
    "Return Markdown only. Do not include code fences. Do not edit files.",
    "",
    "## Required Sections",
    `# ${storyId}: <short story title>`,
    "",
    "## Source Issue",
    "- Issue number",
    "- Issue URL",
    "- Author",
    "",
    "## Expanded Problem",
    "",
    "## User Story",
    "As a <role>, I want <capability>, so that <outcome>.",
    "",
    "## Inputs",
    "",
    "## Outputs",
    "",
    "## Functional Requirements",
    "",
    "## Non-Functional Requirements",
    "",
    "## Acceptance Criteria",
    "",
    "## Edge Cases",
    "",
    "## Dependencies",
    "",
    "## Open Questions",
    "",
    "## Suggested First Slice",
    "",
    "## Issue Context",
    `- Number: ${issue.number}`,
    `- URL: ${issue.url}`,
    `- Author: ${issue.author || "unknown"}`,
    `- Title: ${issue.title}`,
    "",
    issue.body || "(No issue body provided.)"
  ].join("\n");
}

function fallbackStory(issue, storyId) {
  const title = issue.title || `Issue ${issue.number}`;
  return [
    `# ${storyId}: ${title}`,
    "",
    "## Source Issue",
    `- Issue number: ${issue.number}`,
    `- Issue URL: ${issue.url}`,
    `- Author: ${issue.author || "unknown"}`,
    "",
    "## Expanded Problem",
    issue.body || "The issue does not include a detailed body yet. Product discovery should clarify the desired behavior, impacted users, current workaround, and business priority.",
    "",
    "## User Story",
    `As a CSH platform user, I want ${title}, so that the product supports the workflow described in the source issue.`,
    "",
    "## Inputs",
    "- Source issue title and body.",
    "- Existing app behavior and affected module.",
    "- User role, permissions, and data required by the workflow.",
    "",
    "## Outputs",
    "- A validated product behavior in the application.",
    "- User-facing feedback or persisted data when applicable.",
    "- Logs, audit records, or notifications when the workflow changes state.",
    "",
    "## Functional Requirements",
    "- Preserve existing repository patterns.",
    "- Implement the behavior described by the source issue.",
    "- Add or update validation for the affected workflow.",
    "- Keep permissions and data ownership consistent with existing modules.",
    "",
    "## Non-Functional Requirements",
    "- Keep the implementation small and reviewable.",
    "- Avoid new dependencies unless they clearly reduce risk.",
    "- Do not expose secrets or sensitive user data.",
    "- Maintain compatibility with the current deploy pipeline.",
    "",
    "## Acceptance Criteria",
    "- The issue behavior is reproducible or clearly understood.",
    "- The implemented behavior satisfies the story for the target role.",
    "- Relevant tests or checks pass.",
    "- The change is documented in the PR summary.",
    "",
    "## Edge Cases",
    "- Missing or malformed input data.",
    "- Unauthorized users reaching the workflow.",
    "- Empty states and repeated submissions.",
    "",
    "## Dependencies",
    "- Existing CSH app modules and deployment workflow.",
    "- Clarification from the issue owner if the issue lacks detail.",
    "",
    "## Open Questions",
    "- Which user role is the primary actor?",
    "- What module owns the workflow?",
    "- Is this blocking a release or operational process?",
    "",
    "## Suggested First Slice",
    "- Confirm current behavior, identify the affected files, and add the smallest testable implementation."
  ].join("\n");
}

function runProvider(config, providerName, issue, storyId, runDir) {
  const provider = config.providers?.[providerName];
  if (!provider) {
    throw new Error(`Unknown provider: ${providerName}`);
  }
  fs.mkdirSync(runDir, { recursive: true });
  const prompt = promptForIssue(issue, storyId);
  fs.writeFileSync(path.join(runDir, "prompt.md"), `${prompt}\n`);

  if (provider.type === "noop") {
    return fallbackStory(issue, storyId);
  }

  if (provider.type === "codex-cli") {
    const outputPath = path.join(runDir, "agent-output.md");
    const args = [
      "exec",
      "--cd",
      process.cwd(),
      "--sandbox",
      provider.sandbox || "workspace-write",
      "--ask-for-approval",
      provider.approval || "never",
      "--output-last-message",
      outputPath,
      "-m",
      provider.model || "gpt-5.6-sol",
      "-"
    ];
    const result = spawn(provider.command || "codex", args, { input: prompt });
    fs.writeFileSync(path.join(runDir, "agent-events.log"), `${result.stdout}\n${result.stderr}`);
    if (result.ok && fs.existsSync(outputPath)) {
      const text = fs.readFileSync(outputPath, "utf8").trim();
      if (text) return text;
    }
    return fallbackStory(issue, storyId);
  }

  if (provider.type === "claude-cli") {
    const args = [
      "--print",
      "--output-format",
      "stream-json",
      "--model",
      provider.model || "sonnet",
      "--allowedTools",
      (provider.allowedTools || []).join(","),
      prompt
    ];
    const result = spawn(provider.command || "claude", args);
    fs.writeFileSync(path.join(runDir, "agent-events.log"), `${result.stdout}\n${result.stderr}`);
    if (result.ok) {
      const text = extractClaudeText(result.stdout);
      if (text) return text;
    }
    return fallbackStory(issue, storyId);
  }

  return fallbackStory(issue, storyId);
}

function extractClaudeText(stdout) {
  const text = [];
  for (const line of String(stdout || "").split("\n").filter(Boolean)) {
    try {
      const event = JSON.parse(line);
      const content = event?.message?.content || event?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "text" && block.text) text.push(block.text);
        }
      } else if (typeof content === "string") {
        text.push(content);
      }
    } catch {
      // Ignore progress lines.
    }
  }
  return text.join("\n").trim();
}

function writeStory(config, issue, storyMarkdown, overrideDir = null) {
  const storyId = issueId(issue.number);
  const dir = overrideDir || path.resolve(config.storyRoot || "docs/user-stories");
  fs.mkdirSync(dir, { recursive: true });
  const fileName = `${storyId}-${slugify(issue.title)}.md`;
  const filePath = path.join(dir, fileName);
  const body = [
    "---",
    `id: ${storyId}`,
    `issue: ${issue.number}`,
    `issue_url: ${issue.url}`,
    "stage: Backlog",
    `generated_at: ${new Date().toISOString()}`,
    "---",
    "",
    storyMarkdown.trim(),
    ""
  ].join("\n");
  fs.writeFileSync(filePath, body);
  return filePath;
}

function ensureBranch(config, issue, dryRun) {
  const baseBranch = config.baseBranch || "dev";
  const branch = `${config.branchPrefix || "issue"}/${issue.number}-${slugify(issue.title)}`;
  if (dryRun) return branch;

  run("git", ["fetch", "origin", baseBranch], { stdio: "inherit" });
  const branches = run("git", ["branch", "--list", branch]);
  if (branches) {
    run("git", ["switch", branch], { stdio: "inherit" });
  } else {
    run("git", ["switch", "-c", branch, `origin/${baseBranch}`], { stdio: "inherit" });
  }
  return branch;
}

function commitAndPush(issue, filePath, branch, noPush, dryRun) {
  if (dryRun) return;
  run("git", ["add", filePath], { stdio: "inherit" });
  const status = run("git", ["status", "--porcelain", "--", filePath]);
  if (!status) return;
  run("git", ["commit", "-m", `docs: add user story for issue ${issue.number}`], { stdio: "inherit" });
  if (!noPush) {
    run("git", ["push", "-u", "origin", branch], { stdio: "inherit" });
  }
}

function commentIssue(issue, storyPath, branch, projectResult, args) {
  if (args.noComment || args.dryRun) return;
  ensureLabel("user-story", "0E8A16", "Issue has a generated user story");
  ensureLabel("user-story-created", "5319E7", "Automation generated a user story for this issue");
  const body = [
    "## User story created",
    "",
    `Branch: \`${branch}\``,
    `User story: \`${storyPath}\``,
    `Project stage: ${projectResult.added ? "Backlog" : "pending project setup"}`,
    "",
    "The issue has been expanded into a user story with inputs, outputs, functional requirements, non-functional requirements, acceptance criteria, edge cases, dependencies, open questions, and a suggested first slice.",
    "",
    projectResult.message ? `Project note: ${projectResult.message}` : ""
  ].filter(Boolean).join("\n");
  run("gh", ["issue", "comment", String(issue.number), "--repo", REPO, "--body", body], { stdio: "inherit" });
  run("gh", ["issue", "edit", String(issue.number), "--repo", REPO, "--add-label", "user-story,user-story-created"], { stdio: "inherit" });
}

function ensureLabel(name, color, description) {
  run("gh", [
    "label",
    "create",
    name,
    "--repo",
    REPO,
    "--color",
    color,
    "--description",
    description,
    "--force"
  ], { stdio: "inherit" });
}

function addToProject(config, issue, args) {
  if (args.noProject || args.dryRun) {
    return { added: false, message: "project update skipped" };
  }
  const project = config.project || {};
  if (!project.number) {
    return { added: false, message: "project.number is not configured yet" };
  }
  const token = process.env.GH_PROJECT_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    return { added: false, message: "GH_PROJECT_TOKEN/GITHUB_TOKEN is not available" };
  }

  const env = { GH_TOKEN: token };
  try {
    const itemJson = run("gh", [
      "project",
      "item-add",
      String(project.number),
      "--owner",
      project.owner,
      "--url",
      issue.url,
      "--format",
      "json"
    ], { env });
    const item = JSON.parse(itemJson);
    const projectView = JSON.parse(run("gh", [
      "project",
      "view",
      String(project.number),
      "--owner",
      project.owner,
      "--format",
      "json"
    ], { env }));
    const fieldsJson = run("gh", [
      "project",
      "field-list",
      String(project.number),
      "--owner",
      project.owner,
      "--format",
      "json"
    ], { env });
    const fields = JSON.parse(fieldsJson).fields || [];
    const field = fields.find((candidate) => candidate.name === project.fieldName);
    const option = field?.options?.find((candidate) => candidate.name === project.backlogOption);
    if (field?.id && option?.id && item?.id) {
      const projectId = projectView.id || item.projectId || field.projectId || fieldsJson.match(/"projectId":"([^"]+)"/)?.[1];
      if (projectId) {
        run("gh", [
          "project",
          "item-edit",
          "--id",
          item.id,
          "--project-id",
          projectId,
          "--field-id",
          field.id,
          "--single-select-option-id",
          option.id
        ], { env, stdio: "inherit" });
      }
    }
    return { added: true, message: `added to project ${project.owner}/${project.number}` };
  } catch (error) {
    return { added: false, message: `project update failed: ${error.message}` };
  }
}

async function notify(issue, storyPath, branch, projectResult, args) {
  if (args.noNotify || !process.env.DISCORD_WEBHOOK_URL) return;
  const description = [
    `Issue #${issue.number}: ${issue.title}`,
    `Branch: ${branch}`,
    `Story: ${storyPath}`,
    `Project: ${projectResult.added ? "Backlog" : projectResult.message}`
  ].join("\n");
  spawn("node", [
    "scripts/agentic-discord.mjs",
    "--title",
    "New CSH user story",
    "--description",
    description,
    "--status",
    "success",
    "--field",
    `Issue=${issue.url}`,
    "--field",
    `Stage=Backlog`
  ]);
}

function issueFromArgs(args) {
  return {
    number: Number.parseInt(args.issueNumber, 10),
    title: args.issueTitle || `Issue ${args.issueNumber}`,
    body: args.issueBody || "",
    author: args.issueAuthor || "",
    url: args.issueUrl || `https://github.com/${REPO}/issues/${args.issueNumber}`,
    labels: [],
    state: "OPEN"
  };
}

async function processIssue(config, args, issueNumber) {
  const issue = args.issueTitle && args.issueNumber === String(issueNumber)
    ? issueFromArgs(args)
    : readIssue(issueNumber);
  const doneLabel = config.labels?.done || "user-story-created";
  if (issue.labels.includes(doneLabel)) {
    console.log(`Issue #${issue.number} already has ${doneLabel}; skipping.`);
    return;
  }

  const branch = ensureBranch(config, issue, args.dryRun);
  const storyId = issueId(issue.number);
  const runDir = path.resolve(".agentic-runs", `issue-${issue.number}-${Date.now()}`);
  const provider = args.provider || config.defaultProvider || "codex";
  const story = runProvider(config, provider, issue, storyId, runDir);
  const storyPath = writeStory(config, issue, story, args.dryRun ? runDir : null);
  commitAndPush(issue, storyPath, branch, args.noPush, args.dryRun);
  const projectResult = addToProject(config, issue, args);
  commentIssue(issue, path.relative(process.cwd(), storyPath), branch, projectResult, args);
  await notify(issue, path.relative(process.cwd(), storyPath), branch, projectResult, args);
  console.log(JSON.stringify({ issue: issue.number, branch, storyPath, project: projectResult }, null, 2));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.configPath);
  if (args.allOpen) {
    for (const issueNumber of listOpenIssues()) {
      await processIssue(config, args, issueNumber);
    }
    return;
  }
  if (!args.issueNumber) {
    throw new Error("Missing --issue-number or --all-open.");
  }
  await processIssue(config, args, Number.parseInt(args.issueNumber, 10));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
