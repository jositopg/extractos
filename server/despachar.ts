import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ClasificarBody, CuentaBody } from '../shared/api'
import { HttpError, mensajeError } from './http'
import { urlDe } from './ruta'
import { cabeceraSesion, claveConfigurada, claveCorrecta, emitirSesion, leerCookie, sesionValida } from './sesion'
import type { Servicio } from './servicio'

function send(res: ServerResponse, status: number, body: unknown, extra?: Record<string, string>): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...extra,
  })
  res.end(JSON.stringify(body))
}

function leerCuerpo(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let n = 0
    req.on('data', (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      n += buf.length
      if (n > limit) {
        reject(new HttpError(413, 'Pasa del tamaño permitido'))
        req.destroy()
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

async function leerJson<T>(req: IncomingMessage): Promise<T> {
  const buf = await leerCuerpo(req, 1_000_000)
  if (buf.length === 0) return {} as T
  try {
    return JSON.parse(buf.toString('utf8')) as T
  } catch {
    throw new HttpError(400, 'JSON inválido')
  }
}

function param(pathname: string, re: RegExp): string | null {
  const m = re.exec(pathname)
  return m ? decodeURIComponent(m[1]) : null
}

async function entrar(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (!claveConfigurada()) {
    send(res, 400, { error: 'Esta copia no pide clave.' })
    return
  }
  const body = await leerJson<{ clave?: string }>(req)
  if (!body.clave || !claveCorrecta(body.clave)) {
    send(res, 401, { error: 'La clave no vale' })
    return
  }
  const seguro = Boolean(process.env.VERCEL)
  send(res, 200, { ok: true }, { 'set-cookie': cabeceraSesion(emitirSesion(), seguro) })
}

export async function despachar(req: IncomingMessage, res: ServerResponse, svc: Servicio): Promise<void> {
  const url = urlDe(req)
  const pathname = url.pathname
  const method = req.method || 'GET'
  if (process.env.VERCEL && !claveConfigurada()) {
    send(res, 503, { error: 'Falta la clave de acceso en el servidor.' })
    return
  }
  if (method === 'POST' && pathname === '/api/entrar') {
    await entrar(req, res)
    return
  }
  if (!sesionValida(leerCookie(req.headers.cookie))) {
    send(res, 401, { error: 'Hace falta entrar' })
    return
  }
  if (method === 'GET' && pathname === '/api/resumen') return send(res, 200, svc.resumen())
  if (method === 'POST' && pathname === '/api/importar') return send(res, 200, await svc.importar())
  if (method === 'POST' && pathname === '/api/subir') {
    const nombre = String(req.headers['x-filename'] || 'extracto.txt')
    const buf = await leerCuerpo(req, 20_000_000)
    return send(res, 200, await svc.subir(nombre, buf))
  }
  if (method === 'GET' && pathname === '/api/movimientos') {
    return send(res, 200, svc.movimientos({
      destino: url.searchParams.get('destino') || undefined,
      cuentaId: url.searchParams.get('cuentaId') || undefined,
      q: url.searchParams.get('q') || undefined,
    }))
  }
  const movId = param(pathname, /^\/api\/movimientos\/([^/]+)$/)
  if (method === 'PATCH' && movId) {
    await svc.clasificar(movId, await leerJson<ClasificarBody>(req))
    return send(res, 200, { ok: true })
  }
  if (method === 'GET' && pathname === '/api/registro') {
    return send(res, 200, svc.registro(url.searchParams.get('mes') || ''))
  }
  if (method === 'POST' && pathname === '/api/cuentas') {
    const creada = svc.crearCuenta(await leerJson<CuentaBody>(req))
    await svc.engancharPendientes(creada.id)
    const fresca = svc.resumen().cuentas.find((cuenta) => cuenta.id === creada.id)
    return send(res, 200, fresca ?? creada)
  }
  const cuentaId = param(pathname, /^\/api\/cuentas\/([^/]+)$/)
  if (method === 'PATCH' && cuentaId) {
    svc.actualizarCuenta(cuentaId, await leerJson<CuentaBody>(req))
    await svc.engancharPendientes(cuentaId)
    return send(res, 200, { ok: true })
  }
  if (method === 'DELETE' && cuentaId) {
    svc.borrarCuenta(cuentaId)
    return send(res, 200, { ok: true })
  }
  const archivoCuenta = param(pathname, /^\/api\/archivos\/([^/]+)\/cuenta$/)
  if (method === 'POST' && archivoCuenta) {
    const body = await leerJson<{ cuentaId?: string }>(req)
    if (!body.cuentaId) throw new HttpError(400, 'Falta la cuenta')
    await svc.asignar(archivoCuenta, body.cuentaId)
    return send(res, 200, { ok: true })
  }
  const archivoId = param(pathname, /^\/api\/archivos\/([^/]+)$/)
  if (method === 'DELETE' && archivoId) {
    await svc.borrarArchivo(archivoId)
    return send(res, 200, { ok: true })
  }
  if (method === 'POST' && pathname === '/api/propiedades') {
    const body = await leerJson<{ nombre?: string }>(req)
    return send(res, 200, svc.crearPropiedad(body.nombre ?? ''))
  }
  const reglaId = param(pathname, /^\/api\/reglas\/([^/]+)$/)
  if (method === 'DELETE' && reglaId) {
    svc.borrarRegla(reglaId)
    return send(res, 200, { ok: true })
  }
  if (method === 'POST' && pathname === '/api/catalogos') return send(res, 200, await svc.sincronizar())
  if (method === 'GET' && pathname === '/api/finca') return send(res, 200, svc.estadoFinca())
  if (method === 'POST' && pathname === '/api/finca') return send(res, 200, await svc.reintentarFinca())
  if (pathname === '/api/exportar') {
    const soloNuevos = url.searchParams.get('todos') !== '1'
    if (method === 'GET') return send(res, 200, svc.exportacion(soloNuevos))
    if (method === 'POST') return send(res, 200, svc.escribirExportacion(soloNuevos))
  }
  if (method === 'POST' && pathname === '/api/exportar/marcar') {
    const body = await leerJson<{ ids?: string[] }>(req)
    return send(res, 200, svc.marcar(body.ids ?? []))
  }
  send(res, 404, { error: 'No existe' })
}

export function responderError(res: ServerResponse, err: unknown): void {
  const status = err instanceof HttpError ? err.status : 500
  if (status === 500) console.error(err)
  if (!res.headersSent) send(res, status, { error: mensajeError(err) })
}
