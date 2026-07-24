#!/usr/bin/env node
import process from "node:process";

const COLORS = {
  info: 0x5865f2,
  success: 0x2ecc71,
  warning: 0xf1c40f,
  failure: 0xe74c3c
};

function parseArgs(argv) {
  const args = {
    title: "Agentic harness",
    description: "",
    status: "info",
    runId: "",
    url: "",
    fields: []
  };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];
    if (key === "--title") {
      args.title = value || args.title;
      i += 1;
    } else if (key === "--description") {
      args.description = value || "";
      i += 1;
    } else if (key === "--status") {
      args.status = value || "info";
      i += 1;
    } else if (key === "--run-id") {
      args.runId = value || "";
      i += 1;
    } else if (key === "--url") {
      args.url = value || "";
      i += 1;
    } else if (key === "--field") {
      args.fields.push(value || "");
      i += 1;
    }
  }
  return args;
}

function parseField(value) {
  const index = value.indexOf("=");
  if (index === -1) {
    return null;
  }
  return {
    name: value.slice(0, index).trim(),
    value: value.slice(index + 1).trim() || "-",
    inline: true
  };
}

async function main() {
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log("DISCORD_WEBHOOK_URL is not set; notification skipped.");
    return;
  }

  const args = parseArgs(process.argv.slice(2));
  const fields = args.fields.map(parseField).filter(Boolean);
  if (args.runId) {
    fields.unshift({ name: "Run", value: args.runId, inline: true });
  }

  const body = {
    username: "CSH Agentic Harness",
    embeds: [
      {
        title: args.title,
        description: args.description || undefined,
        color: COLORS[args.status] || COLORS.info,
        url: args.url || undefined,
        fields,
        timestamp: new Date().toISOString()
      }
    ]
  };

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Discord notification failed: ${response.status} ${text}`.trim());
  }

  console.log("Discord notification sent.");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
