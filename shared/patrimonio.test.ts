import { describe, expect, it } from 'vitest'
import { gastosBrutos } from './patrimonio'

describe('gastos en bruto', () => {
  it('suma los cargos de las cuentas marcadas y deja fuera traspasos, ignorados e ingresos', () => {
    const movs = [
      { cuentaId: 'a', fecha: '2026-01-10', importeCentimos: -4520, destino: 'finca' as const },
      { cuentaId: 'a', fecha: '2026-01-12', importeCentimos: -1240, destino: 'pendiente' as const },
      { cuentaId: 'a', fecha: '2026-01-15', importeCentimos: 80000, destino: 'finca' as const },
      { cuentaId: 'a', fecha: '2026-01-16', importeCentimos: -500, destino: 'traspaso' as const },
      { cuentaId: 'a', fecha: '2026-01-17', importeCentimos: -100, destino: 'ignorar' as const },
      { cuentaId: 'b', fecha: '2026-01-18', importeCentimos: -999, destino: 'pendiente' as const },
      { cuentaId: 'a', fecha: '2026-02-01', importeCentimos: -3000, destino: 'finca' as const },
    ]
    expect(gastosBrutos(movs, new Set(['a']), '2026-01')).toBe(5760)
    expect(gastosBrutos(movs, new Set(), '2026-01')).toBe(0)
  })
})
