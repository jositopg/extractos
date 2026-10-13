import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { urlDe } from './ruta'

function req(url: string): IncomingMessage {
  return { url } as IncomingMessage
}

describe('ruta de la petición', () => {
  it('deja la url local como está', () => {
    const url = urlDe(req('/api/registro?mes=2026-10'))
    expect(url.pathname).toBe('/api/registro')
    expect(url.searchParams.get('mes')).toBe('2026-10')
  })

  it('reconstruye los tramos que Vercel no enruta', () => {
    const url = urlDe(req('/api/despacho?__ruta=archivos/abc/cuenta&mes=2026-10'))
    expect(url.pathname).toBe('/api/archivos/abc/cuenta')
    expect(url.searchParams.get('mes')).toBe('2026-10')
    expect(url.searchParams.get('__ruta')).toBeNull()
  })
})
