/** Deben coincidir con CATEGORIAS_GASTO y CATEGORIAS_INGRESO de Finca. */
export const CATEGORIAS_GASTO_FINCA = [
  'Electricidad',
  'Agua',
  'Gas',
  'Telefonía / Internet',
  'IBI',
  'Tasa de basuras',
  'IRPF / Retención',
  'Otros impuestos',
  'Comunidad de propietarios',
  'Seguro hogar',
  'Seguro impago',
  'Mantenimiento',
  'Reparaciones',
  'Hipoteca / Financiación',
  'Intereses hipoteca',
  'Honorarios / Gestión',
  'Mobiliario / Equipamiento',
  'Obras / Reforma',
  'Otros gastos',
] as const

export const CATEGORIAS_INGRESO_FINCA = [
  'Alquiler mensual',
  'Electricidad (repercutida)',
  'Agua (repercutida)',
  'Fianza recibida',
  'Devolución de fianza',
  'Otros ingresos',
] as const

export const CATEGORIAS_GASTO_PERSONAL = [
  'Vivienda',
  'Suministros',
  'Comida',
  'Transporte',
  'Salud',
  'Seguros',
  'Ocio',
  'Suscripciones',
  'Ropa y cuidado',
  'Educación',
  'Impuestos',
  'Familia',
  'Otros',
  'Ahorro e inversión',
  'Devolución de deuda',
] as const

export const CATEGORIAS_INGRESO_PERSONAL = [
  'Nómina',
  'Autónomo / facturas',
  'Intereses',
  'Otros ingresos',
] as const

/** No entran en el gasto de vida que se propone a Fuck You Money. */
export const CATEGORIAS_PERSONAL_FUERA_DE_VIDA = ['Ahorro e inversión', 'Devolución de deuda'] as const

export const DESTINOS = ['pendiente', 'finca', 'personal', 'traspaso', 'ignorar'] as const
export type Destino = (typeof DESTINOS)[number]

export const DESTINO_LABEL: Record<Destino, string> = {
  pendiente: 'Pendiente',
  finca: 'Finca',
  personal: 'Personal',
  traspaso: 'Traspaso',
  ignorar: 'Ignorar',
}

export const TIPOS_CUENTA = ['corriente', 'ahorro', 'remunerada', 'nomina', 'otro'] as const
export type TipoCuenta = (typeof TIPOS_CUENTA)[number]

/** Efectivo de Fuck You Money que es una cuenta de banco. `otro` no entra. */
export const TIPOS_CUENTA_BANCARIA = ['corriente', 'ahorro', 'remunerada', 'nomina'] as const

export function esCuentaBancaria(tipo: string | null | undefined): tipo is (typeof TIPOS_CUENTA_BANCARIA)[number] {
  return (TIPOS_CUENTA_BANCARIA as readonly string[]).includes(tipo ?? '')
}

export const TIPO_CUENTA_LABEL: Record<TipoCuenta, string> = {
  corriente: 'Corriente',
  ahorro: 'Ahorro',
  remunerada: 'Remunerada',
  nomina: 'Nómina',
  otro: 'Otra',
}

export function esDestino(value: string): value is Destino {
  return (DESTINOS as readonly string[]).includes(value)
}

export function esTipoCuenta(value: string): value is TipoCuenta {
  return (TIPOS_CUENTA as readonly string[]).includes(value)
}

export function categoriaVida(categoria: string): boolean {
  return (
    (CATEGORIAS_GASTO_PERSONAL as readonly string[]).includes(categoria) &&
    !(CATEGORIAS_PERSONAL_FUERA_DE_VIDA as readonly string[]).includes(categoria)
  )
}
