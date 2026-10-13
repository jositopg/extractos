import { afterEach, describe, expect, it } from 'vitest'
import { cabeceraSesion, claveCorrecta, emitirSesion, leerCookie, sesionValida } from './sesion'

const previa = process.env.EXTRACTOS_PASSWORD

afterEach(() => {
  if (previa == null) delete process.env.EXTRACTOS_PASSWORD
  else process.env.EXTRACTOS_PASSWORD = previa
})

describe('sesión', () => {
  it('acepta la clave y rechaza una sesión caducada o firmada con otra', () => {
    process.env.EXTRACTOS_PASSWORD = 'una clave larga'
    expect(claveCorrecta('una clave larga')).toBe(true)
    expect(claveCorrecta('otra')).toBe(false)
    const token = emitirSesion(1_000)
    expect(sesionValida(token, 1_000)).toBe(true)
    expect(sesionValida(token, 1_000 + 31 * 24 * 60 * 60 * 1000)).toBe(false)
    expect(sesionValida(`${token}x`, 1_000)).toBe(false)
    expect(leerCookie(cabeceraSesion(token, true).split('; ')[0])).toBe(token)
  })

  it('sin clave configurada no pide sesión', () => {
    delete process.env.EXTRACTOS_PASSWORD
    expect(sesionValida(undefined)).toBe(true)
  })
})
