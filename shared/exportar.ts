import type { Destino } from './categorias'
import { errorClasificacion } from './clasificar'
import { importeFinca, textoEur } from './formato'
import { normalizar } from './money'
import type { MediaVida } from './patrimonio'

export type MovimientoExportable = {
  id: string
  fecha: string
  importeCentimos: number
  concepto: string
  destino: Destino
  categoriaFinca: string | null
  propiedadId: string | null
  propiedadNombre: string | null
  exportadoFincaEn: string | null
}

export type FicheroFinca = {
  propiedadId: string
  propiedadNombre: string
  fichero: string
  texto: string
  ids: string[]
  lineas: number
}

export type RechazoExport = {
  id: string
  concepto: string
  motivo: string
}

export function slug(nombre: string): string {
  const s = normalizar(nombre).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return s || 'propiedad'
}

function descripcion(concepto: string): string {
  return concepto.replace(/[;\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180)
}

export function exportarFinca(movs: MovimientoExportable[], soloNuevos: boolean): {
  ficheros: FicheroFinca[]
  rechazados: RechazoExport[]
} {
  const grupos = new Map<string, { nombre: string; lineas: string[]; ids: string[] }>()
  const rechazados: RechazoExport[] = []

  const elegidos = movs
    .filter((m) => m.destino === 'finca' && (!soloNuevos || !m.exportadoFincaEn))
    .slice()
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.concepto.localeCompare(b.concepto, 'es'))

  for (const m of elegidos) {
    const motivo = errorClasificacion({
      destino: 'finca',
      importeCentimos: m.importeCentimos,
      categoriaFinca: m.categoriaFinca,
      propiedadId: m.propiedadId,
    })
    if (motivo || !m.categoriaFinca || !m.propiedadId || !m.propiedadNombre) {
      rechazados.push({ id: m.id, concepto: m.concepto, motivo: motivo ?? 'Falta la propiedad' })
      continue
    }
    if (m.importeCentimos === 0) continue
    const tipo = m.importeCentimos < 0 ? 'gasto' : 'ingreso'
    const linea = `${m.fecha};${tipo};${m.categoriaFinca};${importeFinca(m.importeCentimos)};${descripcion(m.concepto)}`
    const g = grupos.get(m.propiedadId) ?? { nombre: m.propiedadNombre, lineas: [], ids: [] }
    g.lineas.push(linea)
    g.ids.push(m.id)
    grupos.set(m.propiedadId, g)
  }

  const usados = new Set<string>()
  const ficheros: FicheroFinca[] = []
  for (const [propiedadId, g] of grupos) {
    let base = slug(g.nombre)
    if (usados.has(base)) base = `${base}-${propiedadId.slice(0, 8)}`
    usados.add(base)
    ficheros.push({
      propiedadId,
      propiedadNombre: g.nombre,
      fichero: `${base}.txt`,
      texto: `${g.lineas.join('\n')}\n`,
      ids: g.ids,
      lineas: g.lineas.length,
    })
  }
  return { ficheros, rechazados }
}

export type PropuestaCuenta = {
  nombre: string
  fymAssetId: string | null
  fymNombre: string | null
  saldoCentimos: number | null
  saldo: string
  fechaSaldo: string | null
  declaradoCentimos: number | null
  declarado: string
  diferenciaCentimos: number | null
}

export type PropuestaFym = {
  nota: string
  generadoEn: string
  gastoVidaMensualCentimos: number | null
  gastoVidaMensual: string
  meses: string[]
  aviso: string
  cuentas: PropuestaCuenta[]
}

export function propuestaFym(input: {
  generadoEn: string
  media: MediaVida
  cuentas: PropuestaCuenta[]
}): PropuestaFym {
  return {
    nota: 'Propuesta para confirmar a mano en Fuck You Money. Extractos no cambia los saldos allí. Fuck You Money guarda una foto declarada.',
    generadoEn: input.generadoEn,
    gastoVidaMensualCentimos: input.media.mediaCentimos,
    gastoVidaMensual: textoEur(input.media.mediaCentimos),
    meses: input.media.meses,
    aviso: input.media.aviso,
    cuentas: input.cuentas,
  }
}
