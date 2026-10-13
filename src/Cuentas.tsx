import { useState, type FormEvent } from 'react'
import type { CatalogoJson, CuentaJson, ResumenJson } from '../shared/api'
import { TIPO_CUENTA_LABEL, TIPOS_CUENTA, type TipoCuenta } from '../shared/categorias'
import { textoEur, textoFecha } from '../shared/formato'
import { api } from './api'

export function Cuentas({ resumen, onChange }: { resumen: ResumenJson; onChange: () => Promise<void> }) {
  const [nombre, setNombre] = useState('')
  const [banco, setBanco] = useState('')
  const [alias, setAlias] = useState('')
  const [iban, setIban] = useState('')
  const [tipo, setTipo] = useState<TipoCuenta>('corriente')
  const [fymAssetId, setFymAssetId] = useState('')
  const [enFym, setEnFym] = useState(false)
  const [propiedad, setPropiedad] = useState('')
  const [mensaje, setMensaje] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function crear(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await api<CuentaJson>('/api/cuentas', {
        method: 'POST',
        body: JSON.stringify({ nombre, banco, alias, iban, tipo, fymAssetId: fymAssetId || null, enFym }),
      })
      setNombre('')
      setAlias('')
      setIban('')
      await onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha creado')
    }
  }

  async function catalogos() {
    setMensaje(null)
    setError(null)
    try {
      const r = await api<CatalogoJson>('/api/catalogos', { method: 'POST' })
      const partes = [
        r.propiedades != null ? `${r.propiedades} propiedades de Finca` : null,
        r.fymCuentas != null ? `${r.fymCuentas} cuentas bancarias de Fuck You Money` : null,
        ...r.avisos,
      ].filter(Boolean)
      setMensaje(partes.join('. '))
      if (r.errores.length) setError(r.errores.join(' '))
      await onChange()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No he podido conectar')
    }
  }

  return (
    <section className="panel">
      <div className="acciones">
        <button type="button" onClick={() => void catalogos()}>Traer propiedades y cuentas</button>
        <span className="meta">Lee Finca y las cuentas bancarias de Fuck You Money. No cambia Fuck You Money. Al abrir Extractos ya se traen solas.</span>
      </div>
      {mensaje && <p className="meta">{mensaje}</p>}
      {error && <p className="error">{error}</p>}

      {resumen.cuentas.length === 0 && (
        <p>Todavía no hay cuentas. Las bancarias de Fuck You Money aparecen solas al traer el catálogo.</p>
      )}
      {resumen.cuentas.map((c) => (
        <article key={c.id} className="cuenta">
          <div>
            <div className="concepto">{c.nombre}</div>
            <div className="meta">
              {TIPO_CUENTA_LABEL[c.tipo]}
              {c.banco ? ` · ${c.banco}` : ''}
              {c.alias ? ` · alias ${c.alias}` : ''}
              {c.fechaSaldo ? ` · saldo a ${textoFecha(c.fechaSaldo)}` : ''}
              {c.origenSaldo === 'sin_datos' ? ' · el extracto no trae saldo' : ''}
            </div>
            <div className="meta">
              {c.ultimoApunte
                ? `Visto hasta ${textoFecha(c.ultimoApunte.fecha)} · ${c.ultimoApunte.concepto} · ${textoEur(c.ultimoApunte.importeCentimos)}${c.ultimoApunte.eseDia > 1 ? ` · ${c.ultimoApunte.eseDia} apuntes ese día` : ''}`
                : 'Todavía no hay apuntes vistos en esta cuenta.'}
            </div>
            {c.fymNombre && (
              <div className="meta">
                Fuck You Money «{c.fymNombre}» declara {textoEur(c.fymValorCentimos)}
                {c.diferenciaCentimos != null ? ` · el extracto difiere ${textoEur(c.diferenciaCentimos)}` : ''}
              </div>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={c.enFym}
                onChange={(e) => {
                  void api(`/api/cuentas/${c.id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({ enFym: e.target.checked }),
                  })
                    .then(onChange)
                    .catch((err) => setError(err instanceof Error ? err.message : 'No he podido marcar la cuenta'))
                }}
              />
              Saldo para Fuck You Money
            </label>
          </div>
          <div>
            <div className={c.saldoCentimos != null && c.saldoCentimos < 0 ? 'importe sale' : 'importe'}>
              {textoEur(c.saldoCentimos)}
            </div>
            <button
              type="button"
              className="sec"
              onClick={() =>
                void api(`/api/cuentas/${c.id}`, { method: 'DELETE' })
                  .then(onChange)
                  .catch((err) => setError(err instanceof Error ? err.message : 'No he podido borrar la cuenta'))
              }
            >
              Borrar
            </button>
          </div>
        </article>
      ))}

      <h2 style={{ marginTop: '1.4rem' }}>Cuenta que no está en Fuck You Money</h2>
      <p className="meta">El extracto se asigna a una cuenta que ya viene de allí. Esta ficha es solo si falta.</p>
      <form className="form" onSubmit={(e) => void crear(e)}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" required />
        <input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Banco" />
        <input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Alias del fichero" />
        <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="IBAN" />
        <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCuenta)}>
          {TIPOS_CUENTA.map((t) => (
            <option key={t} value={t}>{TIPO_CUENTA_LABEL[t]}</option>
          ))}
        </select>
        <select value={fymAssetId} onChange={(e) => setFymAssetId(e.target.value)}>
          <option value="">Sin comparar con un saldo declarado</option>
          {resumen.fymCuentas.map((f) => (
            <option key={f.id} value={f.id}>{f.nombre}</option>
          ))}
        </select>
        <label className="check">
          <input type="checkbox" checked={enFym} onChange={(e) => setEnFym(e.target.checked)} />
          Saldo para Fuck You Money
        </label>
        <button type="submit">Guardar cuenta</button>
      </form>
      <p className="meta">Si el fichero se llama <code>caixa-nomina-enero.csv</code> y el alias es <code>caixa-nomina</code>, se asigna solo. Con el IBAN dentro del extracto, también.</p>

      <h2 style={{ marginTop: '1.4rem' }}>Propiedades</h2>
      {resumen.propiedades.length === 0 && <p className="meta">Ninguna todavía.</p>}
      {resumen.propiedades.map((p) => (
        <div key={p.id} className="meta">{p.nombre}{p.origen === 'manual' ? ' · añadida a mano' : ''}</div>
      ))}
      <form
        className="form"
        onSubmit={(e) => {
          e.preventDefault()
          void api('/api/propiedades', { method: 'POST', body: JSON.stringify({ nombre: propiedad }) })
            .then(() => {
              setPropiedad('')
              return onChange()
            })
            .catch((err) => setError(err instanceof Error ? err.message : 'No se ha añadido'))
        }}
      >
        <input value={propiedad} onChange={(e) => setPropiedad(e.target.value)} placeholder="Nombre de la propiedad" />
        <button type="submit" className="sec">Añadir propiedad</button>
      </form>
    </section>
  )
}
