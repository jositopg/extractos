import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { utils, write } from 'xlsx'
import { insertArchivo, openDb, type Db } from './db'
import { sha256 } from './ids'
import { crearServicio } from './servicio'

describe('relectura', () => {
  let db: Db | undefined

  afterEach(() => {
    db?.close()
  })

  it('vuelve a leer un fichero que se quedó en error y no lo duplica después', async () => {
    const root = mkdtempSync(join(tmpdir(), 'extractos-'))
    const inbox = join(root, 'inbox')
    mkdirSync(inbox)
    const wb = utils.book_new()
    utils.book_append_sheet(
      wb,
      utils.aoa_to_sheet([
        ['Fecha', 'Concepto', 'Importe'],
        ['10/01/2026', 'RECIBO ENDESA', '-45,20'],
      ]),
      'Movimientos',
    )
    const buf = Buffer.from(write(wb, { type: 'buffer', bookType: 'xls' }))
    writeFileSync(join(inbox, 'ing.xls'), buf)
    db = openDb(join(root, 't.sqlite'))
    insertArchivo(db, {
      id: 'err1',
      nombre: 'ing.xls',
      contenido_hash: sha256(buf),
      formato: 'excel',
      cuenta_id: null,
      ccc: '',
      iban: '',
      desde: null,
      hasta: null,
      saldo_inicial_centimos: null,
      saldo_final_centimos: null,
      cuadre_centimos: null,
      leidos: 0,
      movimientos: 0,
      duplicados: 0,
      avisos: '',
      error: 'No encuentro columnas de fecha e importe',
      importado_en: new Date().toISOString(),
    })
    const svc = crearServicio(db, { root, inbox, exportDir: join(root, 'export') }, { finca: false })
    const primero = await svc.importar()
    expect(primero.errores).toEqual([])
    expect(primero.sinCuenta).toBe(1)
    expect(svc.resumen().archivos[0]?.error).toBeNull()
    expect(svc.resumen().archivos[0]?.leidos).toBe(1)

    const segundo = await svc.importar()
    expect(segundo.yaEstaban).toBe(0)
    expect(segundo.sinCuenta).toBe(1)
    expect(segundo.nuevos).toBe(0)
    expect(svc.resumen().archivos).toHaveLength(1)
    expect(svc.resumen().archivos[0]?.guardado).toBe(true)
  })
})
