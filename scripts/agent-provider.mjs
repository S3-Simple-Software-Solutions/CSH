// Invocacion de los agentes (codex / claude) compartida por el intake de user
// stories y por la generacion de planes. Vive aparte porque los dos flujos
// tropezaron con los mismos bugs de CLI y no conviene arreglarlos dos veces.
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

// Permite distinguir despues si el texto salio del agente o del respaldo.
export const MARCA_FALLO = "No se pudo generar";

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

// El fallback silencioso escondio tres fallas seguidas del proveedor, y cada una
// produjo un artefacto inservible que igual se publicaba. Ahora deja rastro.
function reportarFallo(nombre, result, runDir) {
  const detalle = (result.stderr || result.stdout || "")
    .trim()
    .split("\n")
    .filter(Boolean)
    .pop() || "sin salida";
  const motivo = `${nombre} salio con codigo ${result.status} (${detalle})`;
  console.error(`::warning::El agente fallo. ${motivo}`);
  console.error(`Log completo: ${path.join(runDir, "agent-events.log")}`);
  return motivo;
}

// El stream de claude trae un bloque de texto por turno, incluida la narracion
// entre llamadas a herramientas. Se usa el evento terminal `result`, que trae
// solo la respuesta final; la concatenacion queda de respaldo si el stream se
// corta antes del cierre.
export function extractClaudeText(stdout) {
  const fallback = [];
  let result = "";

  for (const line of String(stdout || "").split("\n").filter(Boolean)) {
    try {
      const event = JSON.parse(line);
      if (event?.type === "result" && typeof event.result === "string") {
        result = event.result;
        continue;
      }
      const content = event?.message?.content || event?.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block?.type === "text" && block.text) fallback.push(block.text);
        }
      } else if (typeof content === "string") {
        fallback.push(content);
      }
    } catch {
      // Lineas de progreso, se ignoran.
    }
  }

  return (result || fallback.join("\n")).trim();
}

/**
 * Corre el agente con el prompt dado.
 * Devuelve { texto, ok, motivo }. Nunca lanza por fallo del proveedor: el
 * llamador decide que publicar.
 */
export function runAgent(config, providerName, prompt, runDir) {
  const provider = config.providers?.[providerName];
  if (!provider) {
    return { texto: "", ok: false, motivo: `proveedor desconocido: ${providerName}` };
  }

  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, "prompt.md"), `${prompt}\n`);

  if (provider.type === "noop") {
    return { texto: "", ok: false, motivo: 'proveedor "noop", no genera nada' };
  }

  if (provider.type === "codex-cli") {
    const outputPath = path.join(runDir, "agent-output.md");
    // Ojo: codex-cli 0.145 no acepta --ask-for-approval. `codex exec` ya corre
    // sin pedir aprobaciones, asi que no hace falta ningun flag equivalente.
    const args = [
      "exec",
      "--cd", process.cwd(),
      "--sandbox", provider.sandbox || "workspace-write",
      "--output-last-message", outputPath,
      "-m", provider.model || "gpt-5.6-sol",
      "-"
    ];
    const result = spawn(provider.command || "codex", args, { input: prompt });
    fs.writeFileSync(path.join(runDir, "agent-events.log"), `${result.stdout}\n${result.stderr}`);
    if (result.ok && fs.existsSync(outputPath)) {
      const texto = fs.readFileSync(outputPath, "utf8").trim();
      if (texto) return { texto, ok: true, motivo: "" };
    }
    return { texto: "", ok: false, motivo: reportarFallo("codex", result, runDir) };
  }

  if (provider.type === "claude-cli") {
    // El prompt va por stdin: --allowedTools es variadico y se traga cualquier
    // argumento posicional que le siga. --verbose es obligatorio para combinar
    // --print con --output-format stream-json.
    const args = [
      "--print",
      "--output-format", "stream-json",
      "--verbose",
      "--model", provider.model || "sonnet",
      "--allowedTools", (provider.allowedTools || []).join(",")
    ];
    const result = spawn(provider.command || "claude", args, { input: prompt });
    fs.writeFileSync(path.join(runDir, "agent-events.log"), `${result.stdout}\n${result.stderr}`);
    if (result.ok) {
      const texto = extractClaudeText(result.stdout);
      if (texto) return { texto, ok: true, motivo: "" };
    }
    return { texto: "", ok: false, motivo: reportarFallo("claude", result, runDir) };
  }

  return { texto: "", ok: false, motivo: `tipo de proveedor "${provider.type}" sin implementacion` };
}
