import { randomUUID } from 'node:crypto'
import { mkdirSync, readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import type { Destino, TipoCuenta } from '../shared/categorias'
import { esCuentaBancaria, esDestino, esTipoCuenta } from '../shared/categorias'
import { normalizar } from '../shared/money'

export type Db = DatabaseSync

const SCHEMA = `
CREATE TABLE IF NOT EXISTS cuentas (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  banco TEXT NOT NULL DEFAULT '',
  alias TEXT NOT NULL DEFAULT '',
  iban TEXT NOT NULL DEFAULT '',
  ccc TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'corriente',
  fym_asset_id TEXT,
  en_fym INTEGER NOT NULL DEFAULT 0,
  saldo_inicial_centimos INTEGER,
  saldo_inicial_fecha TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS propiedades (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  origen TEXT NOT NULL,
  visto_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fym_cash (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  valor_centimos INTEGER,
  tipo TEXT NOT NULL DEFAULT '',
  visto_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS archivos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  contenido_hash TEXT NOT NULL,
  formato TEXT NOT NULL,
  cuenta_id TEXT,
  ccc TEXT NOT NULL DEFAULT '',
  iban TEXT NOT NULL DEFAULT '',
  desde TEXT,
  hasta TEXT,
  saldo_inicial_centimos INTEGER,
  saldo_final_centimos INTEGER,
  cuadre_centimos INTEGER,
  leidos INTEGER NOT NULL DEFAULT 0,
  movimientos INTEGER NOT NULL DEFAULT 0,
  duplicados INTEGER NOT NULL DEFAULT 0,
  avisos TEXT NOT NULL DEFAULT '',
  error TEXT,
  importado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS movimientos (
  id TEXT PRIMARY KEY,
  cuenta_id TEXT NOT NULL REFERENCES cuentas(id),
  archivo_id TEXT NOT NULL REFERENCES archivos(id),
  orden INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  fecha_valor TEXT,
  importe_centimos INTEGER NOT NULL,
  saldo_centimos INTEGER,
  concepto TEXT NOT NULL,
  documento TEXT NOT NULL DEFAULT '',
  destino TEXT NOT NULL DEFAULT 'pendiente',
  categoria_finca TEXT,
  propiedad_id TEXT,
  categoria_personal TEXT,
  nota TEXT NOT NULL DEFAULT '',
  regla_id TEXT,
  clasificado_en TEXT,
  exportado_finca_en TEXT,
  finca_tx_id TEXT,
  finca_sincronizado_en TEXT,
  finca_error TEXT,
  finca_firma TEXT,
  ordinal_clave INTEGER
);

CREATE TABLE IF NOT EXISTS repartos (
  id TEXT PRIMARY KEY,
  movimiento_id TEXT NOT NULL,
  propiedad_id TEXT NOT NULL,
  categoria_finca TEXT NOT NULL,
  importe_centimos INTEGER NOT NULL,
  finca_tx_id TEXT,
  finca_firma TEXT,
  finca_error TEXT,
  finca_sincronizado_en TEXT,
  vigente INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS reglas (
  id TEXT PRIMARY KEY,
  patron TEXT NOT NULL,
  destino TEXT NOT NULL,
  categoria_finca TEXT,
  propiedad_id TEXT,
  categoria_personal TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ficheros (
  hash TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  bytes BLOB NOT NULL,
  guardado_en TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_arch_hash ON archivos(contenido_hash);
CREATE INDEX IF NOT EXISTS idx_mov_cuenta ON movimientos(cuenta_id, fecha);
CREATE INDEX IF NOT EXISTS idx_mov_destino ON movimientos(destino);
CREATE INDEX IF NOT EXISTS idx_reparto_mov ON repartos(movimiento_id);
`

export function openDb(path: string, opciones?: { wal?: boolean }): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
  const db = new DatabaseSync(path)
  db.exec('PRAGMA foreign_keys = ON')
  if (path !== ':memory:') db.exec(opciones?.wal === false ? 'PRAGMA journal_mode = DELETE' : 'PRAGMA journal_mode = WAL')
  db.exec(SCHEMA)
  asegurarColumna(db, 'cuentas', 'en_fym', 'en_fym INTEGER NOT NULL DEFAULT 0')
  asegurarColumna(db, 'fym_cash', 'tipo', "tipo TEXT NOT NULL DEFAULT ''")
  asegurarColumna(db, 'movimientos', 'finca_tx_id', 'finca_tx_id TEXT')
  asegurarColumna(db, 'movimientos', 'finca_sincronizado_en', 'finca_sincronizado_en TEXT')
  asegurarColumna(db, 'movimientos', 'finca_error', 'finca_error TEXT')
  asegurarColumna(db, 'movimientos', 'finca_firma', 'finca_firma TEXT')
  asegurarColumna(db, 'movimientos', 'ordinal_clave', 'ordinal_clave INTEGER')
  return db
}

function asegurarColumna(db: Db, tabla: string, columna: string, definicion: string): void {
  const cols = db.prepare(`PRAGMA table_info(${tabla})`).all() as Array<{ name: string }>
  if (cols.some((c) => c.name === columna)) return
  db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${definicion}`)
}

export type CuentaRow = {
  id: string
  nombre: string
  banco: string
  alias: string
  iban: string
  ccc: string
  tipo: string
  fym_asset_id: string | null
  en_fym: number
  saldo_inicial_centimos: number | null
  saldo_inicial_fecha: string | null
  creado_en: string
}

export type ArchivoRow = {
  id: string
  nombre: string
  contenido_hash: string
  formato: string
  cuenta_id: string | null
  ccc: string
  iban: string
  desde: string | null
  hasta: string | null
  saldo_inicial_centimos: number | null
  saldo_final_centimos: number | null
  cuadre_centimos: number | null
  leidos: number
  movimientos: number
  duplicados: number
  avisos: string
  error: string | null
  importado_en: string
}

export type MovimientoRow = {
  id: string
  cuenta_id: string
  archivo_id: string
  orden: number
  fecha: string
  fecha_valor: string | null
  importe_centimos: number
  saldo_centimos: number | null
  concepto: string
  documento: string
  destino: string
  categoria_finca: string | null
  propiedad_id: string | null
  categoria_personal: string | null
  nota: string
  regla_id: string | null
  clasificado_en: string | null
  exportado_finca_en: string | null
  finca_tx_id: string | null
  finca_sincronizado_en: string | null
  finca_error: string | null
  finca_firma: string | null
  ordinal_clave: number | null
  cuenta_nombre?: string
  propiedad_nombre?: string
}

export type RepartoRow = {
  id: string
  movimiento_id: string
  propiedad_id: string
  categoria_finca: string
  importe_centimos: number
  finca_tx_id: string | null
  finca_firma: string | null
  finca_error: string | null
  finca_sincronizado_en: string | null
  vigente: number
}

export type ReglaRow = {
  id: string
  patron: string
  destino: string
  categoria_finca: string | null
  propiedad_id: string | null
  categoria_personal: string | null
  creado_en: string
}

export type PropiedadRow = {
  id: string
  nombre: string
  origen: string
  visto_en: string
}

export type FymRow = {
  id: string
  nombre: string
  valor_centimos: number | null
  tipo: string
  visto_en: string
}

function all<T>(db: Db, sql: string, ...params: Array<string | number | null>): T[] {
  return db.prepare(sql).all(...params) as T[]
}

function get<T>(db: Db, sql: string, ...params: Array<string | number | null>): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined
}

export function listCuentas(db: Db): CuentaRow[] {
  return all<CuentaRow>(db, 'SELECT * FROM cuentas ORDER BY nombre')
}

export function getCuenta(db: Db, id: string): CuentaRow | undefined {
  return get<CuentaRow>(db, 'SELECT * FROM cuentas WHERE id = ?', id)
}

export function insertCuenta(db: Db, row: CuentaRow): void {
  db.prepare(
    `INSERT INTO cuentas (
      id, nombre, banco, alias, iban, ccc, tipo, fym_asset_id, en_fym, saldo_inicial_centimos, saldo_inicial_fecha, creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.nombre,
    row.banco,
    row.alias,
    row.iban,
    row.ccc,
    row.tipo,
    row.fym_asset_id,
    row.en_fym ? 1 : 0,
    row.saldo_inicial_centimos,
    row.saldo_inicial_fecha,
    row.creado_en,
  )
}

export function updateCuenta(db: Db, row: CuentaRow): void {
  db.prepare(
    `UPDATE cuentas SET nombre = ?, banco = ?, alias = ?, iban = ?, ccc = ?, tipo = ?, fym_asset_id = ?, en_fym = ?,
      saldo_inicial_centimos = ?, saldo_inicial_fecha = ? WHERE id = ?`,
  ).run(
    row.nombre,
    row.banco,
    row.alias,
    row.iban,
    row.ccc,
    row.tipo,
    row.fym_asset_id,
    row.en_fym ? 1 : 0,
    row.saldo_inicial_centimos,
    row.saldo_inicial_fecha,
    row.id,
  )
}

export function contarMovimientosCuenta(db: Db, cuentaId: string): number {
  const row = get<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM movimientos WHERE cuenta_id = ?', cuentaId)
  return row?.c ?? 0
}

export function deleteCuenta(db: Db, id: string): void {
  db.prepare('DELETE FROM cuentas WHERE id = ?').run(id)
}

export function listPropiedades(db: Db): PropiedadRow[] {
  return all<PropiedadRow>(db, 'SELECT * FROM propiedades ORDER BY nombre')
}

export function getPropiedad(db: Db, id: string): PropiedadRow | undefined {
  return get<PropiedadRow>(db, 'SELECT * FROM propiedades WHERE id = ?', id)
}

export function upsertPropiedad(db: Db, row: PropiedadRow): void {
  db.prepare(
    `INSERT INTO propiedades (id, nombre, origen, visto_en) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, origen = excluded.origen, visto_en = excluded.visto_en`,
  ).run(row.id, row.nombre, row.origen, row.visto_en)
}

export function reemplazarPropiedadesFinca(db: Db, rows: PropiedadRow[]): void {
  const ids = rows.map((r) => r.id)
  db.exec('BEGIN')
  try {
    const actuales = all<{ id: string }>(db, `SELECT id FROM propiedades WHERE origen = 'finca'`)
    for (const actual of actuales) {
      if (!ids.includes(actual.id)) db.prepare('DELETE FROM propiedades WHERE id = ?').run(actual.id)
    }
    for (const row of rows) upsertPropiedad(db, row)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function listFym(db: Db): FymRow[] {
  return all<FymRow>(db, 'SELECT * FROM fym_cash ORDER BY nombre')
}

export function reemplazarFym(db: Db, rows: FymRow[]): void {
  db.exec('BEGIN')
  try {
    db.exec('DELETE FROM fym_cash')
    const stmt = db.prepare('INSERT INTO fym_cash (id, nombre, valor_centimos, tipo, visto_en) VALUES (?, ?, ?, ?, ?)')
    for (const row of rows) stmt.run(row.id, row.nombre, row.valor_centimos, row.tipo, row.visto_en)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

/** Crea o actualiza la cuenta local de cada saldo bancario de Fuck You Money. No borra cuentas. */
export function asegurarCuentasDesdeFym(
  db: Db,
  rows: Array<{ id: string; nombre: string; tipo: string }>,
  ahora: string,
): number {
  let n = 0
  for (const row of rows) {
    const tipoDicho = row.tipo.trim()
    if (tipoDicho && !esCuentaBancaria(tipoDicho)) continue
    const nombre = row.nombre.trim()
    const id = row.id.trim()
    if (!nombre || !id) continue
    const tipoNuevo = esCuentaBancaria(tipoDicho) ? tipoDicho : null
    const ligada = get<CuentaRow>(db, 'SELECT * FROM cuentas WHERE fym_asset_id = ?', id)
    if (ligada) {
      updateCuenta(db, { ...ligada, nombre, tipo: tipoNuevo ?? ligada.tipo })
      n += 1
      continue
    }
    const porId = getCuenta(db, id)
    if (porId && (!porId.fym_asset_id || porId.fym_asset_id === id)) {
      updateCuenta(db, { ...porId, nombre, tipo: tipoNuevo ?? porId.tipo, fym_asset_id: id })
      n += 1
      continue
    }
    const mismoNombre = listCuentas(db).filter((c) => !c.fym_asset_id && normalizar(c.nombre) === normalizar(nombre))
    if (mismoNombre.length === 1) {
      const actual = mismoNombre[0]
      updateCuenta(db, { ...actual, nombre, tipo: tipoNuevo ?? actual.tipo, fym_asset_id: id })
      n += 1
      continue
    }
    if (porId) continue
    insertCuenta(db, {
      id,
      nombre,
      banco: '',
      alias: '',
      iban: '',
      ccc: '',
      tipo: tipoNuevo ?? 'corriente',
      fym_asset_id: id,
      en_fym: 1,
      saldo_inicial_centimos: null,
      saldo_inicial_fecha: null,
      creado_en: ahora,
    })
    n += 1
  }
  return n
}

export function hayHash(db: Db, hash: string): boolean {
  return get<{ id: string }>(db, 'SELECT id FROM archivos WHERE contenido_hash = ? LIMIT 1', hash) != null
}

/** Una lectura fallida no bloquea el mismo fichero. Si ya hubo movimientos, no se toca. */
export function olvidarLecturaFallida(db: Db, hash: string): boolean {
  const rows = all<ArchivoRow>(db, 'SELECT * FROM archivos WHERE contenido_hash = ?', hash)
  if (rows.length === 0) return false
  if (rows.some((r) => !r.error || r.cuenta_id || Number(r.movimientos) > 0)) return false
  db.exec('BEGIN')
  try {
    for (const row of rows) {
      db.prepare('DELETE FROM movimientos WHERE archivo_id = ?').run(row.id)
      db.prepare('DELETE FROM archivos WHERE id = ?').run(row.id)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return true
}

export function insertArchivo(db: Db, row: ArchivoRow): void {
  db.prepare(
    `INSERT INTO archivos (
      id, nombre, contenido_hash, formato, cuenta_id, ccc, iban, desde, hasta,
      saldo_inicial_centimos, saldo_final_centimos, cuadre_centimos, leidos, movimientos, duplicados,
      avisos, error, importado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.nombre,
    row.contenido_hash,
    row.formato,
    row.cuenta_id,
    row.ccc,
    row.iban,
    row.desde,
    row.hasta,
    row.saldo_inicial_centimos,
    row.saldo_final_centimos,
    row.cuadre_centimos,
    row.leidos,
    row.movimientos,
    row.duplicados,
    row.avisos,
    row.error,
    row.importado_en,
  )
}

export function updateArchivoCuenta(
  db: Db,
  id: string,
  patch: { cuentaId: string; movimientos: number; duplicados: number; avisos?: string },
): void {
  if (patch.avisos == null) {
    db.prepare('UPDATE archivos SET cuenta_id = ?, movimientos = ?, duplicados = ?, error = NULL WHERE id = ?').run(
      patch.cuentaId,
      patch.movimientos,
      patch.duplicados,
      id,
    )
    return
  }
  db.prepare(
    'UPDATE archivos SET cuenta_id = ?, movimientos = ?, duplicados = ?, avisos = ?, error = NULL WHERE id = ?',
  ).run(patch.cuentaId, patch.movimientos, patch.duplicados, patch.avisos, id)
}

export function listArchivos(db: Db): ArchivoRow[] {
  return all<ArchivoRow>(db, 'SELECT * FROM archivos ORDER BY importado_en DESC')
}

export function getArchivo(db: Db, id: string): ArchivoRow | undefined {
  return get<ArchivoRow>(db, 'SELECT * FROM archivos WHERE id = ?', id)
}

export function contarArchivosHash(db: Db, hash: string): number {
  const row = get<{ c: number }>(db, 'SELECT COUNT(*) AS c FROM archivos WHERE contenido_hash = ?', hash)
  return row?.c ?? 0
}

export function listArchivosHash(db: Db, hash: string): ArchivoRow[] {
  return all<ArchivoRow>(db, 'SELECT * FROM archivos WHERE contenido_hash = ?', hash)
}

export function hashesGuardados(db: Db): Set<string> {
  const rows = all<{ hash: string }>(db, 'SELECT hash FROM ficheros')
  return new Set(rows.map((row) => row.hash))
}

export function guardarFichero(db: Db, hash: string, nombre: string, bytes: Buffer): void {
  db.prepare(
    `INSERT INTO ficheros (hash, nombre, bytes, guardado_en) VALUES (?, ?, ?, ?)
     ON CONFLICT(hash) DO UPDATE SET nombre = excluded.nombre, bytes = excluded.bytes, guardado_en = excluded.guardado_en`,
  ).run(hash, nombre, bytes, new Date().toISOString())
}

export function leerFichero(db: Db, hash: string): Buffer | null {
  const row = get<{ bytes: Uint8Array }>(db, 'SELECT bytes FROM ficheros WHERE hash = ?', hash)
  if (!row?.bytes) return null
  return Buffer.from(row.bytes)
}

export function borrarFichero(db: Db, hash: string): void {
  db.prepare('DELETE FROM ficheros WHERE hash = ?').run(hash)
}

export function maxFechaCuenta(db: Db, cuentaId: string): string | null {
  const row = get<{ f: string | null }>(db, 'SELECT MAX(fecha) AS f FROM movimientos WHERE cuenta_id = ?', cuentaId)
  return row?.f ?? null
}

export function listApuntesCuenta(
  db: Db,
  cuentaId: string,
): Array<{ fecha: string; concepto: string; importe_centimos: number; orden: number }> {
  return all<{ fecha: string; concepto: string; importe_centimos: number; orden: number }>(
    db,
    'SELECT fecha, concepto, importe_centimos, orden FROM movimientos WHERE cuenta_id = ?',
    cuentaId,
  )
}

export function hayMovimientoPorSaldo(
  db: Db,
  cuentaId: string,
  fecha: string,
  importeCentimos: number,
  saldoCentimos: number,
): boolean {
  return (
    get<{ id: string }>(
      db,
      `SELECT id FROM movimientos
       WHERE cuenta_id = ? AND fecha = ? AND importe_centimos = ? AND saldo_centimos = ? LIMIT 1`,
      cuentaId,
      fecha,
      importeCentimos,
      saldoCentimos,
    ) != null
  )
}

export function deleteMovimientosArchivo(db: Db, archivoId: string): void {
  db.prepare(
    'DELETE FROM repartos WHERE movimiento_id IN (SELECT id FROM movimientos WHERE archivo_id = ?)',
  ).run(archivoId)
  db.prepare('DELETE FROM movimientos WHERE archivo_id = ?').run(archivoId)
}

export function listMovimientosArchivo(db: Db, archivoId: string): MovimientoRow[] {
  return all<MovimientoRow>(
    db,
    'SELECT * FROM movimientos WHERE archivo_id = ? ORDER BY orden ASC, id ASC',
    archivoId,
  )
}

export function deleteArchivo(db: Db, id: string): void {
  db.prepare('DELETE FROM archivos WHERE id = ?').run(id)
}

export function hayMovimiento(db: Db, id: string): boolean {
  return get<{ id: string }>(db, 'SELECT id FROM movimientos WHERE id = ?', id) != null
}

export function insertMovimiento(
  db: Db,
  row: {
    id: string
    cuentaId: string
    archivoId: string
    orden: number
    fecha: string
    fechaValor: string | null
    importeCentimos: number
    saldoCentimos: number | null
    concepto: string
    documento: string
    destino: Destino
    categoriaFinca: string | null
    propiedadId: string | null
    categoriaPersonal: string | null
    nota: string
    reglaId: string | null
    clasificadoEn: string | null
    ordinalClave: number
  },
): void {
  db.prepare(
    `INSERT INTO movimientos (
      id, cuenta_id, archivo_id, orden, fecha, fecha_valor, importe_centimos, saldo_centimos, concepto, documento,
      destino, categoria_finca, propiedad_id, categoria_personal, nota, regla_id, clasificado_en, ordinal_clave
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    row.id,
    row.cuentaId,
    row.archivoId,
    row.orden,
    row.fecha,
    row.fechaValor,
    row.importeCentimos,
    row.saldoCentimos,
    row.concepto,
    row.documento,
    row.destino,
    row.categoriaFinca,
    row.propiedadId,
    row.categoriaPersonal,
    row.nota,
    row.reglaId,
    row.clasificadoEn,
    row.ordinalClave,
  )
}

export function getMovimiento(db: Db, id: string): MovimientoRow | undefined {
  return get<MovimientoRow>(
    db,
    `SELECT m.*, c.nombre AS cuenta_nombre FROM movimientos m JOIN cuentas c ON c.id = m.cuenta_id WHERE m.id = ?`,
    id,
  )
}

export function listMovimientos(
  db: Db,
  filtro: { destino?: string | null; destinos?: string[] | null; cuentaId?: string | null; limit: number },
): MovimientoRow[] {
  const cuenta = filtro.cuentaId ?? null
  if (filtro.destinos && filtro.destinos.length > 0) {
    const marks = filtro.destinos.map(() => '?').join(', ')
    return all<MovimientoRow>(
      db,
      `SELECT m.*, c.nombre AS cuenta_nombre
       FROM movimientos m JOIN cuentas c ON c.id = m.cuenta_id
       WHERE m.destino IN (${marks}) AND (? IS NULL OR m.cuenta_id = ?)
       ORDER BY m.fecha DESC, m.orden DESC
       LIMIT ?`,
      ...filtro.destinos,
      cuenta,
      cuenta,
      filtro.limit,
    )
  }
  return all<MovimientoRow>(
    db,
    `SELECT m.*, c.nombre AS cuenta_nombre
     FROM movimientos m JOIN cuentas c ON c.id = m.cuenta_id
     WHERE (? IS NULL OR m.destino = ?) AND (? IS NULL OR m.cuenta_id = ?)
     ORDER BY m.fecha DESC, m.orden DESC
     LIMIT ?`,
    filtro.destino ?? null,
    filtro.destino ?? null,
    cuenta,
    cuenta,
    filtro.limit,
  )
}

export function listMovimientosInforme(db: Db): MovimientoRow[] {
  return all<MovimientoRow>(db, 'SELECT * FROM movimientos')
}

export function listMovimientosFinca(db: Db): Array<MovimientoRow & { propiedad_nombre: string | null }> {
  return all<MovimientoRow & { propiedad_nombre: string | null }>(
    db,
    `SELECT m.*, p.nombre AS propiedad_nombre
     FROM movimientos m LEFT JOIN propiedades p ON p.id = m.propiedad_id
     WHERE m.destino = 'finca'`,
  )
}

export function updateClasificacion(
  db: Db,
  row: {
    id: string
    destino: Destino
    categoriaFinca: string | null
    propiedadId: string | null
    categoriaPersonal: string | null
    nota: string
    reglaId: string | null
    clasificadoEn: string | null
    exportadoFincaEn: string | null
  },
): void {
  db.prepare(
    `UPDATE movimientos SET destino = ?, categoria_finca = ?, propiedad_id = ?, categoria_personal = ?,
      nota = ?, regla_id = ?, clasificado_en = ?, exportado_finca_en = ? WHERE id = ?`,
  ).run(
    row.destino,
    row.categoriaFinca,
    row.propiedadId,
    row.categoriaPersonal,
    row.nota,
    row.reglaId,
    row.clasificadoEn,
    row.exportadoFincaEn,
    row.id,
  )
}

export function listCandidatosFinca(db: Db): MovimientoRow[] {
  return all<MovimientoRow>(
    db,
    `SELECT * FROM movimientos
     WHERE destino = 'finca'
        OR finca_tx_id IS NOT NULL
        OR id IN (SELECT movimiento_id FROM repartos WHERE finca_tx_id IS NOT NULL OR vigente = 0)`,
  )
}

export function listFincaDeArchivo(
  db: Db,
  archivoId: string,
): Array<{ movimientoId: string; repartoId: string | null; finca_tx_id: string; referencia: string }> {
  const movs = all<{ id: string; finca_tx_id: string }>(
    db,
    `SELECT id, finca_tx_id FROM movimientos WHERE archivo_id = ? AND finca_tx_id IS NOT NULL`,
    archivoId,
  )
  const partes = all<{ id: string; movimiento_id: string; finca_tx_id: string }>(
    db,
    `SELECT r.id, r.movimiento_id, r.finca_tx_id
     FROM repartos r JOIN movimientos m ON m.id = r.movimiento_id
     WHERE m.archivo_id = ? AND r.finca_tx_id IS NOT NULL`,
    archivoId,
  )
  return [
    ...movs.map((m) => ({
      movimientoId: m.id,
      repartoId: null,
      finca_tx_id: m.finca_tx_id,
      referencia: `extractos:${m.id}`,
    })),
    ...partes.map((p) => ({
      movimientoId: p.movimiento_id,
      repartoId: p.id,
      finca_tx_id: p.finca_tx_id,
      referencia: `extractos:${p.movimiento_id}:${p.id}`,
    })),
  ]
}

export function marcarFincaOk(db: Db, id: string, txId: string, firma: string, cuando: string): void {
  db.prepare(
    `UPDATE movimientos SET finca_tx_id = ?, finca_sincronizado_en = ?, finca_error = NULL, finca_firma = ? WHERE id = ?`,
  ).run(txId, cuando, firma, id)
}

export function marcarFincaError(db: Db, id: string, error: string): void {
  db.prepare(`UPDATE movimientos SET finca_error = ? WHERE id = ?`).run(error, id)
}

export function limpiarFinca(db: Db, id: string): void {
  db.prepare(
    `UPDATE movimientos SET finca_tx_id = NULL, finca_sincronizado_en = NULL, finca_error = NULL, finca_firma = NULL WHERE id = ?`,
  ).run(id)
}

export function marcarContenedorOk(db: Db, id: string, cuando: string): void {
  db.prepare(
    `UPDATE movimientos SET finca_sincronizado_en = ?, finca_error = NULL, finca_firma = NULL WHERE id = ? AND finca_tx_id IS NULL`,
  ).run(cuando, id)
}

export function listRepartos(db: Db, movimientoId?: string | null): RepartoRow[] {
  if (movimientoId) return all<RepartoRow>(db, 'SELECT * FROM repartos WHERE movimiento_id = ? ORDER BY id', movimientoId)
  return all<RepartoRow>(db, 'SELECT * FROM repartos ORDER BY movimiento_id, id')
}

export function insertReparto(
  db: Db,
  row: { id: string; movimientoId: string; propiedadId: string; categoriaFinca: string; importeCentimos: number },
): void {
  db.prepare(
    `INSERT INTO repartos (id, movimiento_id, propiedad_id, categoria_finca, importe_centimos, vigente)
     VALUES (?, ?, ?, ?, ?, 1)`,
  ).run(row.id, row.movimientoId, row.propiedadId, row.categoriaFinca, row.importeCentimos)
}

export function obsoletarRepartos(db: Db, movimientoId: string): void {
  db.prepare('UPDATE repartos SET vigente = 0 WHERE movimiento_id = ? AND vigente = 1').run(movimientoId)
}

export function deleteReparto(db: Db, id: string): void {
  db.prepare('DELETE FROM repartos WHERE id = ?').run(id)
}

export function deleteRepartosMovimiento(db: Db, movimientoId: string): void {
  db.prepare('DELETE FROM repartos WHERE movimiento_id = ?').run(movimientoId)
}

export function moverRepartos(db: Db, desdeId: string, haciaId: string): void {
  db.prepare('UPDATE repartos SET movimiento_id = ? WHERE movimiento_id = ?').run(haciaId, desdeId)
}

export function marcarRepartoOk(db: Db, id: string, txId: string, firma: string, cuando: string): void {
  db.prepare(
    `UPDATE repartos SET finca_tx_id = ?, finca_sincronizado_en = ?, finca_error = NULL, finca_firma = ? WHERE id = ?`,
  ).run(txId, cuando, firma, id)
}

export function marcarRepartoError(db: Db, id: string, error: string): void {
  db.prepare('UPDATE repartos SET finca_error = ? WHERE id = ?').run(error, id)
}

export function limpiarReparto(db: Db, id: string): void {
  db.prepare(
    `UPDATE repartos SET finca_tx_id = NULL, finca_sincronizado_en = NULL, finca_error = NULL, finca_firma = NULL WHERE id = ?`,
  ).run(id)
}

export function estadoFinca(db: Db): {
  escritos: number
  pendientes: number
  errores: { id: string; concepto: string; fecha: string; error: string }[]
} {
  const escritos = get<{ c: number }>(
    db,
    `SELECT COUNT(*) AS c FROM movimientos WHERE destino = 'finca' AND finca_sincronizado_en IS NOT NULL AND finca_error IS NULL`,
  )
  const pendientes = get<{ c: number }>(
    db,
    `SELECT COUNT(*) AS c FROM movimientos WHERE destino = 'finca' AND finca_sincronizado_en IS NULL AND finca_error IS NULL`,
  )
  const errores = all<{ id: string; concepto: string; fecha: string; finca_error: string }>(
    db,
    `SELECT id, concepto, fecha, finca_error FROM movimientos WHERE finca_error IS NOT NULL ORDER BY fecha DESC`,
  )
  return {
    escritos: Number(escritos?.c ?? 0),
    pendientes: Number(pendientes?.c ?? 0),
    errores: errores.map((e) => ({ id: e.id, concepto: e.concepto, fecha: e.fecha, error: e.finca_error })),
  }
}

export function marcarExportados(db: Db, ids: string[], cuando: string): number {
  const stmt = db.prepare(
    `UPDATE movimientos SET exportado_finca_en = ? WHERE id = ? AND destino = 'finca' AND exportado_finca_en IS NULL`,
  )
  let n = 0
  db.exec('BEGIN')
  try {
    for (const id of ids) {
      const info = stmt.run(cuando, id)
      n += Number(info.changes ?? 0)
    }
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  return n
}

export function listReglas(db: Db): ReglaRow[] {
  return all<ReglaRow>(db, 'SELECT * FROM reglas ORDER BY creado_en DESC')
}

export function upsertRegla(db: Db, row: ReglaRow): string {
  const previa = get<ReglaRow>(db, 'SELECT * FROM reglas WHERE patron = ?', row.patron)
  if (previa) {
    db.prepare(
      `UPDATE reglas SET destino = ?, categoria_finca = ?, propiedad_id = ?, categoria_personal = ? WHERE id = ?`,
    ).run(row.destino, row.categoria_finca, row.propiedad_id, row.categoria_personal, previa.id)
    return previa.id
  }
  db.prepare(
    `INSERT INTO reglas (id, patron, destino, categoria_finca, propiedad_id, categoria_personal, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(row.id, row.patron, row.destino, row.categoria_finca, row.propiedad_id, row.categoria_personal, row.creado_en)
  return row.id
}

export function deleteRegla(db: Db, id: string): void {
  db.prepare('DELETE FROM reglas WHERE id = ?').run(id)
}

export function recuento(db: Db): { pendiente: number; clasificado: number } {
  const rows = all<{ destino: string; c: number }>(db, 'SELECT destino, COUNT(*) AS c FROM movimientos GROUP BY destino')
  let pendiente = 0
  let clasificado = 0
  for (const row of rows) {
    if (row.destino === 'pendiente' || row.destino === 'duda') pendiente += row.c
    else clasificado += row.c
  }
  return { pendiente, clasificado }
}

export function destinoDe(row: { destino: string }): Destino {
  return esDestino(row.destino) ? row.destino : 'pendiente'
}

export function tipoDe(row: { tipo: string }): TipoCuenta {
  return esTipoCuenta(row.tipo) ? row.tipo : 'otro'
}

/** Copia consistente del libro abierto, también si vive en memoria. */
export function copiarLibro(db: Db): Buffer {
  const path = join(tmpdir(), `extractos-copia-${randomUUID()}.sqlite`)
  const sqlPath = path.replaceAll("'", "''")
  try {
    db.exec(`VACUUM INTO '${sqlPath}'`)
    return readFileSync(path)
  } finally {
    try {
      unlinkSync(path)
    } catch {
      // La copia ya se leyó, o no llegó a crearse.
    }
  }
}
