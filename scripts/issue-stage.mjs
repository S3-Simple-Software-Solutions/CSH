#!/usr/bin/env node
// Mueve la etapa (CSH Stage) de la user story de un issue en el proyecto y avisa
// a Discord. Projects v2 no emite eventos de workflow, asi que la transicion se
// dispara con un comando en un comentario del issue y no observando el tablero.
//
//   node scripts/issue-stage.mjs --issue-number 39 --stage Building
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync, spawnSync } from "node:child_process";

const DEFAULT_CONFIG_PATH = "scripts/issue-userstory.config.json";
const REPO = process.env.GITHUB_REPOSITORY || "S3-Simple-Software-Solutions/CSH";

// Como se anuncia cada etapa. Las que no estan aca se avisan con su nombre crudo.
const STAGE_TITLES = {
  Planning: "User story en planificacion",
  Building: "User story en proceso",
  Tests: "User story terminada, lista para pruebas",
  TestDeploy: "User story desplegada en pruebas"
};

function parseArgs(argv) {
  const args = { configPath: DEFAULT_CONFIG_PATH, noNotify: false };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--issue-number") {
      args.issueNumber = value;
      i += 1;
    } else if (key === "--stage") {
      args.stage = value;
      i += 1;
    } else if (key === "--config") {
      args.configPath = value || DEFAULT_CONFIG_PATH;
      i += 1;
    } else if (key === "--no-notify") {
      args.noNotify = true;
    }
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

function fetchIssue(issueNumber) {
  return JSON.parse(run("gh", [
    "issue", "view", String(issueNumber),
    "--repo", REPO,
    "--json", "number,title,url"
  ]));
}

// Resuelve el item del proyecto que corresponde al issue, mas el id del campo de
// etapa y el de la opcion pedida. Se descubre en vivo en vez de fijar ids, que es
// como ya lo hace addToProject() en issue-userstory.mjs.
function resolveProjectTargets(project, issueNumber, env) {
  const projectView = JSON.parse(run("gh", [
    "project", "view", String(project.number),
    "--owner", project.owner, "--format", "json"
  ], { env }));

  const itemList = JSON.parse(run("gh", [
    "project", "item-list", String(project.number),
    "--owner", project.owner, "--format", "json", "--limit", "500"
  ], { env }));
  const item = (itemList.items || []).find(
    (candidate) => candidate.content?.number === Number(issueNumber)
  );
  if (!item) {
    throw new Error(`el issue #${issueNumber} no esta en el proyecto ${project.owner}/${project.number}`);
  }

  const fields = JSON.parse(run("gh", [
    "project", "field-list", String(project.number),
    "--owner", project.owner, "--format", "json"
  ], { env })).fields || [];
  const field = fields.find((candidate) => candidate.name === project.fieldName);
  if (!field?.id) {
    throw new Error(`el proyecto no tiene el campo "${project.fieldName}"`);
  }
  return { projectId: projectView.id, itemId: item.id, field };
}

function setStage(config, issue, stage) {
  const project = config.project || {};
  const token = process.env.GH_PROJECT_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    return { moved: false, message: "GH_PROJECT_TOKEN/GITHUB_TOKEN no esta disponible" };
  }

  const env = { GH_TOKEN: token };
  try {
    const { projectId, itemId, field } = resolveProjectTargets(project, issue.number, env);
    const option = (field.options || []).find((candidate) => candidate.name === stage);
    if (!option?.id) {
      const validas = (field.options || []).map((o) => o.name).join(", ");
      return { moved: false, message: `etapa "${stage}" invalida. Validas: ${validas}` };
    }

    run("gh", [
      "project", "item-edit",
      "--id", itemId,
      "--project-id", projectId,
      "--field-id", field.id,
      "--single-select-option-id", option.id
    ], { env, stdio: "inherit" });

    return { moved: true, message: `${project.fieldName} = ${stage}` };
  } catch (error) {
    return { moved: false, message: `no se pudo mover la etapa: ${error.message}` };
  }
}

function notify(issue, stage, result, args) {
  if (args.noNotify || !process.env.DISCORD_WEBHOOK_URL) return;
  spawnSync("node", [
    "scripts/agentic-discord.mjs",
    "--title", STAGE_TITLES[stage] || `User story en ${stage}`,
    "--description", `Issue #${issue.number}: ${issue.title}`,
    "--status", result.moved ? "success" : "warning",
    "--field", `Issue=${issue.url}`,
    "--field", `Etapa=${stage}`
  ], { stdio: "inherit", encoding: "utf8" });
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.issueNumber || !args.stage) {
    throw new Error("Faltan --issue-number o --stage.");
  }
  const config = loadConfig(args.configPath);
  const issue = fetchIssue(args.issueNumber);
  const result = setStage(config, issue, args.stage);
  notify(issue, args.stage, result, args);

  console.log(JSON.stringify({ issue: issue.number, stage: args.stage, ...result }, null, 2));
  if (!result.moved) process.exitCode = 1;
}

main();
