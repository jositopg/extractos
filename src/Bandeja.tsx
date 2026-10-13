import { useEffect, useState } from 'react'
import type { MovimientoJson, ResumenJson } from '../shared/api'
import { DESTINO_LABEL, DESTINOS, type Destino } from '../shared/categorias'
import { categoriasPara, sugerirPatron } from '../shared/clasificar'
import { api } from './api'
import { textoEur, textoFecha } from '../shared/formato'

export function Bandeja({ resumen, onChange }: { resumen: ResumenJson; onChange: () => Promise<void> }) {
  const [destino, setDestino] = useState<string>('pendiente')
  const [q, setQ] = useState('')
  const [movs, setMovs] = useState<MovimientoJson[]>([])
  const [error, setError] = useState<string | null>(null)

  async function cargar(filtroDestino = destino, query = q) {
    const params = new URLSearchParams()
    if (filtroDestino) params.set('destino', filtroDestino)
    if (query) params.set('q', query)
    setMovs(await api<MovimientoJson[]>(`/api/movimientos?${params}`))
  }

  useEffect(() => {
    void cargar(destino, q).catch((err) => setError(err instanceof Error ? err.message : 'No he podido cargar'))
    // La bandeja se refresca al cambiar el filtro. El texto de búsqueda va con el botón.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destino, resumen.recuento.pendiente, resumen.recuento.clasificado])

  const sinCuenta = resumen.archivos.some((a) => !a.cuentaId && !a.error && a.guardado)
  const sinGuardar = resumen.archivos.some((a) => !a.cuentaId && !a.error && !a.guardado)
  const vacio =
    sinGuardar && sinCuenta
      ? 'Hay un extracto sin guardar y otro sin cuenta. Vuelve a elegir el que no quedó, y asigna el otro arriba. Los apuntes para puntear salen aquí.'
      : sinGuardar
        ? 'Ese extracto no quedó guardado. Vuelve a elegirlo arriba. Lo que ya esté en el libro no se duplica. Los apuntes para puntear salen aquí.'
        : sinCuenta
          ? 'El extracto todavía no tiene cuenta. Elígelo arriba, en el aviso. Los apuntes para puntear salen aquí.'
          : destino === 'pendiente'
            ? 'No hay apuntes pendientes. Si ya los clasificaste, cambia el filtro.'
            : 'No hay apuntes en esta vista.'

  return (
    <section className="panel">
      <p className="meta">Los apuntes del extracto se puntean aquí.</p>
      <div className="controles">
        <select value={destino} onChange={(e) => setDestino(e.target.value)}>
          {DESTINOS.map((d) => (
            <option key={d} value={d}>{DESTINO_LABEL[d]}</option>
          ))}
          <option value="">Todos</option>
        </select>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar concepto" />
        <button type="button" className="sec" onClick={() => void cargar().catch((err) => setError(String(err)))}>
          Buscar
        </button>
      </div>
      {error && <p className="error">{error}</p>}
      {movs.length === 0 && <p className="meta">{vacio}</p>}
      {movs.map((m) => (
        <Fila key={`${m.id}-${m.destino}-${m.categoriaFinca}-${m.propiedadId}-${m.fincaSincronizadoEn ?? ''}-${m.fincaError ?? ''}`} mov={m} resumen={resumen} onSaved={async () => { await onChange(); await cargar() }} />
      ))}
      {resumen.reglas.length > 0 && (
        <>
          <h2 style={{ marginTop: '1.4rem' }}>Reglas</h2>
          {resumen.reglas.map((r) => (
            <div key={r.id} className="entre">
              <span><strong>{r.patron}</strong> <span className="meta">→ {DESTINO_LABEL[r.destino]} {r.categoriaFinca || r.categoriaPersonal || ''}</span></span>
              <button type="button" className="sec" onClick={() => void api(`/api/reglas/${r.id}`, { method: 'DELETE' }).then(onChange)}>
                Borrar
              </button>
            </div>
          ))}
        </>
      )}
    </section>
  )
}

function Fila({ mov, resumen, onSaved }: { mov: MovimientoJson; resumen: ResumenJson; onSaved: () => Promise<void> }) {
  const [categoria, setCategoria] = useState(mov.categoriaFinca || '')
  const [propiedadId, setPropiedadId] = useState(mov.propiedadId || '')
  const [patron, setPatron] = useState(sugerirPatron(mov.concepto))
  const [nota, setNota] = useState(mov.nota)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const opciones = categoriasPara('finca', mov.importeCentimos)
  const propiedad = resumen.propiedades.find((p) => p.id === mov.propiedadId)

  async function guardar(body: {
    destino: Destino
    categoriaFinca?: string | null
    propiedadId?: string | null
    recordar?: boolean
    patron?: string
  }) {
    setGuardando(true)
    setError(null)
    try {
      await api(`/api/movimientos/${mov.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ ...body, nota }),
      })
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha guardado')
    } finally {
      setGuardando(false)
    }
  }

  const estado = mov.fincaError
    ? mov.fincaError
    : mov.fincaSincronizadoEn
      ? 'en Finca'
      : mov.destino === 'finca'
        ? 'pendiente de escribir en Finca'
        : ''

  return (
    <article className="mov">
      <div className="mov-top">
        <div>
          <div className="concepto">{mov.concepto}</div>
          <div className="meta">
            {textoFecha(mov.fecha)} · {mov.cuentaNombre}
            {mov.destino !== 'pendiente' ? ` · ${DESTINO_LABEL[mov.destino]}` : ''}
            {propiedad ? ` · ${propiedad.nombre}` : ''}
            {mov.categoriaFinca ? ` · ${mov.categoriaFinca}` : ''}
            {estado && !mov.fincaError ? ` · ${estado}` : ''}
          </div>
        </div>
        <div className={mov.importeCentimos >= 0 ? 'importe entra' : 'importe sale'}>{textoEur(mov.importeCentimos)}</div>
      </div>
      {mov.fincaError && <p className="error">{mov.fincaError}</p>}
      <div className="controles">
        <select value={propiedadId} onChange={(e) => setPropiedadId(e.target.value)} aria-label="Propiedad">
          <option value="">Propiedad</option>
          {resumen.propiedades.map((p) => (
            <option key={p.id} value={p.id}>{p.nombre}{p.origen === 'manual' ? ' (solo aquí)' : ''}</option>
          ))}
        </select>
        <select value={categoria} onChange={(e) => setCategoria(e.target.value)} aria-label="Categoría de Finca">
          <option value="">Categoría</option>
          {opciones.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <input type="text" value={patron} onChange={(e) => setPatron(e.target.value)} aria-label="Concepto que se recordará" />
        <input type="text" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota" />
        <button
          type="button"
          disabled={guardando}
          onClick={() => void guardar({
            destino: 'finca',
            categoriaFinca: categoria,
            propiedadId,
            recordar: true,
            patron,
          })}
        >
          Conciliar con la propiedad
        </button>
        <button
          type="button"
          className="sec"
          disabled={guardando}
          onClick={() => void guardar({ destino: 'finca', categoriaFinca: categoria, propiedadId })}
        >
          Solo este apunte
        </button>
        <button type="button" className="sec" disabled={guardando} onClick={() => void guardar({ destino: 'traspaso' })}>
          Es un traspaso
        </button>
        <button type="button" className="sec" disabled={guardando} onClick={() => void guardar({ destino: 'ignorar' })}>
          No es de una propiedad
        </button>
      </div>
      {resumen.propiedades.length === 0 && (
        <p className="meta">Trae las propiedades de Finca en la pestaña Cuentas. Una añadida a mano no se puede escribir allí.</p>
      )}
      {error && <p className="error">{error}</p>}
    </article>
  )
}
