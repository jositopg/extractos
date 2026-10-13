import { describe, expect, it } from 'vitest'
import { elegirCuenta } from './asignar'
import { errorClasificacion, reglaGanadora, sugerirPatron, type Regla } from './clasificar'
import { parseCsv } from './csv'
import { exportarFinca } from './exportar'
import { buscarIban, centimosDesdeTexto, cccDesdeIban, ibanCoincideConCcc, parseFecha } from './money'
import { parseNorma43 } from './norma43'
import { cuadreCentimos, mediaGastoVida, saldoDeCuenta } from './patrimonio'
import { parseExtracto } from './parse'
import { parseTexto } from './texto'

function N(value: string | number, len: number): string {
  return String(value).padStart(len, '0').slice(-len)
}
function A(value: string, len: number): string {
  return value.padEnd(len, ' ').slice(0, len)
}
function euros(centimos: number): string {
  return N(Math.abs(centimos), 14)
}
function linea(partes: string[]): string {
  const s = partes.join('')
  if (s.length !== 80) throw new Error(`largo ${s.length}`)
  return s
}

function norma43(): string {
  return [
    linea(['11', N(2100, 4), N(1234, 4), N('1234567890', 10), '260101', '260131', '2', euros(100000), '978', '3', A('JOSE', 26), A('', 3)]),
    linea(['22', N(0, 4), N(1234, 4), '260110', '260110', '03', '000', '1', euros(4520), N(1234, 10), N(0, 12), A('', 16)]),
    linea(['23', '01', A('RECIBO ENDESA', 38), A('', 38)]),
    linea(['22', N(0, 4), N(1234, 4), '260115', '260115', '02', '000', '2', euros(80000), N(5678, 10), N(0, 12), A('', 16)]),
    linea(['23', '01', A('ALQUILER PISO RAMBLA', 38), A('', 38)]),
    linea(['33', N(2100, 4), N(1234, 4), N('1234567890', 10), N(1, 5), euros(4520), N(1, 5), euros(80000), '2', euros(175480), '978', A('', 4)]),
  ].join('\n')
}

describe('importes y fechas', () => {
  it('lee céntimos sin pasar por coma flotante', () => {
    expect(centimosDesdeTexto('1.234,56')).toBe(123456)
    expect(centimosDesdeTexto('-45,20')).toBe(-4520)
    expect(centimosDesdeTexto('45,20-')).toBe(-4520)
    expect(centimosDesdeTexto('(45,20)')).toBe(-4520)
    expect(centimosDesdeTexto('1.754,80')).toBe(175480)
    expect(centimosDesdeTexto('1200.50')).toBe(120050)
    expect(centimosDesdeTexto('1.200')).toBe(120000)
    expect(centimosDesdeTexto('1.234,56')).toBe(123456)
    expect(centimosDesdeTexto('1,234.56')).toBe(123456)
  })

  it('entiende el IBAN español y la fecha', () => {
    expect(parseFecha('10/01/2026')).toBe('2026-01-10')
    expect(parseFecha('31/02/2026')).toBeNull()
    const iban = 'ES91 2100 0418 45 0200051332'
    expect(cccDesdeIban(iban)).toBe('210004180200051332')
    expect(ibanCoincideConCcc(iban, '210004180200051332')).toBe(true)
    expect(buscarIban(`Cuenta\nIBAN: ${iban}\n`)).toBe('ES9121000418450200051332')
  })
})

describe('extractos', () => {
  it('lee Norma 43 con saldo de cierre', () => {
    const r = parseNorma43(norma43())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const b = r.bloques[0]
    expect(b.ccc).toBe('210012341234567890')
    expect(b.saldoInicialCentimos).toBe(100000)
    expect(b.saldoFinalCentimos).toBe(175480)
    expect(b.movimientos.map((m) => [m.fecha, m.importeCentimos, m.concepto])).toEqual([
      ['2026-01-10', -4520, 'RECIBO ENDESA'],
      ['2026-01-15', 80000, 'ALQUILER PISO RAMBLA'],
    ])
    expect(cuadreCentimos(b.saldoInicialCentimos ?? null, b.saldoFinalCentimos ?? null, b.movimientos.map((m) => m.importeCentimos))).toBe(0)
  })

  it('lee un CSV español y, si viene al revés, se queda con el saldo más reciente', () => {
    const texto = [
      'Extracto',
      'IBAN: ES91 2100 0418 45 0200051332',
      'Fecha;Concepto;Importe;Saldo',
      '15/01/2026;ALQUILER PISO RAMBLA;800,00;1.754,80',
      '10/01/2026;RECIBO ENDESA;-45,20;954,80',
    ].join('\n')
    const r = parseCsv(texto)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.bloques[0].ccc).toBe('210004180200051332')
    expect(r.bloques[0].saldoFinalCentimos).toBe(175480)
    expect(r.bloques[0].saldoInicialCentimos).toBe(100000)
    expect(r.bloques[0].movimientos).toHaveLength(2)
  })

  it('lee texto de un PDF ya extraído y cae al formato correcto', () => {
    const texto = '10/01/2026 12/01/2026 RECIBO ENDESA -45,20 954,80\n'
    const r = parseTexto(texto)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.bloques[0].movimientos[0]).toMatchObject({ fecha: '2026-01-10', fechaValor: '2026-01-12', importeCentimos: -4520, saldoCentimos: 95480 })
    expect(parseExtracto(norma43()).ok && parseExtracto(norma43()).formato).toBe('norma43')
  })
})

describe('clasificación y patrimonio', () => {
  const cuentas = [
    { id: 'a', nombre: 'Nómina', alias: 'nomina', iban: 'ES9121000418450200051332', ccc: '' },
    { id: 'b', nombre: 'Ahorro', alias: 'ahorro', iban: '', ccc: '' },
  ]

  it('asigna por CCC antes que por el nombre del fichero', () => {
    expect(elegirCuenta({ ccc: '210004180200051332' }, 'ahorro-enero.csv', cuentas)).toEqual({ id: 'a' })
    expect(elegirCuenta({}, 'ahorro-enero.csv', cuentas)).toEqual({ id: 'b' })
  })

  it('no deja colar una categoría de gasto como ingreso de Finca', () => {
    expect(errorClasificacion({ destino: 'finca', importeCentimos: 80000, categoriaFinca: 'Electricidad', propiedadId: 'p' })).toMatch(/no es un ingreso/)
    expect(errorClasificacion({ destino: 'finca', importeCentimos: -4520, categoriaFinca: 'Electricidad', propiedadId: 'p' })).toBeNull()
    expect(sugerirPatron('RECIBO ENDESA ENERGIA 12345')).toBe('recibo endesa energia')
  })

  it('la regla más larga gana', () => {
    const reglas: Regla[] = [
      { id: '1', patron: 'endesa', destino: 'finca', categoriaFinca: 'Electricidad', propiedadId: 'p', creadoEn: '2026-01-01' },
      { id: '2', patron: 'endesa energia xxi', destino: 'personal', categoriaPersonal: 'Suministros', creadoEn: '2026-01-02' },
    ]
    expect(reglaGanadora('RECIBO ENDESA ENERGIA XXI REF', reglas)?.id).toBe('2')
  })

  it('el saldo de la cuenta es el del extracto más reciente', () => {
    const saldo = saldoDeCuenta(
      'a',
      null,
      null,
      [
        { id: '1', cuentaId: 'a', hasta: '2026-01-31', saldoFinalCentimos: 1000 },
        { id: '2', cuentaId: 'a', hasta: '2026-02-28', saldoFinalCentimos: 2500 },
      ],
      [],
    )
    expect(saldo).toEqual({ centimos: 2500, fecha: '2026-02-28', origen: 'extracto' })
  })

  it('el gasto de vida no mezcla finca, traspasos ni el mes en curso', () => {
    const media = mediaGastoVida(
      [
        { fecha: '2026-07-02', importeCentimos: -10000, destino: 'personal', categoriaFinca: null, categoriaPersonal: 'Comida' },
        { fecha: '2026-08-02', importeCentimos: -20000, destino: 'personal', categoriaFinca: null, categoriaPersonal: 'Comida' },
        { fecha: '2026-08-03', importeCentimos: 5000, destino: 'personal', categoriaFinca: null, categoriaPersonal: 'Comida' },
        { fecha: '2026-09-02', importeCentimos: -30000, destino: 'finca', categoriaFinca: 'Agua', categoriaPersonal: null },
        { fecha: '2026-09-04', importeCentimos: -90000, destino: 'traspaso', categoriaFinca: null, categoriaPersonal: null },
        { fecha: '2026-10-02', importeCentimos: -99900, destino: 'personal', categoriaFinca: null, categoriaPersonal: 'Ocio' },
      ],
      '2026-10-12',
    )
    expect(media.meses).toEqual(['2026-07', '2026-08'])
    expect(media.mediaCentimos).toBe(12500)
  })
})

describe('exportación a Finca', () => {
  it('escribe el pegado que Finca ya sabe importar', () => {
    const exp = exportarFinca(
      [
        {
          id: 'm1',
          fecha: '2026-01-10',
          importeCentimos: -4520,
          concepto: 'RECIBO ENDESA; marzo',
          destino: 'finca',
          categoriaFinca: 'Electricidad',
          propiedadId: 'p1',
          propiedadNombre: 'Piso Rambla',
          exportadoFincaEn: null,
        },
        {
          id: 'm2',
          fecha: '2026-01-15',
          importeCentimos: 80000,
          concepto: 'Alquiler',
          destino: 'finca',
          categoriaFinca: 'Alquiler mensual',
          propiedadId: 'p1',
          propiedadNombre: 'Piso Rambla',
          exportadoFincaEn: null,
        },
      ],
      true,
    )
    expect(exp.ficheros[0].texto).toBe(
      '2026-01-10;gasto;Electricidad;45,20;RECIBO ENDESA marzo\n2026-01-15;ingreso;Alquiler mensual;800,00;Alquiler\n',
    )
  })
})
