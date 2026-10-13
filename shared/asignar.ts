import { ibanCoincideConCcc, normalizar } from './money'

export type CuentaPista = {
  id: string
  alias: string
  iban: string
  ccc: string
  nombre: string
}

export function aliasEnNombre(alias: string, filename: string): boolean {
  const a = normalizar(alias)
  if (a.length < 3) return false
  return normalizar(filename).includes(a)
}

function cccDeCuenta(cuenta: CuentaPista): string {
  const propio = cuenta.ccc.replace(/\D/g, '')
  if (propio.length === 18) return propio
  return ''
}

export function elegirCuenta(
  pista: { ccc?: string; iban?: string },
  filename: string,
  cuentas: CuentaPista[],
): { id: string } | { ambiguo: string } | null {
  const cccBloque = (pista.ccc ?? '').replace(/\D/g, '')
  if (cccBloque.length === 18) {
    const porCcc = cuentas.filter((c) => {
      const propio = cccDeCuenta(c)
      if (propio && propio === cccBloque) return true
      return ibanCoincideConCcc(c.iban, cccBloque)
    })
    if (porCcc.length === 1) return { id: porCcc[0].id }
    if (porCcc.length > 1) return { ambiguo: 'Varias cuentas tienen el mismo IBAN o CCC' }
  }

  const porAlias = cuentas.filter((c) => aliasEnNombre(c.alias, filename))
  if (porAlias.length === 1) return { id: porAlias[0].id }
  if (porAlias.length > 1) return { ambiguo: `Varias cuentas encajan con el nombre «${filename}»` }
  return null
}
