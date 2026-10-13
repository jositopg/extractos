import { describe, expect, it } from 'vitest'
import { parseExtracto } from '../shared/parse'
import { textoPdfJs } from './decode'

function miniPdf(linea: string): Buffer {
  const escaped = linea.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)')
  const stream = `BT /F1 12 Tf 40 750 Td (${escaped}) Tj ET\n`
  const objs = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n',
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}endstream\nendobj\n`,
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n',
  ]
  let body = '%PDF-1.4\n'
  const offsets = [0]
  for (const obj of objs) {
    offsets.push(Buffer.byteLength(body))
    body += obj
  }
  const xrefAt = Buffer.byteLength(body)
  let xref = `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i < offsets.length; i++) xref += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  const trailer = `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`
  return Buffer.from(body + xref + trailer)
}

describe('pdf', () => {
  it('saca el texto sin poppler y lo lee como extracto', async () => {
    const texto = await textoPdfJs(miniPdf('10/01/2026 RECIBO ENDESA -45,20 954,80'))
    const r = parseExtracto(texto)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.bloques[0].movimientos[0]).toMatchObject({
      fecha: '2026-01-10',
      importeCentimos: -4520,
      saldoCentimos: 95480,
      concepto: 'RECIBO ENDESA',
    })
  })
})
