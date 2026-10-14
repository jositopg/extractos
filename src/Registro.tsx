import { useEffect, useState } from 'react'
import type { CuentaJson, RegistroJson } from '../shared/api'
import { textoEur, textoFecha } from '../shared/formato'
import { hoyLocal } from '../shared/money'
import { api } from './api'

export function Registro({ cuentas }: { cuentas: CuentaJson[] }) {
  const [mes, setMes] = useState(hoyLocal().slice(0, 7))
  const [datos, setDatos] = useState<RegistroJson | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    void api<RegistroJson>(`/api/registro?mes=${mes}`)
      .then((d) => {
        setDatos(d)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'No he podido calcular el mes'))
  }, [mes])

  return (
    <section className="panel">
      <div className="controles">
        <label>
          Mes{' '}
          <input type="month" value={mes} onChange={(e) => setMes(e.target.value)} />
        </label>
      </div>
      {error && <p className="error">{error}</p>}
      {datos && (
        <>
          <div className="numeros">
            <div><strong>{textoEur(datos.brutoCentimos)}</strong><span>Gastos en bruto</span></div>
            <div><strong>{textoEur(datos.ingresosFincaCentimos)}</strong><span>Ingresos de finca</span></div>
            <div><strong>{textoEur(datos.gastosFincaCentimos)}</strong><span>Gastos de finca</span></div>
            <div><strong>{datos.pendientes}</strong><span>Sin conciliar</span></div>
          </div>
          <p className="meta">{datos.brutoAviso}</p>
          {datos.avisos.length > 0 && (
            <>
              <h2>Avisos del mes</h2>
              {datos.avisos.map((aviso) => (
                <p key={aviso} className="aviso">{aviso}</p>
              ))}
            </>
          )}
          {datos.porCategoria.length > 0 && (
            <>
              <h2>En las propiedades</h2>
              {datos.porCategoria.map((l) => (
                <div key={`${l.ambito}-${l.categoria}`} className="entre">
                  <span>{l.categoria}</span>
                  <span className={l.centimos >= 0 ? 'importe entra' : 'importe sale'}>{textoEur(l.centimos)}</span>
                </div>
              ))}
            </>
          )}
          <h2>Saldos para Fuck You Money</h2>
          {datos.cuentasFym === 0 && <p className="meta">Ninguna cuenta marcada.</p>}
          {datos.historial.length === 0 && datos.cuentasFym > 0 && (
            <p className="meta">Esas cuentas todavía no tienen un extracto con saldo de cierre.</p>
          )}
          {datos.historial.map((h) => (
            <div key={`${h.cuentaId}-${h.fecha}-${h.extracto}`} className="entre">
              <span>{h.cuentaNombre} <span className="meta">{textoFecha(h.fecha)} · {h.extracto}</span></span>
              <span className="importe">{textoEur(h.saldoCentimos)}</span>
            </div>
          ))}
          {datos.descuadres.length > 0 && (
            <>
              <h2>Extractos que no cuadran</h2>
              {datos.descuadres.map((d) => (
                <div key={d.archivoId} className="meta">
                  {d.nombre} · {d.cuentaNombre} · diferencia {textoEur(d.diferenciaCentimos)}
                </div>
              ))}
            </>
          )}
        </>
      )}

      <h2 style={{ marginTop: '1.4rem' }}>Saldo de cada cuenta</h2>
      {cuentas.length === 0 && <p className="meta">Todavía no hay cuentas.</p>}
      {cuentas.map((c) => (
        <div key={c.id} className="entre">
          <span>
            {c.nombre}
            <span className="meta">
              {c.fechaSaldo ? ` ${textoFecha(c.fechaSaldo)}` : ' sin fecha'}
              {c.enFym ? ' · para Fuck You Money' : ''}
              {c.diferenciaCentimos != null ? ` · declarado ${textoEur(c.fymValorCentimos)}` : ''}
            </span>
          </span>
          <span className="importe">{textoEur(c.saldoCentimos)}</span>
        </div>
      ))}
    </section>
  )
}
