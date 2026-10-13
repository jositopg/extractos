import { createHash } from 'node:crypto'
import type { BloqueParseado } from '../shared/extracto'
import { normalizar } from '../shared/money'

export function sha256(text: string | Buffer): string {
  return createHash('sha256').update(text).digest('hex')
}

/** UUID versión 5 a partir del hash. El mismo movimiento siempre apunta a la misma fila de Finca. */
export function uuidEstable(clave: string): string {
  const bytes = sha256(clave).slice(0, 32).split('')
  bytes[12] = '5'
  bytes[16] = ((Number.parseInt(bytes[16] ?? '0', 16) & 0x3) | 0x8).toString(16)
  const s = bytes.join('')
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`
}

export function idArchivo(contenidoHash: string, clave: string, indice: number): string {
  return sha256(`${contenidoHash}|${clave}|${indice}`).slice(0, 32)
}

export function idMovimiento(
  cuentaId: string,
  mov: { fecha: string; importeCentimos: number; concepto: string; documento?: string; ordinal: number },
): string {
  const doc = (mov.documento ?? '').replace(/\D/g, '').replace(/^0+$/, '')
  const base = [
    cuentaId,
    mov.fecha,
    String(mov.importeCentimos),
    normalizar(mov.concepto),
    doc,
    doc ? '' : String(mov.ordinal),
  ].join('|')
  return sha256(base).slice(0, 32)
}

export function identificarBloques(
  contenidoHash: string,
  bloques: BloqueParseado[],
): Array<BloqueParseado & { id: string }> {
  const seen = new Map<string, number>()
  return bloques.map((b) => {
    const key = b.ccc || b.iban || 'unica'
    const n = seen.get(key) ?? 0
    seen.set(key, n + 1)
    return { ...b, id: idArchivo(contenidoHash, key, n) }
  })
}
