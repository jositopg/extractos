import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import type { FilaFinca } from '../shared/finca'
import { openDb, upsertPropiedad, copiarLibro, type Db } from './db'
import type { EscritorFinca } from './finca'
import { uuidEstable } from './ids'
import { crearServicio } from './servicio'

const IBAN = 'ES91 2100 0418 45 0200051332'
const propiedadA = '11111111-1111-4111-8111-111111111111'
const propiedadB = '22222222-2222-4222-8222-222222222222'

function csv(lineas: string[]): string {
  return ['IBAN: ES91 2100 0418 45 0200051332', 'Fecha;Concepto;Importe;Saldo', ...lineas].join('\n')
}

function libro(nombre: string) {
  const root = mkdtempSync(join(tmpdir(), nombre))
  const db = openDb(join(root, 'extractos.sqlite'))
  const rutas = { root, inbox: join(root, 'inbox'), exportDir: join(root, 'export') }
  mkdirSync(rutas.inbox, { recursive: true })
  return { root, db, rutas }
}

function escritor(escrituras: FilaFinca[], borrados: { id: string; referencia: string }[], llamadas: { n: number }): EscritorFinca {
  return {
    async aplicar(ops) {
      llamadas.n += 1
      escrituras.push(...ops.upserts)
      borrados.push(...ops.borrados)
      return { ok: [...ops.upserts.map((u) => u.id), ...ops.borrados.map((b) => b.id)], fallos: [] }
    },
  }
}

describe('reglas, cuenta y copia', () => {
  let db: Db | undefined
  afterEach(() => db?.close())

  it('enseña la regla y solo escribe en Finca al aceptarla', async () => {
    const hecho = libro('extractos-regla-')
    db = hecho.db
    const escrituras: FilaFinca[] = []
    const llamadas = { n: 0 }
    const svc = crearServicio(db, hecho.rutas, { finca: escritor(escrituras, [], llamadas) })
    svc.crearCuenta({ nombre: 'Nómina', iban: IBAN })
    upsertPropiedad(db, { id: propiedadA, nombre: 'Piso Rambla', origen: 'finca', visto_en: '2026-01-01T00:00:00.000Z' })
    upsertPropiedad(db, { id: propiedadB, nombre: 'Piso Mar', origen: 'finca', visto_en: '2026-01-01T00:00:00.000Z' })
    writeFileSync(join(hecho.rutas.inbox, 'uno.csv'), csv([
      '10/01/2026;RECIBO ENDESA ENERGIA;-30,00;100,00',
      '11/01/2026;ENDESA SUMINISTROS;-10,00;90,00',
      '12/01/2026;RECIBO ENDESA ENERGIA EXTRA;-8,00;82,00',
      '13/01/2026;MERCADONA;-5,00;77,00',
    ]))
    await svc.importar()
    const energia = svc.movimientos({}).find((m) => m.concepto === 'RECIBO ENDESA ENERGIA')!
    const extra = svc.movimientos({}).find((m) => m.concepto.includes('EXTRA'))!
    const suministros = svc.movimientos({}).find((m) => m.concepto.includes('SUMINISTROS'))!
    await svc.clasificar(energia.id, {
      destino: 'finca',
      categoriaFinca: 'Electricidad',
      propiedadId: propiedadA,
      recordar: true,
      patron: 'recibo endesa energia',
    })
    const vista = svc.previsualizar({
      destino: 'finca',
      categoriaFinca: 'Agua',
      propiedadId: propiedadB,
      patron: 'endesa',
    })
    expect(vista.coincidencias.map((c) => c.id)).toEqual([suministros.id])
    expect(llamadas.n).toBe(1)
    await svc.clasificar(suministros.id, {
      destino: 'finca',
      categoriaFinca: 'Agua',
      propiedadId: propiedadB,
      recordar: true,
      patron: 'endesa',
    })
    expect(svc.movimientos({}).find((m) => m.id === energia.id)?.categoriaFinca).toBe('Electricidad')
    expect(svc.movimientos({}).find((m) => m.id === extra.id)?.categoriaFinca).toBe('Electricidad')
    expect(svc.movimientos({}).find((m) => m.id === suministros.id)?.categoriaFinca).toBe('Agua')
    expect(escrituras.some((f) => f.descripcion.includes('MERCADONA'))).toBe(false)
  })

  it('al mover el extracto pasa el IBAN y rehace la fila de Finca', async () => {
    const hecho = libro('extractos-mover-')
    db = hecho.db
    const escrituras: FilaFinca[] = []
    const borrados: { id: string; referencia: string }[] = []
    const svc = crearServicio(db, hecho.rutas, { finca: escritor(escrituras, borrados, { n: 0 }) })
    const origen = svc.crearCuenta({ nombre: 'Sin iban' })
    const destino = svc.crearCuenta({ nombre: 'Otra' })
    upsertPropiedad(db, { id: propiedadA, nombre: 'Piso Rambla', origen: 'finca', visto_en: '2026-01-01T00:00:00.000Z' })
    writeFileSync(join(hecho.rutas.inbox, 'suelto.csv'), csv(['10/01/2026;RECIBO ENDESA;-45,20;100,00']))
    await svc.importar()
    const archivo = svc.resumen().archivos[0]!
    expect(archivo.cuentaId).toBeNull()
    await svc.asignar(archivo.id, origen.id)
    expect(svc.resumen().cuentas.find((c) => c.id === origen.id)?.iban).toBe('ES9121000418450200051332')
    const endesa = svc.movimientos({})[0]!
    await svc.clasificar(endesa.id, { destino: 'finca', categoriaFinca: 'Electricidad', propiedadId: propiedadA })
    const idViejo = endesa.id
    await svc.asignar(archivo.id, destino.id)
    const cuentas = svc.resumen().cuentas
    expect(cuentas.find((c) => c.id === origen.id)?.iban).toBe('')
    expect(cuentas.find((c) => c.id === destino.id)?.iban).toBe('ES9121000418450200051332')
    const movido = svc.movimientos({})[0]!
    expect(movido.cuentaId).toBe(destino.id)
    expect(movido.id).not.toBe(idViejo)
    expect(borrados).toContainEqual({ id: uuidEstable(`extractos:${idViejo}`), referencia: `extractos:${idViejo}` })
    expect(escrituras.at(-1)?.referencia).toBe(`extractos:${movido.id}`)
  })

  it('la duda sigue en el bruto y deshacer borra solo la fila de Finca', async () => {
    const hecho = libro('extractos-duda-')
    db = hecho.db
    const borrados: { id: string; referencia: string }[] = []
    const svc = crearServicio(db, hecho.rutas, { finca: escritor([], borrados, { n: 0 }) })
    const cuenta = svc.crearCuenta({ nombre: 'Nómina', iban: IBAN, enFym: true })
    upsertPropiedad(db, { id: propiedadA, nombre: 'Piso Rambla', origen: 'finca', visto_en: '2026-01-01T00:00:00.000Z' })
    writeFileSync(join(hecho.rutas.inbox, 'uno.csv'), csv([
      '10/01/2026;RECIBO ENDESA;-45,20;100,00',
      '12/01/2026;MERCADONA;-12,40;87,60',
    ]))
    await svc.importar()
    const endesa = svc.movimientos({}).find((m) => m.concepto.includes('ENDESA'))!
    const super_ = svc.movimientos({}).find((m) => m.concepto.includes('MERCADONA'))!
    await svc.clasificar(super_.id, { destino: 'duda' })
    expect(svc.registro('2026-01').brutoCentimos).toBe(5760)
    expect(svc.movimientos({ destino: 'abiertos' }).map((m) => m.id).sort()).toEqual([endesa.id, super_.id].sort())
    expect(svc.resumen().recuento.pendiente).toBe(2)
    await svc.clasificar(endesa.id, { destino: 'finca', categoriaFinca: 'Electricidad', propiedadId: propiedadA })
    await svc.clasificar(endesa.id, { destino: 'pendiente' })
    expect(borrados).toContainEqual({ id: uuidEstable(`extractos:${endesa.id}`), referencia: `extractos:${endesa.id}` })
    expect(svc.movimientos({}).find((m) => m.id === endesa.id)?.destino).toBe('pendiente')
    expect(svc.registro('2026-01').brutoCentimos).toBe(5760)
    expect(cuenta.enFym).toBe(true)
  })

  it('parte un apunte en dos propiedades y la suma es el importe', async () => {
    const hecho = libro('extractos-parte-')
    db = hecho.db
    const escrituras: FilaFinca[] = []
    const borrados: { id: string; referencia: string }[] = []
    const svc = crearServicio(db, hecho.rutas, { finca: escritor(escrituras, borrados, { n: 0 }) })
    svc.crearCuenta({ nombre: 'Nómina', iban: IBAN })
    upsertPropiedad(db, { id: propiedadA, nombre: 'Piso Rambla', origen: 'finca', visto_en: '2026-01-01T00:00:00.000Z' })
    upsertPropiedad(db, { id: propiedadB, nombre: 'Piso Mar', origen: 'finca', visto_en: '2026-01-01T00:00:00.000Z' })
    writeFileSync(join(hecho.rutas.inbox, 'uno.csv'), csv(['10/01/2026;RECIBO ENDESA;-45,20;100,00']))
    await svc.importar()
    const endesa = svc.movimientos({})[0]!
    await svc.clasificar(endesa.id, { destino: 'finca', categoriaFinca: 'Electricidad', propiedadId: propiedadA })
    await svc.repartir(endesa.id, [
      { propiedadId: propiedadA, categoriaFinca: 'Electricidad', importeCentimos: -2000 },
      { propiedadId: propiedadB, categoriaFinca: 'Agua', importeCentimos: -2520 },
    ])
    const partes = svc.movimientos({})[0]?.repartos ?? []
    expect(partes.map((p) => p.importeCentimos).sort((a, b) => a - b)).toEqual([-2520, -2000])
    expect(partes.reduce((s, p) => s + p.importeCentimos, 0)).toBe(-4520)
    const refs = partes.map((p) => `extractos:${endesa.id}:${p.id}`).sort()
    expect(escrituras.map((f) => f.referencia).filter((r) => r.startsWith(`extractos:${endesa.id}:`)).sort()).toEqual(refs)
    expect(borrados).toContainEqual({ id: uuidEstable(`extractos:${endesa.id}`), referencia: `extractos:${endesa.id}` })
    await expect(svc.repartir(endesa.id, [
      { propiedadId: propiedadA, categoriaFinca: 'Electricidad', importeCentimos: -1000 },
      { propiedadId: propiedadB, categoriaFinca: 'Agua', importeCentimos: -1000 },
    ])).rejects.toThrow(/sumar/)
  })

  it('concilia varios apuntes con una sola escritura', async () => {
    const hecho = libro('extractos-varios-')
    db = hecho.db
    const llamadas = { n: 0 }
    const svc = crearServicio(db, hecho.rutas, { finca: escritor([], [], llamadas) })
    svc.crearCuenta({ nombre: 'Nómina', iban: IBAN })
    upsertPropiedad(db, { id: propiedadA, nombre: 'Piso Rambla', origen: 'finca', visto_en: '2026-01-01T00:00:00.000Z' })
    writeFileSync(join(hecho.rutas.inbox, 'uno.csv'), csv([
      '10/01/2026;COMUNIDAD ENERO;-20,00;80,00',
      '11/01/2026;COMUNIDAD FEBRERO;-20,00;60,00',
    ]))
    await svc.importar()
    const ids = svc.movimientos({}).map((m) => m.id)
    await svc.clasificarVarios({
      ids,
      destino: 'finca',
      categoriaFinca: 'Comunidad de propietarios',
      propiedadId: propiedadA,
    })
    expect(llamadas.n).toBe(1)
    expect(svc.movimientos({}).every((m) => m.destino === 'finca')).toBe(true)
  })

  it('la copia del libro es un sqlite', () => {
    const hecho = libro('extractos-copia-')
    db = hecho.db
    const svc = crearServicio(db, hecho.rutas)
    const buf = svc.copiarLibro()
    expect(buf.subarray(0, 16).toString('utf8')).toBe('SQLite format 3\u0000')
    const abierto = openDb(':memory:')
    expect(copiarLibro(abierto).subarray(0, 15).toString('utf8')).toBe('SQLite format 3')
    abierto.close()
  })
})
