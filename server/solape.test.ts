import { mkdtempSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { openDb, type Db } from './db'
import { crearServicio } from './servicio'

const IBAN = 'ES7914650100991234567890'

function libro() {
  const root = mkdtempSync(join(tmpdir(), 'extractos-solape-'))
  const rutas = { root, inbox: join(root, 'inbox'), exportDir: join(root, 'export') }
  mkdirSync(rutas.inbox, { recursive: true })
  const db = openDb(join(root, 'extractos.sqlite'))
  const svc = crearServicio(db, rutas, { finca: false })
  return { db, rutas, svc }
}

describe('extractos que se solapan', () => {
  let db: Db | undefined

  afterEach(() => {
    db?.close()
  })

  it('no repite el último apunte aunque el concepto cambie, y entra el nuevo', async () => {
    const hecho = libro()
    db = hecho.db
    hecho.svc.crearCuenta({ nombre: 'ING', iban: IBAN })
    writeFileSync(
      join(hecho.rutas.inbox, 'septiembre.csv'),
      [
        `IBAN: ${IBAN}`,
        'Fecha;Concepto;Importe;Saldo',
        '01/09/2026;NOMINA;1000,00;1000,00',
        '02/09/2026;MERCADONA;-20,00;980,00',
      ].join('\n'),
    )
    const primero = await hecho.svc.importar()
    expect(primero.movimientos).toBe(2)
    expect(primero.notas[0]).toMatch(/2 nuevos y 0 que ya estaban/)

    writeFileSync(
      join(hecho.rutas.inbox, 'octubre.csv'),
      [
        `IBAN: ${IBAN}`,
        'Fecha;Concepto;Importe;Saldo',
        '12/10/2026;BIZUM ANA;-5,00;975,00',
        '02/09/2026;MERCADONA COMPRA;-20,00;980,00',
        '01/09/2026;NOMINA SEPTIEMBRE;1000,00;1000,00',
      ].join('\n'),
    )
    const segundo = await hecho.svc.importar()
    expect(segundo.movimientos).toBe(1)
    expect(segundo.duplicados).toBe(2)
    expect(segundo.notas.join('\n')).toMatch(/1 nuevo y 2 que ya estaban/)
    expect(segundo.notas.join('\n')).toMatch(/02\/09\/2026/)
    const conceptos = hecho.svc.movimientos({}).map((mov) => mov.concepto)
    expect(conceptos).toContain('MERCADONA')
    expect(conceptos).not.toContain('MERCADONA COMPRA')
    expect(hecho.svc.resumen().cuentas[0]?.ultimoApunte).toMatchObject({
      fecha: '2026-10-12',
      concepto: 'BIZUM ANA',
      importeCentimos: -500,
    })
  })

  it('avisa si el extracto nuevo deja días por medio', async () => {
    const hecho = libro()
    db = hecho.db
    hecho.svc.crearCuenta({ nombre: 'ING', iban: IBAN })
    writeFileSync(
      join(hecho.rutas.inbox, 'septiembre.csv'),
      [`IBAN: ${IBAN}`, 'Fecha;Concepto;Importe;Saldo', '02/09/2026;NOMINA;1000,00;1000,00'].join('\n'),
    )
    await hecho.svc.importar()
    writeFileSync(
      join(hecho.rutas.inbox, 'octubre.csv'),
      [`IBAN: ${IBAN}`, 'Fecha;Concepto;Importe;Saldo', '20/10/2026;BIZUM;-5,00;995,00'].join('\n'),
    )
    const segundo = await hecho.svc.importar()
    expect(segundo.movimientos).toBe(1)
    expect(segundo.notas.join('\n')).toMatch(/llega al 02\/09\/2026/)
    expect(segundo.notas.join('\n')).toMatch(/empieza el 20\/10\/2026/)
  })

  it('guarda el fichero sin cuenta y lo engancha al crear la cuenta, aunque ya no esté en inbox', async () => {
    const hecho = libro()
    db = hecho.db
    const path = join(hecho.rutas.inbox, 'septiembre.csv')
    writeFileSync(
      path,
      [
        `IBAN: ${IBAN}`,
        'Fecha;Concepto;Importe;Saldo',
        '01/09/2026;NOMINA;1000,00;1000,00',
        '02/09/2026;MERCADONA;-20,00;980,00',
      ].join('\n'),
    )
    const primero = await hecho.svc.importar()
    expect(primero.sinCuenta).toBe(1)
    expect(primero.movimientos).toBe(0)
    expect(hecho.svc.resumen().archivos[0]?.guardado).toBe(true)
    unlinkSync(path)

    const otraVez = await hecho.svc.importar()
    expect(otraVez.vistos).toBe(0)
    expect(hecho.svc.resumen().archivos).toHaveLength(1)

    const cuenta = hecho.svc.crearCuenta({ nombre: 'ING', iban: IBAN })
    const enganche = await hecho.svc.engancharPendientes(cuenta.id)
    expect(enganche.movimientos).toBe(2)
    const resumen = hecho.svc.resumen()
    expect(resumen.archivos[0]?.cuentaId).toBe(cuenta.id)
    expect(resumen.archivos[0]?.guardado).toBe(false)
    expect(resumen.cuentas[0]?.ultimoApunte).toMatchObject({ fecha: '2026-09-02', concepto: 'MERCADONA' })
    expect(hecho.svc.movimientos({})).toHaveLength(2)
  })

  it('dos cargos iguales el mismo día no se duplican aunque el fichero los traiga al revés', async () => {
    const hecho = libro()
    db = hecho.db
    hecho.svc.crearCuenta({ nombre: 'ING', iban: IBAN })
    writeFileSync(
      join(hecho.rutas.inbox, 'a.csv'),
      [
        `IBAN: ${IBAN}`,
        'Fecha;Concepto;Importe',
        '01/09/2026;BIZUM;-10,00',
        '01/09/2026;BIZUM;-10,00',
      ].join('\n'),
    )
    await hecho.svc.importar()
    writeFileSync(
      join(hecho.rutas.inbox, 'b.csv'),
      [
        `IBAN: ${IBAN}`,
        'Fecha;Concepto;Importe',
        '01/09/2026;BIZUM;-10,00',
        '01/09/2026;BIZUM;-10,00',
        '03/09/2026;BIZUM;-10,00',
      ].join('\n'),
    )
    const segundo = await hecho.svc.importar()
    expect(segundo.duplicados).toBe(2)
    expect(segundo.movimientos).toBe(1)
    expect(hecho.svc.movimientos({})).toHaveLength(3)
  })
})
