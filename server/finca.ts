import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client } from 'pg'
import { filaFinca, firmaFila, propiedadLocal, type FilaFinca } from '../shared/finca'
import {
  estadoFinca,
  limpiarFinca,
  listCandidatosFinca,
  listFincaDeArchivo,
  marcarFincaError,
  marcarFincaOk,
  type Db,
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

export async function sincronizarFinca(
  db: Db,
  escritor: EscritorFinca | false | null | undefined,
): Promise<{ escritos: number; borrados: number; errores: number }> {
  if (!escritor) return { escritos: 0, borrados: 0, errores: estadoFinca(db).errores.length }
  const upserts: FilaFinca[] = []
  const borrados: { id: string; referencia: string; movimientoId: string }[] = []
  const firmaDe = new Map<string, string>()
  const movimientoDeFila = new Map<string, string>()

  for (const row of listCandidatosFinca(db)) {
    if (row.destino !== 'finca') {
      if (row.finca_tx_id) {
        borrados.push({
          id: row.finca_tx_id,
          referencia: `extractos:${row.id}`,
          movimientoId: row.id,
        })
      }
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
    upserts.push(fila)
    firmaDe.set(fila.id, firma)
    movimientoDeFila.set(fila.id, row.id)
  }

  if (upserts.length === 0 && borrados.length === 0) {
    return { escritos: 0, borrados: 0, errores: estadoFinca(db).errores.length }
  }

  let resultado: ResultadoEscritura
  try {
    resultado = await escritor.aplicar({
      upserts,
      borrados: borrados.map(({ id, referencia }) => ({ id, referencia })),
    })
  } catch (err) {
    const msg = mensajeError(err)
    for (const fila of upserts) {
      const movId = movimientoDeFila.get(fila.id)
      if (movId) marcarFincaError(db, movId, msg)
    }
    for (const b of borrados) marcarFincaError(db, b.movimientoId, msg)
    return { escritos: 0, borrados: 0, errores: estadoFinca(db).errores.length }
  }

  const fallos = new Map(resultado.fallos.map((f) => [f.id, f.error]))
  const confirmados = new Set(resultado.ok)
  const ahora = new Date().toISOString()
  let escritos = 0
  let borradosOk = 0
  for (const fila of upserts) {
    const movId = movimientoDeFila.get(fila.id)
    if (!movId) continue
    const fallo = fallos.get(fila.id)
    if (fallo) marcarFincaError(db, movId, fallo)
    else if (confirmados.has(fila.id)) {
      marcarFincaOk(db, movId, fila.id, firmaDe.get(fila.id) ?? firmaFila(fila), ahora)
      escritos += 1
    } else marcarFincaError(db, movId, 'Finca no ha confirmado el apunte.')
  }
  for (const b of borrados) {
    const fallo = fallos.get(b.id)
    if (fallo) marcarFincaError(db, b.movimientoId, fallo)
    else if (confirmados.has(b.id)) {
      limpiarFinca(db, b.movimientoId)
      borradosOk += 1
    } else marcarFincaError(db, b.movimientoId, 'Finca no ha confirmado el borrado.')
  }
  return { escritos, borrados: borradosOk, errores: estadoFinca(db).errores.length }
}

export async function retirarArchivoDeFinca(db: Db, escritor: EscritorFinca, archivoId: string): Promise<void> {
  const filas = listFincaDeArchivo(db, archivoId)
  if (filas.length === 0) return
  const resultado = await escritor.aplicar({
    upserts: [],
    borrados: filas.map((f) => ({ id: f.finca_tx_id, referencia: `extractos:${f.id}` })),
  })
  if (resultado.fallos.length > 0) throw new HttpError(502, resultado.fallos[0]?.error ?? 'Finca no ha borrado el apunte')
  for (const fila of filas) limpiarFinca(db, fila.id)
}
