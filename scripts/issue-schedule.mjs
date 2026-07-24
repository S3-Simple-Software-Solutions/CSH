#!/usr/bin/env node
// Le pone ventana de trabajo a un issue en el roadmap: arranca el dia que se
// abre y vence a los `dueDays` (una semana por defecto).
//
// Los campos nativos Start date / Target date de GitHub son "issue fields" y su
// mutacion (updateIssueFieldValue) rechaza los draft items con los que esta
// cargado el SOW, asi que el roadmap usa los campos propios del proyecto
// Inicio SOW / Entrega SOW, que si aceptan drafts e issues por igual.
//
//   node scripts/issue-schedule.mjs --issue-number 39
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";

const DEFAULT_CONFIG_PATH = "scripts/issue-userstory.config.json";
const REPO = process.env.GITHUB_REPOSITORY || "S3-Simple-Software-Solutions/CSH";

function parseArgs(argv) {
  const args = { configPath: DEFAULT_CONFIG_PATH };
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--issue-number") {
      args.issueNumber = value;
      i += 1;
    } else if (key === "--days") {
      args.days = Number(value);
      i += 1;
    } else if (key === "--config") {
      args.configPath = value || DEFAULT_CONFIG_PATH;
      i += 1;
    }
  }
  return args;
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

function gql(query, variables, env) {
  const args = ["api", "graphql", "-f", `query=${query}`];
  for (const [key, value] of Object.entries(variables)) {
    args.push("-F", `${key}=${value}`);
  }
  return JSON.parse(run("gh", args, { env }));
}

const Q_ITEMS = `
query($projectId:ID!, $cursor:String) {
  node(id:$projectId) { ... on ProjectV2 {
    items(first:100, after:$cursor) {
      pageInfo { hasNextPage endCursor }
      nodes { id content { ... on Issue { number } } }
    }
  }}
}`;

const M_DATE = `
mutation($p:ID!,$i:ID!,$f:ID!,$v:Date!){updateProjectV2ItemFieldValue(
  input:{projectId:$p,itemId:$i,fieldId:$f,value:{date:$v}}){projectV2Item{id}}}`;

function isoDate(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function findItem(projectId, issueNumber, env) {
  let cursor = "";
  for (;;) {
    const data = gql(Q_ITEMS, { projectId, cursor }, env);
    const items = data.data.node.items;
    const match = items.nodes.find(
      (node) => node.content?.number === Number(issueNumber)
    );
    if (match) return match.id;
    if (!items.pageInfo.hasNextPage) return null;
    cursor = items.pageInfo.endCursor;
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.issueNumber) throw new Error("Falta --issue-number.");

  const config = JSON.parse(fs.readFileSync(path.resolve(args.configPath), "utf8"));
  const roadmap = config.roadmap || {};
  if (!roadmap.number) throw new Error("El config no tiene la seccion roadmap.");

  const token = process.env.GH_PROJECT_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new Error("GH_PROJECT_TOKEN/GITHUB_TOKEN no esta disponible.");
  const env = { GH_TOKEN: token };

  const issue = JSON.parse(run("gh", [
    "issue", "view", String(args.issueNumber),
    "--repo", REPO, "--json", "number,title,url,createdAt"
  ]));

  const projectView = JSON.parse(run("gh", [
    "project", "view", String(roadmap.number),
    "--owner", roadmap.owner, "--format", "json"
  ], { env }));
  const projectId = projectView.id;

  const itemId = findItem(projectId, issue.number, env);
  if (!itemId) {
    // El alta la hace el workflow nativo de auto-add del proyecto; si todavia no
    // corrio, no hay item que agendar.
    console.log(JSON.stringify({
      issue: issue.number,
      scheduled: false,
      message: `el issue #${issue.number} todavia no esta en el proyecto ${roadmap.owner}/${roadmap.number}`
    }, null, 2));
    process.exitCode = 1;
    return;
  }

  const fields = JSON.parse(run("gh", [
    "project", "field-list", String(roadmap.number),
    "--owner", roadmap.owner, "--format", "json"
  ], { env })).fields || [];
  const startField = fields.find((f) => f.name === roadmap.startFieldName);
  const dueField = fields.find((f) => f.name === roadmap.dueFieldName);
  if (!startField?.id || !dueField?.id) {
    throw new Error(`faltan los campos "${roadmap.startFieldName}" o "${roadmap.dueFieldName}" en el proyecto`);
  }

  const days = Number.isFinite(args.days) ? args.days : (roadmap.dueDays ?? 7);
  const start = new Date(issue.createdAt);
  const due = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);

  gql(M_DATE, { p: projectId, i: itemId, f: startField.id, v: isoDate(start) }, env);
  gql(M_DATE, { p: projectId, i: itemId, f: dueField.id, v: isoDate(due) }, env);

  console.log(JSON.stringify({
    issue: issue.number,
    scheduled: true,
    start: isoDate(start),
    due: isoDate(due),
    days
  }, null, 2));
}

main();
