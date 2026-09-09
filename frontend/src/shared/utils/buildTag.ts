// Identificador de la revision desplegada (issue #119). Se arma UNA vez, en
// build time, desde los build-args que inyecta el deploy (cicd/Containerfile),
// y termina en dos lugares del HTML: el <meta name="app-version"> y el footer.
//
// El sufijo es el short sha de 7 caracteres, el mismo que muestran Discord,
// GitHub y `git log`. Con menos caracteres el valor no se puede cruzar contra
// ninguna de esas superficies: los dos ultimos del hash completo no aparecen
// en ningun otro lado.
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

/** Se usa cuando no hay un hash valido del cual sacar el short sha. */
const COMMIT_DESCONOCIDO = '??'

/** Lo que usan GitHub y los workflows: `${GITHUB_SHA::7}`. */
const LARGO_SHORT_SHA = 7

// Cualquier otra cosa que llegue en el build-arg se descarta: el tag va al HTML
// sin escapar y no queremos que un valor raro inyecte markup.
const CARACTERES_VALIDOS = /[^A-Za-z0-9.\-_]/g

function etiquetaVersion(version: string | null | undefined): string {
  const limpia = (version ?? '').trim().replace(CARACTERES_VALIDOS, '')
  if (limpia === '') return VERSION_POR_DEFECTO

  // `0.3` se lee mejor como `v0.3`; `dev` o `local` no llevan prefijo.
  return /^\d/.test(limpia) ? `v${limpia}` : limpia
}

function shortSha(commitSha: string | null | undefined): string {
  const limpio = (commitSha ?? '').trim().toLowerCase()

  // Algo que no es un hash no sirve como identificador de commit.
  if (!/^[0-9a-f]+$/.test(limpio)) return COMMIT_DESCONOCIDO

  // Un hash ya abreviado se deja como esta; nunca se rellena.
  return limpio.slice(0, LARGO_SHORT_SHA)
}

/**
 * Arma el identificador que se muestra en el HTML.
 *
 * `{ version: '0.3', commitSha: 'c021d8ca9d0d...' }` -> `v0.3-c021d8c`
 */
export function formatBuildTag({ version, commitSha }: BuildTagInput): string {
  return `${etiquetaVersion(version)}-${shortSha(commitSha)}`
}
