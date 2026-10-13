import { mkdirSync } from 'node:fs'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { join } from 'node:path'
import { openDb } from './db'
import { despachar, responderError } from './despachar'
import { escritorFincaReal } from './finca'
import { abrirLibroNube } from './libro'
import { urlDe } from './ruta'
import { claveConfigurada, leerCookie, sesionValida } from './sesion'
import { crearServicio } from './servicio'

export const maxDuration = 60

const rutas = {
  root: '/tmp/extractos',
  inbox: join('/tmp/extractos', 'inbox'),
  exportDir: join('/tmp/extractos', 'export'),
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const method = req.method || 'GET'
  const url = urlDe(req)
  if (process.env.VERCEL && !claveConfigurada()) {
    json(res, 503, { error: 'Falta la clave de acceso en el servidor.' })
    return
  }
  const entra = method === 'POST' && url.pathname === '/api/entrar'
  if (!entra && !sesionValida(leerCookie(req.headers.cookie))) {
    json(res, 401, { error: 'Hace falta entrar' })
    return
  }
  if (entra) {
    const db = openDb(':memory:')
    try {
      await despachar(req, res, crearServicio(db, rutas, { finca: false }))
    } catch (err) {
      responderError(res, err)
    } finally {
      db.close()
    }
    return
  }
  mkdirSync(rutas.inbox, { recursive: true })
  mkdirSync(rutas.exportDir, { recursive: true })
  const libro = await abrirLibroNube()
  const svc = crearServicio(libro.db, rutas, { finca: escritorFincaReal() })
  try {
    await despachar(req, res, svc)
  } catch (err) {
    responderError(res, err)
  } finally {
    await libro.cerrar(method !== 'GET' && method !== 'HEAD')
  }
}
