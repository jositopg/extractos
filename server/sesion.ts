import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

const COOKIE = 'extractos_sesion'
const DIAS = 30

export function claveConfigurada(): string | null {
  const clave = process.env.EXTRACTOS_PASSWORD?.trim()
  return clave || null
}

export function claveCorrecta(intento: string): boolean {
  const clave = claveConfigurada()
  if (!clave) return false
  const a = createHash('sha256').update(clave).digest()
  const b = createHash('sha256').update(intento).digest()
  return timingSafeEqual(a, b)
}

export function emitirSesion(ahora = Date.now()): string {
  const clave = claveConfigurada()
  if (!clave) throw new Error('No hay clave')
  const exp = ahora + DIAS * 24 * 60 * 60 * 1000
  const mac = createHmac('sha256', clave).update(String(exp)).digest('base64url')
  return `${exp}.${mac}`
}

export function sesionValida(token: string | undefined, ahora = Date.now()): boolean {
  if (!claveConfigurada()) return true
  if (!token) return false
  const punto = token.lastIndexOf('.')
  if (punto <= 0) return false
  const expRaw = token.slice(0, punto)
  const mac = token.slice(punto + 1)
  const exp = Number(expRaw)
  if (!Number.isFinite(exp) || exp < ahora) return false
  const clave = claveConfigurada()
  if (!clave) return false
  const esperada = createHmac('sha256', clave).update(expRaw).digest('base64url')
  const a = Buffer.from(mac)
  const b = Buffer.from(esperada)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export function leerCookie(header: string | undefined): string | undefined {
  if (!header) return undefined
  for (const parte of header.split(';')) {
    const i = parte.indexOf('=')
    if (i < 0) continue
    const nombre = parte.slice(0, i).trim()
    if (nombre !== COOKIE) continue
    return decodeURIComponent(parte.slice(i + 1).trim())
  }
  return undefined
}

export function cabeceraSesion(token: string, seguro: boolean): string {
  const trozos = [
    `${COOKIE}=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Lax',
    `Max-Age=${DIAS * 86400}`,
  ]
  if (seguro) trozos.push('Secure')
  return trozos.join('; ')
}
