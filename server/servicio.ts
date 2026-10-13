import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import type {
  CatalogoJson,
  ClasificarBody,
  CuentaBody,
  CuentaJson,
  EstadoFincaJson,
  ExportacionJson,
  FicheroFincaJson,
  MovimientoJson,
  PropiedadJson,
  RegistroJson,
  ResumenJson,
} from '../shared/api'
import { esDestino, esTipoCuenta, type Destino } from '../shared/categorias'
import { errorClasificacion, sugerirPatron } from '../shared/clasificar'
import { exportarFinca, propuestaFym, type PropuestaCuenta } from '../shared/exportar'
import { textoEur } from '../shared/formato'
import { cccDesdeIban, hoyLocal, normalizar, parseFecha } from '../shared/money'
import { gastosBrutos, historialSaldos, informeMes, mediaGastoVida, saldoDeCuenta, type MovimientoInforme } from '../shared/patrimonio'
import { ultimoApunte } from '../shared/visto'
import { sincronizarCatalogos } from './catalogos'
import {
  contarMovimientosCuenta,
  deleteCuenta,
  deleteRegla,
  destinoDe,
  estadoFinca,
  getCuenta,
  getMovimiento,
  getPropiedad,
  insertCuenta,
  hashesGuardados,
  listArchivos,
  listCuentas,
  listFym,
  listMovimientos,
  listMovimientosFinca,
  listMovimientosInforme,
  listPropiedades,
  listReglas,
  marcarExportados,
  recuento,
  tipoDe,
  updateClasificacion,
  updateCuenta,
  upsertPropiedad,
  upsertRegla,
  type Db,
  type MovimientoRow,
} from './db'
import { retirarArchivoDeFinca, sincronizarFinca, type EscritorFinca } from './finca'
import { HttpError } from './http'
import { aplicarReglasPendientes, asignarArchivo, borrarArchivo, engancharPendientes, guardarSubida, importarInbox, type Rutas } from './importar'

function cuentaJson(
  db: Db,
  cuentas = listCuentas(db),
): CuentaJson[] {
  const archivos = listArchivos(db)
  const movs = listMovimientosInforme(db)
  const fym = listFym(db)
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
    }
  })
}

function movJson(row: MovimientoRow): MovimientoJson {
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
  }
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
  const ficheros = exportarFinca(
    listMovimientosFinca(db).map((m) => ({
      id: m.id,
      fecha: m.fecha,
      importeCentimos: m.importe_centimos,
      concepto: m.concepto,
      destino: destinoDe(m),
      categoriaFinca: m.categoria_finca,
      propiedadId: m.propiedad_id,
      propiedadNombre: m.propiedad_nombre,
      exportadoFincaEn: m.exportado_finca_en,
    })),
    soloNuevos,
  )
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
      const destino = filtro.destino && esDestino(filtro.destino) ? filtro.destino : null
      const q = normalizar(filtro.q ?? '')
      const rows = listMovimientos(db, { destino, cuentaId: filtro.cuentaId || null, limit: q ? 2000 : 500 })
      return rows.filter((r) => !q || normalizar(`${r.concepto} ${r.nota}`).includes(q)).slice(0, 500).map(movJson)
    },

    async clasificar(id: string, body: ClasificarBody): Promise<void> {
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

      let reglaId: string | null = null
      if (body.recordar) {
        if (destino === 'pendiente') throw new HttpError(400, 'Elige un destino antes de recordar el concepto')
        const patron = normalizar(body.patron || sugerirPatron(mov.concepto))
        if (patron.length < 3) {
          throw new HttpError(400, 'El patrón es demasiado corto. Deja una palabra del concepto, por ejemplo endesa.')
        }
        reglaId = upsertRegla(db, {
          id: randomUUID(),
          patron,
          destino,
          categoria_finca: categoriaFinca,
          propiedad_id: propiedadId,
          categoria_personal: categoriaPersonal,
          creado_en: new Date().toISOString(),
        })
      }

      updateClasificacion(db, {
        id,
        destino,
        categoriaFinca,
        propiedadId,
        categoriaPersonal,
        nota: body.nota ?? mov.nota,
        reglaId,
        clasificadoEn: destino === 'pendiente' ? null : new Date().toISOString(),
        exportadoFincaEn: mov.exportado_finca_en,
      })
      if (reglaId) aplicarReglasPendientes(db)
      await sincronizarFinca(db, escritor)
    },

    registro(mes: string): RegistroJson {
      if (!/^\d{4}-\d{2}$/.test(mes)) throw new HttpError(400, 'El mes tiene que ser AAAA-MM')
      const crudas = listMovimientosInforme(db)
      const movs = crudas.map((m) => ({
        fecha: m.fecha,
        importeCentimos: m.importe_centimos,
        destino: destinoDe(m),
        categoriaFinca: m.categoria_finca,
        categoriaPersonal: m.categoria_personal,
      }))
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
