import { describe, expect, it } from 'vitest'
import { utils, write, type WorkBook } from 'xlsx'
import { parseHoja } from './hoja'

const FILAS = [
  ['IBAN: ES91 2100 0418 45 0200051332'],
  ['Fecha', 'Concepto', 'Importe', 'Saldo'],
  ['15/01/2026', 'ALQUILER PISO RAMBLA', 800, 1754.8],
  ['10/01/2026', 'RECIBO ENDESA', -45.2, 954.8],
]

function libro(): WorkBook {
  const wb = utils.book_new()
  utils.book_append_sheet(wb, utils.aoa_to_sheet([['Extracto de enero']]), 'Portada')
  utils.book_append_sheet(wb, utils.aoa_to_sheet(FILAS), 'Movimientos')
  return wb
}

function bytes(wb: WorkBook, bookType: 'xlsx' | 'xls'): Buffer {
  return Buffer.from(write(wb, { type: 'buffer', bookType }))
}

describe('hoja de cálculo', () => {
  it('lee el Excel aunque la primera hoja sea la portada', () => {
    const r = parseHoja(bytes(libro(), 'xlsx'))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.formato).toBe('excel')
    expect(r.bloques).toHaveLength(1)
    expect(r.bloques[0].ccc).toBe('210004180200051332')
    expect(r.bloques[0].saldoFinalCentimos).toBe(175480)
    expect(r.bloques[0].movimientos.map((m) => [m.fecha, m.importeCentimos, m.concepto])).toEqual([
      ['2026-01-15', 80000, 'ALQUILER PISO RAMBLA'],
      ['2026-01-10', -4520, 'RECIBO ENDESA'],
    ])
  })

  it('lee un xls antiguo', () => {
    const r = parseHoja(bytes(libro(), 'xls'))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.bloques[0].movimientos).toHaveLength(2)
  })

  it('lee el extracto de ING: fecha en F. VALOR, importe con punto y cuenta de 20 dígitos', () => {
    const wb = utils.book_new()
    utils.book_append_sheet(
      wb,
      utils.aoa_to_sheet([
        ['Movimientos de la Cuenta', '', 'Número de cuenta:', '9999 0000 00 1234567890'],
        ['F. VALOR', 'CATEGORÍA', 'SUBCATEGORÍA', 'DESCRIPCIÓN', 'COMENTARIO', 'IMPORTE (€)', 'SALDO (€)'],
        ['12/10/2026', 'Otros ingresos', 'Otros', 'Traspaso recibido', '', '75.00', '1,075.00'],
        ['01/10/2026', 'Otros gastos', 'Transferencias', 'Transferencia emitida', 'alquiler octubre', '-1,150.00', '1,000.00'],
      ]),
      'Movimientos',
    )
    const r = parseHoja(Buffer.from(write(wb, { type: 'buffer', bookType: 'xls' })))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.bloques[0].ccc).toBe('999900001234567890')
    expect(r.bloques[0].movimientos.map((m) => [m.fecha, m.importeCentimos, m.concepto])).toEqual([
      ['2026-10-12', 7500, 'Traspaso recibido'],
      ['2026-10-01', -115000, 'Transferencia emitida alquiler octubre'],
    ])
  })
})
