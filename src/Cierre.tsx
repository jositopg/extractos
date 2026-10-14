import { useEffect, useState } from 'react'
import type { ArchivoJson, CuentaJson, RegistroJson } from '../shared/api'
import { textoEur, textoFecha } from '../shared/formato'
import { hoyLocal } from '../shared/money'
import { api } from './api'

export function Cierre({
  cuenta,
  archivo,
  onClose,
}: {
  cuenta: CuentaJson
  archivo: ArchivoJson
  onClose: () => void
}) {
  const mes = (archivo.hasta || hoyLocal()).slice(0, 7)
  const [avisos, setAvisos] = useState<string[]>([])

  useEffect(() => {
    void api<RegistroJson>(`/api/registro?mes=${mes}`)
      .then((datos) => setAvisos(datos.avisos))
      .catch(() => setAvisos([]))
  }, [mes])

  return (
    <section className="panel" style={{ marginBottom: '1rem' }}>
      <h2>Cierre de {cuenta.nombre}</h2>
      <p className="meta">{archivo.nombre}. Copia este saldo en Fuck You Money cuando lo actualices a mano.</p>
      <div className="numeros">
        <div>
          <strong>{textoEur(cuenta.saldoCentimos)}</strong>
          <span>Saldo del extracto{cuenta.fechaSaldo ? ` a ${textoFecha(cuenta.fechaSaldo)}` : ''}</span>
        </div>
        <div>
          <strong>{textoEur(cuenta.fymValorCentimos)}</strong>
          <span>Declarado en Fuck You Money</span>
        </div>
        <div>
          <strong>{textoEur(cuenta.diferenciaCentimos)}</strong>
          <span>Diferencia</span>
        </div>
        <div>
          <strong>{cuenta.pendientes}</strong>
          <span>Sin puntear en esta cuenta</span>
        </div>
      </div>
      {archivo.avisos && <p className="aviso">{archivo.avisos}</p>}
      {avisos.map((aviso) => (
        <p key={aviso} className="aviso">{aviso}</p>
      ))}
      <button type="button" className="sec" onClick={onClose}>Seguir punteando</button>
    </section>
  )
}
