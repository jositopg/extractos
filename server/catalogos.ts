import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client } from 'pg'
import type { CatalogoJson } from '../shared/api'
import { centimosDesdeTexto } from '../shared/money'
import { reemplazarFym, reemplazarPropiedadesFinca, type Db } from './db'
import { mensajeError } from './http'
import { fincaUrlsToTry, urlAplicacion } from './pgurl'

function centimosPg(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value * 100)
  if (typeof value !== 'string') return null
  const s = value.trim()
  if (/^-?\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 100)
  const c = centimosDesdeTexto(s)
  return Number.isNaN(c) ? null : c
}

async function consultar(urls: string[], sql: string): Promise<Array<Record<string, unknown>>> {
  let last = 'No se pudo conectar'
  for (const url of urls) {
    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8000,
    })
    try {
      await client.connect()
      const result = await client.query(sql)
      await client.end().catch(() => {})
      return result.rows as Array<Record<string, unknown>>
    } catch (err) {
      last = mensajeError(err)
      await client.end().catch(() => {})
    }
  }
  throw new Error(last)
}

export async function sincronizarCatalogos(db: Db): Promise<CatalogoJson> {
  const errores: string[] = []
  let propiedades: number | null = null
  let fymCuentas: number | null = null
  const ahora = new Date().toISOString()

  const fincaUrl = urlAplicacion('FINCA_DATABASE_URL', join(homedir(), '.finca-db.env'))
  if (!fincaUrl) {
    errores.push('No está ~/.finca-db.env, así que no puedo traer las propiedades.')
  } else {
    try {
      const rows = await consultar(fincaUrlsToTry(fincaUrl), 'SELECT id, nombre FROM propiedades ORDER BY nombre')
      reemplazarPropiedadesFinca(
        db,
        rows.map((r) => ({
          id: String(r.id),
          nombre: String(r.nombre),
          origen: 'finca',
          visto_en: ahora,
        })),
      )
      propiedades = rows.length
    } catch (err) {
      errores.push(`Finca: ${mensajeError(err)}`)
    }
  }

  const fymUrl = urlAplicacion('FYM_DATABASE_URL', join(homedir(), '.fuckyoumoney-db.env'))
  if (!fymUrl) {
    errores.push('No está ~/.fuckyoumoney-db.env, así que no puedo traer las cuentas.')
  } else {
    try {
      const rows = await consultar(
        [fymUrl],
        `SELECT id, name, manual_value FROM assets WHERE type = 'cash' ORDER BY name`,
      )
      reemplazarFym(
        db,
        rows.map((r) => ({
          id: String(r.id),
          nombre: String(r.name),
          valor_centimos: centimosPg(r.manual_value),
          visto_en: ahora,
        })),
      )
      fymCuentas = rows.length
    } catch (err) {
      errores.push(`Fuck You Money: ${mensajeError(err)}`)
    }
  }

  return { propiedades, fymCuentas, errores }
}
