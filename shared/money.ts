/** Importes en céntimos enteros. El texto del banco no pasa por coma flotante. */

export function centimosDesdeTexto(raw: string): number {
  let s = raw.trim().replace(/€/g, '').replace(/\s/g, '')
  if (!s) return NaN

  let sign = 1
  if (s.startsWith('(') && s.endsWith(')')) {
    sign = -1
    s = s.slice(1, -1)
  }
  if (s.endsWith('-')) {
    sign = -1
    s = s.slice(0, -1)
  } else if (s.startsWith('-')) {
    sign = -1
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }
  if (!/^\d[\d.,]*$/.test(s)) return NaN
  if (s.includes(',') && s.includes('.')) {
    if (s.lastIndexOf('.') > s.lastIndexOf(',')) s = s.replace(/,/g, '')
    else s = s.replace(/\./g, '')
  }

  let entero: string
  let decimal = ''
  if (s.includes(',')) {
    const partes = s.split(',')
    if (partes.length !== 2 || partes[1].length > 2) return NaN
    entero = partes[0].replace(/\./g, '')
    decimal = partes[1]
  } else if (s.includes('.')) {
    const partes = s.split('.')
    if (partes.length === 2 && partes[1].length <= 2) {
      entero = partes[0]
      decimal = partes[1]
    } else if (partes.every((p, i) => /^\d+$/.test(p) && (i === 0 || p.length === 3))) {
      entero = partes.join('')
    } else {
      return NaN
    }
  } else {
    entero = s
  }

  if (!/^\d+$/.test(entero) || (decimal !== '' && !/^\d+$/.test(decimal))) return NaN
  decimal = decimal.padEnd(2, '0')
  const n = Number(entero) * 100 + Number(decimal)
  if (!Number.isSafeInteger(n)) return NaN
  return sign * n
}

export function parseFecha(raw: string): string | null {
  const s = raw.trim()
  let y: number
  let m: number
  let d: number
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (iso) {
    y = Number(iso[1])
    m = Number(iso[2])
    d = Number(iso[3])
  } else {
    const dm = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s)
    if (!dm) return null
    d = Number(dm[1])
    m = Number(dm[2])
    y = Number(dm[3])
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/** YYMMDD del Cuaderno 43. 80–99 son del siglo XX; el resto, del XXI. */
export function fechaYyMmDd(raw: string): string | null {
  if (!/^\d{6}$/.test(raw)) return null
  const yy = Number(raw.slice(0, 2))
  const year = yy >= 80 ? 1900 + yy : 2000 + yy
  return parseFecha(`${year}-${raw.slice(2, 4)}-${raw.slice(4, 6)}`)
}

export function normalizar(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Los 20 dígitos de la cuenta (con los dos de control) pasan a los 18 que usa el libro. */
export function ccc18DesdeCuenta(texto: string): string | undefined {
  const m = texto.match(/n[uú]mero de cuenta\s*:?\s*((?:\d\s*){20})/i)
  if (!m?.[1]) return undefined
  const d = m[1].replace(/\D/g, '')
  if (d.length !== 20) return undefined
  return d.slice(0, 8) + d.slice(10)
}

export function cccDesdeIban(iban: string): string | null {
  const d = iban.replace(/\s/g, '').toUpperCase()
  if (!/^ES\d{22}$/.test(d)) return null
  return d.slice(4, 12) + d.slice(14, 24)
}

export function ibanCoincideConCcc(iban: string, ccc18: string): boolean {
  const ccc = cccDesdeIban(iban)
  const limpio = ccc18.replace(/\D/g, '')
  return ccc != null && limpio.length === 18 && ccc === limpio
}

export function buscarIban(texto: string): string | null {
  const m = texto.toUpperCase().match(/ES(?:\s*\d){22}/)
  if (!m) return null
  const iban = m[0].replace(/\s/g, '')
  return /^ES\d{22}$/.test(iban) ? iban : null
}

export function hoyLocal(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function mesDe(fecha: string): string {
  return fecha.slice(0, 7)
}
