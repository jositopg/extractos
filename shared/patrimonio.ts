import { categoriaVida, type Destino } from './categorias'
import { mesDe } from './money'

export type ArchivoSaldo = {
  id: string
  cuentaId: string | null
  hasta: string | null
  saldoFinalCentimos: number | null
}

export type MovimientoSaldo = {
  cuentaId: string
  archivoId: string
  fecha: string
  orden: number
  importeCentimos: number
  saldoCentimos: number | null
}

export type SaldoResultado = {
  centimos: number | null
  fecha: string | null
  origen: 'extracto' | 'calculado' | 'sin_datos'
}

export function saldoDeCuenta(
  cuentaId: string,
  saldoInicialCentimos: number | null,
  saldoInicialFecha: string | null,
  archivos: ArchivoSaldo[],
  movimientos: MovimientoSaldo[],
): SaldoResultado {
  const propios = archivos.filter((a) => a.cuentaId === cuentaId && a.saldoFinalCentimos != null)
  propios.sort((a, b) => (b.hasta ?? '').localeCompare(a.hasta ?? ''))
  const mejor = propios[0]
  if (mejor && mejor.saldoFinalCentimos != null) {
    return { centimos: mejor.saldoFinalCentimos, fecha: mejor.hasta, origen: 'extracto' }
  }

  const conSaldo = movimientos
    .filter((m) => m.cuentaId === cuentaId && m.saldoCentimos != null)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden)
  const ultimo = conSaldo[conSaldo.length - 1]
  if (ultimo && ultimo.saldoCentimos != null) {
    return { centimos: ultimo.saldoCentimos, fecha: ultimo.fecha, origen: 'extracto' }
  }

  const movs = movimientos.filter((m) => m.cuentaId === cuentaId)
  if (saldoInicialCentimos != null) {
    const suma = movs.reduce((a, m) => a + m.importeCentimos, 0)
    const fecha = movs.reduce<string | null>((max, m) => (max == null || m.fecha > max ? m.fecha : max), saldoInicialFecha)
    return { centimos: saldoInicialCentimos + suma, fecha, origen: 'calculado' }
  }

  return { centimos: null, fecha: null, origen: 'sin_datos' }
}

export function cuadreCentimos(
  inicial: number | null,
  final: number | null,
  importes: number[],
): number | null {
  if (inicial == null || final == null) return null
  const suma = importes.reduce((a, b) => a + b, 0)
  return final - (inicial + suma)
}

export type MovimientoInforme = {
  fecha: string
  importeCentimos: number
  destino: Destino
  categoriaFinca: string | null
  categoriaPersonal: string | null
}

export type LineaCategoria = {
  ambito: 'finca' | 'personal'
  categoria: string
  centimos: number
}

export type InformeMes = {
  ingresosFincaCentimos: number
  gastosFincaCentimos: number
  ingresosPersonalCentimos: number
  gastosPersonalCentimos: number
  vidaCentimos: number
  porCategoria: LineaCategoria[]
  pendientes: number
}

export function informeMes(movs: MovimientoInforme[], mes: string): InformeMes {
  const delMes = movs.filter((m) => mesDe(m.fecha) === mes)
  let ingresosFincaCentimos = 0
  let gastosFincaCentimos = 0
  let ingresosPersonalCentimos = 0
  let gastosPersonalCentimos = 0
  let vidaCentimos = 0
  let pendientes = 0
  const grupos = new Map<string, LineaCategoria>()

  for (const m of delMes) {
    if (m.destino === 'pendiente') {
      pendientes += 1
      continue
    }
    if (m.destino === 'traspaso' || m.destino === 'ignorar') continue
    const ambito = m.destino
    const categoria = (ambito === 'finca' ? m.categoriaFinca : m.categoriaPersonal) || 'Sin categoría'
    const key = `${ambito}:${categoria}`
    const prev = grupos.get(key) ?? { ambito, categoria, centimos: 0 }
    prev.centimos += m.importeCentimos
    grupos.set(key, prev)
    if (m.importeCentimos >= 0) {
      if (ambito === 'finca') ingresosFincaCentimos += m.importeCentimos
      else ingresosPersonalCentimos += m.importeCentimos
    } else if (ambito === 'finca') gastosFincaCentimos += -m.importeCentimos
    else gastosPersonalCentimos += -m.importeCentimos
    if (ambito === 'personal' && categoriaVida(categoria)) vidaCentimos -= m.importeCentimos
  }

  const porCategoria = [...grupos.values()].sort((a, b) => Math.abs(b.centimos) - Math.abs(a.centimos))
  return {
    ingresosFincaCentimos,
    gastosFincaCentimos,
    ingresosPersonalCentimos,
    gastosPersonalCentimos,
    vidaCentimos,
    porCategoria,
    pendientes,
  }
}

export type MediaVida = {
  mediaCentimos: number | null
  meses: string[]
  aviso: string
}

export type MovimientoBruto = {
  cuentaId: string
  fecha: string
  importeCentimos: number
  destino: Destino
}

/** Cargos del extracto. Un traspaso o un apunte ignorado no es gasto. Lo pendiente sí cuenta: todavía no se ha dicho que no lo sea. */
export function gastosBrutos(movs: MovimientoBruto[], cuentaIds: ReadonlySet<string>, mes: string): number {
  let total = 0
  for (const m of movs) {
    if (!cuentaIds.has(m.cuentaId)) continue
    if (mesDe(m.fecha) !== mes) continue
    if (m.destino === 'traspaso' || m.destino === 'ignorar') continue
    if (m.importeCentimos >= 0) continue
    total += -m.importeCentimos
  }
  return total
}

export type PuntoSaldo = {
  cuentaId: string | null
  hasta: string | null
  saldoFinalCentimos: number | null
  extracto: string
}

export type HistorialSaldo = {
  cuentaId: string
  cuentaNombre: string
  fecha: string
  saldoCentimos: number
  extracto: string
}

export function historialSaldos(
  archivos: PuntoSaldo[],
  cuentas: Array<{ id: string; nombre: string }>,
): HistorialSaldo[] {
  const nombres = new Map(cuentas.map((c) => [c.id, c.nombre]))
  const puntos: HistorialSaldo[] = []
  for (const a of archivos) {
    if (!a.cuentaId || a.saldoFinalCentimos == null || !a.hasta) continue
    const cuentaNombre = nombres.get(a.cuentaId)
    if (!cuentaNombre) continue
    puntos.push({
      cuentaId: a.cuentaId,
      cuentaNombre,
      fecha: a.hasta,
      saldoCentimos: a.saldoFinalCentimos,
      extracto: a.extracto,
    })
  }
  puntos.sort((a, b) => a.cuentaNombre.localeCompare(b.cuentaNombre, 'es') || a.fecha.localeCompare(b.fecha) || a.extracto.localeCompare(b.extracto, 'es'))
  return puntos
}

export function mediaGastoVida(movs: MovimientoInforme[], hoy: string): MediaVida {
  const porMes = new Map<string, number>()
  for (const m of movs) {
    if (m.destino !== 'personal') continue
    const categoria = m.categoriaPersonal ?? ''
    if (!categoriaVida(categoria)) continue
    const mes = mesDe(m.fecha)
    porMes.set(mes, (porMes.get(mes) ?? 0) - m.importeCentimos)
  }
  const mesActual = hoy.slice(0, 7)
  const cerrados = [...porMes.keys()].filter((m) => m < mesActual).sort()
  const usar = cerrados.length > 0 ? cerrados : [...porMes.keys()].sort()
  const ultimos = usar.slice(-3)
  if (ultimos.length === 0) {
    return {
      mediaCentimos: null,
      meses: [],
      aviso: 'Todavía no hay gastos de vida clasificados.',
    }
  }
  const suma = ultimos.reduce((a, m) => a + (porMes.get(m) ?? 0), 0)
  const mediaCentimos = Math.round(suma / ultimos.length)
  const aviso =
    cerrados.length === 0
      ? 'Solo está el mes en curso. La media se asentará cuando cierres un mes.'
      : `Media de ${ultimos.length} ${ultimos.length === 1 ? 'mes cerrado' : 'meses cerrados'}, sin gastos de finca, traspasos, ahorro ni deuda.`
  return { mediaCentimos, meses: ultimos, aviso }
}
