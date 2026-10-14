import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client } from 'pg'
import { filaFinca, firmaFila, propiedadLocal, type FilaFinca } from '../shared/finca'
import {
  deleteReparto,
  estadoFinca,
  getMovimiento,
  limpiarFinca,
  limpiarReparto,
  listCandidatosFinca,
  listFincaDeArchivo,
  listRepartos,
  marcarContenedorOk,
  marcarFincaError,
  marcarFincaOk,
  marcarRepartoError,
  marcarRepartoOk,
  type Db,
  type RepartoRow,
} from './db'
import { mensajeError, HttpError } from './http'
import { uuidEstable } from './ids'
import { fincaUrlsToTry, urlAplicacion } from './pgurl'

export type ResultadoEscritura = {
  ok: string[]
  fallos: { id: string; error: string }[]
}

export type OpsFinca = {
  upserts: FilaFinca[]
  borrados: { id: string; referencia: string }[]
}

export type EscritorFinca = {
  aplicar(ops: OpsFinca): Promise<ResultadoEscritura>
}

const UPSERT = `
INSERT INTO transacciones (
  id, propiedad_id, fecha, tipo, importe, categoria, descripcion, archivos, creado_en, referencia
) VALUES ($1::uuid, $2::uuid, $3::date, $4, $5::numeric, $6, $7, '{}'::text[], now(), $8)
ON CONFLICT (id) DO UPDATE SET
  propiedad_id = EXCLUDED.propiedad_id,
  fecha = EXCLUDED.fecha,
  tipo = EXCLUDED.tipo,
  importe = EXCLUDED.importe,
  categoria = EXCLUDED.categoria,
  descripcion = EXCLUDED.descripcion,
  referencia = EXCLUDED.referencia
WHERE transacciones.referencia = EXCLUDED.referencia
RETURNING id
`

let urlQueFunciono: string | null = null

async function conFinca<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const raw = urlAplicacion('FINCA_DATABASE_URL', join(homedir(), '.finca-db.env'))
  if (!raw) throw new Error('No está ~/.finca-db.env, así que el apunte se queda en este libro.')
  const todas = fincaUrlsToTry(raw)
  const urls = urlQueFunciono ? [urlQueFunciono, ...todas.filter((u) => u !== urlQueFunciono)] : todas
  let last = 'No se pudo conectar con Finca'
  for (const url of urls) {
    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    })
    try {
      await client.connect()
    } catch (err) {
      last = mensajeError(err)
      await client.end().catch(() => {})
      continue
    }
    try {
      const result = await fn(client)
      urlQueFunciono = url
      return result
    } finally {
      await client.end().catch(() => {})
    }
  }
  throw new Error(last)
}

export function escritorFincaReal(): EscritorFinca {
  return {
    async aplicar(ops) {
      if (ops.upserts.length === 0 && ops.borrados.length === 0) return { ok: [], fallos: [] }
      return conFinca(async (client) => {
        const ok: string[] = []
        const fallos: { id: string; error: string }[] = []
        for (const fila of ops.upserts) {
          try {
            const result = await client.query(UPSERT, [
              fila.id,
              fila.propiedadId,
              fila.fecha,
              fila.tipo,
              fila.importe,
              fila.categoria,
              fila.descripcion,
              fila.referencia,
            ])
            if (result.rows.length === 0) {
              fallos.push({
                id: fila.id,
                error: 'Ese apunte ya existe en Finca con otra referencia. No lo he tocado.',
              })
            } else ok.push(fila.id)
          } catch (err) {
            fallos.push({ id: fila.id, error: mensajeError(err) })
          }
        }
        for (const fila of ops.borrados) {
          try {
            await client.query(`DELETE FROM transacciones WHERE id = $1::uuid AND referencia = $2`, [
              fila.id,
              fila.referencia,
            ])
            ok.push(fila.id)
          } catch (err) {
            fallos.push({ id: fila.id, error: mensajeError(err) })
          }
        }
        return { ok, fallos }
      })
    },
  }
}

type PlanUpsert = { fila: FilaFinca; movimientoId: string; repartoId: string | null }
type PlanBorrado = {
  id: string
  referencia: string
  movimientoId: string
  repartoId: string | null
  quitarFila: boolean
}

function filaDeParte(row: { id: string; fecha: string; concepto: string }, parte: RepartoRow): FilaFinca {
  const clave = `${row.id}:${parte.id}`
  return filaFinca({
    id: uuidEstable(`extractos:${clave}`),
    movimientoId: clave,
    propiedadId: parte.propiedad_id,
    fecha: row.fecha,
    importeCentimos: parte.importe_centimos,
    categoria: parte.categoria_finca,
    concepto: row.concepto,
  })
}

function prepararParte(
  db: Db,
  row: { id: string; fecha: string; concepto: string },
  parte: RepartoRow,
  upserts: PlanUpsert[],
  firmaDe: Map<string, string>,
): void {
  if (propiedadLocal(parte.propiedad_id)) {
    const msg = 'Esta propiedad está solo en este libro. Trae las de Finca para escribir el apunte.'
    marcarRepartoError(db, parte.id, msg)
    marcarFincaError(db, row.id, msg)
    return
  }
  const fila = filaDeParte(row, parte)
  const firma = firmaFila(fila)
  if (parte.finca_tx_id && parte.finca_firma === firma && !parte.finca_error) return
  upserts.push({ fila, movimientoId: row.id, repartoId: parte.id })
  firmaDe.set(fila.id, firma)
}

export async function sincronizarFinca(
  db: Db,
  escritor: EscritorFinca | false | null | undefined,
): Promise<{ escritos: number; borrados: number; errores: number }> {
  if (!escritor) return { escritos: 0, borrados: 0, errores: estadoFinca(db).errores.length }
  const upserts: PlanUpsert[] = []
  const borrados: PlanBorrado[] = []
  const firmaDe = new Map<string, string>()
  const contenedores = new Set<string>()

  for (const row of listCandidatosFinca(db)) {
    const partes = listRepartos(db, row.id)
    const vivas = partes.filter((p) => Number(p.vigente) === 1)
    const muertas = partes.filter((p) => Number(p.vigente) !== 1)
    if (row.destino !== 'finca') {
      if (row.finca_tx_id) {
        borrados.push({
          id: row.finca_tx_id,
          referencia: `extractos:${row.id}`,
          movimientoId: row.id,
          repartoId: null,
          quitarFila: false,
        })
      }
      for (const parte of partes) {
        if (parte.finca_tx_id) {
          borrados.push({
            id: parte.finca_tx_id,
            referencia: `extractos:${row.id}:${parte.id}`,
            movimientoId: row.id,
            repartoId: parte.id,
            quitarFila: true,
          })
        } else deleteReparto(db, parte.id)
      }
      continue
    }
    for (const parte of muertas) {
      if (parte.finca_tx_id) {
        borrados.push({
          id: parte.finca_tx_id,
          referencia: `extractos:${row.id}:${parte.id}`,
          movimientoId: row.id,
          repartoId: parte.id,
          quitarFila: true,
        })
      } else deleteReparto(db, parte.id)
    }
    if (vivas.length > 0) {
      contenedores.add(row.id)
      if (row.finca_tx_id) {
        borrados.push({
          id: row.finca_tx_id,
          referencia: `extractos:${row.id}`,
          movimientoId: row.id,
          repartoId: null,
          quitarFila: false,
        })
      }
      for (const parte of vivas) prepararParte(db, row, parte, upserts, firmaDe)
      continue
    }
    if (!row.categoria_finca || !row.propiedad_id) {
      marcarFincaError(db, row.id, 'Falta la propiedad o la categoría.')
      continue
    }
    if (propiedadLocal(row.propiedad_id)) {
      marcarFincaError(db, row.id, 'Esta propiedad está solo en este libro. Trae las de Finca para escribir el apunte.')
      continue
    }
    const fila = filaFinca({
      id: uuidEstable(`extractos:${row.id}`),
      movimientoId: row.id,
      propiedadId: row.propiedad_id,
      fecha: row.fecha,
      importeCentimos: row.importe_centimos,
      categoria: row.categoria_finca,
      concepto: row.concepto,
    })
    const firma = firmaFila(fila)
    if (row.finca_tx_id && row.finca_firma === firma && !row.finca_error) continue
    upserts.push({ fila, movimientoId: row.id, repartoId: null })
    firmaDe.set(fila.id, firma)
  }

  const ahora = new Date().toISOString()
  if (upserts.length === 0 && borrados.length === 0) {
    for (const id of contenedores) cerrarContenedor(db, id, ahora)
    return { escritos: 0, borrados: 0, errores: estadoFinca(db).errores.length }
  }

  let resultado: ResultadoEscritura
  try {
    resultado = await escritor.aplicar({
      upserts: upserts.map((u) => u.fila),
      borrados: borrados.map(({ id, referencia }) => ({ id, referencia })),
    })
  } catch (err) {
    const msg = mensajeError(err)
    for (const item of upserts) {
      if (item.repartoId) marcarRepartoError(db, item.repartoId, msg)
      marcarFincaError(db, item.movimientoId, msg)
    }
    for (const b of borrados) {
      if (b.repartoId) marcarRepartoError(db, b.repartoId, msg)
      marcarFincaError(db, b.movimientoId, msg)
    }
    return { escritos: 0, borrados: 0, errores: estadoFinca(db).errores.length }
  }

  const fallos = new Map(resultado.fallos.map((f) => [f.id, f.error]))
  const confirmados = new Set(resultado.ok)
  let escritos = 0
  let borradosOk = 0
  for (const item of upserts) {
    const fallo = fallos.get(item.fila.id)
    if (fallo) {
      if (item.repartoId) marcarRepartoError(db, item.repartoId, fallo)
      marcarFincaError(db, item.movimientoId, fallo)
    } else if (confirmados.has(item.fila.id)) {
      const firma = firmaDe.get(item.fila.id) ?? firmaFila(item.fila)
      if (item.repartoId) marcarRepartoOk(db, item.repartoId, item.fila.id, firma, ahora)
      else marcarFincaOk(db, item.movimientoId, item.fila.id, firma, ahora)
      escritos += 1
    } else {
      const msg = 'Finca no ha confirmado el apunte.'
      if (item.repartoId) marcarRepartoError(db, item.repartoId, msg)
      marcarFincaError(db, item.movimientoId, msg)
    }
  }
  for (const b of borrados) {
    const fallo = fallos.get(b.id)
    if (fallo) {
      if (b.repartoId) marcarRepartoError(db, b.repartoId, fallo)
      marcarFincaError(db, b.movimientoId, fallo)
    } else if (confirmados.has(b.id)) {
      if (b.repartoId && b.quitarFila) deleteReparto(db, b.repartoId)
      else if (b.repartoId) limpiarReparto(db, b.repartoId)
      else limpiarFinca(db, b.movimientoId)
      borradosOk += 1
    } else {
      const msg = 'Finca no ha confirmado el borrado.'
      if (b.repartoId) marcarRepartoError(db, b.repartoId, msg)
      marcarFincaError(db, b.movimientoId, msg)
    }
  }
  for (const id of contenedores) cerrarContenedor(db, id, ahora)
  return { escritos, borrados: borradosOk, errores: estadoFinca(db).errores.length }
}

function cerrarContenedor(db: Db, movimientoId: string, cuando: string): void {
  const mov = getMovimiento(db, movimientoId)
  const vivas = listRepartos(db, movimientoId).filter((p) => Number(p.vigente) === 1)
  if (!mov || mov.destino !== 'finca' || vivas.length === 0 || mov.finca_tx_id) return
  const fallo = vivas.find((p) => p.finca_error)
  if (fallo?.finca_error) {
    marcarFincaError(db, movimientoId, fallo.finca_error)
    return
  }
  if (vivas.every((p) => p.finca_sincronizado_en && !p.finca_error)) marcarContenedorOk(db, movimientoId, cuando)
}

export async function retirarArchivoDeFinca(db: Db, escritor: EscritorFinca, archivoId: string): Promise<void> {
  const filas = listFincaDeArchivo(db, archivoId)
  if (filas.length === 0) return
  const resultado = await escritor.aplicar({
    upserts: [],
    borrados: filas.map((f) => ({ id: f.finca_tx_id, referencia: f.referencia })),
  })
  if (resultado.fallos.length > 0) throw new HttpError(502, resultado.fallos[0]?.error ?? 'Finca no ha borrado el apunte')
  for (const fila of filas) {
    if (fila.repartoId) limpiarReparto(db, fila.repartoId)
    else limpiarFinca(db, fila.movimientoId)
  }
}
