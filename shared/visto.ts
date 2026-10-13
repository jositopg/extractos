export type ApunteVisto = {
  fecha: string
  concepto: string
  importeCentimos: number
  eseDia: number
}

/** El día más reciente y un apunte de ese día. No es un corte: un apunte anterior que faltaba puede entrar después. */
export function ultimoApunte(
  movs: { fecha: string; concepto: string; importeCentimos: number; orden: number }[],
): ApunteVisto | null {
  if (movs.length === 0) return null
  let fecha = movs[0].fecha
  for (const mov of movs) {
    if (mov.fecha > fecha) fecha = mov.fecha
  }
  const delDia = movs.filter((mov) => mov.fecha === fecha)
  const elegido = [...delDia].sort((a, b) => a.orden - b.orden)[0]
  if (!elegido) return null
  return {
    fecha,
    concepto: elegido.concepto,
    importeCentimos: elegido.importeCentimos,
    eseDia: delDia.length,
  }
}

/** El saldo de cada línea identifica el apunte solo si cada una trae el suyo y no se repite. */
export function saldoIdentificaLinea(movs: { saldoCentimos?: number | null }[]): boolean {
  if (movs.length === 0) return false
  const saldos: number[] = []
  for (const mov of movs) {
    if (mov.saldoCentimos == null) return false
    saldos.push(mov.saldoCentimos)
  }
  return new Set(saldos).size === saldos.length
}

export function diaSiguiente(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + 1))
  return dt.toISOString().slice(0, 10)
}

/** Hay un hueco si el extracto nuevo empieza más de un día después del último apunte visto. */
export function hayHueco(vistoHasta: string | null, desde: string | null | undefined): boolean {
  if (!vistoHasta || !desde) return false
  return desde > diaSiguiente(vistoHasta)
}
