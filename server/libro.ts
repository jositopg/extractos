import { BlobAccessError, BlobNotFoundError, BlobStoreNotFoundError, get, put } from '@vercel/blob'
import { readFileSync, rmSync, writeFileSync } from 'node:fs'
import { openDb, type Db } from './db'

const PATHNAME = 'libro/extractos.sqlite'
const TMP = '/tmp/extractos-libro.sqlite'

export async function abrirLibroNube(): Promise<{ db: Db; cerrar: (guardar: boolean) => Promise<void> }> {
  rmSync(TMP, { force: true })
  rmSync(`${TMP}-wal`, { force: true })
  rmSync(`${TMP}-shm`, { force: true })
  try {
    const got = await get(PATHNAME, { access: 'private', useCache: false })
    if (got?.statusCode === 200 && got.stream) {
      const buf = Buffer.from(await new Response(got.stream).arrayBuffer())
      writeFileSync(TMP, buf)
    }
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
      // El primer extracto crea el libro.
    } else if (err instanceof BlobStoreNotFoundError || err instanceof BlobAccessError) {
      throw new Error('Falta el almacén privado del libro en Vercel.')
    } else {
      throw err
    }
  }
  const db = openDb(TMP, { wal: false })
  return {
    db,
    cerrar: async (guardar) => {
      db.close()
      if (!guardar) return
      await put(PATHNAME, readFileSync(TMP), {
        access: 'private',
        allowOverwrite: true,
        contentType: 'application/octet-stream',
      })
    },
  }
}
