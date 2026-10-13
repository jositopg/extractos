import { describe, expect, it } from 'vitest'
import { asegurarCuentasDesdeFym, getCuenta, insertCuenta, listCuentas, openDb, updateCuenta } from './db'

const ahora = '2026-10-13T00:00:00.000Z'

describe('cuentas bancarias de Fuck You Money', () => {
  it('crea la cuenta, enlaza una que ya existía y no pisa el desmarque ni el IBAN', () => {
    const db = openDb(':memory:')
    insertCuenta(db, {
      id: 'local-nomina',
      nombre: 'Nomina',
      banco: 'ING',
      alias: 'ing',
      iban: 'ES7921000813610123456789',
      ccc: '21000813610123456789',
      tipo: 'nomina',
      fym_asset_id: null,
      en_fym: 0,
      saldo_inicial_centimos: null,
      saldo_inicial_fecha: null,
      creado_en: ahora,
    })
    insertCuenta(db, {
      id: 'local-caja',
      nombre: 'Caja',
      banco: '',
      alias: '',
      iban: '',
      ccc: '',
      tipo: 'corriente',
      fym_asset_id: null,
      en_fym: 0,
      saldo_inicial_centimos: null,
      saldo_inicial_fecha: null,
      creado_en: ahora,
    })

    const n = asegurarCuentasDesdeFym(
      db,
      [
        { id: 'fym-nomina', nombre: 'Nómina', tipo: 'nomina' },
        { id: 'fym-ahorro', nombre: 'Ahorro', tipo: 'ahorro' },
        { id: 'fym-efectivo', nombre: 'Efectivo', tipo: 'otro' },
        { id: 'fym-suelta', nombre: 'Sin tipo', tipo: '' },
      ],
      ahora,
    )

    expect(n).toBe(3)
    expect(listCuentas(db).map((c) => c.nombre).sort()).toEqual(['Ahorro', 'Caja', 'Nómina', 'Sin tipo'])
    const nomina = getCuenta(db, 'local-nomina')
    expect(nomina).toMatchObject({
      fym_asset_id: 'fym-nomina',
      nombre: 'Nómina',
      iban: 'ES7921000813610123456789',
      alias: 'ing',
      en_fym: 0,
      tipo: 'nomina',
    })
    expect(getCuenta(db, 'fym-ahorro')).toMatchObject({ en_fym: 1, tipo: 'ahorro', fym_asset_id: 'fym-ahorro' })
    expect(getCuenta(db, 'fym-suelta')).toMatchObject({ tipo: 'corriente', en_fym: 1 })
    expect(getCuenta(db, 'fym-efectivo')).toBeUndefined()
    expect(getCuenta(db, 'local-caja')?.fym_asset_id).toBeNull()

    updateCuenta(db, { ...getCuenta(db, 'fym-ahorro')!, en_fym: 0, iban: 'ES12' })
    asegurarCuentasDesdeFym(db, [{ id: 'fym-ahorro', nombre: 'Ahorro casa', tipo: 'ahorro' }], ahora)
    expect(getCuenta(db, 'fym-ahorro')).toMatchObject({
      nombre: 'Ahorro casa',
      en_fym: 0,
      iban: 'ES12',
    })
    expect(listCuentas(db).filter((c) => c.fym_asset_id === 'fym-ahorro')).toHaveLength(1)
  })
})
