import { saldosDeMovimientos, type BloqueParseado, type MovimientoParseado, type ResultadoParseo } from './extracto'
import { buscarIban, ccc18DesdeCuenta, cccDesdeIban, centimosDesdeTexto, normalizar, parseFecha } from './money'

type Campo = 'fecha' | 'fechaValor' | 'concepto' | 'extra' | 'importe' | 'debe' | 'haber' | 'saldo' | 'signo'

const ALIAS: Record<Campo, string[]> = {
  fecha: ['fecha', 'fecha operacion', 'fecha movimiento', 'f operacion', 'date'],
  fechaValor: ['fecha valor', 'f valor'],
  concepto: ['concepto', 'movimiento', 'descripcion', 'detalle'],
  extra: ['mas datos', 'observaciones', 'concepto adicional', 'ampliacion', 'comentario', 'comentarios', 'nota', 'notas'],
  importe: ['importe', 'cantidad', 'amount', 'importe eur'],
  debe: ['debe', 'cargo', 'cargos'],
  haber: ['haber', 'abono', 'abonos'],
  saldo: ['saldo', 'balance', 'saldo eur'],
  signo: ['signo', 'dh', 'tipo'],
}

function normHeader(s: string): string {
  return normalizar(s)
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\beur\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function campoDe(header: string): Campo | null {
  const h = normHeader(header)
  if (!h) return null
  const orden: Campo[] = ['fechaValor', 'fecha', 'extra', 'concepto', 'importe', 'debe', 'haber', 'saldo', 'signo']
  for (const c of orden) {
    if (ALIAS[c].includes(h)) return c
  }
  if (h.startsWith('fecha valor')) return 'fechaValor'
  if (h.startsWith('fecha')) return 'fecha'
  if (h.includes('importe') || h === 'amount') return 'importe'
  if (h.includes('saldo') || h === 'balance') return 'saldo'
  if (h.includes('concepto') || h.includes('descripcion') || h.includes('movimiento')) return 'concepto'
  if (h.includes('mas datos') || h.includes('observacion')) return 'extra'
  return null
}

export function splitCsvLine(line: string, delim: string): string[] {
  const out: string[] = []
  let cur = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i++
        } else {
          quoted = false
        }
      } else {
        cur += c
      }
    } else if (c === '"') {
      quoted = true
    } else if (c === delim) {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur.trim())
  return out
}

function lineasCrudas(texto: string): string[] {
  return texto
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
}

function delimDe(lineas: string[]): string {
  const sep = lineas.find((l) => /^sep\s*=\s*.$/i.test(l))
  if (sep) return sep.slice(-1)
  const cuenta = { ';': 0, ',': 0, '\t': 0 }
  for (const l of lineas.slice(0, 30)) {
    cuenta[';'] += (l.match(/;/g) ?? []).length
    cuenta[','] += (l.match(/,/g) ?? []).length
    cuenta['\t'] += (l.match(/\t/g) ?? []).length
  }
  if (cuenta[';'] >= cuenta[','] && cuenta[';'] >= cuenta['\t'] && cuenta[';'] > 0) return ';'
  if (cuenta['\t'] >= cuenta[','] && cuenta['\t'] > 0) return '\t'
  return ','
}

function indiceCabecera(filas: string[][]): { index: number; mapa: Map<Campo, number> } | null {
  for (let i = 0; i < Math.min(filas.length, 40); i++) {
    const mapa = new Map<Campo, number>()
    filas[i].forEach((cell, col) => {
      const c = campoDe(cell)
      if (!c) return
      if (!mapa.has(c)) mapa.set(c, col)
      else if (c === 'concepto' && !mapa.has('extra')) mapa.set('extra', col)
    })
    const tieneFecha = mapa.has('fecha') || mapa.has('fechaValor')
    const tieneImporte = mapa.has('importe') || mapa.has('debe') || mapa.has('haber')
    if (tieneFecha && tieneImporte) return { index: i, mapa }
  }
  return null
}

function signoDe(raw: string): 1 | -1 | null {
  const s = normalizar(raw)
  if (['1', 'd', 'debe', 'cargo', 'gasto'].includes(s)) return -1
  if (['2', 'h', 'haber', 'abono', 'ingreso'].includes(s)) return 1
  return null
}

function celda(fila: string[], idx: number | undefined): string {
  if (idx == null) return ''
  return fila[idx] ?? ''
}

export function parseTabla(
  filas: string[][],
  textoIban: string,
  formato: 'csv' | 'excel',
): ResultadoParseo {
  const etiqueta = formato === 'excel' ? 'La hoja' : 'El CSV'
  if (filas.length < 2) return { ok: false, formato, error: `${etiqueta} no tiene filas` }

  const cabecera = indiceCabecera(filas)
  if (!cabecera) return { ok: false, formato, error: 'No encuentro columnas de fecha e importe' }

  const { mapa } = cabecera
  const avisos: string[] = []
  const movimientos: MovimientoParseado[] = []

  for (let i = cabecera.index + 1; i < filas.length; i++) {
    const fila = filas[i]
    if (fila.every((c) => c.trim() === '')) continue
    const fecha = parseFecha(celda(fila, mapa.get('fecha'))) ?? parseFecha(celda(fila, mapa.get('fechaValor')))
    if (!fecha) {
      const concepto = celda(fila, mapa.get('concepto'))
      if (normalizar(concepto) !== 'total') avisos.push(`Fila ${i + 1} sin fecha`)
      continue
    }

    let importe: number
    if (mapa.has('importe')) {
      importe = centimosDesdeTexto(celda(fila, mapa.get('importe')))
      const signo = signoDe(celda(fila, mapa.get('signo')))
      if (!Number.isNaN(importe) && importe > 0 && signo === -1) importe = -importe
    } else {
      const debe = centimosDesdeTexto(celda(fila, mapa.get('debe')))
      const haber = centimosDesdeTexto(celda(fila, mapa.get('haber')))
      const d = Number.isNaN(debe) ? 0 : Math.abs(debe)
      const h = Number.isNaN(haber) ? 0 : Math.abs(haber)
      if (d === 0 && h === 0) importe = NaN
      else importe = h - d
    }
    if (Number.isNaN(importe) || importe === 0) {
      avisos.push(`Fila ${i + 1} sin importe`)
      continue
    }

    const concepto = [celda(fila, mapa.get('concepto')), celda(fila, mapa.get('extra'))]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
    const saldoRaw = celda(fila, mapa.get('saldo'))
    const saldo = saldoRaw ? centimosDesdeTexto(saldoRaw) : NaN
    const fechaValor = parseFecha(celda(fila, mapa.get('fechaValor')))

    movimientos.push({
      orden: movimientos.length,
      fecha,
      fechaValor: fechaValor ?? undefined,
      importeCentimos: importe,
      saldoCentimos: Number.isNaN(saldo) ? undefined : saldo,
      concepto: concepto || 'Sin concepto',
    })
  }

  if (movimientos.length === 0) {
    return { ok: false, formato, error: avisos[0] ?? `${etiqueta} no tiene movimientos` }
  }

  const iban = buscarIban(textoIban) ?? undefined
  const bloque: BloqueParseado = {
    iban,
    ccc: iban ? (cccDesdeIban(iban) ?? undefined) : ccc18DesdeCuenta(textoIban),
    ...saldosDeMovimientos(movimientos),
    movimientos,
  }
  return { ok: true, formato, bloques: [bloque], avisos }
}

export function parseCsv(texto: string): ResultadoParseo {
  const crudas = lineasCrudas(texto).filter((l) => !/^sep\s*=/i.test(l))
  if (crudas.length < 2) return { ok: false, formato: 'csv', error: 'El CSV no tiene filas' }

  const delim = delimDe(crudas)
  const filas = crudas.map((l) => splitCsvLine(l, delim))
  return parseTabla(filas, texto, 'csv')
}
