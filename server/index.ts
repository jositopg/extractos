import { createReadStream, existsSync, statSync, watch } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { dirname, extname, join, normalize, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb } from './db'
import { despachar, responderError } from './despachar'
import { escritorFincaReal } from './finca'
import { asegurarCarpetas, type Rutas } from './importar'
import { mensajeError } from './http'
import { crearServicio } from './servicio'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const rutas: Rutas = {
  root: ROOT,
  inbox: join(ROOT, 'inbox'),
  exportDir: join(ROOT, 'export'),
}
const db = openDb(join(ROOT, 'data', 'extractos.sqlite'))
const svc = crearServicio(db, rutas, { finca: escritorFincaReal() })
asegurarCarpetas(rutas)

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(JSON.stringify(body))
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
}

function servirEstatico(res: ServerResponse, pathname: string): void {
  const dist = join(ROOT, 'dist')
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '')
  let file = normalize(join(dist, rel))
  if (file !== dist && !file.startsWith(dist + sep)) {
    send(res, 404, { error: 'No existe' })
    return
  }
  if (!existsSync(file) || !statSync(file).isFile()) file = join(dist, 'index.html')
  if (!existsSync(file)) {
    send(res, 404, { error: 'No está construida la interfaz. Usa npm run dev.' })
    return
  }
  res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(res)
}

const server = createServer((req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  const pathname = url.pathname
  if (!pathname.startsWith('/api')) {
    if (process.env.NODE_ENV === 'production') servirEstatico(res, pathname)
    else send(res, 404, { error: 'La interfaz está en el puerto 5173' })
    return
  }
  despachar(req, res, svc).catch((err) => responderError(res, err))
})

const port = Number(process.env.PORT) || 8787
server.listen(port, '127.0.0.1', () => {
  console.log(`API en http://127.0.0.1:${port}`)
  void svc.importar().then((r) => {
    if (r.nuevos > 0) console.log(`Inbox: ${r.movimientos} movimientos nuevos`)
  }).catch((err) => console.error(mensajeError(err)))
  try {
    let timer: NodeJS.Timeout | undefined
    watch(rutas.inbox, () => {
      clearTimeout(timer)
      timer = setTimeout(() => {
        void svc.importar().then((r) => {
          if (r.nuevos > 0) console.log(`Inbox: ${r.movimientos} movimientos nuevos`)
        }).catch((err) => console.error(mensajeError(err)))
      }, 400)
    })
  } catch (err) {
    console.error(mensajeError(err))
  }
})

function cerrar(): void {
  server.close()
  db.close()
  process.exit(0)
}
process.on('SIGINT', cerrar)
process.on('SIGTERM', cerrar)
