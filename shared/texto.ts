import { saldosDeMovimientos, type BloqueParseado, type MovimientoParseado, type ResultadoParseo } from './extracto'
import { buscarIban, cccDesdeIban, centimosDesdeTexto, parseFecha } from './money'

const LINEA =
  /^(\d{2}[/\-.]\d{2}[/\-.]\d{4})(?:\s+(\d{2}[/\-.]\d{2}[/\-.]\d{4}))?\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})(?:\s+(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}))?\s*$/

export function parseTexto(texto: string): ResultadoParseo {
  const lineas = texto
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
  const movimientos: MovimientoParseado[] = []

  for (const linea of lineas) {
    const m = LINEA.exec(linea.trim())
    if (!m) continue
    const fecha = parseFecha(m[1])
    const fechaValor = m[2] ? parseFecha(m[2]) : null
    const importe = centimosDesdeTexto(m[4])
    const saldo = m[5] ? centimosDesdeTexto(m[5]) : NaN
    if (!fecha || Number.isNaN(importe) || importe === 0) continue
    movimientos.push({
      orden: movimientos.length,
      fecha,
      fechaValor: fechaValor ?? undefined,
      importeCentimos: importe,
      saldoCentimos: Number.isNaN(saldo) ? undefined : saldo,
      concepto: m[3].replace(/\s+/g, ' ').trim() || 'Sin concepto',
    })
  }

  if (movimientos.length === 0) {
    return { ok: false, formato: 'texto', error: 'No veo líneas con fecha e importe' }
  }

  const iban = buscarIban(texto) ?? undefined
  const bloque: BloqueParseado = {
    iban,
    ccc: iban ? (cccDesdeIban(iban) ?? undefined) : undefined,
    ...saldosDeMovimientos(movimientos),
    movimientos,
  }
  return { ok: true, formato: 'texto', bloques: [bloque], avisos: [] }
}
