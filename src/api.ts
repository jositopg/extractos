export class ErrorApi extends Error {
  constructor(message: string, public status: number) {
    super(message)
  }
}

export function esSesion(err: unknown): boolean {
  return err instanceof ErrorApi && err.status === 401
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers)
  const esFichero = init?.body instanceof ArrayBuffer
  if (!esFichero && init?.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
  const res = await fetch(path, { ...init, headers })
  const text = await res.text()
  let data: { error?: string } = {}
  if (text) {
    try {
      data = JSON.parse(text) as { error?: string }
    } catch {
      throw new ErrorApi(res.ok ? 'La respuesta no se entiende' : `Error ${res.status}`, res.status)
    }
  }
  if (!res.ok) throw new ErrorApi(data.error || `Error ${res.status}`, res.status)
  return data as T
}
