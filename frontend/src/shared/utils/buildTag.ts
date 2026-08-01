// Identificador de la revision desplegada (issue #119). Se arma UNA vez, en
// build time, desde los build-args que inyecta el deploy (cicd/Containerfile),
// y termina en dos lugares del HTML: el <meta name="app-version"> y el footer.
//
// Esta funcion es pura a proposito: la importan tanto vite.config.ts (que la
// evalua en Node durante el build) como los tests.

export interface BuildTagInput {
  /** Version de la publicacion: `0.3` en produccion, `dev` en el ambiente dev. */
  version?: string | null
  /** Hash completo del commit desplegado. */
  commitSha?: string | null
}

/** Se usa cuando el build no corre desde un deploy (build local). */
const VERSION_POR_DEFECTO = 'local'

/** Se usa cuando no hay un hash valido del cual sacar los dos caracteres. */
const COMMIT_DESCONOCIDO = '??'

// Cualquier otra cosa que llegue en el build-arg se descarta: el tag va al HTML
// sin escapar y no queremos que un valor raro inyecte markup.
const CARACTERES_VALIDOS = /[^A-Za-z0-9.\-_]/g

function etiquetaVersion(version: string | null | undefined): string {
  const limpia = (version ?? '').trim().replace(CARACTERES_VALIDOS, '')
  if (limpia === '') return VERSION_POR_DEFECTO

  // `0.3` se lee mejor como `v0.3`; `dev` o `local` no llevan prefijo.
  return /^\d/.test(limpia) ? `v${limpia}` : limpia
}

function sufijoCommit(commitSha: string | null | undefined): string {
  const limpio = (commitSha ?? '').trim().toLowerCase()

  // Menos de dos caracteres, o algo que no es un hash, no sirve como sufijo.
  if (!/^[0-9a-f]{2,}$/.test(limpio)) return COMMIT_DESCONOCIDO

  return limpio.slice(-2)
}

/**
 * Arma el identificador que se muestra en el HTML.
 *
 * `{ version: '0.3', commitSha: 'a1b2...c7' }` -> `v0.3-c7`
 */
export function formatBuildTag({ version, commitSha }: BuildTagInput): string {
  return `${etiquetaVersion(version)}-${sufijoCommit(commitSha)}`
}
