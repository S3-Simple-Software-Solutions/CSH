import { describe, expect, test } from 'vitest'
import { formatBuildTag } from './buildTag'

describe('formatBuildTag', () => {
  test('combina la version de release con los dos ultimos caracteres del commit', () => {
    const tag = formatBuildTag({
      version: '0.3',
      commitSha: '9f2c1b7e4a5d6c8f0e1a2b3c4d5e6f7a8b9c0da7',
    })

    expect(tag).toBe('v0.3-a7')
  })

  test('otro commit con terminacion distinta cambia el sufijo', () => {
    const tag = formatBuildTag({
      version: '0.3',
      commitSha: '9f2c1b7e4a5d6c8f0e1a2b3c4d5e6f7a8b9c0d1f',
    })

    expect(tag).toBe('v0.3-1f')
  })

  test('el ambiente dev no lleva prefijo v', () => {
    expect(formatBuildTag({ version: 'dev', commitSha: 'abcdef' })).toBe('dev-ef')
  })

  // Casos borde del user story #119.
  test('sin version cae en local', () => {
    expect(formatBuildTag({ version: '', commitSha: 'abcdef' })).toBe('local-ef')
    expect(formatBuildTag({ commitSha: 'abcdef' })).toBe('local-ef')
  })

  test('sin commit el sufijo queda marcado como desconocido', () => {
    expect(formatBuildTag({ version: '0.3' })).toBe('v0.3-??')
    expect(formatBuildTag({ version: '0.3', commitSha: '' })).toBe('v0.3-??')
  })

  test('un hash de menos de dos caracteres no alcanza para el sufijo', () => {
    expect(formatBuildTag({ version: '0.3', commitSha: 'a' })).toBe('v0.3-??')
  })

  test('un valor que no es un hash hexadecimal se descarta', () => {
    expect(formatBuildTag({ version: '0.3', commitSha: 'unknown' })).toBe('v0.3-??')
  })

  test('normaliza mayusculas y espacios del hash', () => {
    expect(formatBuildTag({ version: '0.3', commitSha: '  ABCDEF  ' })).toBe('v0.3-ef')
  })

  test('descarta caracteres inesperados en la version', () => {
    expect(formatBuildTag({ version: '0.3<script>', commitSha: 'abcdef' })).toBe('v0.3script-ef')
  })

  test('una version que queda vacia despues de limpiar cae en local', () => {
    expect(formatBuildTag({ version: '<>', commitSha: 'abcdef' })).toBe('local-ef')
  })
})
