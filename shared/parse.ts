import { parseCsv } from './csv'
import type { ResultadoParseo } from './extracto'
import { esNorma43, parseNorma43 } from './norma43'
import { parseTexto } from './texto'

export function parseExtracto(texto: string): ResultadoParseo {
  if (esNorma43(texto)) return parseNorma43(texto)
  const csv = parseCsv(texto)
  if (csv.ok) return csv
  const textoPlano = parseTexto(texto)
  if (textoPlano.ok) return textoPlano
  return {
    ok: false,
    formato: 'desconocido',
    error: 'No reconozco el formato. Sirve un CSV, un Excel, un PDF o Norma 43.',
  }
}
