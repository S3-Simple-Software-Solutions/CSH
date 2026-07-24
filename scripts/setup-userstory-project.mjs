#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const CONFIG_PATH = "scripts/issue-userstory.config.json";

function gh(args) {
  return execFileSync("gh", args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"]
  }).trim();
}

function loadConfig() {
  return JSON.parse(fs.readFileSync(path.resolve(CONFIG_PATH), "utf8"));
}

function saveConfig(config) {
  fs.writeFileSync(path.resolve(CONFIG_PATH), `${JSON.stringify(config, null, 2)}\n`);
}

function main() {
  const config = loadConfig();
  const project = config.project;
  const list = JSON.parse(gh(["project", "list", "--owner", project.owner, "--format", "json"]));
  const existing = (list.projects || []).find((candidate) => candidate.title === project.title);
  const created = existing || JSON.parse(gh([
    "project",
    "create",
    "--owner",
    project.owner,
    "--title",
    project.title,
    "--format",
    "json"
  ]));

  project.number = created.number;
  const fields = JSON.parse(gh([
    "project",
    "field-list",
    String(project.number),
    "--owner",
    project.owner,
    "--format",
    "json"
  ])).fields || [];

  if (!fields.some((field) => field.name === project.fieldName)) {
    gh([
      "project",
      "field-create",
      String(project.number),
      "--owner",
      project.owner,
      "--name",
      project.fieldName,
      "--data-type",
      "SINGLE_SELECT",
      "--single-select-options",
      project.statusOptions.join(",")
    ]);
  }

  saveConfig(config);
  console.log(`Project ready: ${project.owner}/${project.number} (${project.title})`);
  console.log(`Status field: ${project.fieldName}`);
}

main();
