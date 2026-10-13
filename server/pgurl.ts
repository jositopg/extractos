import { existsSync, readFileSync } from 'node:fs'

export function urlAplicacion(envName: string, archivo: string): string | null {
  const directa = process.env[envName]?.trim()
  if (directa) return directa
  return leerDatabaseUrl(archivo)
}

export function leerDatabaseUrl(filePath: string): string | null {
  if (!existsSync(filePath)) return null
  for (const line of readFileSync(filePath, 'utf8').split('\n')) {
    const m = /^DATABASE_URL=(.*)$/.exec(line.trim())
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, '')
  }
  return null
}

/** La URL directa de Supabase es solo IPv6. En local se prueba y, si falla, el pooler. */
export function fincaUrlsToTry(raw: string): string[] {
  const direct = raw.trim()
  const urls = [direct]
  try {
    const u = new URL(direct)
    const m = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(u.hostname)
    if (m) {
      const ref = m[1]
      const pass = encodeURIComponent(decodeURIComponent(u.password || ''))
      const user = `postgres.${ref}`
      for (const host of [
        'aws-0-eu-west-1.pooler.supabase.com',
        'aws-0-eu-central-1.pooler.supabase.com',
        'aws-0-eu-west-3.pooler.supabase.com',
      ]) {
        urls.push(`postgresql://${user}:${pass}@${host}:5432/postgres`)
      }
      // Fuck You Money está en eu-central-1, clúster aws-1. El de sesión no entra; el de transacción sí.
      urls.push(`postgresql://${user}:${pass}@aws-1-eu-central-1.pooler.supabase.com:6543/postgres`)
    }
  } catch {
    return [direct]
  }
  return [...new Set(urls)]
}
