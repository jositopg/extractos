export type CandidatoTraspaso = {
  id: string
  cuentaId: string
  fecha: string
  importeCentimos: number
}

const DIA = 86_400_000

function diasEntre(a: string, b: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null
  const da = Date.parse(`${a}T00:00:00Z`)
  const db = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(da) || Number.isNaN(db)) return null
  return Math.abs(da - db) / DIA
}

/** Mismo importe, signo contrario, otra cuenta, a lo sumo tres días. No marca el apunte. */
export function sugerirTraspaso<T extends CandidatoTraspaso>(mov: T, otros: readonly T[]): T | null {
  if (mov.importeCentimos === 0) return null
  let mejor: T | null = null
  let mejorDias = Infinity
  for (const otro of otros) {
    if (otro.id === mov.id || otro.cuentaId === mov.cuentaId) continue
    if (otro.importeCentimos !== -mov.importeCentimos) continue
    const dias = diasEntre(mov.fecha, otro.fecha)
    if (dias == null || dias > 3) continue
    const gana =
      mejor == null ||
      dias < mejorDias ||
      (dias === mejorDias && (otro.fecha < mejor.fecha || (otro.fecha === mejor.fecha && otro.id < mejor.id)))
    if (gana) {
      mejor = otro
      mejorDias = dias
    }
  }
  return mejor
}
