import { useEffect, useState } from 'react'
import type { CoincidenciaJson, MovimientoJson, ResumenJson } from '../shared/api'
import { DESTINO_LABEL, DESTINOS, type Destino } from '../shared/categorias'
import { categoriasPara, sugerirPatron } from '../shared/clasificar'
import { textoEur, textoFecha } from '../shared/formato'
import { centimosDesdeTexto } from '../shared/money'
import { api } from './api'

export function Bandeja({ resumen, onChange }: { resumen: ResumenJson; onChange: () => Promise<void> }) {
  const [destino, setDestino] = useState('abiertos')
  const [q, setQ] = useState('')
  const [movs, setMovs] = useState<MovimientoJson[]>([])
  const [error, setError] = useState<string | null>(null)
  const [sel, setSel] = useState<string[]>([])
  const [propiedadBulk, setPropiedadBulk] = useState('')
  const [categoriaBulk, setCategoriaBulk] = useState('')
  const [recordarBulk, setRecordarBulk] = useState(false)
  const [patronBulk, setPatronBulk] = useState('')
  const [vistaBulk, setVistaBulk] = useState<CoincidenciaJson[] | null>(null)

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
          : destino === 'abiertos'
            ? 'No hay apuntes pendientes ni dudas. Si ya los clasificaste, cambia el filtro.'
            : destino === 'pendiente'
              ? 'No hay apuntes pendientes. Si ya los clasificaste, cambia el filtro.'
              : 'No hay apuntes en esta vista.'

  const elegidos = movs.filter((m) => sel.includes(m.id))
  const signos = new Set(elegidos.map((m) => Math.sign(m.importeCentimos)))
  const mezclados = signos.size > 1
  const opcionesBulk = elegidos[0] ? categoriasPara('finca', elegidos[0].importeCentimos) : []

  async function conciliarSeleccion() {
    setError(null)
    try {
      await api('/api/movimientos', {
        method: 'POST',
        body: JSON.stringify({
          ids: elegidos.map((m) => m.id),
          destino: 'finca',
          categoriaFinca: categoriaBulk,
          propiedadId: propiedadBulk,
          recordar: recordarBulk,
          patron: patronBulk || undefined,
        }),
      })
      setSel([])
      setVistaBulk(null)
      await onChange()
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha conciliado la selección')
    }
  }

  async function prepararSeleccion() {
    if (!recordarBulk) {
      await conciliarSeleccion()
      return
    }
    setError(null)
    try {
      const vista = await api<{ coincidencias: CoincidenciaJson[] }>('/api/reglas/vista', {
        method: 'POST',
        body: JSON.stringify({
          destino: 'finca',
          categoriaFinca: categoriaBulk,
          propiedadId: propiedadBulk,
          patron: patronBulk,
        }),
      })
      setVistaBulk(vista.coincidencias)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No he podido ver la regla')
    }
  }

  return (
    <section className="panel">
      <p className="meta">Los apuntes del extracto se puntean aquí. Una regla solo se guarda cuando confirmas a qué pendientes llega.</p>
      <div className="controles">
        <select value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Filtro">
          <option value="abiertos">Abiertos</option>
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
      {elegidos.length > 0 && (
        <div className="aviso">
          <p>{elegidos.length === 1 ? '1 apunte seleccionado.' : `${elegidos.length} apuntes seleccionados.`}</p>
          {mezclados && <p>Selecciona solo cargos o solo abonos.</p>}
          {!mezclados && (
            <div className="controles">
              <select value={propiedadBulk} onChange={(e) => setPropiedadBulk(e.target.value)} aria-label="Propiedad de la selección">
                <option value="">Propiedad</option>
                {resumen.propiedades.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
              <select value={categoriaBulk} onChange={(e) => setCategoriaBulk(e.target.value)} aria-label="Categoría de la selección">
                <option value="">Categoría</option>
                {opcionesBulk.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <label className="check">
                <input
                  type="checkbox"
                  checked={recordarBulk}
                  onChange={(e) => {
                    setRecordarBulk(e.target.checked)
                    setVistaBulk(null)
                    if (e.target.checked && !patronBulk && elegidos[0]) setPatronBulk(sugerirPatron(elegidos[0].concepto))
                  }}
                />
                Recordar un concepto
              </label>
              {recordarBulk && (
                <input value={patronBulk} onChange={(e) => setPatronBulk(e.target.value)} aria-label="Concepto de la selección" placeholder="Concepto" />
              )}
              <button type="button" onClick={() => void prepararSeleccion()}>
                {recordarBulk ? 'Ver a quién llega' : 'Conciliar selección'}
              </button>
              <button type="button" className="sec" onClick={() => { setSel([]); setVistaBulk(null) }}>Quitar selección</button>
            </div>
          )}
          {vistaBulk && (
            <div>
              {vistaBulk.length === 0 ? (
                <p>Ningún apunte pendiente coincide con este concepto.</p>
              ) : (
                vistaBulk.map((c) => (
                  <div key={c.id} className="meta">
                    {textoFecha(c.fecha)} · {c.cuentaNombre} · {c.concepto} · {textoEur(c.importeCentimos)}
                  </div>
                ))
              )}
              <div className="controles">
                <button type="button" onClick={() => void conciliarSeleccion()}>Guardar y aplicar</button>
                <button type="button" className="sec" onClick={() => setVistaBulk(null)}>Cancelar</button>
              </div>
            </div>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
      {movs.length === 0 && <p className="meta">{vacio}</p>}
      {movs.map((m) => (
        <Fila
          key={`${m.id}-${m.destino}-${m.categoriaFinca}-${m.propiedadId}-${m.fincaSincronizadoEn ?? ''}-${m.fincaError ?? ''}-${m.repartos.map((r) => r.id).join(',')}-${m.sugerencia?.patron ?? ''}`}
          mov={m}
          resumen={resumen}
          seleccionado={sel.includes(m.id)}
          onToggle={() => setSel((prev) => (prev.includes(m.id) ? prev.filter((id) => id !== m.id) : [...prev, m.id]))}
          onSaved={async () => {
            await onChange()
            await cargar()
          }}
        />
      ))}
      {resumen.reglas.length > 0 && (
        <>
          <h2 style={{ marginTop: '1.4rem' }}>Reglas</h2>
          <p className="meta">Al entrar un extracto nuevo, la regla se sugiere. No se escribe en Finca hasta que la aceptas.</p>
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

function Fila({
  mov,
  resumen,
  seleccionado,
  onToggle,
  onSaved,
}: {
  mov: MovimientoJson
  resumen: ResumenJson
  seleccionado: boolean
  onToggle: () => void
  onSaved: () => Promise<void>
}) {
  const [categoria, setCategoria] = useState(mov.categoriaFinca || mov.sugerencia?.categoriaFinca || '')
  const [propiedadId, setPropiedadId] = useState(mov.propiedadId || mov.sugerencia?.propiedadId || '')
  const [patron, setPatron] = useState(mov.sugerencia?.patron || sugerirPatron(mov.concepto))
  const [nota, setNota] = useState(mov.nota)
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [vista, setVista] = useState<CoincidenciaJson[] | null>(null)
  const [partiendo, setPartiendo] = useState(false)
  const mitad = Math.trunc(mov.importeCentimos / 2)
  const [importeA, setImporteA] = useState(textoEur(mitad))
  const [importeB, setImporteB] = useState(textoEur(mov.importeCentimos - mitad))
  const [propA, setPropA] = useState('')
  const [propB, setPropB] = useState('')
  const [catA, setCatA] = useState('')
  const [catB, setCatB] = useState('')
  const opciones = categoriasPara('finca', mov.importeCentimos)
  const propiedad = resumen.propiedades.find((p) => p.id === mov.propiedadId)
  const nombreSugerido = mov.sugerencia?.propiedadNombre

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
      setVista(null)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha guardado')
    } finally {
      setGuardando(false)
    }
  }

  async function previsualizar() {
    setGuardando(true)
    setError(null)
    try {
      const r = await api<{ coincidencias: CoincidenciaJson[] }>('/api/reglas/vista', {
        method: 'POST',
        body: JSON.stringify({
          destino: 'finca',
          categoriaFinca: categoria,
          propiedadId,
          patron,
        }),
      })
      setVista(r.coincidencias)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No he podido ver la regla')
    } finally {
      setGuardando(false)
    }
  }

  async function partir() {
    const a = centimosDesdeTexto(importeA)
    const b = centimosDesdeTexto(importeB)
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      setError('Escribe los dos importes como en el extracto, por ejemplo -12,40')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      await api(`/api/movimientos/${mov.id}/repartir`, {
        method: 'POST',
        body: JSON.stringify({
          partes: [
            { propiedadId: propA, categoriaFinca: catA, importeCentimos: a },
            { propiedadId: propB, categoriaFinca: catB, importeCentimos: b },
          ],
        }),
      })
      setPartiendo(false)
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha partido')
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
  const textoSugerencia = mov.sugerencia
    ? mov.sugerencia.propiedadNombre
      ? `Esto parece ${mov.sugerencia.categoriaFinca || 'un apunte'} de ${nombreSugerido}.`
      : `Esto parece ${mov.sugerencia.categoriaPersonal || mov.sugerencia.categoriaFinca || 'un apunte'}.`
    : ''

  return (
    <article className="mov">
      <div className="mov-top">
        <div>
          <div className="concepto">
            <label>
              <input type="checkbox" checked={seleccionado} onChange={onToggle} aria-label={`Seleccionar ${mov.concepto}`} />{' '}
              {mov.concepto}
            </label>
          </div>
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
      {mov.repartos.length > 0 && (
        <p className="meta">
          Partido:{' '}
          {mov.repartos.map((p) => `${p.propiedadNombre ?? 'propiedad'} · ${p.categoriaFinca} · ${textoEur(p.importeCentimos)}`).join(' / ')}
        </p>
      )}
      {mov.sugerencia && (mov.destino === 'pendiente' || mov.destino === 'duda') && (
        <div className="aviso">
          <span>{textoSugerencia}</span>{' '}
          <button
            type="button"
            disabled={guardando}
            onClick={() =>
              void guardar({
                destino: mov.sugerencia!.destino,
                categoriaFinca: mov.sugerencia!.categoriaFinca,
                propiedadId: mov.sugerencia!.propiedadId,
              })
            }
          >
            Aceptar
          </button>
        </div>
      )}
      {mov.traspasoSugerido && (mov.destino === 'pendiente' || mov.destino === 'duda') && (
        <p className="meta">
          Parece un traspaso con {mov.traspasoSugerido.cuentaNombre} el {textoFecha(mov.traspasoSugerido.fecha)} ({textoEur(mov.traspasoSugerido.importeCentimos)}).
        </p>
      )}
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
        <button type="button" disabled={guardando} onClick={() => void previsualizar()}>
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
        <button type="button" className="sec" disabled={guardando} onClick={() => void guardar({ destino: 'duda' })}>
          No lo sé
        </button>
        {mov.destino !== 'pendiente' && (
          <button type="button" className="sec" disabled={guardando} onClick={() => void guardar({ destino: 'pendiente' })}>
            Volver a pendiente
          </button>
        )}
        <button type="button" className="sec" disabled={guardando} onClick={() => setPartiendo((v) => !v)}>
          Partir en dos
        </button>
      </div>
      {vista && (
        <div className="aviso">
          {vista.length === 0 ? (
            <p>Ningún apunte pendiente coincide con este concepto.</p>
          ) : (
            <>
              <p>Estos apuntes pendientes pasarían a la propiedad:</p>
              {vista.map((c) => (
                <div key={c.id} className="meta">
                  {textoFecha(c.fecha)} · {c.cuentaNombre} · {c.concepto} · {textoEur(c.importeCentimos)}
                </div>
              ))}
            </>
          )}
          <div className="controles">
            <button
              type="button"
              disabled={guardando}
              onClick={() =>
                void guardar({
                  destino: 'finca',
                  categoriaFinca: categoria,
                  propiedadId,
                  recordar: true,
                  patron,
                })
              }
            >
              Guardar y aplicar
            </button>
            <button type="button" className="sec" onClick={() => setVista(null)}>Cancelar</button>
          </div>
        </div>
      )}
      {partiendo && (
        <div className="controles">
          <select value={propA} onChange={(e) => setPropA(e.target.value)} aria-label="Primera propiedad">
            <option value="">Propiedad</option>
            {resumen.propiedades.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <select value={catA} onChange={(e) => setCatA(e.target.value)} aria-label="Primera categoría">
            <option value="">Categoría</option>
            {opciones.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input value={importeA} onChange={(e) => setImporteA(e.target.value)} aria-label="Importe de la primera parte" />
          <select value={propB} onChange={(e) => setPropB(e.target.value)} aria-label="Segunda propiedad">
            <option value="">Propiedad</option>
            {resumen.propiedades.map((p) => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </select>
          <select value={catB} onChange={(e) => setCatB(e.target.value)} aria-label="Segunda categoría">
            <option value="">Categoría</option>
            {opciones.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input value={importeB} onChange={(e) => setImporteB(e.target.value)} aria-label="Importe de la segunda parte" />
          <button type="button" disabled={guardando} onClick={() => void partir()}>Guardar el reparto</button>
        </div>
      )}
      {resumen.propiedades.length === 0 && (
        <p className="meta">Trae las propiedades de Finca en la pestaña Cuentas. Una añadida a mano no se puede escribir allí.</p>
      )}
      {error && <p className="error">{error}</p>}
    </article>
  )
}
