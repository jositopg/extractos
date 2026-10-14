import type { Destino } from './categorias'
import { mesDe } from './money'

export type MovimientoAviso = {
  fecha: string
  destino: Destino
  importeCentimos: number
  categoriaFinca: string | null
  propiedadId: string | null
}

function mesHaceUnAno(mes: string): string | null {
  const m = /^(\d{4})-(\d{2})$/.exec(mes)
  if (!m) return null
  return `${Number(m[1]) - 1}-${m[2]}`
}

function es(mov: MovimientoAviso, propiedadId: string, categoria: string, mes: string, ingreso: boolean): boolean {
  if (mov.destino !== 'finca' || mov.propiedadId !== propiedadId || mov.categoriaFinca !== categoria) return false
  if (mesDe(mov.fecha) !== mes) return false
  return ingreso ? mov.importeCentimos > 0 : mov.importeCentimos < 0
}

/** Avisos del mes: alquiler que ya se cobraba, recibos anuales que tocan, y luz sin repercutir. */
export function avisosDelMes(
  movs: MovimientoAviso[],
  mes: string,
  propiedades: Array<{ id: string; nombre: string }>,
): string[] {
  const nombres = new Map(propiedades.map((p) => [p.id, p.nombre]))
  const ids = new Set<string>()
  for (const mov of movs) {
    if (mov.propiedadId && nombres.has(mov.propiedadId)) ids.add(mov.propiedadId)
  }
  const avisos: string[] = []
  const anoPasado = mesHaceUnAno(mes)
  const ordenados = [...ids].sort((a, b) => (nombres.get(a) ?? '').localeCompare(nombres.get(b) ?? '', 'es'))

  for (const id of ordenados) {
    const nombre = nombres.get(id) ?? 'una propiedad'
    const cobroAntes = movs.some(
      (mov) =>
        mov.destino === 'finca' &&
        mov.propiedadId === id &&
        mov.categoriaFinca === 'Alquiler mensual' &&
        mov.importeCentimos > 0 &&
        mesDe(mov.fecha) < mes,
    )
    const cobroAhora = movs.some((mov) => es(mov, id, 'Alquiler mensual', mes, true))
    if (cobroAntes && !cobroAhora) {
      avisos.push(`En ${nombre} no veo el alquiler de este mes. En meses anteriores sí entró.`)
    }
    if (anoPasado) {
      for (const categoria of ['IBI', 'Comunidad de propietarios'] as const) {
        const antes = movs.some((mov) => es(mov, id, categoria, anoPasado, false))
        const ahora = movs.some((mov) => es(mov, id, categoria, mes, false))
        if (antes && !ahora) avisos.push(`El año pasado, este mes, ${nombre} tuvo ${categoria}. Este año no lo veo.`)
      }
    }
    const luz = movs.some((mov) => es(mov, id, 'Electricidad', mes, false))
    const repercutida = movs.some((mov) => es(mov, id, 'Electricidad (repercutida)', mes, true))
    if (luz && !repercutida) {
      avisos.push(`En ${nombre} hay un cargo de electricidad y no veo la electricidad repercutida.`)
    }
  }
  return avisos
}
