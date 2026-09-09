import { describe, expect, test } from 'vitest'
import { formatBuildTag } from './buildTag'

// El sha del commit que expuso el problema: el deploy mostraba `dev-21` (los
// dos ultimos del hash completo) mientras Discord y GitHub decian `c021d8c`.
const SHA_REAL = 'c021d8ca9d0db488db68dc2696fc61ef20560021'

describe('formatBuildTag', () => {
  test('combina la version de release con el short sha del commit', () => {
    expect(formatBuildTag({ version: '0.3', commitSha: SHA_REAL })).toBe('v0.3-c021d8c')
  })

  test('el sufijo es el mismo short sha que muestran Discord y git log', () => {
    // Los 7 primeros caracteres, no los ultimos: es el unico valor que se puede
    // cruzar contra el resto del sistema.
    expect(formatBuildTag({ version: 'dev', commitSha: SHA_REAL })).toBe('dev-c021d8c')
  })

  test('otro commit cambia el sufijo', () => {
    const otro = '0a6e439cd1d356f6a3992df8305c0a79b4cbd443'

    expect(formatBuildTag({ version: 'dev', commitSha: otro })).toBe('dev-0a6e439')
  })

  test('la version de release lleva prefijo v y el ambiente dev no', () => {
    expect(formatBuildTag({ version: '0.12', commitSha: SHA_REAL })).toBe('v0.12-c021d8c')
    expect(formatBuildTag({ version: 'dev', commitSha: SHA_REAL })).toBe('dev-c021d8c')
  })

  // Casos borde del user story #119.
  test('sin version cae en local', () => {
    expect(formatBuildTag({ version: '', commitSha: SHA_REAL })).toBe('local-c021d8c')
    expect(formatBuildTag({ commitSha: SHA_REAL })).toBe('local-c021d8c')
  })

  test('sin commit el sufijo queda marcado como desconocido', () => {
    expect(formatBuildTag({ version: '0.3' })).toBe('v0.3-??')
    expect(formatBuildTag({ version: '0.3', commitSha: '' })).toBe('v0.3-??')
  })

  test('un hash mas corto que el short sha se deja como esta', () => {
    expect(formatBuildTag({ version: '0.3', commitSha: 'abc' })).toBe('v0.3-abc')
  })

  test('un valor que no es un hash hexadecimal se descarta', () => {
    expect(formatBuildTag({ version: '0.3', commitSha: 'unknown' })).toBe('v0.3-??')
  })

  test('normaliza mayusculas y espacios del hash', () => {
    expect(formatBuildTag({ version: '0.3', commitSha: `  ${SHA_REAL.toUpperCase()}  ` })).toBe(
      'v0.3-c021d8c',
    )
  })

  test('descarta caracteres inesperados en la version', () => {
    expect(formatBuildTag({ version: '0.3<script>', commitSha: SHA_REAL })).toBe(
      'v0.3script-c021d8c',
    )
  })

  test('una version que queda vacia despues de limpiar cae en local', () => {
    expect(formatBuildTag({ version: '<>', commitSha: SHA_REAL })).toBe('local-c021d8c')
  })
})
