import { describe, expect, it } from 'vitest'
import { fincaUrlsToTry } from './pgurl'

describe('conexión de solo lectura a Finca', () => {
  it('prueba la URL directa y luego el pooler, sin dejar la contraseña en claro mal codificada', () => {
    const urls = fincaUrlsToTry('postgresql://postgres:p%40ss@db.abc123.supabase.co:5432/postgres')
    expect(urls[0]).toContain('db.abc123.supabase.co')
    expect(urls.some((u) => u.includes('postgres.abc123') && u.includes('p%40ss') && u.includes('pooler.supabase.com'))).toBe(true)
    expect(urls.some((u) => u.includes('aws-1-eu-central-1.pooler.supabase.com:6543'))).toBe(true)
  })
})
