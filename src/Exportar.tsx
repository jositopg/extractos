import { useEffect, useState } from 'react'
import type { EstadoFincaJson } from '../shared/api'
import { textoFecha } from '../shared/formato'
import { api } from './api'

export function Finca() {
  const [datos, setDatos] = useState<EstadoFincaJson | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function cargar() {
    setDatos(await api<EstadoFincaJson>('/api/finca'))
  }

  useEffect(() => {
    void cargar().catch((err) => setError(err instanceof Error ? err.message : 'No he podido leer el estado'))
  }, [])

  async function reintentar() {
    setOcupado(true)
    setError(null)
    setAviso(null)
    try {
      const siguiente = await api<EstadoFincaJson>('/api/finca', { method: 'POST' })
      setDatos(siguiente)
      setAviso(siguiente.errores.length === 0 ? 'Finca está al día.' : 'Siguen quedando apuntes sin escribir.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No he podido escribir en Finca')
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className="panel">
      <p>
        Al conciliar un apunte con una propiedad se escribe en Finca. Si vuelves a traer un extracto y el concepto coincide, entra en la misma propiedad. Fuck You Money no se toca.
      </p>
      {datos && (
        <div className="numeros">
          <div><strong>{datos.escritos}</strong><span>En Finca</span></div>
          <div><strong>{datos.pendientes}</strong><span>Sin escribir</span></div>
          <div><strong>{datos.errores.length}</strong><span>Con error</span></div>
        </div>
      )}
      <div className="acciones">
        <button type="button" disabled={ocupado} onClick={() => void reintentar()}>
          {ocupado ? 'Escribiendo…' : 'Reintentar en Finca'}
        </button>
      </div>
      {aviso && <p className="meta">{aviso}</p>}
      {error && <p className="error">{error}</p>}
      {datos && datos.errores.length > 0 && (
        <>
          <h2>Sin escribir</h2>
          {datos.errores.map((e) => (
            <div key={e.id} className="meta">
              {textoFecha(e.fecha)} · {e.concepto}: {e.error}
            </div>
          ))}
        </>
      )}
    </section>
  )
}
