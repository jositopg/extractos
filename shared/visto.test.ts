import { describe, expect, it } from 'vitest'
import { hayHueco, saldoIdentificaLinea, ultimoApunte } from './visto'

describe('visto', () => {
  it('señala el día más reciente y un apunte de ese día', () => {
    const visto = ultimoApunte([
      { fecha: '2026-09-02', concepto: 'MERCADONA', importeCentimos: -2000, orden: 1 },
      { fecha: '2026-10-12', concepto: 'BIZUM ANA', importeCentimos: -500, orden: 0 },
      { fecha: '2026-10-12', concepto: 'NOMINA', importeCentimos: 100000, orden: 1 },
    ])
    expect(visto).toEqual({
      fecha: '2026-10-12',
      concepto: 'BIZUM ANA',
      importeCentimos: -500,
      eseDia: 2,
    })
  })

  it('el saldo identifica la línea solo cuando cada apunte trae uno distinto', () => {
    expect(saldoIdentificaLinea([{ saldoCentimos: 100 }, { saldoCentimos: 80 }])).toBe(true)
    expect(saldoIdentificaLinea([{ saldoCentimos: 100 }, { saldoCentimos: 100 }])).toBe(false)
    expect(saldoIdentificaLinea([{ saldoCentimos: 100 }, { saldoCentimos: null }])).toBe(false)
    expect(saldoIdentificaLinea([])).toBe(false)
  })

  it('un día seguido no es hueco, y dos días sí', () => {
    expect(hayHueco('2026-10-12', '2026-10-13')).toBe(false)
    expect(hayHueco('2026-10-12', '2026-10-12')).toBe(false)
    expect(hayHueco('2026-10-12', '2026-10-14')).toBe(true)
    expect(hayHueco(null, '2026-10-14')).toBe(false)
  })
})
