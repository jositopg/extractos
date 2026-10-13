import type { Destino, TipoCuenta } from './categorias'
import type { PropuestaFym, RechazoExport } from './exportar'
import type { HistorialSaldo, LineaCategoria } from './patrimonio'

export type CuentaJson = {
  id: string
  nombre: string
  banco: string
  alias: string
  iban: string
  ccc: string
  tipo: TipoCuenta
  fymAssetId: string | null
  saldoInicialCentimos: number | null
  saldoInicialFecha: string | null
  saldoCentimos: number | null
  fechaSaldo: string | null
  origenSaldo: 'extracto' | 'calculado' | 'sin_datos'
  enFym: boolean
  fymNombre: string | null
  fymValorCentimos: number | null
  diferenciaCentimos: number | null
  ultimoApunte: { fecha: string; concepto: string; importeCentimos: number; eseDia: number } | null
}

export type PropiedadJson = {
  id: string
  nombre: string
  origen: 'finca' | 'manual'
}

export type FymCashJson = {
  id: string
  nombre: string
  valorCentimos: number | null
}

export type ReglaJson = {
  id: string
  patron: string
  destino: Destino
  categoriaFinca: string | null
  propiedadId: string | null
  categoriaPersonal: string | null
}

export type ArchivoJson = {
  id: string
  nombre: string
  formato: string
  cuentaId: string | null
  desde: string | null
  hasta: string | null
  leidos: number
  movimientos: number
  duplicados: number
  avisos: string
  error: string | null
  cuadreCentimos: number | null
  saldoFinalCentimos: number | null
  guardado: boolean
}

export type ResumenJson = {
  cuentas: CuentaJson[]
  propiedades: PropiedadJson[]
  fymCuentas: FymCashJson[]
  archivos: ArchivoJson[]
  reglas: ReglaJson[]
  recuento: { pendiente: number; clasificado: number }
  rutas: { inbox: string; exportDir: string }
  nube: boolean
}

export type MovimientoJson = {
  id: string
  cuentaId: string
  cuentaNombre: string
  fecha: string
  fechaValor: string | null
  importeCentimos: number
  saldoCentimos: number | null
  concepto: string
  destino: Destino
  categoriaFinca: string | null
  propiedadId: string | null
  categoriaPersonal: string | null
  nota: string
  exportadoFincaEn: string | null
  fincaSincronizadoEn: string | null
  fincaError: string | null
}

export type RegistroJson = {
  mes: string
  ingresosFincaCentimos: number
  gastosFincaCentimos: number
  brutoCentimos: number
  cuentasFym: number
  brutoAviso: string
  porCategoria: LineaCategoria[]
  pendientes: number
  descuadres: { archivoId: string; nombre: string; cuentaNombre: string; diferenciaCentimos: number }[]
  historial: HistorialSaldo[]
}

export type EstadoFincaJson = {
  escritos: number
  pendientes: number
  errores: { id: string; concepto: string; fecha: string; error: string }[]
}

export type FicheroFincaJson = {
  propiedadId: string
  propiedadNombre: string
  fichero: string
  texto: string
  ids: string[]
  lineas: number
  ruta?: string
}

export type ExportacionJson = {
  ficheros: FicheroFincaJson[]
  rechazados: RechazoExport[]
  fym: PropuestaFym
  rutaFym?: string
}

export type ImportacionJson = {
  vistos: number
  nuevos: number
  movimientos: number
  duplicados: number
  sinCuenta: number
  yaEstaban: number
  notas: string[]
  errores: { nombre: string; error: string }[]
}

export type ClasificarBody = {
  destino: Destino
  categoriaFinca?: string | null
  propiedadId?: string | null
  categoriaPersonal?: string | null
  nota?: string
  recordar?: boolean
  patron?: string
}

export type CuentaBody = {
  nombre?: string
  banco?: string
  alias?: string
  iban?: string
  tipo?: string
  fymAssetId?: string | null
  enFym?: boolean
  saldoInicialCentimos?: number | null
  saldoInicialFecha?: string | null
}

export type CatalogoJson = {
  propiedades: number | null
  fymCuentas: number | null
  errores: string[]
  avisos: string[]
}
