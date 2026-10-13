import { homedir } from 'node:os'
import { join } from 'node:path'
import { Client } from 'pg'
import type { CatalogoJson } from '../shared/api'
import { esCuentaBancaria } from '../shared/categorias'
import { centimosDesdeTexto } from '../shared/money'
import { asegurarCuentasDesdeFym, reemplazarFym, reemplazarPropiedadesFinca, type Db } from './db'
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

function errorFym(err: unknown): string {
  const msg = mensajeError(err)
  if (/ENOTFOUND|NXDOMAIN|tenant\/user|getaddrinfo/i.test(msg)) {
    return 'Fuck You Money no responde. Si el proyecto está pausado en Supabase, reanúdalo y vuelve a abrir Extractos.'
  }
  return `Fuck You Money: ${msg}`
}

export async function sincronizarCatalogos(db: Db): Promise<CatalogoJson> {
  const errores: string[] = []
  const avisos: string[] = []
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
        fincaUrlsToTry(fymUrl),
        `SELECT id, name, manual_value, institution FROM assets WHERE type = 'cash' ORDER BY name`,
      )
      const bancarias: Array<{ id: string; nombre: string; tipo: string; valor_centimos: number | null }> = []
      let fuera = 0
      for (const row of rows) {
        const tipo = row.institution == null ? '' : String(row.institution).trim()
        if (tipo && !esCuentaBancaria(tipo)) {
          fuera += 1
          continue
        }
        const id = String(row.id ?? '').trim()
        const nombre = String(row.name ?? '').trim()
        if (!id || !nombre) continue
        bancarias.push({ id, nombre, tipo, valor_centimos: centimosPg(row.manual_value) })
      }
      reemplazarFym(
        db,
        bancarias.map((row) => ({
          id: row.id,
          nombre: row.nombre,
          valor_centimos: row.valor_centimos,
          tipo: row.tipo,
          visto_en: ahora,
        })),
      )
      asegurarCuentasDesdeFym(db, bancarias, ahora)
      fymCuentas = bancarias.length
      if (fuera > 0) {
        avisos.push(
          fuera === 1
            ? 'He dejado fuera 1 saldo que no es una cuenta bancaria.'
            : `He dejado fuera ${fuera} saldos que no son cuenta bancaria.`,
        )
      }
      if (bancarias.length === 0) avisos.push('Fuck You Money no ha devuelto cuentas bancarias.')
    } catch (err) {
      errores.push(errorFym(err))
    }
  }

  return { propiedades, fymCuentas, errores, avisos }
}
