import { describe, expect, it } from 'vitest'
import { avisosDelMes, type MovimientoAviso } from './avisos'
import { sugerirTraspaso } from './traspaso'

const piso = { id: 'p1', nombre: 'Piso Rambla' }

function mov(parcial: Partial<MovimientoAviso> & Pick<MovimientoAviso, 'fecha' | 'categoriaFinca' | 'importeCentimos'>): MovimientoAviso {
  return {
    destino: 'finca',
    propiedadId: 'p1',
    ...parcial,
  }
}

describe('avisos del mes', () => {
  it('avisa del alquiler, del IBI y de la luz sin repercutir', () => {
    const avisos = avisosDelMes(
      [
        mov({ fecha: '2026-01-05', categoriaFinca: 'Alquiler mensual', importeCentimos: 80000 }),
        mov({ fecha: '2025-03-10', categoriaFinca: 'IBI', importeCentimos: -12000 }),
        mov({ fecha: '2026-03-02', categoriaFinca: 'Electricidad', importeCentimos: -4520 }),
      ],
      '2026-03',
      [piso],
    )
    expect(avisos).toEqual([
      'En Piso Rambla no veo el alquiler de este mes. En meses anteriores sí entró.',
      'El año pasado, este mes, Piso Rambla tuvo IBI. Este año no lo veo.',
      'En Piso Rambla hay un cargo de electricidad y no veo la electricidad repercutida.',
    ])
  })

  it('calla si el alquiler, el recibo y la luz repercutida están', () => {
    const avisos = avisosDelMes(
      [
        mov({ fecha: '2026-03-05', categoriaFinca: 'Alquiler mensual', importeCentimos: 80000 }),
        mov({ fecha: '2025-03-10', categoriaFinca: 'IBI', importeCentimos: -12000 }),
        mov({ fecha: '2026-03-10', categoriaFinca: 'IBI', importeCentimos: -12000 }),
        mov({ fecha: '2026-03-02', categoriaFinca: 'Electricidad', importeCentimos: -4520 }),
        mov({ fecha: '2026-03-20', categoriaFinca: 'Electricidad (repercutida)', importeCentimos: 4520 }),
      ],
      '2026-03',
      [piso],
    )
    expect(avisos).toEqual([])
  })
})

describe('sugerencia de traspaso', () => {
  it('empareja el mismo importe en otra cuenta, dentro de tres días', () => {
    const sale = { id: 'a', cuentaId: 'c1', fecha: '2026-04-01', importeCentimos: -1500 }
    const entra = { id: 'b', cuentaId: 'c2', fecha: '2026-04-03', importeCentimos: 1500 }
    const lejos = { id: 'c', cuentaId: 'c2', fecha: '2026-04-06', importeCentimos: 1500 }
    const misma = { id: 'd', cuentaId: 'c1', fecha: '2026-04-01', importeCentimos: 1500 }
    expect(sugerirTraspaso(sale, [sale, entra, lejos, misma])?.id).toBe('b')
    expect(sugerirTraspaso(sale, [lejos, misma])).toBeNull()
  })
})
