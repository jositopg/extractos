import { describe, expect, it } from 'vitest'
import { eurosExactos, filaFinca, firmaFila } from './finca'

describe('fila de Finca', () => {
  it('guarda el importe como decimal exacto y el mismo contenido da la misma firma', () => {
    expect(eurosExactos(-4520)).toBe('45.20')
    expect(eurosExactos(80000)).toBe('800.00')
    expect(eurosExactos(3000)).toBe('30.00')
    const fila = filaFinca({
      id: '11111111-1111-4111-8111-111111111111',
      movimientoId: 'abc',
      propiedadId: '22222222-2222-4222-8222-222222222222',
      fecha: '2026-01-10',
      importeCentimos: -4520,
      categoria: 'Electricidad',
      concepto: 'RECIBO ENDESA',
    })
    expect(fila).toMatchObject({
      tipo: 'gasto',
      importe: '45.20',
      referencia: 'extractos:abc',
      descripcion: 'RECIBO ENDESA',
    })
    expect(firmaFila(fila)).toBe(firmaFila({ ...fila }))
    expect(firmaFila({ ...fila, importe: '45.21' })).not.toBe(firmaFila(fila))
  })
})
