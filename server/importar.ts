import { mkdirSync, readdirSync, readFileSync, unlinkSync, writeFileSync, existsSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import type { ImportacionJson } from '../shared/api'
import { elegirCuenta, type CuentaPista } from '../shared/asignar'
import { errorClasificacion, reglaGanadora, type Regla } from '../shared/clasificar'
import { textoEur, textoFecha } from '../shared/formato'
import { cuadreCentimos } from '../shared/patrimonio'
import { parseExtracto } from '../shared/parse'
import type { BloqueParseado, ResultadoParseo } from '../shared/extracto'
import { EXTENSIONES_EXTRACTO } from '../shared/formatos'
import { normalizar } from '../shared/money'
import { hayHueco, saldoIdentificaLinea, ultimoApunte, type ApunteVisto } from '../shared/visto'
import {
  borrarFichero,
  contarArchivosHash,
  deleteArchivo,
  deleteMovimientosArchivo,
  deleteRepartosMovimiento,
  destinoDe,
  getArchivo,
  getCuenta,
  getPropiedad,
  guardarFichero,
  hayHash,
  hayMovimientoPorSaldo,
  leerFichero,
  listApuntesCuenta,
  listArchivos,
  listArchivosHash,
  listMovimientosArchivo,
  maxFechaCuenta,
  moverRepartos,
  olvidarLecturaFallida,
  hayMovimiento,
  insertArchivo,
  insertMovimiento,
  listCuentas,
  listReglas,
  updateArchivoCuenta,
  updateCuenta,
  type ArchivoRow,
  type Db,
} from './db'
import { decodeTextoBanco, textoPdf } from './decode'
import { parseHoja } from './hoja'
import { HttpError } from './http'
import { idMovimiento, identificarBloques, sha256 } from './ids'

export type Rutas = {
  root: string
  inbox: string
  exportDir: string
}

const EXT_OK = new Set<string>(EXTENSIONES_EXTRACTO)
const EXT_HOJA = new Set(['xls', 'xlsx', 'xlsm', 'xlsb', 'ods', 'numbers'])
const MAX_BYTES = 20_000_000

export function asegurarCarpetas(rutas: Rutas): void {
  mkdirSync(rutas.inbox, { recursive: true })
  mkdirSync(rutas.exportDir, { recursive: true })
  mkdirSync(join(rutas.root, 'data'), { recursive: true })
}

function extension(nombre: string): string {
  const i = nombre.lastIndexOf('.')
  return i >= 0 ? nombre.slice(i + 1).toLowerCase() : ''
}

export function nombreSeguro(raw: string): string {
  const base = raw.split(/[/\\]/).pop() || 'extracto'
  const limpio = base.replace(/[^\w.\- ()áéíóúñüÁÉÍÓÚÑÜ]+/g, '_').slice(0, 120)
  return limpio || 'extracto'
}

function dentro(dir: string, file: string): boolean {
  const root = resolve(dir)
  const full = resolve(file)
  return full === root || full.startsWith(root + sep)
}

export function reglasDelLibro(db: Db): Regla[] {
  return listReglas(db).map((r) => ({
    id: r.id,
    patron: r.patron,
    destino: destinoDe(r),
    categoriaFinca: r.categoria_finca,
    propiedadId: r.propiedad_id,
    categoriaPersonal: r.categoria_personal,
    creadoEn: r.creado_en,
  }))
}

function cuentasPista(db: Db): CuentaPista[] {
  return listCuentas(db).map((c) => ({
    id: c.id,
    alias: c.alias,
    iban: c.iban,
    ccc: c.ccc,
    nombre: c.nombre,
  }))
}

function aplicarRegla(
  db: Db,
  reglas: Regla[],
  concepto: string,
  importeCentimos: number,
): { destino: Regla['destino']; categoriaFinca: string | null; propiedadId: string | null; categoriaPersonal: string | null; reglaId: string | null } {
  const regla = reglaGanadora(concepto, reglas)
  if (!regla) {
    return { destino: 'pendiente', categoriaFinca: null, propiedadId: null, categoriaPersonal: null, reglaId: null }
  }
  const error = errorClasificacion({ ...regla, importeCentimos })
  if (error) {
    return { destino: 'pendiente', categoriaFinca: null, propiedadId: null, categoriaPersonal: null, reglaId: null }
  }
  if (regla.destino === 'finca' && regla.propiedadId && !getPropiedad(db, regla.propiedadId)) {
    return { destino: 'pendiente', categoriaFinca: null, propiedadId: null, categoriaPersonal: null, reglaId: null }
  }
  return {
    destino: regla.destino,
    categoriaFinca: regla.destino === 'finca' ? (regla.categoriaFinca ?? null) : null,
    propiedadId: regla.destino === 'finca' ? (regla.propiedadId ?? null) : null,
    categoriaPersonal: regla.destino === 'personal' ? (regla.categoriaPersonal ?? null) : null,
    reglaId: regla.id,
  }
}

export type SugerenciaMovimiento = {
  destino: Regla['destino']
  categoriaFinca: string | null
  propiedadId: string | null
  propiedadNombre: string | null
  categoriaPersonal: string | null
  patron: string
}

/** La regla que ganaría ahora. El import no la aplica: solo se enseña. */
export function sugerirMovimiento(
  db: Db,
  reglas: Regla[],
  concepto: string,
  importeCentimos: number,
): SugerenciaMovimiento | null {
  const clas = aplicarRegla(db, reglas, concepto, importeCentimos)
  if (clas.destino === 'pendiente' || !clas.reglaId) return null
  const regla = reglas.find((r) => r.id === clas.reglaId)
  return {
    destino: clas.destino,
    categoriaFinca: clas.categoriaFinca,
    propiedadId: clas.propiedadId,
    propiedadNombre: clas.propiedadId ? (getPropiedad(db, clas.propiedadId)?.nombre ?? null) : null,
    categoriaPersonal: clas.categoriaPersonal,
    patron: regla?.patron ?? '',
  }
}

export function coincidenciasRegla(
  db: Db,
  candidata: {
    patron: string
    destino: Regla['destino']
    categoriaFinca: string | null
    propiedadId: string | null
    categoriaPersonal: string | null
  },
): Array<{ id: string; fecha: string; concepto: string; importeCentimos: number; cuentaNombre: string }> {
  const patron = normalizar(candidata.patron)
  const nueva: Regla = {
    id: 'nueva',
    patron,
    destino: candidata.destino,
    categoriaFinca: candidata.categoriaFinca,
    propiedadId: candidata.propiedadId,
    categoriaPersonal: candidata.categoriaPersonal,
    creadoEn: new Date().toISOString(),
  }
  const reglas = reglasDelLibro(db).filter((r) => normalizar(r.patron) !== patron)
  reglas.push(nueva)
  const rows = db
    .prepare(
      `SELECT m.id, m.fecha, m.concepto, m.importe_centimos, c.nombre AS cuenta_nombre
       FROM movimientos m JOIN cuentas c ON c.id = m.cuenta_id
       WHERE m.destino = 'pendiente'`,
    )
    .all() as Array<{ id: string; fecha: string; concepto: string; importe_centimos: number; cuenta_nombre: string }>
  const coincidencias = []
  for (const mov of rows) {
    const clas = aplicarRegla(db, reglas, mov.concepto, mov.importe_centimos)
    if (clas.reglaId !== 'nueva') continue
    coincidencias.push({
      id: mov.id,
      fecha: mov.fecha,
      concepto: mov.concepto,
      importeCentimos: mov.importe_centimos,
      cuentaNombre: mov.cuenta_nombre,
    })
  }
  return coincidencias
}

function apunteDeCuenta(db: Db, cuentaId: string): ApunteVisto | null {
  return ultimoApunte(
    listApuntesCuenta(db, cuentaId).map((row) => ({
      fecha: row.fecha,
      concepto: row.concepto,
      importeCentimos: row.importe_centimos,
      orden: row.orden,
    })),
  )
}

function textoHueco(db: Db, cuentaId: string, desde: string | null | undefined): string {
  const hasta = maxFechaCuenta(db, cuentaId)
  if (!hayHueco(hasta, desde)) return ''
  return `El libro de esta cuenta llega al ${textoFecha(hasta)} y este extracto empieza el ${textoFecha(desde)}.`
}

function corto(texto: string): string {
  const limpio = texto.replace(/\s+/g, ' ').trim()
  return limpio.length > 60 ? `${limpio.slice(0, 57)}…` : limpio
}

function notaSinCuenta(nombre: string, leidos: number): string {
  return `${nombre}: ${leidos} apuntes leídos, sin cuenta. Crea la cuenta con el IBAN del extracto y se enganchan solos.`
}

function notaVolcado(
  nombre: string,
  cuenta: string,
  nuevos: number,
  duplicados: number,
  antes: ApunteVisto | null,
  hueco: string,
): string {
  const ya = antes
    ? ` El libro ya llegaba al ${textoFecha(antes.fecha)} (${corto(antes.concepto)} · ${textoEur(antes.importeCentimos)}).`
    : ''
  const aviso = hueco ? ` ${hueco}` : ''
  const nuevoTxt = nuevos === 1 ? '1 nuevo' : `${nuevos} nuevos`
  const yaTxt = duplicados === 1 ? '1 que ya estaba' : `${duplicados} que ya estaban`
  return `${nombre} · ${cuenta}: ${nuevoTxt} y ${yaTxt}.${ya}${aviso}`
}

function soltarBytesSiYaNoHacenFalta(db: Db, hash: string): void {
  const quedaSuelto = listArchivosHash(db, hash).some((row) => !row.error && !row.cuenta_id)
  if (!quedaSuelto) borrarFichero(db, hash)
}

function insertarMovimientos(
  db: Db,
  cuentaId: string,
  archivoId: string,
  bloque: BloqueParseado,
): { insertados: number; duplicados: number } {
  const porSaldo = saldoIdentificaLinea(bloque.movimientos)
  const vistos = new Map<string, number>()
  let insertados = 0
  let duplicados = 0
  for (const mov of bloque.movimientos) {
    const doc = (mov.documento ?? '').replace(/\D/g, '').replace(/^0+$/, '')
    const clave = `${mov.fecha}|${mov.importeCentimos}|${normalizar(mov.concepto)}`
    const ordinal = doc ? 0 : (vistos.get(clave) ?? 0)
    if (!doc) vistos.set(clave, ordinal + 1)
    if (
      porSaldo &&
      mov.saldoCentimos != null &&
      hayMovimientoPorSaldo(db, cuentaId, mov.fecha, mov.importeCentimos, mov.saldoCentimos)
    ) {
      duplicados += 1
      continue
    }
    const id = idMovimiento(cuentaId, {
      fecha: mov.fecha,
      importeCentimos: mov.importeCentimos,
      concepto: mov.concepto,
      documento: mov.documento,
      ordinal,
    })
    if (hayMovimiento(db, id)) {
      duplicados += 1
      continue
    }
    insertMovimiento(db, {
      id,
      cuentaId,
      archivoId,
      orden: mov.orden,
      fecha: mov.fecha,
      fechaValor: mov.fechaValor ?? null,
      importeCentimos: mov.importeCentimos,
      saldoCentimos: mov.saldoCentimos ?? null,
      concepto: mov.concepto,
      documento: mov.documento ?? '',
      destino: 'pendiente',
      categoriaFinca: null,
      propiedadId: null,
      categoriaPersonal: null,
      nota: '',
      reglaId: null,
      clasificadoEn: null,
      ordinalClave: ordinal,
    })
    insertados += 1
  }
  return { insertados, duplicados }
}

function aprenderCuenta(db: Db, cuentaId: string, bloque: BloqueParseado): void {
  const cuenta = getCuenta(db, cuentaId)
  if (!cuenta) return
  const ccc = bloque.ccc ?? ''
  const iban = bloque.iban ?? ''
  if ((!cuenta.ccc && ccc) || (!cuenta.iban && iban)) {
    updateCuenta(db, {
      ...cuenta,
      ccc: cuenta.ccc || ccc,
      iban: cuenta.iban || iban,
    })
  }
}

function filaArchivo(input: {
  id: string
  nombre: string
  hash: string
  formato: string
  cuentaId: string | null
  bloque?: BloqueParseado
  leidos: number
  movimientos: number
  duplicados: number
  avisos: string
  error: string | null
  ahora: string
}): ArchivoRow {
  const b = input.bloque
  return {
    id: input.id,
    nombre: input.nombre,
    contenido_hash: input.hash,
    formato: input.formato,
    cuenta_id: input.cuentaId,
    ccc: b?.ccc ?? '',
    iban: b?.iban ?? '',
    desde: b?.desde ?? null,
    hasta: b?.hasta ?? null,
    saldo_inicial_centimos: b?.saldoInicialCentimos ?? null,
    saldo_final_centimos: b?.saldoFinalCentimos ?? null,
    cuadre_centimos: b
      ? cuadreCentimos(
          b.saldoInicialCentimos ?? null,
          b.saldoFinalCentimos ?? null,
          b.movimientos.map((m) => m.importeCentimos),
        )
      : null,
    leidos: input.leidos,
    movimientos: input.movimientos,
    duplicados: input.duplicados,
    avisos: input.avisos,
    error: input.error,
    importado_en: input.ahora,
  }
}

async function parseBuf(nombre: string, buf: Buffer, path: string | null): Promise<ResultadoParseo> {
  const ext = extension(nombre)
  if (EXT_HOJA.has(ext)) return parseHoja(buf)
  if (ext === 'pdf') {
    if (path) return parseExtracto(await textoPdf(path, buf))
    const tmp = join(tmpdir(), `extractos-${sha256(buf).slice(0, 12)}.pdf`)
    writeFileSync(tmp, buf)
    try {
      return parseExtracto(await textoPdf(tmp, buf))
    } finally {
      try {
        unlinkSync(tmp)
      } catch {
        // El temporal ya no está. El texto, si salió, sigue valiendo.
      }
    }
  }
  return parseExtracto(decodeTextoBanco(buf))
}

function volcarBloque(
  db: Db,
  cuentaId: string,
  archivoId: string,
  bloque: BloqueParseado,
  avisosPrevios: string,
): { insertados: number; duplicados: number; hueco: string; antes: ApunteVisto | null } {
  const antes = apunteDeCuenta(db, cuentaId)
  const hueco = textoHueco(db, cuentaId, bloque.desde)
  const avisos = [avisosPrevios, hueco].filter(Boolean).join('\n')
  const volcado = insertarMovimientos(db, cuentaId, archivoId, bloque)
  updateArchivoCuenta(db, archivoId, {
    cuentaId,
    movimientos: volcado.insertados,
    duplicados: volcado.duplicados,
    avisos,
  })
  aprenderCuenta(db, cuentaId, bloque)
  return { ...volcado, hueco, antes }
}

async function reengancharSueltos(
  db: Db,
  nombre: string,
  hash: string,
  buf: Buffer,
  sueltos: ArchivoRow[],
): Promise<Pick<ImportacionJson, 'movimientos' | 'duplicados' | 'sinCuenta' | 'notas' | 'errores'>> {
  const parcial = { movimientos: 0, duplicados: 0, sinCuenta: 0, notas: [] as string[], errores: [] as { nombre: string; error: string }[] }
  let parsed: ResultadoParseo
  try {
    parsed = await parseBuf(nombre, buf, null)
  } catch (err) {
    const error = err instanceof Error ? err.message : 'No he podido leer el fichero'
    parcial.errores.push({ nombre, error })
    return parcial
  }
  if (!parsed.ok) {
    parcial.errores.push({ nombre, error: parsed.error })
    return parcial
  }
  const cuentas = cuentasPista(db)
  const bloques = identificarBloques(hash, parsed.bloques)
  db.exec('BEGIN')
  try {
    guardarFichero(db, hash, nombre, buf)
    for (const archivo of sueltos) {
      const bloque = bloques.find((item) => item.id === archivo.id)
      if (!bloque) continue
      const eleccion = elegirCuenta(bloque, archivo.nombre, cuentas)
      const cuentaId = eleccion && 'id' in eleccion ? eleccion.id : null
      if (!cuentaId) {
        parcial.sinCuenta += 1
        parcial.notas.push(notaSinCuenta(archivo.nombre, bloque.movimientos.length))
        continue
      }
      const volcado = volcarBloque(db, cuentaId, archivo.id, bloque, archivo.avisos)
      parcial.movimientos += volcado.insertados
      parcial.duplicados += volcado.duplicados
      parcial.notas.push(
        notaVolcado(
          archivo.nombre,
          getCuenta(db, cuentaId)?.nombre ?? 'Cuenta',
          volcado.insertados,
          volcado.duplicados,
          volcado.antes,
          volcado.hueco,
        ),
      )
    }
    soltarBytesSiYaNoHacenFalta(db, hash)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    parcial.errores.push({ nombre, error: err instanceof Error ? err.message : 'No he podido guardar el extracto' })
    parcial.notas = []
    parcial.movimientos = 0
    parcial.duplicados = 0
    parcial.sinCuenta = 0
  }
  return parcial
}

export async function importarInbox(db: Db, rutas: Rutas): Promise<ImportacionJson> {
  asegurarCarpetas(rutas)
  const resultado: ImportacionJson = {
    vistos: 0,
    nuevos: 0,
    movimientos: 0,
    duplicados: 0,
    sinCuenta: 0,
    yaEstaban: 0,
    notas: [],
    errores: [],
  }
  const nombres = readdirSync(rutas.inbox).filter((n) => !n.startsWith('.'))
  for (const nombre of nombres) {
    const path = join(rutas.inbox, nombre)
    let st: ReturnType<typeof statSync>
    try {
      st = statSync(path)
    } catch {
      continue
    }
    if (!st.isFile()) continue
    const ext = extension(nombre)
    if (!EXT_OK.has(ext)) continue
    resultado.vistos += 1
    if (st.size > MAX_BYTES) {
      resultado.errores.push({ nombre, error: 'Pasa de 20 MB' })
      continue
    }
    const buf = readFileSync(path)
    const hash = sha256(buf)
    if (hayHash(db, hash) && !olvidarLecturaFallida(db, hash)) {
      const sueltos = listArchivosHash(db, hash).filter((row) => !row.error && !row.cuenta_id && Number(row.movimientos) === 0)
      if (sueltos.length === 0) {
        borrarFichero(db, hash)
        resultado.yaEstaban += 1
        resultado.notas.push(`${nombre}: este fichero ya estaba en el libro.`)
        continue
      }
      const reenganche = await reengancharSueltos(db, nombre, hash, buf, sueltos)
      resultado.movimientos += reenganche.movimientos
      resultado.duplicados += reenganche.duplicados
      resultado.sinCuenta += reenganche.sinCuenta
      resultado.notas.push(...reenganche.notas)
      resultado.errores.push(...reenganche.errores)
      continue
    }
    const ahora = new Date().toISOString()
    if (buf.length === 0) {
      resultado.errores.push({ nombre, error: 'El fichero está vacío' })
      continue
    }

    let parsed: ResultadoParseo
    try {
      parsed = await parseBuf(nombre, buf, path)
    } catch (err) {
      const error = err instanceof Error ? err.message : 'No he podido leer el fichero'
      insertArchivo(
        db,
        filaArchivo({
          id: sha256(`${hash}|error`).slice(0, 32),
          nombre,
          hash,
          formato: ext === 'pdf' ? 'pdf' : EXT_HOJA.has(ext) ? 'excel' : 'desconocido',
          cuentaId: null,
          leidos: 0,
          movimientos: 0,
          duplicados: 0,
          avisos: '',
          error,
          ahora,
        }),
      )
      resultado.nuevos += 1
      resultado.errores.push({ nombre, error })
      continue
    }
    if (!parsed.ok) {
      insertArchivo(
        db,
        filaArchivo({
          id: sha256(`${hash}|error`).slice(0, 32),
          nombre,
          hash,
          formato: parsed.formato,
          cuentaId: null,
          leidos: 0,
          movimientos: 0,
          duplicados: 0,
          avisos: '',
          error: parsed.error,
          ahora,
        }),
      )
      resultado.nuevos += 1
      resultado.errores.push({ nombre, error: parsed.error })
      continue
    }

    const cuentas = cuentasPista(db)
    const bloques = identificarBloques(hash, parsed.bloques)
    db.exec('BEGIN')
    try {
      let suelto = false
      for (const bloque of bloques) {
        const eleccion = elegirCuenta(bloque, nombre, cuentas)
        const cuentaId = eleccion && 'id' in eleccion ? eleccion.id : null
        const avisoExtra = eleccion && 'ambiguo' in eleccion ? eleccion.ambiguo : ''
        const avisosPrevios = [...parsed.avisos, avisoExtra].filter(Boolean).join('\n')
        insertArchivo(
          db,
          filaArchivo({
            id: bloque.id,
            nombre,
            hash,
            formato: parsed.formato,
            cuentaId,
            bloque,
            leidos: bloque.movimientos.length,
            movimientos: 0,
            duplicados: 0,
            avisos: avisosPrevios,
            error: null,
            ahora,
          }),
        )
        if (!cuentaId) {
          suelto = true
          resultado.sinCuenta += 1
          resultado.notas.push(notaSinCuenta(nombre, bloque.movimientos.length))
          continue
        }
        const volcado = volcarBloque(db, cuentaId, bloque.id, bloque, avisosPrevios)
        resultado.movimientos += volcado.insertados
        resultado.duplicados += volcado.duplicados
        resultado.notas.push(
          notaVolcado(
            nombre,
            getCuenta(db, cuentaId)?.nombre ?? 'Cuenta',
            volcado.insertados,
            volcado.duplicados,
            volcado.antes,
            volcado.hueco,
          ),
        )
      }
      if (suelto) guardarFichero(db, hash, nombre, buf)
      else borrarFichero(db, hash)
      db.exec('COMMIT')
      resultado.nuevos += 1
    } catch (err) {
      db.exec('ROLLBACK')
      const error = err instanceof Error ? err.message : 'No he podido guardar el extracto'
      resultado.errores.push({ nombre, error })
    }
  }
  return resultado
}

function bufDelExtracto(db: Db, rutas: Rutas, nombre: string, hash: string): { buf: Buffer; path: string | null } {
  const guardado = leerFichero(db, hash)
  if (guardado) return { buf: guardado, path: null }
  try {
    return leerPorHash(rutas, nombre, hash)
  } catch {
    throw new HttpError(
      400,
      'Este extracto se leyó, pero el fichero no quedó guardado. Vuelve a elegirlo. Lo que ya esté en el libro no se duplica.',
    )
  }
}

function leerPorHash(rutas: Rutas, nombre: string, hash: string): { buf: Buffer; path: string } {
  const directo = join(rutas.inbox, nombre)
  if (existsSync(directo)) {
    const buf = readFileSync(directo)
    if (sha256(buf) === hash) return { buf, path: directo }
  }
  for (const entry of readdirSync(rutas.inbox)) {
    const path = join(rutas.inbox, entry)
    if (!statSync(path).isFile()) continue
    const buf = readFileSync(path)
    if (sha256(buf) === hash) return { buf, path }
  }
  throw new HttpError(400, 'Ya no está el fichero en la carpeta inbox')
}

export async function asignarArchivo(db: Db, rutas: Rutas, archivoId: string, cuentaId: string): Promise<void> {
  const archivo = getArchivo(db, archivoId)
  if (!archivo) throw new HttpError(404, 'No encuentro ese extracto')
  if (archivo.cuenta_id) throw new HttpError(400, 'Este extracto ya tiene cuenta')
  if (archivo.error) throw new HttpError(400, 'No pude leer el fichero. Bórralo de la lista y vuelve a dejarlo en inbox.')
  if (!getCuenta(db, cuentaId)) throw new HttpError(400, 'No encuentro esa cuenta')

  const encontrado = bufDelExtracto(db, rutas, archivo.nombre, archivo.contenido_hash)
  const parsed = await parseBuf(archivo.nombre, encontrado.buf, encontrado.path)
  if (!parsed.ok) throw new HttpError(400, parsed.error)
  const bloque = identificarBloques(archivo.contenido_hash, parsed.bloques).find((b) => b.id === archivoId)
  if (!bloque) throw new HttpError(400, 'No encuentro ese bloque en el fichero')

  db.exec('BEGIN')
  try {
    volcarBloque(db, cuentaId, archivoId, bloque, archivo.avisos)
    soltarBytesSiYaNoHacenFalta(db, archivo.contenido_hash)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export async function engancharPendientes(
  db: Db,
  cuentaId?: string,
): Promise<{ movimientos: number; duplicados: number }> {
  const cuentas = cuentasPista(db).filter((cuenta) => !cuentaId || cuenta.id === cuentaId)
  const sueltos = listArchivos(db).filter((archivo) => !archivo.cuenta_id && !archivo.error)
  let movimientos = 0
  let duplicados = 0
  for (const archivo of sueltos) {
    const buf = leerFichero(db, archivo.contenido_hash)
    if (!buf) continue
    let parsed: ResultadoParseo
    try {
      parsed = await parseBuf(archivo.nombre, buf, null)
    } catch {
      continue
    }
    if (!parsed.ok) continue
    const bloque = identificarBloques(archivo.contenido_hash, parsed.bloques).find((item) => item.id === archivo.id)
    if (!bloque) continue
    const eleccion = elegirCuenta(bloque, archivo.nombre, cuentas)
    if (!eleccion || !('id' in eleccion)) continue
    db.exec('BEGIN')
    try {
      const volcado = volcarBloque(db, eleccion.id, archivo.id, bloque, archivo.avisos)
      soltarBytesSiYaNoHacenFalta(db, archivo.contenido_hash)
      db.exec('COMMIT')
      movimientos += volcado.insertados
      duplicados += volcado.duplicados
    } catch (err) {
      db.exec('ROLLBACK')
      throw err
    }
  }
  return { movimientos, duplicados }
}

export function borrarArchivo(db: Db, rutas: Rutas, archivoId: string): void {
  const archivo = getArchivo(db, archivoId)
  if (!archivo) throw new HttpError(404, 'No encuentro ese extracto')
  const hash = archivo.contenido_hash
  const nombre = archivo.nombre
  db.exec('BEGIN')
  try {
    deleteMovimientosArchivo(db, archivoId)
    deleteArchivo(db, archivoId)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
  if (contarArchivosHash(db, hash) > 0) return
  borrarFichero(db, hash)
  const directo = join(rutas.inbox, nombre)
  if (existsSync(directo)) {
    try {
      if (sha256(readFileSync(directo)) === hash) unlinkSync(directo)
    } catch {
      // El fichero puede haberse movido. El libro ya no lo tiene.
    }
  }
}

export function guardarSubida(rutas: Rutas, nombre: string, buf: Buffer): string {
  asegurarCarpetas(rutas)
  if (buf.length === 0) throw new HttpError(400, 'El fichero está vacío')
  if (buf.length > MAX_BYTES) throw new HttpError(413, 'El fichero pasa de 20 MB')
  const seguro = nombreSeguro(nombre)
  const punto = seguro.lastIndexOf('.')
  const base = punto > 0 ? seguro.slice(0, punto) : seguro
  const ext = punto > 0 ? seguro.slice(punto) : ''
  let candidato = join(rutas.inbox, seguro)
  if (!dentro(rutas.inbox, candidato)) throw new HttpError(400, 'Nombre de fichero no válido')
  for (let i = 2; existsSync(candidato) && i < 1000; i++) {
    candidato = join(rutas.inbox, `${base}-${i}${ext}`)
  }
  if (existsSync(candidato)) throw new HttpError(400, 'Demasiados ficheros con el mismo nombre')
  writeFileSync(candidato, buf)
  return candidato
}

function claveIban(valor: string): string {
  return valor.replace(/\s/g, '').toUpperCase()
}

/** Cambia la cuenta de un extracto ya cargado y rehace los ids. El IBAN solo se mueve si esa cuenta lo aprendió de este fichero. */
export function moverArchivo(db: Db, archivoId: string, cuentaId: string): void {
  const archivo = getArchivo(db, archivoId)
  if (!archivo) throw new HttpError(404, 'No encuentro ese extracto')
  if (!archivo.cuenta_id) throw new HttpError(400, 'Este extracto todavía no tiene cuenta')
  if (archivo.cuenta_id === cuentaId) return
  const destino = getCuenta(db, cuentaId)
  if (!destino) throw new HttpError(400, 'No encuentro esa cuenta')
  const origen = getCuenta(db, archivo.cuenta_id)
  const movs = listMovimientosArchivo(db, archivoId)
  db.exec('BEGIN')
  try {
    const vistos = new Map<string, number>()
    for (const mov of movs) {
      const doc = (mov.documento ?? '').replace(/\D/g, '').replace(/^0+$/, '')
      const clave = `${mov.fecha}|${mov.importe_centimos}|${normalizar(mov.concepto)}`
      let ordinal = mov.ordinal_clave
      if (ordinal == null) {
        ordinal = doc ? 0 : (vistos.get(clave) ?? 0)
        if (!doc) vistos.set(clave, ordinal + 1)
      }
      const nuevoId = idMovimiento(cuentaId, {
        fecha: mov.fecha,
        importeCentimos: mov.importe_centimos,
        concepto: mov.concepto,
        documento: mov.documento,
        ordinal,
      })
      if (nuevoId !== mov.id && hayMovimiento(db, nuevoId)) {
        deleteRepartosMovimiento(db, mov.id)
        db.prepare('DELETE FROM movimientos WHERE id = ?').run(mov.id)
        continue
      }
      if (nuevoId !== mov.id) moverRepartos(db, mov.id, nuevoId)
      db.prepare('UPDATE movimientos SET id = ?, cuenta_id = ?, ordinal_clave = ? WHERE id = ?').run(
        nuevoId,
        cuentaId,
        ordinal,
        mov.id,
      )
    }
    const quedan = db.prepare('SELECT COUNT(*) AS c FROM movimientos WHERE archivo_id = ?').get(archivoId) as { c: number }
    db.prepare('UPDATE archivos SET cuenta_id = ?, movimientos = ? WHERE id = ?').run(cuentaId, Number(quedan.c), archivoId)
    if (origen) {
      const otros = listArchivos(db).filter((a) => a.id !== archivoId && a.cuenta_id === origen.id)
      const ibanArchivo = claveIban(archivo.iban)
      const cccArchivo = archivo.ccc.replace(/\D/g, '')
      let iban = origen.iban
      let ccc = origen.ccc
      const otroIban = otros.some((a) => ibanArchivo && claveIban(a.iban) === ibanArchivo)
      const otroCcc = otros.some((a) => cccArchivo && a.ccc.replace(/\D/g, '') === cccArchivo)
      if (ibanArchivo && claveIban(origen.iban) === ibanArchivo && !otroIban) iban = ''
      if (cccArchivo && origen.ccc.replace(/\D/g, '') === cccArchivo && !otroCcc) ccc = ''
      if (iban !== origen.iban || ccc !== origen.ccc) updateCuenta(db, { ...origen, iban, ccc })
    }
    aprenderCuenta(db, cuentaId, { iban: archivo.iban, ccc: archivo.ccc } as BloqueParseado)
    db.exec('COMMIT')
  } catch (err) {
    db.exec('ROLLBACK')
    throw err
  }
}

export function aplicarReglasPendientes(db: Db): number {
  const reglas = reglasDelLibro(db)
  const pendientes = listPendientes(db)
  const ahora = new Date().toISOString()
  let n = 0
  for (const mov of pendientes) {
    const clas = aplicarRegla(db, reglas, mov.concepto, mov.importe_centimos)
    if (clas.destino === 'pendiente') continue
    db.prepare(
      `UPDATE movimientos SET destino = ?, categoria_finca = ?, propiedad_id = ?, categoria_personal = ?,
        regla_id = ?, clasificado_en = ? WHERE id = ? AND destino = 'pendiente'`,
    ).run(
      clas.destino,
      clas.categoriaFinca,
      clas.propiedadId,
      clas.categoriaPersonal,
      clas.reglaId,
      ahora,
      mov.id,
    )
    n += 1
  }
  return n
}

function listPendientes(db: Db): Array<{ id: string; concepto: string; importe_centimos: number }> {
  return db
    .prepare(`SELECT id, concepto, importe_centimos FROM movimientos WHERE destino = 'pendiente'`)
    .all() as Array<{ id: string; concepto: string; importe_centimos: number }>
}

