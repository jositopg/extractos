export type MovimientoParseado = {
  orden: number
  fecha: string
  fechaValor?: string
  importeCentimos: number
  saldoCentimos?: number
  concepto: string
  documento?: string
}

export type BloqueParseado = {
  ccc?: string
  iban?: string
  nombre?: string
  desde?: string
  hasta?: string
  saldoInicialCentimos?: number
  saldoFinalCentimos?: number
  movimientos: MovimientoParseado[]
}

export type ResultadoParseo =
  | { ok: true; formato: 'norma43' | 'csv' | 'texto' | 'excel'; bloques: BloqueParseado[]; avisos: string[] }
  | { ok: false; formato: 'desconocido' | 'norma43' | 'csv' | 'texto' | 'excel'; error: string }

/** El CSV puede venir del más nuevo al más viejo. El saldo que manda es el de la fecha más reciente. */
export function saldosDeMovimientos(movs: MovimientoParseado[]): Pick<
  BloqueParseado,
  'desde' | 'hasta' | 'saldoInicialCentimos' | 'saldoFinalCentimos'
> {
  if (movs.length === 0) return {}
  const desde = movs.reduce((m, x) => (x.fecha < m ? x.fecha : m), movs[0].fecha)
  const hasta = movs.reduce((m, x) => (x.fecha > m ? x.fecha : m), movs[0].fecha)
  const descendente = movs[0].fecha > movs[movs.length - 1].fecha
  const reciente = descendente ? movs[0] : movs[movs.length - 1]
  const antiguo = descendente ? movs[movs.length - 1] : movs[0]
  return {
    desde,
    hasta,
    saldoFinalCentimos: reciente.saldoCentimos,
    saldoInicialCentimos:
      antiguo.saldoCentimos == null ? undefined : antiguo.saldoCentimos - antiguo.importeCentimos,
  }
}
