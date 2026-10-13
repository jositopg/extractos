export type FilaFinca = {
  id: string
  propiedadId: string
  fecha: string
  tipo: 'ingreso' | 'gasto'
  importe: string
  categoria: string
  descripcion: string
  referencia: string
}

/** Euros con dos decimales, sin redondeo de coma flotante. El signo no entra: en Finca el tipo lo dice. */
export function eurosExactos(centimos: number): string {
  const abs = Math.abs(Math.round(centimos))
  return `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

export function descripcionFinca(concepto: string, categoria: string): string {
  const limpio = concepto.replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim()
  return (limpio || categoria).slice(0, 500)
}

export function filaFinca(input: {
  id: string
  movimientoId: string
  propiedadId: string
  fecha: string
  importeCentimos: number
  categoria: string
  concepto: string
}): FilaFinca {
  return {
    id: input.id,
    propiedadId: input.propiedadId,
    fecha: input.fecha,
    tipo: input.importeCentimos >= 0 ? 'ingreso' : 'gasto',
    importe: eurosExactos(input.importeCentimos),
    categoria: input.categoria,
    descripcion: descripcionFinca(input.concepto, input.categoria),
    referencia: `extractos:${input.movimientoId}`,
  }
}

export function firmaFila(fila: FilaFinca): string {
  return [fila.propiedadId, fila.fecha, fila.tipo, fila.importe, fila.categoria, fila.descripcion, fila.referencia].join('\u001f')
}

export function propiedadLocal(id: string): boolean {
  return id.startsWith('local-')
}
