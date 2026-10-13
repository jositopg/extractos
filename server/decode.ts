import { execFileSync } from 'node:child_process'
import { extractTextItems, type StructuredTextItem } from 'unpdf'

export function decodeTextoBanco(buf: Buffer): string {
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le')
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8')
  }
  const utf8 = buf.toString('utf8')
  if (utf8.includes('\uFFFD')) return buf.toString('latin1')
  return utf8
}

function lineasDeItems(paginas: StructuredTextItem[][]): string {
  const lineas: string[] = []
  for (const items of paginas) {
    const ordenados = items.filter((it) => it.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x)
    let grupo: StructuredTextItem[] = []
    let y = 0
    const volcar = () => {
      if (grupo.length === 0) return
      grupo.sort((a, b) => a.x - b.x)
      let texto = ''
      let cursor = grupo[0]?.x ?? 0
      for (const it of grupo) {
        if (texto) {
          const hueco = it.x - cursor
          texto += hueco > Math.max(it.fontSize || 8, 8) ? '  ' : ' '
        }
        texto += it.str
        cursor = it.x + (it.width || it.str.length)
      }
      const limpia = texto.replace(/\s+/g, ' ').trim()
      if (limpia) lineas.push(limpia)
      grupo = []
    }
    for (const it of ordenados) {
      const tolerancia = Math.max(it.fontSize || 8, 8) * 0.6
      if (grupo.length > 0 && Math.abs(it.y - y) > tolerancia) volcar()
      if (grupo.length === 0) {
        grupo = [it]
        y = it.y
      } else {
        grupo.push(it)
      }
    }
    volcar()
  }
  return lineas.join('\n')
}

/** Texto del PDF sin poppler. Es el camino de la web. */
export async function textoPdfJs(buf: Buffer): Promise<string> {
  try {
    const { items } = await extractTextItems(new Uint8Array(buf))
    return lineasDeItems(items)
  } catch {
    throw new Error('No he podido leer el PDF. Exporta el extracto en CSV o Excel.')
  }
}

export async function textoPdf(path: string, buf: Buffer): Promise<string> {
  if (!process.env.VERCEL) {
    try {
      const texto = execFileSync('pdftotext', ['-layout', '-enc', 'UTF-8', path, '-'], {
        encoding: 'utf8',
        maxBuffer: 20_000_000,
      })
      if (texto.trim()) return texto
    } catch (err) {
      const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : ''
      if (code !== 'ENOENT') {
        const js = await textoPdfJs(buf).catch(() => '')
        if (js.trim()) return js
        throw new Error('No he podido leer el PDF. Exporta el extracto en CSV o Excel.')
      }
    }
  }
  const texto = await textoPdfJs(buf)
  if (!texto.trim()) throw new Error('El PDF no trae texto. Si es un escaneo, exporta CSV o Excel.')
  return texto
}
