#!/usr/bin/env node
// CLI de aviso a Discord.
//
// Por que existe si los workflows nuevos avisan con jq y curl adentro del step:
// los workflows disparados por eventos de `issues` corren con la definicion de
// la rama por defecto (main), no con la de dev. Esas definiciones todavia
// invocan `node scripts/agentic-discord.mjs`. Como hacen `checkout ref: dev`,
// alcanza con que el archivo exista aca para que funcionen, sin tocar main.
//
// Es solo la capa de argumentos: el formato del embed y el envio viven en
// discord.mjs, para no tener dos versiones del mismo mensaje.
//
// Uso:
//   node scripts/agentic-discord.mjs --title T --description D \
//     --status success --url U --field "Clave=Valor" --field "Otra=Cosa"
import process from "node:process";
import { avisar } from "./discord.mjs";

function parseArgs(argv) {
  const args = { title: "", description: "", status: "info", url: "", fields: {} };

  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    const value = argv[i + 1];

    if (key === "--title") {
      args.title = value || "";
      i += 1;
    } else if (key === "--description") {
      args.description = value || "";
      i += 1;
    } else if (key === "--status") {
      args.status = value || "info";
      i += 1;
    } else if (key === "--url") {
      args.url = value || "";
      i += 1;
    } else if (key === "--run-id") {
      // Compatibilidad con las definiciones viejas: se mostraba como un campo mas.
      if (value) args.fields.Run = value;
      i += 1;
    } else if (key === "--field") {
      // "Clave=Valor". El valor puede traer '=', asi que se corta en el primero.
      const separador = (value || "").indexOf("=");
      if (separador > 0) {
        args.fields[value.slice(0, separador)] = value.slice(separador + 1);
      }
      i += 1;
    }
  }

  return args;
}

const args = parseArgs(process.argv.slice(2));

await avisar({
  titulo: args.title || "CSH",
  descripcion: args.description,
  estado: args.status,
  url: args.url || undefined,
  campos: args.fields,
});
