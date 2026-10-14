import {
  CATEGORIAS_GASTO_FINCA,
  CATEGORIAS_GASTO_PERSONAL,
  CATEGORIAS_INGRESO_FINCA,
  CATEGORIAS_INGRESO_PERSONAL,
  type Destino,
} from './categorias'
import { normalizar } from './money'

export type Clasificacion = {
  destino: Destino
  categoriaFinca?: string | null
  propiedadId?: string | null
  categoriaPersonal?: string | null
}

export function categoriasPara(destino: Destino, importeCentimos: number): readonly string[] {
  if (destino === 'finca') return importeCentimos >= 0 ? CATEGORIAS_INGRESO_FINCA : CATEGORIAS_GASTO_FINCA
  if (destino === 'personal') return importeCentimos >= 0 ? CATEGORIAS_INGRESO_PERSONAL : CATEGORIAS_GASTO_PERSONAL
  return []
}

export function errorClasificacion(input: Clasificacion & { importeCentimos: number }): string | null {
  const { destino, importeCentimos } = input
  if (destino === 'pendiente' || destino === 'duda' || destino === 'traspaso' || destino === 'ignorar') return null
  const categoria = destino === 'finca' ? input.categoriaFinca : input.categoriaPersonal
  if (!categoria) return 'Falta la categoría'
  const validas = categoriasPara(destino, importeCentimos)
  if (!validas.includes(categoria)) {
    const lado = importeCentimos >= 0 ? 'un ingreso' : 'un gasto'
    return `«${categoria}» no es ${lado} de ${destino === 'finca' ? 'Finca' : 'la cuenta personal'}`
  }
  if (destino === 'finca' && !input.propiedadId) return 'Falta la propiedad'
  return null
}

export type Regla = Clasificacion & {
  id: string
  patron: string
  creadoEn: string
}

export function sugerirPatron(concepto: string): string {
  return normalizar(concepto)
    .replace(/\b\d+\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((w) => w.length > 2)
    .slice(0, 5)
    .join(' ')
}

export function reglaGanadora(concepto: string, reglas: Regla[]): Regla | null {
  const n = normalizar(concepto)
  const hits = reglas.filter((r) => {
    const p = normalizar(r.patron)
    return p.length >= 3 && n.includes(p)
  })
  hits.sort((a, b) => normalizar(b.patron).length - normalizar(a.patron).length || b.creadoEn.localeCompare(a.creadoEn))
  return hits[0] ?? null
}
