export function textoEur(centimos: number | null | undefined): string {
  if (centimos == null || !Number.isFinite(centimos)) return '—'
  const sign = centimos < 0 ? '-' : ''
  const abs = Math.abs(Math.round(centimos))
  const euros = Math.floor(abs / 100)
  const dec = String(abs % 100).padStart(2, '0')
  const miles = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sign}${miles},${dec} €`
}

export function textoFecha(iso: string | null | undefined): string {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

/** Importe positivo con coma decimal, como lo espera el pegado de Finca. */
export function importeFinca(centimos: number): string {
  const abs = Math.abs(Math.round(centimos))
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`
}

export function euroNumero(centimos: number): number {
  return Math.round(centimos) / 100
}
