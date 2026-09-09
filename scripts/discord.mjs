// Aviso a Discord para los scripts del intake de user stories.
//
// Antes esto era `node scripts/agentic-discord.mjs` como proceso aparte. Ese
// archivo se borro con el stack anterior y los avisos de los workflows pasaron
// a armarse con jq y curl dentro del propio step. Los scripts de aca no pueden
// hacer eso —ya estan en Node— asi que postean directo con fetch: un proceso
// menos y un solo lugar donde vive el formato del embed.

const COLORES = {
  info: 3447003,
  success: 5763719,
  warning: 16776960,
  failure: 15548997,
};

/**
 * Publica un embed en Discord. No lanza: un aviso que falla no puede tumbar el
 * intake de un issue, pero si tiene que quedar en el log.
 *
 * @param {object} aviso
 * @param {string} aviso.titulo
 * @param {string} aviso.descripcion
 * @param {"info"|"success"|"warning"|"failure"} [aviso.estado]
 * @param {Record<string, string>} [aviso.campos]
 * @param {string} [aviso.url]
 */
export async function avisar({ titulo, descripcion, estado = "info", campos = {}, url }) {
  const webhook = process.env.DISCORD_WEBHOOK_URL;
  if (!webhook) {
    console.log("Sin DISCORD_WEBHOOK_URL, no se avisa.");
    return;
  }

  const embed = {
    title: titulo,
    description: descripcion,
    color: COLORES[estado] ?? COLORES.info,
    fields: Object.entries(campos)
      .filter(([, valor]) => Boolean(valor))
      .map(([name, value]) => ({ name, value: String(value) })),
  };

  if (url) embed.url = url;

  try {
    const respuesta = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ embeds: [embed] }),
    });

    if (!respuesta.ok) {
      const cuerpo = await respuesta.text().catch(() => "");
      console.error(`Discord respondio ${respuesta.status}: ${cuerpo}`);
    }
  } catch (error) {
    console.error(`No se pudo avisar a Discord: ${error.message || error}`);
  }
}
