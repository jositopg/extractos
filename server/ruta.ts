import type { IncomingMessage } from 'node:http'

/** En Vercel todas las rutas /api/* llegan a /api/despacho con la ruta real en __ruta. */
export function urlDe(req: IncomingMessage): URL {
  const url = new URL(req.url || '/', 'http://127.0.0.1')
  const marca = url.searchParams.get('__ruta')
  if (!marca) return url
  url.searchParams.delete('__ruta')
  const resto = url.searchParams.toString()
  const path = marca.replace(/^\/+/, '')
  const pathname = path.startsWith('api/') ? `/${path}` : `/api/${path}`
  return new URL(`${pathname}${resto ? `?${resto}` : ''}`, 'http://127.0.0.1')
}
