/// <reference types="vite/client" />

/**
 * Identificador de la revision desplegada (issue #119). Lo reemplaza Vite en
 * build time con el valor que arma `shared/utils/buildTag.ts`.
 */
declare const __BUILD_TAG__: string
