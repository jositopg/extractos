import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  CatalogoJson,
  ClasificarBody,
  ClasificarVariosBody,
  CuentaBody,
  CuentaJson,
  EstadoFincaJson,
  ExportacionJson,
  FicheroFincaJson,
  MovimientoJson,
  ParteReparto,
  PropiedadJson,
  RegistroJson,
  RepartoJson,
  ResumenJson,
  SugerenciaJson,
  TraspasoSugeridoJson,
  VistaReglaJson,
} from '../shared/api'
import { avisosDelMes, type MovimientoAviso } from '../shared/avisos'
import { esDestino, esTipoCuenta, type Destino } from '../shared/categorias'
import { errorClasificacion, sugerirPatron } from '../shared/clasificar'
import { exportarFinca, propuestaFym, type MovimientoExportable, type PropuestaCuenta } from '../shared/exportar'
import { textoEur } from '../shared/formato'
import { cccDesdeIban, hoyLocal, normalizar, parseFecha } from '../shared/money'
import { gastosBrutos, historialSaldos, informeMes, mediaGastoVida, saldoDeCuenta, type MovimientoInforme } from '../shared/patrimonio'
import { sugerirTraspaso } from '../shared/traspaso'
import { ultimoApunte } from '../shared/visto'
import { sincronizarCatalogos } from './catalogos'
import {
  copiarLibro as copiaDelLibro,
  contarMovimientosCuenta,
  deleteCuenta,
  deleteRegla,
  destinoDe,
  estadoFinca,
  getArchivo,
  getCuenta,
  getMovimiento,
  getPropiedad,
  insertCuenta,
  insertReparto,
  hashesGuardados,
  listArchivos,
  listCuentas,
  listFym,
  listMovimientos,
  listMovimientosFinca,
  listMovimientosInforme,
  listPropiedades,
  listReglas,
  listRepartos,
  marcarExportados,
  obsoletarRepartos,
  recuento,
  tipoDe,
  updateClasificacion,
  updateCuenta,
  upsertPropiedad,
  upsertRegla,
  type Db,
  type MovimientoRow,
  type RepartoRow,
} from './db'
import { retirarArchivoDeFinca, sincronizarFinca, type EscritorFinca } from './finca'
import { HttpError } from './http'
import {
  aplicarReglasPendientes,
  asignarArchivo,
  borrarArchivo,
  coincidenciasRegla,
  engancharPendientes,
  guardarSubida,
  importarInbox,
  moverArchivo,
  reglasDelLibro,
  sugerirMovimiento,
  type Rutas,
} from './importar'

function cuentaJson(
  db: Db,
  cuentas = listCuentas(db),
): CuentaJson[] {
  const archivos = listArchivos(db)
  const movs = listMovimientosInforme(db)
  const fym = listFym(db)
  const abiertosPorCuenta = new Map<string, number>()
  for (const mov of movs) {
    if (mov.destino === 'pendiente' || mov.destino === 'duda') {
      abiertosPorCuenta.set(mov.cuenta_id, (abiertosPorCuenta.get(mov.cuenta_id) ?? 0) + 1)
    }
  }
  const porCuenta = new Map<string, { fecha: string; concepto: string; importeCentimos: number; orden: number }[]>()
  for (const mov of movs) {
    const lista = porCuenta.get(mov.cuenta_id) ?? []
    lista.push({
      fecha: mov.fecha,
      concepto: mov.concepto,
      importeCentimos: mov.importe_centimos,
      orden: mov.orden,
    })
    porCuenta.set(mov.cuenta_id, lista)
  }
  return cuentas.map((c) => {
    const saldo = saldoDeCuenta(
      c.id,
      c.saldo_inicial_centimos,
      c.saldo_inicial_fecha,
      archivos.map((a) => ({
        id: a.id,
        cuentaId: a.cuenta_id,
        hasta: a.hasta,
        saldoFinalCentimos: a.saldo_final_centimos,
      })),
      movs.map((m) => ({
        cuentaId: m.cuenta_id,
        archivoId: m.archivo_id,
        fecha: m.fecha,
        orden: m.orden,
        importeCentimos: m.importe_centimos,
        saldoCentimos: m.saldo_centimos,
      })),
    )
    const enlace = c.fym_asset_id ? fym.find((f) => f.id === c.fym_asset_id) : undefined
    const diferencia =
      saldo.centimos != null && enlace?.valor_centimos != null ? saldo.centimos - enlace.valor_centimos : null
    return {
      id: c.id,
      nombre: c.nombre,
      banco: c.banco,
      alias: c.alias,
      iban: c.iban,
      ccc: c.ccc,
      tipo: tipoDe(c),
      fymAssetId: c.fym_asset_id,
      saldoInicialCentimos: c.saldo_inicial_centimos,
      saldoInicialFecha: c.saldo_inicial_fecha,
      saldoCentimos: saldo.centimos,
      fechaSaldo: saldo.fecha,
      origenSaldo: saldo.origen,
      enFym: Number(c.en_fym) === 1,
      fymNombre: enlace?.nombre ?? null,
      fymValorCentimos: enlace?.valor_centimos ?? null,
      diferenciaCentimos: diferencia,
      ultimoApunte: ultimoApunte(porCuenta.get(c.id) ?? []),
      pendientes: abiertosPorCuenta.get(c.id) ?? 0,
    }
  })
}

function movJson(
  row: MovimientoRow,
  extra: { sugerencia: SugerenciaJson | null; traspasoSugerido: TraspasoSugeridoJson | null; repartos: RepartoJson[] },
): MovimientoJson {
  return {
    id: row.id,
    cuentaId: row.cuenta_id,
    cuentaNombre: row.cuenta_nombre ?? '',
    fecha: row.fecha,
    fechaValor: row.fecha_valor,
    importeCentimos: row.importe_centimos,
    saldoCentimos: row.saldo_centimos,
    concepto: row.concepto,
    destino: destinoDe(row),
    categoriaFinca: row.categoria_finca,
    propiedadId: row.propiedad_id,
    categoriaPersonal: row.categoria_personal,
    nota: row.nota,
    exportadoFincaEn: row.exportado_finca_en,
    fincaSincronizadoEn: row.finca_sincronizado_en,
    fincaError: row.finca_error,
    sugerencia: extra.sugerencia,
    traspasoSugerido: extra.traspasoSugerido,
    repartos: extra.repartos,
  }
}

type ClasificacionLista = {
  mov: MovimientoRow
  destino: Destino
  categoriaFinca: string | null
  propiedadId: string | null
  categoriaPersonal: string | null
}

function prepararClasificacion(db: Db, id: string, body: ClasificarBody): ClasificacionLista {
  if (!esDestino(body.destino)) throw new HttpError(400, 'Destino desconocido')
  const mov = getMovimiento(db, id)
  if (!mov) throw new HttpError(404, 'No encuentro el movimiento')
  const destino: Destino = body.destino
  const categoriaFinca = destino === 'finca' ? (body.categoriaFinca ?? null) : null
  const propiedadId = destino === 'finca' ? (body.propiedadId ?? null) : null
  const categoriaPersonal = destino === 'personal' ? (body.categoriaPersonal ?? null) : null
  const error = errorClasificacion({
    destino,
    importeCentimos: mov.importe_centimos,
    categoriaFinca,
    propiedadId,
    categoriaPersonal,
  })
  if (error) throw new HttpError(400, error)
  if (destino === 'finca' && propiedadId && !getPropiedad(db, propiedadId)) {
    throw new HttpError(400, 'No tengo esa propiedad. Tráela de Finca o añádela a mano.')
  }
  if (body.recordar && (destino === 'pendiente' || destino === 'duda')) {
    throw new HttpError(400, 'Elige un destino antes de recordar el concepto')
  }
  return { mov, destino, categoriaFinca, propiedadId, categoriaPersonal }
}

function guardarRegla(db: Db, mov: MovimientoRow, listo: ClasificacionLista, body: ClasificarBody): string {
  const patron = normalizar(body.patron || sugerirPatron(mov.concepto))
  if (patron.length < 3) {
    throw new HttpError(400, 'El patrón es demasiado corto. Deja una palabra del concepto, por ejemplo endesa.')
  }
  return upsertRegla(db, {
    id: randomUUID(),
    patron,
    destino: listo.destino,
    categoria_finca: listo.categoriaFinca,
    propiedad_id: listo.propiedadId,
    categoria_personal: listo.categoriaPersonal,
    creado_en: new Date().toISOString(),
  })
}

function escribirClasificacion(db: Db, listo: ClasificacionLista, body: ClasificarBody, reglaId: string | null): void {
  const abierto = listo.destino === 'pendiente' || listo.destino === 'duda'
  obsoletarRepartos(db, listo.mov.id)
  updateClasificacion(db, {
    id: listo.mov.id,
    destino: listo.destino,
    categoriaFinca: listo.categoriaFinca,
    propiedadId: listo.propiedadId,
    categoriaPersonal: listo.categoriaPersonal,
    nota: body.nota ?? listo.mov.nota,
    reglaId,
    clasificadoEn: abierto ? null : new Date().toISOString(),
    exportadoFincaEn: listo.mov.exportado_finca_en,
  })
}

function repartosVigentes(db: Db): Map<string, RepartoRow[]> {
  const mapa = new Map<string, RepartoRow[]>()
  for (const parte of listRepartos(db)) {
    if (Number(parte.vigente) !== 1) continue
    const lista = mapa.get(parte.movimiento_id) ?? []
    lista.push(parte)
    mapa.set(parte.movimiento_id, lista)
  }
  return mapa
}

function informes(db: Db): MovimientoInforme[] {
  return listMovimientosInforme(db).map((m) => ({
    fecha: m.fecha,
    importeCentimos: m.importe_centimos,
    destino: destinoDe(m),
    categoriaFinca: m.categoria_finca,
    categoriaPersonal: m.categoria_personal,
  }))
}

function armarExportacion(db: Db, soloNuevos: boolean): ExportacionJson {
  const nombres = new Map(listPropiedades(db).map((p) => [p.id, p.nombre]))
  const porMov = repartosVigentes(db)
  const lineas: MovimientoExportable[] = []
  for (const m of listMovimientosFinca(db)) {
    const trozos = porMov.get(m.id) ?? []
    if (trozos.length > 0) {
      for (const parte of trozos) {
        lineas.push({
          id: m.id,
          fecha: m.fecha,
          importeCentimos: parte.importe_centimos,
          concepto: m.concepto,
          destino: 'finca',
          categoriaFinca: parte.categoria_finca,
          propiedadId: parte.propiedad_id,
          propiedadNombre: nombres.get(parte.propiedad_id) ?? null,
          exportadoFincaEn: m.exportado_finca_en,
        })
      }
      continue
    }
    lineas.push({
      id: m.id,
      fecha: m.fecha,
      importeCentimos: m.importe_centimos,
      concepto: m.concepto,
      destino: destinoDe(m),
      categoriaFinca: m.categoria_finca,
      propiedadId: m.propiedad_id,
      propiedadNombre: m.propiedad_nombre,
      exportadoFincaEn: m.exportado_finca_en,
    })
  }
  const ficheros = exportarFinca(lineas, soloNuevos)
  const media = mediaGastoVida(informes(db), hoyLocal())
  const cuentas: PropuestaCuenta[] = cuentaJson(db).map((c) => ({
    nombre: c.nombre,
    fymAssetId: c.fymAssetId,
    fymNombre: c.fymNombre,
    saldoCentimos: c.saldoCentimos,
    saldo: textoEur(c.saldoCentimos),
    fechaSaldo: c.fechaSaldo,
    declaradoCentimos: c.fymValorCentimos,
    declarado: textoEur(c.fymValorCentimos),
    diferenciaCentimos: c.diferenciaCentimos,
  }))
  return {
    ficheros: ficheros.ficheros,
    rechazados: ficheros.rechazados,
    fym: propuestaFym({ generadoEn: hoyLocal(), media, cuentas }),
  }
}

function normalizarIban(raw: string | undefined): string {
  const iban = (raw ?? '').replace(/\s/g, '').toUpperCase()
  if (!iban) return ''
  if (!/^ES\d{22}$/.test(iban)) throw new HttpError(400, 'El IBAN no parece español')
  return iban
}

export type OpcionesServicio = {
  /** false o ausente: no se abre la base de Finca. El servidor real pasa el escritor. */
  finca?: EscritorFinca | false
}

export function crearServicio(db: Db, rutas: Rutas, opciones: OpcionesServicio = {}) {
  const escritor = opciones.finca || null
  return {
    resumen(): ResumenJson {
      const archivos = listArchivos(db)
      const guardados = hashesGuardados(db)
      return {
        cuentas: cuentaJson(db),
        propiedades: listPropiedades(db).map((p) => ({
          id: p.id,
          nombre: p.nombre,
          origen: p.origen === 'finca' ? 'finca' : 'manual',
        })),
        fymCuentas: listFym(db).map((f) => ({ id: f.id, nombre: f.nombre, valorCentimos: f.valor_centimos })),
        archivos: archivos.map((a) => ({
          id: a.id,
          nombre: a.nombre,
          formato: a.formato,
          cuentaId: a.cuenta_id,
          desde: a.desde,
          hasta: a.hasta,
          leidos: a.leidos,
          movimientos: a.movimientos,
          duplicados: a.duplicados,
          avisos: a.avisos,
          error: a.error,
          cuadreCentimos: a.cuadre_centimos,
          saldoFinalCentimos: a.saldo_final_centimos,
          guardado: guardados.has(a.contenido_hash),
        })),
        reglas: listReglas(db).map((r) => ({
          id: r.id,
          patron: r.patron,
          destino: destinoDe(r),
          categoriaFinca: r.categoria_finca,
          propiedadId: r.propiedad_id,
          categoriaPersonal: r.categoria_personal,
        })),
        recuento: recuento(db),
        rutas: { inbox: rutas.inbox, exportDir: rutas.exportDir },
        nube: Boolean(process.env.VERCEL),
      }
    },

    async importar() {
      const resultado = await importarInbox(db, rutas)
      await sincronizarFinca(db, escritor)
      return resultado
    },

    async subir(nombre: string, buf: Buffer) {
      guardarSubida(rutas, nombre, buf)
      const resultado = await importarInbox(db, rutas)
      await sincronizarFinca(db, escritor)
      return resultado
    },

    async engancharPendientes(cuentaId?: string) {
      const resultado = await engancharPendientes(db, cuentaId)
      if (resultado.movimientos > 0) await sincronizarFinca(db, escritor)
      return resultado
    },

    movimientos(filtro: { destino?: string; cuentaId?: string; q?: string }): MovimientoJson[] {
      const abiertos = filtro.destino === 'abiertos'
      const destino = !abiertos && filtro.destino && esDestino(filtro.destino) ? filtro.destino : null
      const q = normalizar(filtro.q ?? '')
      const rows = listMovimientos(db, {
        destino: abiertos ? null : destino,
        destinos: abiertos ? ['pendiente', 'duda'] : null,
        cuentaId: filtro.cuentaId || null,
        limit: q ? 2000 : 500,
      })
        .filter((r) => !q || normalizar(`${r.concepto} ${r.nota}`).includes(q))
        .slice(0, 500)
      const reglas = reglasDelLibro(db)
      const nombres = new Map(listCuentas(db).map((c) => [c.id, c.nombre]))
      const propiedades = new Map(listPropiedades(db).map((p) => [p.id, p.nombre]))
      const candidatos = listMovimientosInforme(db).map((m) => ({
        id: m.id,
        cuentaId: m.cuenta_id,
        fecha: m.fecha,
        importeCentimos: m.importe_centimos,
        cuentaNombre: nombres.get(m.cuenta_id) ?? '',
      }))
      const porMov = repartosVigentes(db)
      return rows.map((row) => {
        const abierto = row.destino === 'pendiente' || row.destino === 'duda'
        const sugerida = abierto ? sugerirMovimiento(db, reglas, row.concepto, row.importe_centimos) : null
        const pareja = abierto
          ? sugerirTraspaso(
              {
                id: row.id,
                cuentaId: row.cuenta_id,
                fecha: row.fecha,
                importeCentimos: row.importe_centimos,
                cuentaNombre: row.cuenta_nombre ?? '',
              },
              candidatos,
            )
          : null
        const sugerencia: SugerenciaJson | null = sugerida
          ? {
              destino: sugerida.destino,
              categoriaFinca: sugerida.categoriaFinca,
              propiedadId: sugerida.propiedadId,
              propiedadNombre: sugerida.propiedadNombre,
              categoriaPersonal: sugerida.categoriaPersonal,
              patron: sugerida.patron,
            }
          : null
        const traspasoSugerido: TraspasoSugeridoJson | null = pareja
          ? {
              id: pareja.id,
              cuentaNombre: pareja.cuentaNombre,
              fecha: pareja.fecha,
              importeCentimos: pareja.importeCentimos,
            }
          : null
        const repartos: RepartoJson[] = (porMov.get(row.id) ?? []).map((parte) => ({
          id: parte.id,
          propiedadId: parte.propiedad_id,
          propiedadNombre: propiedades.get(parte.propiedad_id) ?? null,
          categoriaFinca: parte.categoria_finca,
          importeCentimos: parte.importe_centimos,
          fincaError: parte.finca_error,
        }))
        return movJson(row, { sugerencia, traspasoSugerido, repartos })
      })
    },

    async clasificar(id: string, body: ClasificarBody): Promise<void> {
      const listo = prepararClasificacion(db, id, body)
      const reglaId = body.recordar ? guardarRegla(db, listo.mov, listo, body) : null
      escribirClasificacion(db, listo, body, reglaId)
      if (reglaId) aplicarReglasPendientes(db)
      await sincronizarFinca(db, escritor)
    },

    async clasificarVarios(body: ClasificarVariosBody): Promise<void> {
      if (!Array.isArray(body.ids) || body.ids.length === 0 || body.ids.some((id) => typeof id !== 'string')) {
        throw new HttpError(400, 'Elige al menos un apunte')
      }
      const listos = body.ids.map((id) => prepararClasificacion(db, id, body))
      const reglaId = body.recordar ? guardarRegla(db, listos[0].mov, listos[0], body) : null
      for (const listo of listos) escribirClasificacion(db, listo, body, reglaId)
      if (reglaId) aplicarReglasPendientes(db)
      await sincronizarFinca(db, escritor)
    },

    previsualizar(body: ClasificarBody): VistaReglaJson {
      if (!esDestino(body.destino) || (body.destino !== 'finca' && body.destino !== 'personal')) {
        throw new HttpError(400, 'Esa acción no guarda una regla')
      }
      const patron = normalizar(body.patron ?? '')
      if (patron.length < 3) {
        throw new HttpError(400, 'El patrón es demasiado corto. Deja una palabra del concepto, por ejemplo endesa.')
      }
      const categoriaFinca = body.destino === 'finca' ? (body.categoriaFinca ?? null) : null
      const propiedadId = body.destino === 'finca' ? (body.propiedadId ?? null) : null
      const categoriaPersonal = body.destino === 'personal' ? (body.categoriaPersonal ?? null) : null
      if (body.destino === 'finca' && (!categoriaFinca || !propiedadId)) {
        throw new HttpError(400, 'Falta la propiedad o la categoría')
      }
      if (body.destino === 'personal' && !categoriaPersonal) throw new HttpError(400, 'Falta la categoría')
      if (propiedadId && !getPropiedad(db, propiedadId)) {
        throw new HttpError(400, 'No tengo esa propiedad. Tráela de Finca o añádela a mano.')
      }
      return {
        coincidencias: coincidenciasRegla(db, {
          patron,
          destino: body.destino,
          categoriaFinca,
          propiedadId,
          categoriaPersonal,
        }),
      }
    },

    async repartir(id: string, partes: ParteReparto[]): Promise<void> {
      const mov = getMovimiento(db, id)
      if (!mov) throw new HttpError(404, 'No encuentro el movimiento')
      if (!Array.isArray(partes) || partes.length < 2) throw new HttpError(400, 'Parte el apunte en dos.')
      if (mov.importe_centimos === 0) throw new HttpError(400, 'Un apunte de cero no se parte.')
      const signo = Math.sign(mov.importe_centimos)
      let suma = 0
      for (const parte of partes) {
        if (!parte || !Number.isInteger(parte.importeCentimos) || Math.sign(parte.importeCentimos) !== signo) {
          throw new HttpError(400, 'Cada parte tiene que ir en el mismo sentido que el apunte.')
        }
        suma += parte.importeCentimos
        const error = errorClasificacion({
          destino: 'finca',
          importeCentimos: parte.importeCentimos,
          categoriaFinca: parte.categoriaFinca,
          propiedadId: parte.propiedadId,
        })
        if (error) throw new HttpError(400, error)
        if (!getPropiedad(db, parte.propiedadId)) {
          throw new HttpError(400, 'No tengo esa propiedad. Tráela de Finca o añádela a mano.')
        }
      }
      if (suma !== mov.importe_centimos) throw new HttpError(400, 'Las partes tienen que sumar el importe del apunte.')
      const vivas = (repartosVigentes(db).get(id) ?? [])
      const iguales =
        vivas.length === partes.length &&
        vivas.every(
          (parte, i) =>
            parte.propiedad_id === partes[i]?.propiedadId &&
            parte.categoria_finca === partes[i]?.categoriaFinca &&
            parte.importe_centimos === partes[i]?.importeCentimos,
        )
      if (!iguales) {
        obsoletarRepartos(db, id)
        for (const parte of partes) {
          insertReparto(db, {
            id: randomUUID(),
            movimientoId: id,
            propiedadId: parte.propiedadId,
            categoriaFinca: parte.categoriaFinca,
            importeCentimos: parte.importeCentimos,
          })
        }
      }
      updateClasificacion(db, {
        id,
        destino: 'finca',
        categoriaFinca: null,
        propiedadId: null,
        categoriaPersonal: null,
        nota: mov.nota,
        reglaId: null,
        clasificadoEn: new Date().toISOString(),
        exportadoFincaEn: mov.exportado_finca_en,
      })
      await sincronizarFinca(db, escritor)
    },

    copiarLibro(): Buffer {
      return copiaDelLibro(db)
    },

    registro(mes: string): RegistroJson {
      if (!/^\d{4}-\d{2}$/.test(mes)) throw new HttpError(400, 'El mes tiene que ser AAAA-MM')
      const crudas = listMovimientosInforme(db)
      const porMov = repartosVigentes(db)
      const movs: MovimientoInforme[] = []
      const paraAvisos: MovimientoAviso[] = []
      for (const m of crudas) {
        const destino = destinoDe(m)
        const trozos = destino === 'finca' ? (porMov.get(m.id) ?? []) : []
        if (trozos.length > 0) {
          for (const parte of trozos) {
            movs.push({
              fecha: m.fecha,
              importeCentimos: parte.importe_centimos,
              destino: 'finca',
              categoriaFinca: parte.categoria_finca,
              categoriaPersonal: null,
            })
            paraAvisos.push({
              fecha: m.fecha,
              destino: 'finca',
              importeCentimos: parte.importe_centimos,
              categoriaFinca: parte.categoria_finca,
              propiedadId: parte.propiedad_id,
            })
          }
          continue
        }
        movs.push({
          fecha: m.fecha,
          importeCentimos: m.importe_centimos,
          destino,
          categoriaFinca: m.categoria_finca,
          categoriaPersonal: m.categoria_personal,
        })
        paraAvisos.push({
          fecha: m.fecha,
          destino,
          importeCentimos: m.importe_centimos,
          categoriaFinca: m.categoria_finca,
          propiedadId: m.propiedad_id,
        })
      }
      const inf = informeMes(movs, mes)
      const cuentas = listCuentas(db)
      const deFym = cuentas.filter((c) => Number(c.en_fym) === 1)
      const brutoCentimos = gastosBrutos(
        crudas.map((m) => ({
          cuentaId: m.cuenta_id,
          fecha: m.fecha,
          importeCentimos: m.importe_centimos,
          destino: destinoDe(m),
        })),
        new Set(deFym.map((c) => c.id)),
        mes,
      )
      const nombres = new Map(cuentas.map((c) => [c.id, c.nombre]))
      const descuadres = listArchivos(db)
        .filter((a) => a.cuadre_centimos != null && a.cuadre_centimos !== 0)
        .map((a) => ({
          archivoId: a.id,
          nombre: a.nombre,
          cuentaNombre: (a.cuenta_id && nombres.get(a.cuenta_id)) || 'Sin cuenta',
          diferenciaCentimos: a.cuadre_centimos ?? 0,
        }))
      return {
        mes,
        ingresosFincaCentimos: inf.ingresosFincaCentimos,
        gastosFincaCentimos: inf.gastosFincaCentimos,
        brutoCentimos,
        cuentasFym: deFym.length,
        brutoAviso:
          deFym.length === 0
            ? 'Marca en Cuentas las que quieres seguir para Fuck You Money. El gasto en bruto sale de esas.'
            : 'Cargos del extracto, sin traspasos ni apuntes que has dejado fuera.',
        porCategoria: inf.porCategoria.filter((l) => l.ambito === 'finca'),
        pendientes: inf.pendientes,
        descuadres,
        avisos: avisosDelMes(
          paraAvisos,
          mes,
          listPropiedades(db).map((p) => ({ id: p.id, nombre: p.nombre })),
        ),
        historial: historialSaldos(
          listArchivos(db).map((a) => ({
            cuentaId: a.cuenta_id,
            hasta: a.hasta,
            saldoFinalCentimos: a.saldo_final_centimos,
            extracto: a.nombre,
          })),
          deFym.map((c) => ({ id: c.id, nombre: c.nombre })),
        ),
      }
    },

    crearCuenta(body: CuentaBody): CuentaJson {
      const nombre = (body.nombre ?? '').trim()
      if (!nombre) throw new HttpError(400, 'Falta el nombre de la cuenta')
      if (body.tipo && !esTipoCuenta(body.tipo)) throw new HttpError(400, 'Tipo de cuenta desconocido')
      const iban = normalizarIban(body.iban)
      if (body.saldoInicialCentimos != null && !Number.isInteger(body.saldoInicialCentimos)) {
        throw new HttpError(400, 'El saldo inicial va en céntimos enteros')
      }
      if (body.saldoInicialFecha && !parseFecha(body.saldoInicialFecha)) {
        throw new HttpError(400, 'La fecha del saldo inicial no vale')
      }
      const id = randomUUID()
      const ahora = new Date().toISOString()
      insertCuenta(db, {
        id,
        nombre,
        banco: (body.banco ?? '').trim(),
        alias: (body.alias ?? '').trim(),
        iban,
        ccc: cccDesdeIban(iban) ?? '',
        tipo: body.tipo && esTipoCuenta(body.tipo) ? body.tipo : 'corriente',
        fym_asset_id: body.fymAssetId || null,
        en_fym: body.enFym ? 1 : 0,
        saldo_inicial_centimos: body.saldoInicialCentimos ?? null,
        saldo_inicial_fecha: body.saldoInicialFecha || null,
        creado_en: ahora,
      })
      const creada = cuentaJson(db).find((c) => c.id === id)
      if (!creada) throw new HttpError(500, 'No he podido crear la cuenta')
      return creada
    },

    actualizarCuenta(id: string, body: CuentaBody): void {
      const actual = getCuenta(db, id)
      if (!actual) throw new HttpError(404, 'No encuentro esa cuenta')
      const nombre = body.nombre != null ? body.nombre.trim() : actual.nombre
      if (!nombre) throw new HttpError(400, 'Falta el nombre de la cuenta')
      if (body.tipo && !esTipoCuenta(body.tipo)) throw new HttpError(400, 'Tipo de cuenta desconocido')
      const iban = body.iban != null ? normalizarIban(body.iban) : actual.iban
      updateCuenta(db, {
        ...actual,
        nombre,
        banco: body.banco != null ? body.banco.trim() : actual.banco,
        alias: body.alias != null ? body.alias.trim() : actual.alias,
        iban,
        ccc: cccDesdeIban(iban) || actual.ccc,
        tipo: body.tipo && esTipoCuenta(body.tipo) ? body.tipo : actual.tipo,
        fym_asset_id: body.fymAssetId === undefined ? actual.fym_asset_id : body.fymAssetId || null,
        en_fym: body.enFym === undefined ? (Number(actual.en_fym) === 1 ? 1 : 0) : body.enFym ? 1 : 0,
        saldo_inicial_centimos:
          body.saldoInicialCentimos === undefined ? actual.saldo_inicial_centimos : body.saldoInicialCentimos,
        saldo_inicial_fecha:
          body.saldoInicialFecha === undefined ? actual.saldo_inicial_fecha : body.saldoInicialFecha || null,
      })
    },

    borrarCuenta(id: string): void {
      if (!getCuenta(db, id)) throw new HttpError(404, 'No encuentro esa cuenta')
      if (contarMovimientosCuenta(db, id) > 0) {
        throw new HttpError(400, 'Tiene movimientos. Borra antes sus extractos.')
      }
      const conArchivo = listArchivos(db).some((a) => a.cuenta_id === id)
      if (conArchivo) throw new HttpError(400, 'Tiene extractos importados. Bórralos antes.')
      deleteCuenta(db, id)
    },

    async asignar(archivoId: string, cuentaId: string) {
      const archivo = getArchivo(db, archivoId)
      if (!archivo) throw new HttpError(404, 'No encuentro ese extracto')
      if (!getCuenta(db, cuentaId)) throw new HttpError(400, 'No encuentro esa cuenta')
      if (archivo.cuenta_id && archivo.cuenta_id !== cuentaId) {
        if (escritor) await retirarArchivoDeFinca(db, escritor, archivoId)
        moverArchivo(db, archivoId, cuentaId)
        await sincronizarFinca(db, escritor)
        return
      }
      if (archivo.cuenta_id === cuentaId) return
      await asignarArchivo(db, rutas, archivoId, cuentaId)
      await sincronizarFinca(db, escritor)
    },

    async borrarArchivo(archivoId: string) {
      if (escritor) await retirarArchivoDeFinca(db, escritor, archivoId)
      borrarArchivo(db, rutas, archivoId)
    },

    crearPropiedad(nombreRaw: string): PropiedadJson {
      const nombre = nombreRaw.trim()
      if (!nombre) throw new HttpError(400, 'Falta el nombre de la propiedad')
      const ya = listPropiedades(db).find((p) => normalizar(p.nombre) === normalizar(nombre))
      if (ya) throw new HttpError(400, 'Ya tengo una propiedad con ese nombre')
      const row = { id: `local-${randomUUID()}`, nombre, origen: 'manual', visto_en: new Date().toISOString() }
      upsertPropiedad(db, row)
      return { id: row.id, nombre, origen: 'manual' }
    },

    borrarRegla(id: string): void {
      deleteRegla(db, id)
    },

    sincronizar(): Promise<CatalogoJson> {
      return sincronizarCatalogos(db)
    },

    estadoFinca(): EstadoFincaJson {
      return estadoFinca(db)
    },

    async reintentarFinca(): Promise<EstadoFincaJson> {
      if (!escritor) throw new HttpError(400, 'Este proceso no escribe en Finca.')
      await sincronizarFinca(db, escritor)
      return estadoFinca(db)
    },

    exportacion(soloNuevos = true): ExportacionJson {
      return armarExportacion(db, soloNuevos)
    },

    escribirExportacion(soloNuevos = true): ExportacionJson {
      const payload = armarExportacion(db, soloNuevos)
      const dir = join(rutas.exportDir, 'finca')
      mkdirSync(dir, { recursive: true })
      const ficheros: FicheroFincaJson[] = payload.ficheros.map((f) => {
        const ruta = join(dir, f.fichero)
        writeFileSync(ruta, f.texto)
        return { ...f, ruta }
      })
      const rutaFym = join(rutas.exportDir, 'fym-propuesta.json')
      writeFileSync(rutaFym, `${JSON.stringify(payload.fym, null, 2)}\n`)
      return { ...payload, ficheros, rutaFym }
    },

    marcar(ids: string[]): { marcados: number } {
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== 'string')) {
        throw new HttpError(400, 'Faltan los movimientos a marcar')
      }
      return { marcados: marcarExportados(db, ids, new Date().toISOString()) }
    },
  }
}

export type Servicio = ReturnType<typeof crearServicio>
