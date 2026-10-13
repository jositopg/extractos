import { read, utils, type WorkSheet } from 'xlsx'
import { parseTabla } from '../shared/csv'
import type { BloqueParseado, ResultadoParseo } from '../shared/extracto'

function textoCelda(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = String(value.getDate()).padStart(2, '0')
    const m = String(value.getMonth() + 1).padStart(2, '0')
    return `${d}/${m}/${value.getFullYear()}`
  }
  return String(value).trim()
}

export function parseHoja(buf: Buffer): ResultadoParseo {
  let libro
  try {
    libro = read(buf, { type: 'buffer', cellDates: true })
  } catch {
    return { ok: false, formato: 'excel', error: 'No he podido abrir la hoja de cálculo.' }
  }

  const bloques: BloqueParseado[] = []
  const avisos: string[] = []
  let ultimo = 'No encuentro columnas de fecha e importe'
  for (const nombre of libro.SheetNames) {
    const hoja = libro.Sheets[nombre] as WorkSheet | undefined
    if (!hoja) continue
    const rows = utils.sheet_to_json<unknown[]>(hoja, {
      header: 1,
      raw: false,
      defval: '',
      dateNF: 'dd/mm/yyyy',
      blankrows: false,
    })
    const filas = rows.map((fila) => (Array.isArray(fila) ? fila : [fila]).map(textoCelda))
    if (filas.every((fila) => fila.every((celda) => celda === ''))) continue
    const parsed = parseTabla(filas, filas.flat().join('\n'), 'excel')
    if (!parsed.ok) {
      ultimo = parsed.error
      continue
    }
    bloques.push(...parsed.bloques)
    avisos.push(...parsed.avisos)
  }
  if (bloques.length === 0) return { ok: false, formato: 'excel', error: ultimo }
  return { ok: true, formato: 'excel', bloques, avisos }
}
