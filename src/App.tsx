import { useCallback, useEffect, useRef, useState } from 'react'
import type { CatalogoJson, ImportacionJson, ResumenJson } from '../shared/api'
import { ACCEPT_FICHEROS } from '../shared/formatos'
import { api, esSesion } from './api'
import { Bandeja } from './Bandeja'
import { Cuentas } from './Cuentas'
import { Finca } from './Exportar'
import { Registro } from './Registro'

type Tab = 'apuntes' | 'cuentas' | 'registro' | 'finca'

export function App() {
  const [tab, setTab] = useState<Tab>('apuntes')
  const [resumen, setResumen] = useState<ResumenJson | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [pedirClave, setPedirClave] = useState(false)
  const [clave, setClave] = useState('')
  const [notas, setNotas] = useState<string[]>([])
  const catalogoPedido = useRef(false)

  const fallar = useCallback((err: unknown, reserva: string) => {
    if (esSesion(err)) {
      setPedirClave(true)
      setError(null)
      return
    }
    setError(err instanceof Error ? err.message : reserva)
  }, [])

  const cargar = useCallback(async () => {
    try {
      setResumen(await api<ResumenJson>('/api/resumen'))
      setError(null)
      setPedirClave(false)
    } catch (err) {
      fallar(err, 'No llego a la API. Arranca con npm run dev.')
    }
  }, [fallar])

  useEffect(() => {
    void cargar()
  }, [cargar])

  useEffect(() => {
    if (!resumen || pedirClave || catalogoPedido.current) return
    catalogoPedido.current = true
    void api<CatalogoJson>('/api/catalogos', { method: 'POST' })
      .then(async (r) => {
        const textos = [...r.errores, ...r.avisos]
        if (textos.length) setNotas((prev) => [...textos, ...prev])
        await cargar()
      })
      .catch((err) => fallar(err, 'No he podido traer las cuentas de Fuck You Money'))
  }, [resumen, pedirClave, cargar, fallar])

  function textosDe(resultado: ImportacionJson): string[] {
    return [...resultado.notas, ...resultado.errores.map((item) => `${item.nombre}: ${item.error}`)]
  }

  async function leerInbox() {
    setLeyendo(true)
    try {
      const resultado = await api<ImportacionJson>('/api/importar', { method: 'POST' })
      setNotas(textosDe(resultado))
      await cargar()
    } catch (err) {
      fallar(err, 'No he podido leer la carpeta')
    } finally {
      setLeyendo(false)
    }
  }

  async function subir(files: FileList | null) {
    if (!files?.length) return
    setLeyendo(true)
    try {
      const textos: string[] = []
      for (const file of files) {
        const resultado = await api<ImportacionJson>('/api/subir', {
          method: 'POST',
          headers: { 'x-filename': file.name },
          body: await file.arrayBuffer(),
        })
        textos.push(...textosDe(resultado))
      }
      setNotas(textos)
      await cargar()
    } catch (err) {
      fallar(err, 'No he podido guardar el fichero')
    } finally {
      setLeyendo(false)
    }
  }

  async function entrar(e: { preventDefault: () => void }) {
    e.preventDefault()
    setError(null)
    try {
      await api('/api/entrar', { method: 'POST', body: JSON.stringify({ clave }) })
      setClave('')
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No he podido entrar')
    }
  }

  const sueltos = resumen?.archivos.filter((a) => !a.cuentaId || a.error) ?? []
  const enLaWeb = Boolean(resumen?.nube)

  if (pedirClave) {
    return (
      <div className="app">
        <header>
          <h1>Extractos</h1>
          <p>El libro de los extractos. Hace falta la clave para ver saldos y escribir en Finca.</p>
        </header>
        <form className="form" onSubmit={(e) => void entrar(e)}>
          <input type="password" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="Clave" autoFocus required />
          <button type="submit">Entrar</button>
        </form>
        {error && <p className="error">{error}</p>}
      </div>
    )
  }

  return (
    <div className="app">
      <header>
        <h1>Extractos</h1>
        <p>
          {enLaWeb
            ? 'Elige el extracto y asígnalo a una cuenta de Fuck You Money. Los apuntes se puntean en Apuntes: si son de un piso, se escriben en Finca. El saldo queda aquí, sin cambiar Fuck You Money.'
            : 'Deja los extractos en la carpeta inbox o elígelos aquí. Asígnale una cuenta de Fuck You Money y puntea los apuntes en Apuntes. Si son de un piso, se escriben en Finca.'}
        </p>
      </header>

      {error && <p className="error">{error}</p>}
      {notas.length > 0 && (
        <div className="aviso">
          {notas.map((nota) => (
            <div key={nota}>{nota}</div>
          ))}
        </div>
      )}

      <div className="acciones">
        {!enLaWeb && (
          <button type="button" onClick={() => void leerInbox()} disabled={leyendo}>
            {leyendo ? 'Leyendo…' : 'Leer inbox'}
          </button>
        )}
        <label className="sec" style={{ border: '1px solid #d9d0c3', borderRadius: 6, padding: '0.35rem 0.55rem', background: '#fffdf8' }}>
          {leyendo ? 'Leyendo…' : 'Elegir ficheros'}
          <input
            type="file"
            multiple
            accept={ACCEPT_FICHEROS}
            hidden
            onChange={(e) => {
              void subir(e.target.files)
              e.target.value = ''
            }}
          />
        </label>
        <span className="meta">CSV, Excel, PDF o Norma 43. Si el extracto pisa días ya vistos, esos apuntes no se repiten.</span>
        {resumen && !enLaWeb && <span className="meta"><code>{resumen.rutas.inbox}</code></span>}
      </div>

      {sueltos.length > 0 && resumen && (
        <div className="aviso">
          {sueltos.map((a) => (
            <div key={a.id} className="entre">
              <div>
                <strong>{a.nombre}</strong>
                <div className="meta">
                  {a.error ||
                    a.avisos ||
                    (a.guardado
                      ? resumen.cuentas.length
                        ? `${a.leidos} apuntes leídos. Elige la cuenta. Luego se puntean en Apuntes.`
                        : `${a.leidos} apuntes leídos. Aún no hay cuentas bancarias de Fuck You Money.`
                      : `${a.leidos} apuntes leídos, pero el fichero no quedó guardado. Vuelve a elegirlo. Lo que ya esté en el libro no se duplica.`)}
                </div>
              </div>
              <div className="acciones">
                {!a.error && (
                  <select
                    defaultValue=""
                    onChange={(e) => {
                      const cuentaId = e.target.value
                      if (!cuentaId) return
                      void api(`/api/archivos/${a.id}/cuenta`, {
                        method: 'POST',
                        body: JSON.stringify({ cuentaId }),
                      })
                        .then(async () => {
                          setTab('apuntes')
                          setNotas((prev) => ['Extracto asignado. Los apuntes están en Apuntes para puntearlos.', ...prev])
                          await cargar()
                        })
                        .catch((err) => fallar(err, 'No he podido asignar la cuenta'))
                    }}
                  >
                    <option value="">Asignar a una cuenta</option>
                    {resumen.cuentas.map((c) => (
                      <option key={c.id} value={c.id}>{c.nombre}</option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  className="sec"
                  onClick={() =>
                    void api(`/api/archivos/${a.id}`, { method: 'DELETE' })
                      .then(cargar)
                      .catch((err) => fallar(err, 'No he podido quitar el extracto'))
                  }
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <nav className="tabs">
        <button type="button" className={tab === 'apuntes' ? 'on' : ''} onClick={() => setTab('apuntes')}>
          Apuntes{resumen ? ` (${resumen.recuento.pendiente})` : ''}
        </button>
        <button type="button" className={tab === 'cuentas' ? 'on' : ''} onClick={() => setTab('cuentas')}>Cuentas</button>
        <button type="button" className={tab === 'registro' ? 'on' : ''} onClick={() => setTab('registro')}>Registro</button>
        <button type="button" className={tab === 'finca' ? 'on' : ''} onClick={() => setTab('finca')}>Finca</button>
      </nav>

      {resumen && tab === 'apuntes' && <Bandeja resumen={resumen} onChange={cargar} />}
      {resumen && tab === 'cuentas' && <Cuentas resumen={resumen} onChange={cargar} />}
      {resumen && tab === 'registro' && <Registro cuentas={resumen.cuentas} />}
      {resumen && tab === 'finca' && <Finca />}
    </div>
  )
}
