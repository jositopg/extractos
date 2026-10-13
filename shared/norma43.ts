import type { BloqueParseado, MovimientoParseado, ResultadoParseo } from './extracto'
import { fechaYyMmDd } from './money'

/**
 * Cuaderno 43 de la AEB (Norma 43). Registros de 80 caracteres.
 * El importe del fichero ya viene en céntimos (14 dígitos, 2 decimales implícitos).
 * Clave 1 = debe (sale dinero). Clave 2 = haber (entra dinero).
 */

const CONCEPTO_COMUN: Record<string, string> = {
  '01': 'Reintegro',
  '02': 'Ingreso',
  '03': 'Domiciliación',
  '04': 'Transferencia',
  '05': 'Amortización',
  '06': 'Remesa de efectos',
  '07': 'Suscripción',
  '08': 'Dividendo',
  '09': 'Bolsa',
  '10': 'Amortización',
  '11': 'Nómina',
  '12': 'Anulación',
  '14': 'Devolución',
  '15': 'Nómina',
  '16': 'Impuestos',
  '17': 'Tarjeta',
  '98': 'Anulación',
  '99': 'Varios',
}

function campo(linea: string, desde: number, hasta: number): string {
  return linea.slice(desde - 1, hasta)
}

function centimosFirmados(raw: string, dh: string): number | null {
  if (!/^\d+$/.test(raw.trim()) || (dh !== '1' && dh !== '2')) return null
  const n = Number(raw)
  if (!Number.isSafeInteger(n)) return null
  return dh === '1' ? -n : n
}

function registros(raw: string): string[] {
  const text = raw.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const lines = text.split('\n').filter((l) => l.trim().length > 0)
  if (lines.length === 1 && lines[0].length >= 160 && lines[0].length % 80 === 0) {
    const s = lines[0]
    const out: string[] = []
    for (let i = 0; i < s.length; i += 80) out.push(s.slice(i, i + 80))
    return out
  }
  return lines
}

export function esNorma43(texto: string): boolean {
  return registros(texto).some((l) => /^11\d{18}/.test(l))
}

type Borrador = {
  ccc: string
  nombre?: string
  desde?: string
  hasta?: string
  saldoInicialCentimos?: number
  saldoFinalCentimos?: number
  movimientos: MovimientoParseado[]
  debitos: number
  creditos: number
  sumaDebe: number
  sumaHaber: number
}

export function parseNorma43(texto: string): ResultadoParseo {
  if (!esNorma43(texto)) return { ok: false, formato: 'norma43', error: 'No es un fichero Norma 43' }

  const avisos: string[] = []
  const bloques: BloqueParseado[] = []
  const sinTextoBanco = new Set<MovimientoParseado>()
  let actual: Borrador | null = null
  let ultimo: MovimientoParseado | null = null

  const cerrar = () => {
    if (!actual) return
    bloques.push({
      ccc: actual.ccc,
      nombre: actual.nombre,
      desde: actual.desde,
      hasta: actual.hasta,
      saldoInicialCentimos: actual.saldoInicialCentimos,
      saldoFinalCentimos: actual.saldoFinalCentimos,
      movimientos: actual.movimientos,
    })
    actual = null
    ultimo = null
  }

  for (const linea of registros(texto)) {
    const codigo = linea.slice(0, 2)
    if (codigo === '11') {
      cerrar()
      const entidad = campo(linea, 3, 6)
      const oficina = campo(linea, 7, 10)
      const cuenta = campo(linea, 11, 20)
      if (!/^\d{4}$/.test(entidad) || !/^\d{4}$/.test(oficina) || !/^\d{10}$/.test(cuenta)) {
        return { ok: false, formato: 'norma43', error: 'Cabecera de cuenta ilegible' }
      }
      const saldo = centimosFirmados(campo(linea, 34, 47), campo(linea, 33, 33))
      actual = {
        ccc: entidad + oficina + cuenta,
        nombre: campo(linea, 52, 77).trim() || undefined,
        desde: fechaYyMmDd(campo(linea, 21, 26)) ?? undefined,
        hasta: fechaYyMmDd(campo(linea, 27, 32)) ?? undefined,
        saldoInicialCentimos: saldo ?? undefined,
        movimientos: [],
        debitos: 0,
        creditos: 0,
        sumaDebe: 0,
        sumaHaber: 0,
      }
      continue
    }

    if (codigo === '22') {
      if (!actual) return { ok: false, formato: 'norma43', error: 'Movimiento sin cabecera de cuenta' }
      const fecha = fechaYyMmDd(campo(linea, 11, 16))
      const fechaValor = fechaYyMmDd(campo(linea, 17, 22))
      const importe = centimosFirmados(campo(linea, 29, 42), campo(linea, 28, 28))
      if (!fecha || importe == null) {
        avisos.push(`Apunte con fecha o importe ilegible (${campo(linea, 11, 16)})`)
        ultimo = null
        continue
      }
      const comun = campo(linea, 23, 24)
      const propio = campo(linea, 25, 27).trim()
      const documento = campo(linea, 43, 52).trim()
      const etiqueta = CONCEPTO_COMUN[comun] ?? `Concepto ${comun}`
      const mov: MovimientoParseado = {
        orden: actual.movimientos.length,
        fecha,
        fechaValor: fechaValor ?? undefined,
        importeCentimos: importe,
        concepto: propio && propio !== '000' ? `${etiqueta} ${propio}` : etiqueta,
        documento: documento || undefined,
      }
      actual.movimientos.push(mov)
      sinTextoBanco.add(mov)
      ultimo = mov
      if (importe < 0) {
        actual.debitos += 1
        actual.sumaDebe += -importe
      } else {
        actual.creditos += 1
        actual.sumaHaber += importe
      }
      continue
    }

    if (codigo === '23') {
      if (!ultimo) continue
      const a = campo(linea, 5, 42).trim()
      const b = campo(linea, 43, 80).trim()
      const extra = [a, b].filter(Boolean).join(' ')
      if (!extra) continue
      if (sinTextoBanco.has(ultimo)) {
        ultimo.concepto = extra
        sinTextoBanco.delete(ultimo)
      } else {
        ultimo.concepto = `${ultimo.concepto} ${extra}`.replace(/\s+/g, ' ').trim()
      }
      continue
    }

    if (codigo === '33') {
      if (!actual) continue
      const saldo = centimosFirmados(campo(linea, 60, 73), campo(linea, 59, 59))
      if (saldo != null) actual.saldoFinalCentimos = saldo
      const nDebe = Number(campo(linea, 21, 25))
      const nHaber = Number(campo(linea, 40, 44))
      if (Number.isFinite(nDebe) && nDebe !== actual.debitos) {
        avisos.push(`El cierre dice ${nDebe} cargos y he leído ${actual.debitos}`)
      }
      if (Number.isFinite(nHaber) && nHaber !== actual.creditos) {
        avisos.push(`El cierre dice ${nHaber} abonos y he leído ${actual.creditos}`)
      }
      cerrar()
      continue
    }

    if (codigo === '88' || codigo === '24') continue
  }

  cerrar()
  if (bloques.length === 0) return { ok: false, formato: 'norma43', error: 'La Norma 43 no trae ninguna cuenta' }
  return { ok: true, formato: 'norma43', bloques, avisos }
}
