import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { FilaFinca } from '../shared/finca'
import { openDb, upsertPropiedad, type Db } from './db'
import type { EscritorFinca } from './finca'
import { uuidEstable } from './ids'
import { crearServicio, type Servicio } from './servicio'

const csv = [
  'IBAN: ES91 2100 0418 45 0200051332',
  'Fecha;Concepto;Importe;Saldo',
  '10/01/2026;RECIBO ENDESA;-45,20;954,80',
  '12/01/2026;MERCADONA;-12,40;942,40',
  '15/01/2026;ALQUILER PISO RAMBLA;800,00;1.742,40',
].join('\n')

const propiedadId = '11111111-1111-4111-8111-111111111111'

function escritorFalso(escrituras: FilaFinca[], borrados: { id: string; referencia: string }[], llamadas: { n: number }): EscritorFinca {
  return {
    async aplicar(ops) {
      llamadas.n += 1
      escrituras.push(...ops.upserts)
      borrados.push(...ops.borrados)
      return {
        ok: [...ops.upserts.map((u) => u.id), ...ops.borrados.map((b) => b.id)],
        fallos: [],
      }
    },
  }
}

describe('flujo de un extracto', () => {
  let db: Db | undefined

  afterEach(() => {
    db?.close()
  })

  it('concilia con la propiedad, escribe en Finca y separa el gasto en bruto', async () => {
    const root = mkdtempSync(join(tmpdir(), 'extractos-'))
    db = openDb(join(root, 'extractos.sqlite'))
    const rutas = { root, inbox: join(root, 'inbox'), exportDir: join(root, 'export') }
    mkdirSync(rutas.inbox, { recursive: true })
    const escrituras: FilaFinca[] = []
    const borrados: { id: string; referencia: string }[] = []
    const llamadas = { n: 0 }
    const svc: Servicio = crearServicio(db, rutas, { finca: escritorFalso(escrituras, borrados, llamadas) })
    const cuenta = svc.crearCuenta({
      nombre: 'Caixa nómina',
      banco: 'CaixaBank',
      tipo: 'nomina',
      iban: 'ES91 2100 0418 45 0200051332',
    })
    upsertPropiedad(db, {
      id: propiedadId,
      nombre: 'Piso Rambla',
      origen: 'finca',
      visto_en: new Date().toISOString(),
    })
    writeFileSync(join(rutas.inbox, 'enero.csv'), csv)

    const primero = await svc.importar()
    expect(primero.movimientos).toBe(3)
    expect(primero.sinCuenta).toBe(0)
    expect(llamadas.n).toBe(0)
    expect(svc.resumen().cuentas[0]).toMatchObject({ saldoCentimos: 174240, fechaSaldo: '2026-01-15', origenSaldo: 'extracto', enFym: false })

    const movs = svc.movimientos({})
    const endesa = movs.find((m) => m.concepto.includes('ENDESA'))
    const super_ = movs.find((m) => m.concepto.includes('MERCADONA'))
    const alquiler = movs.find((m) => m.concepto.includes('ALQUILER'))
    expect(endesa && super_ && alquiler).toBeTruthy()
    const conciliar = {
      destino: 'finca' as const,
      categoriaFinca: 'Electricidad',
      propiedadId,
      recordar: true,
      patron: 'endesa',
    }
    await svc.clasificar(endesa!.id, conciliar)
    await svc.clasificar(endesa!.id, conciliar)
    expect(llamadas.n).toBe(1)
    expect(escrituras[0]).toMatchObject({
      id: uuidEstable(`extractos:${endesa!.id}`),
      propiedadId,
      fecha: '2026-01-10',
      tipo: 'gasto',
      importe: '45.20',
      categoria: 'Electricidad',
      referencia: `extractos:${endesa!.id}`,
    })
    expect(escrituras[0]?.descripcion).toContain('ENDESA')

    await svc.clasificar(alquiler!.id, {
      destino: 'finca',
      categoriaFinca: 'Alquiler mensual',
      propiedadId,
    })
    expect(escrituras.at(-1)).toMatchObject({
      tipo: 'ingreso',
      importe: '800.00',
      categoria: 'Alquiler mensual',
      referencia: `extractos:${alquiler!.id}`,
    })

    writeFileSync(
      join(rutas.inbox, 'febrero.csv'),
      [
        'IBAN: ES91 2100 0418 45 0200051332',
        'Fecha;Concepto;Importe;Saldo',
        '20/02/2026;RECIBO ENDESA ENERGIA;-30,00;1.712,40',
      ].join('\n'),
    )
    const segundo = await svc.importar()
    expect(segundo.movimientos).toBe(1)
    const febrero = svc.movimientos({}).find((m) => m.fecha === '2026-02-20')
    expect(febrero).toMatchObject({ destino: 'finca', categoriaFinca: 'Electricidad', propiedadId, fincaError: null })
    expect(escrituras.at(-1)).toMatchObject({ importe: '30.00', referencia: `extractos:${febrero!.id}` })

    const otraVez = await svc.importar()
    expect(otraVez.yaEstaban).toBe(2)
    expect(otraVez.movimientos).toBe(0)
    expect(llamadas.n).toBe(3)
    expect(escrituras.some((f) => f.descripcion.includes('MERCADONA'))).toBe(false)

    expect(svc.registro('2026-01')).toMatchObject({
      brutoCentimos: 0,
      cuentasFym: 0,
    })
    expect(svc.registro('2026-01').brutoAviso).toMatch(/Fuck You Money/)
    svc.actualizarCuenta(cuenta.id, { enFym: true })
    const enero = svc.registro('2026-01')
    expect(enero.brutoCentimos).toBe(5760)
    expect(enero.ingresosFincaCentimos).toBe(80000)
    expect(enero.cuentasFym).toBe(1)
    expect(enero.historial.map((h) => h.saldoCentimos)).toEqual([174240, 171240])
    expect(svc.resumen().cuentas[0].saldoCentimos).toBe(171240)
    expect(svc.estadoFinca().escritos).toBe(3)

    await svc.clasificar(endesa!.id, {
      destino: 'finca',
      categoriaFinca: 'Agua',
      propiedadId,
      recordar: true,
      patron: 'endesa',
    })
    expect(escrituras.at(-1)).toMatchObject({ id: escrituras[0]?.id, categoria: 'Agua', importe: '45.20' })

    await svc.clasificar(super_!.id, { destino: 'traspaso' })
    expect(svc.registro('2026-01').brutoCentimos).toBe(4520)

    await svc.clasificar(endesa!.id, { destino: 'ignorar' })
    expect(borrados).toContainEqual({ id: uuidEstable(`extractos:${endesa!.id}`), referencia: `extractos:${endesa!.id}` })
    const fuera = svc.movimientos({}).find((m) => m.id === endesa!.id)
    expect(fuera).toMatchObject({ destino: 'ignorar', fincaError: null, fincaSincronizadoEn: null })
    expect(svc.registro('2026-01').brutoCentimos).toBe(0)
    expect(svc.estadoFinca().escritos).toBe(2)
  })

  it('no escribe en Finca una propiedad que solo existe en este libro', async () => {
    const root = mkdtempSync(join(tmpdir(), 'extractos-local-'))
    db = openDb(join(root, 'extractos.sqlite'))
    const rutas = { root, inbox: join(root, 'inbox'), exportDir: join(root, 'export') }
    mkdirSync(rutas.inbox, { recursive: true })
    const escrituras: FilaFinca[] = []
    const svc = crearServicio(db, rutas, { finca: escritorFalso(escrituras, [], { n: 0 }) })
    svc.crearCuenta({ nombre: 'Caja', iban: 'ES91 2100 0418 45 0200051332' })
    const propiedad = svc.crearPropiedad('Piso local')
    writeFileSync(join(rutas.inbox, 'uno.csv'), csv)
    await svc.importar()
    const endesa = svc.movimientos({}).find((m) => m.concepto.includes('ENDESA'))
    await svc.clasificar(endesa!.id, {
      destino: 'finca',
      categoriaFinca: 'Electricidad',
      propiedadId: propiedad.id,
      recordar: true,
      patron: 'endesa',
    })
    expect(escrituras).toHaveLength(0)
    expect(svc.movimientos({}).find((m) => m.id === endesa!.id)?.fincaError).toMatch(/este libro/)
  })

  it('abre un libro guardado antes de llevar el saldo a Fuck You Money', () => {
    const root = mkdtempSync(join(tmpdir(), 'extractos-viejo-'))
    const path = join(root, 'extractos.sqlite')
    const viejo = new DatabaseSync(path)
    viejo.exec(`
      CREATE TABLE cuentas (
        id TEXT PRIMARY KEY,
        nombre TEXT NOT NULL,
        banco TEXT NOT NULL DEFAULT '',
        alias TEXT NOT NULL DEFAULT '',
        iban TEXT NOT NULL DEFAULT '',
        ccc TEXT NOT NULL DEFAULT '',
        tipo TEXT NOT NULL DEFAULT 'corriente',
        fym_asset_id TEXT,
        saldo_inicial_centimos INTEGER,
        saldo_inicial_fecha TEXT,
        creado_en TEXT NOT NULL
      );
      CREATE TABLE movimientos (
        id TEXT PRIMARY KEY,
        cuenta_id TEXT NOT NULL,
        archivo_id TEXT NOT NULL,
        orden INTEGER NOT NULL,
        fecha TEXT NOT NULL,
        importe_centimos INTEGER NOT NULL,
        concepto TEXT NOT NULL,
        destino TEXT NOT NULL DEFAULT 'pendiente'
      );
    `)
    viejo.close()
    db = openDb(path)
    const cuentas = db.prepare('PRAGMA table_info(cuentas)').all() as Array<{ name: string }>
    const movimientos = db.prepare('PRAGMA table_info(movimientos)').all() as Array<{ name: string }>
    expect(cuentas.some((c) => c.name === 'en_fym')).toBe(true)
    expect(movimientos.map((c) => c.name)).toEqual(expect.arrayContaining(['finca_tx_id', 'finca_error', 'finca_firma']))
  })

  it('si Finca no responde, el apunte se queda clasificado', async () => {
    const root = mkdtempSync(join(tmpdir(), 'extractos-caida-'))
    db = openDb(join(root, 'extractos.sqlite'))
    const rutas = { root, inbox: join(root, 'inbox'), exportDir: join(root, 'export') }
    mkdirSync(rutas.inbox, { recursive: true })
    const svc = crearServicio(db, rutas, {
      finca: { aplicar: async () => { throw new Error('caída de Finca') } },
    })
    svc.crearCuenta({ nombre: 'Caja', iban: 'ES91 2100 0418 45 0200051332' })
    upsertPropiedad(db, { id: propiedadId, nombre: 'Piso Rambla', origen: 'finca', visto_en: new Date().toISOString() })
    writeFileSync(join(rutas.inbox, 'uno.csv'), csv)
    await svc.importar()
    const endesa = svc.movimientos({}).find((m) => m.concepto.includes('ENDESA'))
    await svc.clasificar(endesa!.id, {
      destino: 'finca',
      categoriaFinca: 'Electricidad',
      propiedadId,
    })
    expect(svc.movimientos({}).find((m) => m.id === endesa!.id)).toMatchObject({
      destino: 'finca',
      fincaError: 'caída de Finca',
    })
  })
})
