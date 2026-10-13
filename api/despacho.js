// Generado por npm run build. No lo edites.

// server/nube.ts
import { mkdirSync as mkdirSync4 } from "node:fs";
import { join as join5 } from "node:path";

// server/db.ts
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

// shared/categorias.ts
var CATEGORIAS_GASTO_FINCA = [
  "Electricidad",
  "Agua",
  "Gas",
  "Telefon\xEDa / Internet",
  "IBI",
  "Tasa de basuras",
  "IRPF / Retenci\xF3n",
  "Otros impuestos",
  "Comunidad de propietarios",
  "Seguro hogar",
  "Seguro impago",
  "Mantenimiento",
  "Reparaciones",
  "Hipoteca / Financiaci\xF3n",
  "Intereses hipoteca",
  "Honorarios / Gesti\xF3n",
  "Mobiliario / Equipamiento",
  "Obras / Reforma",
  "Otros gastos"
];
var CATEGORIAS_INGRESO_FINCA = [
  "Alquiler mensual",
  "Electricidad (repercutida)",
  "Agua (repercutida)",
  "Fianza recibida",
  "Devoluci\xF3n de fianza",
  "Otros ingresos"
];
var CATEGORIAS_GASTO_PERSONAL = [
  "Vivienda",
  "Suministros",
  "Comida",
  "Transporte",
  "Salud",
  "Seguros",
  "Ocio",
  "Suscripciones",
  "Ropa y cuidado",
  "Educaci\xF3n",
  "Impuestos",
  "Familia",
  "Otros",
  "Ahorro e inversi\xF3n",
  "Devoluci\xF3n de deuda"
];
var CATEGORIAS_INGRESO_PERSONAL = [
  "N\xF3mina",
  "Aut\xF3nomo / facturas",
  "Intereses",
  "Otros ingresos"
];
var CATEGORIAS_PERSONAL_FUERA_DE_VIDA = ["Ahorro e inversi\xF3n", "Devoluci\xF3n de deuda"];
var DESTINOS = ["pendiente", "finca", "personal", "traspaso", "ignorar"];
var TIPOS_CUENTA = ["corriente", "ahorro", "remunerada", "nomina", "otro"];
function esDestino(value) {
  return DESTINOS.includes(value);
}
function esTipoCuenta(value) {
  return TIPOS_CUENTA.includes(value);
}
function categoriaVida(categoria) {
  return CATEGORIAS_GASTO_PERSONAL.includes(categoria) && !CATEGORIAS_PERSONAL_FUERA_DE_VIDA.includes(categoria);
}

// server/db.ts
var SCHEMA = `
CREATE TABLE IF NOT EXISTS cuentas (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  banco TEXT NOT NULL DEFAULT '',
  alias TEXT NOT NULL DEFAULT '',
  iban TEXT NOT NULL DEFAULT '',
  ccc TEXT NOT NULL DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'corriente',
  fym_asset_id TEXT,
  en_fym INTEGER NOT NULL DEFAULT 0,
  saldo_inicial_centimos INTEGER,
  saldo_inicial_fecha TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS propiedades (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  origen TEXT NOT NULL,
  visto_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS fym_cash (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  valor_centimos INTEGER,
  visto_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS archivos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  contenido_hash TEXT NOT NULL,
  formato TEXT NOT NULL,
  cuenta_id TEXT,
  ccc TEXT NOT NULL DEFAULT '',
  iban TEXT NOT NULL DEFAULT '',
  desde TEXT,
  hasta TEXT,
  saldo_inicial_centimos INTEGER,
  saldo_final_centimos INTEGER,
  cuadre_centimos INTEGER,
  leidos INTEGER NOT NULL DEFAULT 0,
  movimientos INTEGER NOT NULL DEFAULT 0,
  duplicados INTEGER NOT NULL DEFAULT 0,
  avisos TEXT NOT NULL DEFAULT '',
  error TEXT,
  importado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS movimientos (
  id TEXT PRIMARY KEY,
  cuenta_id TEXT NOT NULL REFERENCES cuentas(id),
  archivo_id TEXT NOT NULL REFERENCES archivos(id),
  orden INTEGER NOT NULL,
  fecha TEXT NOT NULL,
  fecha_valor TEXT,
  importe_centimos INTEGER NOT NULL,
  saldo_centimos INTEGER,
  concepto TEXT NOT NULL,
  documento TEXT NOT NULL DEFAULT '',
  destino TEXT NOT NULL DEFAULT 'pendiente',
  categoria_finca TEXT,
  propiedad_id TEXT,
  categoria_personal TEXT,
  nota TEXT NOT NULL DEFAULT '',
  regla_id TEXT,
  clasificado_en TEXT,
  exportado_finca_en TEXT,
  finca_tx_id TEXT,
  finca_sincronizado_en TEXT,
  finca_error TEXT,
  finca_firma TEXT
);

CREATE TABLE IF NOT EXISTS reglas (
  id TEXT PRIMARY KEY,
  patron TEXT NOT NULL,
  destino TEXT NOT NULL,
  categoria_finca TEXT,
  propiedad_id TEXT,
  categoria_personal TEXT,
  creado_en TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ficheros (
  hash TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  bytes BLOB NOT NULL,
  guardado_en TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_arch_hash ON archivos(contenido_hash);
CREATE INDEX IF NOT EXISTS idx_mov_cuenta ON movimientos(cuenta_id, fecha);
CREATE INDEX IF NOT EXISTS idx_mov_destino ON movimientos(destino);
`;
function openDb(path, opciones) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  if (path !== ":memory:") db.exec(opciones?.wal === false ? "PRAGMA journal_mode = DELETE" : "PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);
  asegurarColumna(db, "cuentas", "en_fym", "en_fym INTEGER NOT NULL DEFAULT 0");
  asegurarColumna(db, "movimientos", "finca_tx_id", "finca_tx_id TEXT");
  asegurarColumna(db, "movimientos", "finca_sincronizado_en", "finca_sincronizado_en TEXT");
  asegurarColumna(db, "movimientos", "finca_error", "finca_error TEXT");
  asegurarColumna(db, "movimientos", "finca_firma", "finca_firma TEXT");
  return db;
}
function asegurarColumna(db, tabla, columna, definicion) {
  const cols = db.prepare(`PRAGMA table_info(${tabla})`).all();
  if (cols.some((c) => c.name === columna)) return;
  db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${definicion}`);
}
function all(db, sql, ...params) {
  return db.prepare(sql).all(...params);
}
function get(db, sql, ...params) {
  return db.prepare(sql).get(...params);
}
function listCuentas(db) {
  return all(db, "SELECT * FROM cuentas ORDER BY nombre");
}
function getCuenta(db, id) {
  return get(db, "SELECT * FROM cuentas WHERE id = ?", id);
}
function insertCuenta(db, row) {
  db.prepare(
    `INSERT INTO cuentas (
      id, nombre, banco, alias, iban, ccc, tipo, fym_asset_id, en_fym, saldo_inicial_centimos, saldo_inicial_fecha, creado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.nombre,
    row.banco,
    row.alias,
    row.iban,
    row.ccc,
    row.tipo,
    row.fym_asset_id,
    row.en_fym ? 1 : 0,
    row.saldo_inicial_centimos,
    row.saldo_inicial_fecha,
    row.creado_en
  );
}
function updateCuenta(db, row) {
  db.prepare(
    `UPDATE cuentas SET nombre = ?, banco = ?, alias = ?, iban = ?, ccc = ?, tipo = ?, fym_asset_id = ?, en_fym = ?,
      saldo_inicial_centimos = ?, saldo_inicial_fecha = ? WHERE id = ?`
  ).run(
    row.nombre,
    row.banco,
    row.alias,
    row.iban,
    row.ccc,
    row.tipo,
    row.fym_asset_id,
    row.en_fym ? 1 : 0,
    row.saldo_inicial_centimos,
    row.saldo_inicial_fecha,
    row.id
  );
}
function contarMovimientosCuenta(db, cuentaId) {
  const row = get(db, "SELECT COUNT(*) AS c FROM movimientos WHERE cuenta_id = ?", cuentaId);
  return row?.c ?? 0;
}
function deleteCuenta(db, id) {
  db.prepare("DELETE FROM cuentas WHERE id = ?").run(id);
}
function listPropiedades(db) {
  return all(db, "SELECT * FROM propiedades ORDER BY nombre");
}
function getPropiedad(db, id) {
  return get(db, "SELECT * FROM propiedades WHERE id = ?", id);
}
function upsertPropiedad(db, row) {
  db.prepare(
    `INSERT INTO propiedades (id, nombre, origen, visto_en) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, origen = excluded.origen, visto_en = excluded.visto_en`
  ).run(row.id, row.nombre, row.origen, row.visto_en);
}
function reemplazarPropiedadesFinca(db, rows) {
  const ids = rows.map((r) => r.id);
  db.exec("BEGIN");
  try {
    const actuales = all(db, `SELECT id FROM propiedades WHERE origen = 'finca'`);
    for (const actual of actuales) {
      if (!ids.includes(actual.id)) db.prepare("DELETE FROM propiedades WHERE id = ?").run(actual.id);
    }
    for (const row of rows) upsertPropiedad(db, row);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
function listFym(db) {
  return all(db, "SELECT * FROM fym_cash ORDER BY nombre");
}
function reemplazarFym(db, rows) {
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM fym_cash");
    const stmt = db.prepare("INSERT INTO fym_cash (id, nombre, valor_centimos, visto_en) VALUES (?, ?, ?, ?)");
    for (const row of rows) stmt.run(row.id, row.nombre, row.valor_centimos, row.visto_en);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
function hayHash(db, hash) {
  return get(db, "SELECT id FROM archivos WHERE contenido_hash = ? LIMIT 1", hash) != null;
}
function olvidarLecturaFallida(db, hash) {
  const rows = all(db, "SELECT * FROM archivos WHERE contenido_hash = ?", hash);
  if (rows.length === 0) return false;
  if (rows.some((r) => !r.error || r.cuenta_id || Number(r.movimientos) > 0)) return false;
  db.exec("BEGIN");
  try {
    for (const row of rows) {
      db.prepare("DELETE FROM movimientos WHERE archivo_id = ?").run(row.id);
      db.prepare("DELETE FROM archivos WHERE id = ?").run(row.id);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return true;
}
function insertArchivo(db, row) {
  db.prepare(
    `INSERT INTO archivos (
      id, nombre, contenido_hash, formato, cuenta_id, ccc, iban, desde, hasta,
      saldo_inicial_centimos, saldo_final_centimos, cuadre_centimos, leidos, movimientos, duplicados,
      avisos, error, importado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.nombre,
    row.contenido_hash,
    row.formato,
    row.cuenta_id,
    row.ccc,
    row.iban,
    row.desde,
    row.hasta,
    row.saldo_inicial_centimos,
    row.saldo_final_centimos,
    row.cuadre_centimos,
    row.leidos,
    row.movimientos,
    row.duplicados,
    row.avisos,
    row.error,
    row.importado_en
  );
}
function updateArchivoCuenta(db, id, patch) {
  if (patch.avisos == null) {
    db.prepare("UPDATE archivos SET cuenta_id = ?, movimientos = ?, duplicados = ?, error = NULL WHERE id = ?").run(
      patch.cuentaId,
      patch.movimientos,
      patch.duplicados,
      id
    );
    return;
  }
  db.prepare(
    "UPDATE archivos SET cuenta_id = ?, movimientos = ?, duplicados = ?, avisos = ?, error = NULL WHERE id = ?"
  ).run(patch.cuentaId, patch.movimientos, patch.duplicados, patch.avisos, id);
}
function listArchivos(db) {
  return all(db, "SELECT * FROM archivos ORDER BY importado_en DESC");
}
function getArchivo(db, id) {
  return get(db, "SELECT * FROM archivos WHERE id = ?", id);
}
function contarArchivosHash(db, hash) {
  const row = get(db, "SELECT COUNT(*) AS c FROM archivos WHERE contenido_hash = ?", hash);
  return row?.c ?? 0;
}
function listArchivosHash(db, hash) {
  return all(db, "SELECT * FROM archivos WHERE contenido_hash = ?", hash);
}
function hashesGuardados(db) {
  const rows = all(db, "SELECT hash FROM ficheros");
  return new Set(rows.map((row) => row.hash));
}
function guardarFichero(db, hash, nombre, bytes) {
  db.prepare(
    `INSERT INTO ficheros (hash, nombre, bytes, guardado_en) VALUES (?, ?, ?, ?)
     ON CONFLICT(hash) DO UPDATE SET nombre = excluded.nombre, bytes = excluded.bytes, guardado_en = excluded.guardado_en`
  ).run(hash, nombre, bytes, (/* @__PURE__ */ new Date()).toISOString());
}
function leerFichero(db, hash) {
  const row = get(db, "SELECT bytes FROM ficheros WHERE hash = ?", hash);
  if (!row?.bytes) return null;
  return Buffer.from(row.bytes);
}
function borrarFichero(db, hash) {
  db.prepare("DELETE FROM ficheros WHERE hash = ?").run(hash);
}
function maxFechaCuenta(db, cuentaId) {
  const row = get(db, "SELECT MAX(fecha) AS f FROM movimientos WHERE cuenta_id = ?", cuentaId);
  return row?.f ?? null;
}
function listApuntesCuenta(db, cuentaId) {
  return all(
    db,
    "SELECT fecha, concepto, importe_centimos, orden FROM movimientos WHERE cuenta_id = ?",
    cuentaId
  );
}
function hayMovimientoPorSaldo(db, cuentaId, fecha, importeCentimos, saldoCentimos) {
  return get(
    db,
    `SELECT id FROM movimientos
       WHERE cuenta_id = ? AND fecha = ? AND importe_centimos = ? AND saldo_centimos = ? LIMIT 1`,
    cuentaId,
    fecha,
    importeCentimos,
    saldoCentimos
  ) != null;
}
function deleteMovimientosArchivo(db, archivoId) {
  db.prepare("DELETE FROM movimientos WHERE archivo_id = ?").run(archivoId);
}
function deleteArchivo(db, id) {
  db.prepare("DELETE FROM archivos WHERE id = ?").run(id);
}
function hayMovimiento(db, id) {
  return get(db, "SELECT id FROM movimientos WHERE id = ?", id) != null;
}
function insertMovimiento(db, row) {
  db.prepare(
    `INSERT INTO movimientos (
      id, cuenta_id, archivo_id, orden, fecha, fecha_valor, importe_centimos, saldo_centimos, concepto, documento,
      destino, categoria_finca, propiedad_id, categoria_personal, nota, regla_id, clasificado_en
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    row.id,
    row.cuentaId,
    row.archivoId,
    row.orden,
    row.fecha,
    row.fechaValor,
    row.importeCentimos,
    row.saldoCentimos,
    row.concepto,
    row.documento,
    row.destino,
    row.categoriaFinca,
    row.propiedadId,
    row.categoriaPersonal,
    row.nota,
    row.reglaId,
    row.clasificadoEn
  );
}
function getMovimiento(db, id) {
  return get(
    db,
    `SELECT m.*, c.nombre AS cuenta_nombre FROM movimientos m JOIN cuentas c ON c.id = m.cuenta_id WHERE m.id = ?`,
    id
  );
}
function listMovimientos(db, filtro) {
  return all(
    db,
    `SELECT m.*, c.nombre AS cuenta_nombre
     FROM movimientos m JOIN cuentas c ON c.id = m.cuenta_id
     WHERE (? IS NULL OR m.destino = ?) AND (? IS NULL OR m.cuenta_id = ?)
     ORDER BY m.fecha DESC, m.orden DESC
     LIMIT ?`,
    filtro.destino ?? null,
    filtro.destino ?? null,
    filtro.cuentaId ?? null,
    filtro.cuentaId ?? null,
    filtro.limit
  );
}
function listMovimientosInforme(db) {
  return all(db, "SELECT * FROM movimientos");
}
function listMovimientosFinca(db) {
  return all(
    db,
    `SELECT m.*, p.nombre AS propiedad_nombre
     FROM movimientos m LEFT JOIN propiedades p ON p.id = m.propiedad_id
     WHERE m.destino = 'finca'`
  );
}
function updateClasificacion(db, row) {
  db.prepare(
    `UPDATE movimientos SET destino = ?, categoria_finca = ?, propiedad_id = ?, categoria_personal = ?,
      nota = ?, regla_id = ?, clasificado_en = ?, exportado_finca_en = ? WHERE id = ?`
  ).run(
    row.destino,
    row.categoriaFinca,
    row.propiedadId,
    row.categoriaPersonal,
    row.nota,
    row.reglaId,
    row.clasificadoEn,
    row.exportadoFincaEn,
    row.id
  );
}
function listCandidatosFinca(db) {
  return all(
    db,
    `SELECT * FROM movimientos WHERE destino = 'finca' OR finca_tx_id IS NOT NULL`
  );
}
function listFincaDeArchivo(db, archivoId) {
  return all(
    db,
    `SELECT id, finca_tx_id FROM movimientos WHERE archivo_id = ? AND finca_tx_id IS NOT NULL`,
    archivoId
  );
}
function marcarFincaOk(db, id, txId, firma, cuando) {
  db.prepare(
    `UPDATE movimientos SET finca_tx_id = ?, finca_sincronizado_en = ?, finca_error = NULL, finca_firma = ? WHERE id = ?`
  ).run(txId, cuando, firma, id);
}
function marcarFincaError(db, id, error) {
  db.prepare(`UPDATE movimientos SET finca_error = ? WHERE id = ?`).run(error, id);
}
function limpiarFinca(db, id) {
  db.prepare(
    `UPDATE movimientos SET finca_tx_id = NULL, finca_sincronizado_en = NULL, finca_error = NULL, finca_firma = NULL WHERE id = ?`
  ).run(id);
}
function estadoFinca(db) {
  const escritos = get(
    db,
    `SELECT COUNT(*) AS c FROM movimientos WHERE destino = 'finca' AND finca_sincronizado_en IS NOT NULL AND finca_error IS NULL`
  );
  const pendientes = get(
    db,
    `SELECT COUNT(*) AS c FROM movimientos WHERE destino = 'finca' AND finca_sincronizado_en IS NULL AND finca_error IS NULL`
  );
  const errores = all(
    db,
    `SELECT id, concepto, fecha, finca_error FROM movimientos WHERE finca_error IS NOT NULL ORDER BY fecha DESC`
  );
  return {
    escritos: Number(escritos?.c ?? 0),
    pendientes: Number(pendientes?.c ?? 0),
    errores: errores.map((e) => ({ id: e.id, concepto: e.concepto, fecha: e.fecha, error: e.finca_error }))
  };
}
function marcarExportados(db, ids, cuando) {
  const stmt = db.prepare(
    `UPDATE movimientos SET exportado_finca_en = ? WHERE id = ? AND destino = 'finca' AND exportado_finca_en IS NULL`
  );
  let n = 0;
  db.exec("BEGIN");
  try {
    for (const id of ids) {
      const info = stmt.run(cuando, id);
      n += Number(info.changes ?? 0);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  return n;
}
function listReglas(db) {
  return all(db, "SELECT * FROM reglas ORDER BY creado_en DESC");
}
function upsertRegla(db, row) {
  const previa = get(db, "SELECT * FROM reglas WHERE patron = ?", row.patron);
  if (previa) {
    db.prepare(
      `UPDATE reglas SET destino = ?, categoria_finca = ?, propiedad_id = ?, categoria_personal = ? WHERE id = ?`
    ).run(row.destino, row.categoria_finca, row.propiedad_id, row.categoria_personal, previa.id);
    return previa.id;
  }
  db.prepare(
    `INSERT INTO reglas (id, patron, destino, categoria_finca, propiedad_id, categoria_personal, creado_en)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(row.id, row.patron, row.destino, row.categoria_finca, row.propiedad_id, row.categoria_personal, row.creado_en);
  return row.id;
}
function deleteRegla(db, id) {
  db.prepare("DELETE FROM reglas WHERE id = ?").run(id);
}
function recuento(db) {
  const rows = all(db, "SELECT destino, COUNT(*) AS c FROM movimientos GROUP BY destino");
  let pendiente = 0;
  let clasificado = 0;
  for (const row of rows) {
    if (row.destino === "pendiente") pendiente += row.c;
    else clasificado += row.c;
  }
  return { pendiente, clasificado };
}
function destinoDe(row) {
  return esDestino(row.destino) ? row.destino : "pendiente";
}
function tipoDe(row) {
  return esTipoCuenta(row.tipo) ? row.tipo : "otro";
}

// server/http.ts
var HttpError = class extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
  status;
};
function mensajeError(err) {
  if (err instanceof Error) return err.message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://\u2026");
  return String(err);
}

// server/ruta.ts
function urlDe(req) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const marca = url.searchParams.get("__ruta");
  if (!marca) return url;
  url.searchParams.delete("__ruta");
  const resto = url.searchParams.toString();
  const path = marca.replace(/^\/+/, "");
  const pathname = path.startsWith("api/") ? `/${path}` : `/api/${path}`;
  return new URL(`${pathname}${resto ? `?${resto}` : ""}`, "http://127.0.0.1");
}

// server/sesion.ts
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
var COOKIE = "extractos_sesion";
var DIAS = 30;
function claveConfigurada() {
  const clave = process.env.EXTRACTOS_PASSWORD?.trim();
  return clave || null;
}
function claveCorrecta(intento) {
  const clave = claveConfigurada();
  if (!clave) return false;
  const a = createHash("sha256").update(clave).digest();
  const b = createHash("sha256").update(intento).digest();
  return timingSafeEqual(a, b);
}
function emitirSesion(ahora = Date.now()) {
  const clave = claveConfigurada();
  if (!clave) throw new Error("No hay clave");
  const exp = ahora + DIAS * 24 * 60 * 60 * 1e3;
  const mac = createHmac("sha256", clave).update(String(exp)).digest("base64url");
  return `${exp}.${mac}`;
}
function sesionValida(token, ahora = Date.now()) {
  if (!claveConfigurada()) return true;
  if (!token) return false;
  const punto = token.lastIndexOf(".");
  if (punto <= 0) return false;
  const expRaw = token.slice(0, punto);
  const mac = token.slice(punto + 1);
  const exp = Number(expRaw);
  if (!Number.isFinite(exp) || exp < ahora) return false;
  const clave = claveConfigurada();
  if (!clave) return false;
  const esperada = createHmac("sha256", clave).update(expRaw).digest("base64url");
  const a = Buffer.from(mac);
  const b = Buffer.from(esperada);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
function leerCookie(header) {
  if (!header) return void 0;
  for (const parte of header.split(";")) {
    const i = parte.indexOf("=");
    if (i < 0) continue;
    const nombre = parte.slice(0, i).trim();
    if (nombre !== COOKIE) continue;
    return decodeURIComponent(parte.slice(i + 1).trim());
  }
  return void 0;
}
function cabeceraSesion(token, seguro) {
  const trozos = [
    `${COOKIE}=${token}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Lax",
    `Max-Age=${DIAS * 86400}`
  ];
  if (seguro) trozos.push("Secure");
  return trozos.join("; ");
}

// server/despachar.ts
function send(res, status, body, extra) {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    ...extra
  });
  res.end(JSON.stringify(body));
}
function leerCuerpo(req, limit) {
  return new Promise((resolve2, reject) => {
    const chunks = [];
    let n = 0;
    req.on("data", (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      n += buf.length;
      if (n > limit) {
        reject(new HttpError(413, "Pasa del tama\xF1o permitido"));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on("end", () => resolve2(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
async function leerJson(req) {
  const buf = await leerCuerpo(req, 1e6);
  if (buf.length === 0) return {};
  try {
    return JSON.parse(buf.toString("utf8"));
  } catch {
    throw new HttpError(400, "JSON inv\xE1lido");
  }
}
function param(pathname, re) {
  const m = re.exec(pathname);
  return m ? decodeURIComponent(m[1]) : null;
}
async function entrar(req, res) {
  if (!claveConfigurada()) {
    send(res, 400, { error: "Esta copia no pide clave." });
    return;
  }
  const body = await leerJson(req);
  if (!body.clave || !claveCorrecta(body.clave)) {
    send(res, 401, { error: "La clave no vale" });
    return;
  }
  const seguro = Boolean(process.env.VERCEL);
  send(res, 200, { ok: true }, { "set-cookie": cabeceraSesion(emitirSesion(), seguro) });
}
async function despachar(req, res, svc) {
  const url = urlDe(req);
  const pathname = url.pathname;
  const method = req.method || "GET";
  if (process.env.VERCEL && !claveConfigurada()) {
    send(res, 503, { error: "Falta la clave de acceso en el servidor." });
    return;
  }
  if (method === "POST" && pathname === "/api/entrar") {
    await entrar(req, res);
    return;
  }
  if (!sesionValida(leerCookie(req.headers.cookie))) {
    send(res, 401, { error: "Hace falta entrar" });
    return;
  }
  if (method === "GET" && pathname === "/api/resumen") return send(res, 200, svc.resumen());
  if (method === "POST" && pathname === "/api/importar") return send(res, 200, await svc.importar());
  if (method === "POST" && pathname === "/api/subir") {
    const nombre = String(req.headers["x-filename"] || "extracto.txt");
    const buf = await leerCuerpo(req, 2e7);
    return send(res, 200, await svc.subir(nombre, buf));
  }
  if (method === "GET" && pathname === "/api/movimientos") {
    return send(res, 200, svc.movimientos({
      destino: url.searchParams.get("destino") || void 0,
      cuentaId: url.searchParams.get("cuentaId") || void 0,
      q: url.searchParams.get("q") || void 0
    }));
  }
  const movId = param(pathname, /^\/api\/movimientos\/([^/]+)$/);
  if (method === "PATCH" && movId) {
    await svc.clasificar(movId, await leerJson(req));
    return send(res, 200, { ok: true });
  }
  if (method === "GET" && pathname === "/api/registro") {
    return send(res, 200, svc.registro(url.searchParams.get("mes") || ""));
  }
  if (method === "POST" && pathname === "/api/cuentas") {
    const creada = svc.crearCuenta(await leerJson(req));
    await svc.engancharPendientes(creada.id);
    const fresca = svc.resumen().cuentas.find((cuenta) => cuenta.id === creada.id);
    return send(res, 200, fresca ?? creada);
  }
  const cuentaId = param(pathname, /^\/api\/cuentas\/([^/]+)$/);
  if (method === "PATCH" && cuentaId) {
    svc.actualizarCuenta(cuentaId, await leerJson(req));
    await svc.engancharPendientes(cuentaId);
    return send(res, 200, { ok: true });
  }
  if (method === "DELETE" && cuentaId) {
    svc.borrarCuenta(cuentaId);
    return send(res, 200, { ok: true });
  }
  const archivoCuenta = param(pathname, /^\/api\/archivos\/([^/]+)\/cuenta$/);
  if (method === "POST" && archivoCuenta) {
    const body = await leerJson(req);
    if (!body.cuentaId) throw new HttpError(400, "Falta la cuenta");
    await svc.asignar(archivoCuenta, body.cuentaId);
    return send(res, 200, { ok: true });
  }
  const archivoId = param(pathname, /^\/api\/archivos\/([^/]+)$/);
  if (method === "DELETE" && archivoId) {
    await svc.borrarArchivo(archivoId);
    return send(res, 200, { ok: true });
  }
  if (method === "POST" && pathname === "/api/propiedades") {
    const body = await leerJson(req);
    return send(res, 200, svc.crearPropiedad(body.nombre ?? ""));
  }
  const reglaId = param(pathname, /^\/api\/reglas\/([^/]+)$/);
  if (method === "DELETE" && reglaId) {
    svc.borrarRegla(reglaId);
    return send(res, 200, { ok: true });
  }
  if (method === "POST" && pathname === "/api/catalogos") return send(res, 200, await svc.sincronizar());
  if (method === "GET" && pathname === "/api/finca") return send(res, 200, svc.estadoFinca());
  if (method === "POST" && pathname === "/api/finca") return send(res, 200, await svc.reintentarFinca());
  if (pathname === "/api/exportar") {
    const soloNuevos = url.searchParams.get("todos") !== "1";
    if (method === "GET") return send(res, 200, svc.exportacion(soloNuevos));
    if (method === "POST") return send(res, 200, svc.escribirExportacion(soloNuevos));
  }
  if (method === "POST" && pathname === "/api/exportar/marcar") {
    const body = await leerJson(req);
    return send(res, 200, svc.marcar(body.ids ?? []));
  }
  send(res, 404, { error: "No existe" });
}
function responderError(res, err) {
  const status = err instanceof HttpError ? err.status : 500;
  if (status === 500) console.error(err);
  if (!res.headersSent) send(res, status, { error: mensajeError(err) });
}

// server/finca.ts
import { homedir } from "node:os";
import { join } from "node:path";
import { Client } from "pg";

// shared/finca.ts
function eurosExactos(centimos) {
  const abs = Math.abs(Math.round(centimos));
  return `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}
function descripcionFinca(concepto, categoria) {
  const limpio = concepto.replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim();
  return (limpio || categoria).slice(0, 500);
}
function filaFinca(input) {
  return {
    id: input.id,
    propiedadId: input.propiedadId,
    fecha: input.fecha,
    tipo: input.importeCentimos >= 0 ? "ingreso" : "gasto",
    importe: eurosExactos(input.importeCentimos),
    categoria: input.categoria,
    descripcion: descripcionFinca(input.concepto, input.categoria),
    referencia: `extractos:${input.movimientoId}`
  };
}
function firmaFila(fila) {
  return [fila.propiedadId, fila.fecha, fila.tipo, fila.importe, fila.categoria, fila.descripcion, fila.referencia].join("");
}
function propiedadLocal(id) {
  return id.startsWith("local-");
}

// server/ids.ts
import { createHash as createHash2 } from "node:crypto";

// shared/money.ts
function centimosDesdeTexto(raw) {
  let s = raw.trim().replace(/€/g, "").replace(/\s/g, "");
  if (!s) return NaN;
  let sign = 1;
  if (s.startsWith("(") && s.endsWith(")")) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (s.endsWith("-")) {
    sign = -1;
    s = s.slice(0, -1);
  } else if (s.startsWith("-")) {
    sign = -1;
    s = s.slice(1);
  } else if (s.startsWith("+")) {
    s = s.slice(1);
  }
  if (!/^\d[\d.,]*$/.test(s)) return NaN;
  if (s.includes(",") && s.includes(".")) {
    if (s.lastIndexOf(".") > s.lastIndexOf(",")) s = s.replace(/,/g, "");
    else s = s.replace(/\./g, "");
  }
  let entero;
  let decimal = "";
  if (s.includes(",")) {
    const partes = s.split(",");
    if (partes.length !== 2 || partes[1].length > 2) return NaN;
    entero = partes[0].replace(/\./g, "");
    decimal = partes[1];
  } else if (s.includes(".")) {
    const partes = s.split(".");
    if (partes.length === 2 && partes[1].length <= 2) {
      entero = partes[0];
      decimal = partes[1];
    } else if (partes.every((p, i) => /^\d+$/.test(p) && (i === 0 || p.length === 3))) {
      entero = partes.join("");
    } else {
      return NaN;
    }
  } else {
    entero = s;
  }
  if (!/^\d+$/.test(entero) || decimal !== "" && !/^\d+$/.test(decimal)) return NaN;
  decimal = decimal.padEnd(2, "0");
  const n = Number(entero) * 100 + Number(decimal);
  if (!Number.isSafeInteger(n)) return NaN;
  return sign * n;
}
function parseFecha(raw) {
  const s = raw.trim();
  let y;
  let m;
  let d;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) {
    y = Number(iso[1]);
    m = Number(iso[2]);
    d = Number(iso[3]);
  } else {
    const dm = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/.exec(s);
    if (!dm) return null;
    d = Number(dm[1]);
    m = Number(dm[2]);
    y = Number(dm[3]);
  }
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function fechaYyMmDd(raw) {
  if (!/^\d{6}$/.test(raw)) return null;
  const yy = Number(raw.slice(0, 2));
  const year = yy >= 80 ? 1900 + yy : 2e3 + yy;
  return parseFecha(`${year}-${raw.slice(2, 4)}-${raw.slice(4, 6)}`);
}
function normalizar(s) {
  return s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function ccc18DesdeCuenta(texto) {
  const m = texto.match(/n[uú]mero de cuenta\s*:?\s*((?:\d\s*){20})/i);
  if (!m?.[1]) return void 0;
  const d = m[1].replace(/\D/g, "");
  if (d.length !== 20) return void 0;
  return d.slice(0, 8) + d.slice(10);
}
function cccDesdeIban(iban) {
  const d = iban.replace(/\s/g, "").toUpperCase();
  if (!/^ES\d{22}$/.test(d)) return null;
  return d.slice(4, 12) + d.slice(14, 24);
}
function ibanCoincideConCcc(iban, ccc18) {
  const ccc = cccDesdeIban(iban);
  const limpio = ccc18.replace(/\D/g, "");
  return ccc != null && limpio.length === 18 && ccc === limpio;
}
function buscarIban(texto) {
  const m = texto.toUpperCase().match(/ES(?:\s*\d){22}/);
  if (!m) return null;
  const iban = m[0].replace(/\s/g, "");
  return /^ES\d{22}$/.test(iban) ? iban : null;
}
function hoyLocal(d = /* @__PURE__ */ new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function mesDe(fecha) {
  return fecha.slice(0, 7);
}

// server/ids.ts
function sha256(text) {
  return createHash2("sha256").update(text).digest("hex");
}
function uuidEstable(clave) {
  const bytes = sha256(clave).slice(0, 32).split("");
  bytes[12] = "5";
  bytes[16] = (Number.parseInt(bytes[16] ?? "0", 16) & 3 | 8).toString(16);
  const s = bytes.join("");
  return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20, 32)}`;
}
function idArchivo(contenidoHash, clave, indice) {
  return sha256(`${contenidoHash}|${clave}|${indice}`).slice(0, 32);
}
function idMovimiento(cuentaId, mov) {
  const doc = (mov.documento ?? "").replace(/\D/g, "").replace(/^0+$/, "");
  const base = [
    cuentaId,
    mov.fecha,
    String(mov.importeCentimos),
    normalizar(mov.concepto),
    doc,
    doc ? "" : String(mov.ordinal)
  ].join("|");
  return sha256(base).slice(0, 32);
}
function identificarBloques(contenidoHash, bloques) {
  const seen = /* @__PURE__ */ new Map();
  return bloques.map((b) => {
    const key = b.ccc || b.iban || "unica";
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    return { ...b, id: idArchivo(contenidoHash, key, n) };
  });
}

// server/pgurl.ts
import { existsSync, readFileSync } from "node:fs";
function urlAplicacion(envName, archivo) {
  const directa = process.env[envName]?.trim();
  if (directa) return directa;
  return leerDatabaseUrl(archivo);
}
function leerDatabaseUrl(filePath) {
  if (!existsSync(filePath)) return null;
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const m = /^DATABASE_URL=(.*)$/.exec(line.trim());
    if (m) return m[1].trim().replace(/^['"]|['"]$/g, "");
  }
  return null;
}
function fincaUrlsToTry(raw) {
  const direct = raw.trim();
  const urls = [direct];
  try {
    const u = new URL(direct);
    const m = /^db\.([a-z0-9]+)\.supabase\.co$/i.exec(u.hostname);
    if (m) {
      const ref = m[1];
      const pass = encodeURIComponent(decodeURIComponent(u.password || ""));
      const user = `postgres.${ref}`;
      for (const host of [
        "aws-0-eu-west-1.pooler.supabase.com",
        "aws-0-eu-central-1.pooler.supabase.com",
        "aws-0-eu-west-3.pooler.supabase.com"
      ]) {
        urls.push(`postgresql://${user}:${pass}@${host}:5432/postgres`);
      }
    }
  } catch {
    return [direct];
  }
  return [...new Set(urls)];
}

// server/finca.ts
var UPSERT = `
INSERT INTO transacciones (
  id, propiedad_id, fecha, tipo, importe, categoria, descripcion, archivos, creado_en, referencia
) VALUES ($1::uuid, $2::uuid, $3::date, $4, $5::numeric, $6, $7, '{}'::text[], now(), $8)
ON CONFLICT (id) DO UPDATE SET
  propiedad_id = EXCLUDED.propiedad_id,
  fecha = EXCLUDED.fecha,
  tipo = EXCLUDED.tipo,
  importe = EXCLUDED.importe,
  categoria = EXCLUDED.categoria,
  descripcion = EXCLUDED.descripcion,
  referencia = EXCLUDED.referencia
WHERE transacciones.referencia = EXCLUDED.referencia
RETURNING id
`;
var urlQueFunciono = null;
async function conFinca(fn) {
  const raw = urlAplicacion("FINCA_DATABASE_URL", join(homedir(), ".finca-db.env"));
  if (!raw) throw new Error("No est\xE1 ~/.finca-db.env, as\xED que el apunte se queda en este libro.");
  const todas = fincaUrlsToTry(raw);
  const urls = urlQueFunciono ? [urlQueFunciono, ...todas.filter((u) => u !== urlQueFunciono)] : todas;
  let last = "No se pudo conectar con Finca";
  for (const url of urls) {
    const client = new Client({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8e3
    });
    try {
      await client.connect();
    } catch (err) {
      last = mensajeError(err);
      await client.end().catch(() => {
      });
      continue;
    }
    try {
      const result = await fn(client);
      urlQueFunciono = url;
      return result;
    } finally {
      await client.end().catch(() => {
      });
    }
  }
  throw new Error(last);
}
function escritorFincaReal() {
  return {
    async aplicar(ops) {
      if (ops.upserts.length === 0 && ops.borrados.length === 0) return { ok: [], fallos: [] };
      return conFinca(async (client) => {
        const ok = [];
        const fallos = [];
        for (const fila of ops.upserts) {
          try {
            const result = await client.query(UPSERT, [
              fila.id,
              fila.propiedadId,
              fila.fecha,
              fila.tipo,
              fila.importe,
              fila.categoria,
              fila.descripcion,
              fila.referencia
            ]);
            if (result.rows.length === 0) {
              fallos.push({
                id: fila.id,
                error: "Ese apunte ya existe en Finca con otra referencia. No lo he tocado."
              });
            } else ok.push(fila.id);
          } catch (err) {
            fallos.push({ id: fila.id, error: mensajeError(err) });
          }
        }
        for (const fila of ops.borrados) {
          try {
            await client.query(`DELETE FROM transacciones WHERE id = $1::uuid AND referencia = $2`, [
              fila.id,
              fila.referencia
            ]);
            ok.push(fila.id);
          } catch (err) {
            fallos.push({ id: fila.id, error: mensajeError(err) });
          }
        }
        return { ok, fallos };
      });
    }
  };
}
async function sincronizarFinca(db, escritor) {
  if (!escritor) return { escritos: 0, borrados: 0, errores: estadoFinca(db).errores.length };
  const upserts = [];
  const borrados = [];
  const firmaDe = /* @__PURE__ */ new Map();
  const movimientoDeFila = /* @__PURE__ */ new Map();
  for (const row of listCandidatosFinca(db)) {
    if (row.destino !== "finca") {
      if (row.finca_tx_id) {
        borrados.push({
          id: row.finca_tx_id,
          referencia: `extractos:${row.id}`,
          movimientoId: row.id
        });
      }
      continue;
    }
    if (!row.categoria_finca || !row.propiedad_id) {
      marcarFincaError(db, row.id, "Falta la propiedad o la categor\xEDa.");
      continue;
    }
    if (propiedadLocal(row.propiedad_id)) {
      marcarFincaError(db, row.id, "Esta propiedad est\xE1 solo en este libro. Trae las de Finca para escribir el apunte.");
      continue;
    }
    const fila = filaFinca({
      id: uuidEstable(`extractos:${row.id}`),
      movimientoId: row.id,
      propiedadId: row.propiedad_id,
      fecha: row.fecha,
      importeCentimos: row.importe_centimos,
      categoria: row.categoria_finca,
      concepto: row.concepto
    });
    const firma = firmaFila(fila);
    if (row.finca_tx_id && row.finca_firma === firma && !row.finca_error) continue;
    upserts.push(fila);
    firmaDe.set(fila.id, firma);
    movimientoDeFila.set(fila.id, row.id);
  }
  if (upserts.length === 0 && borrados.length === 0) {
    return { escritos: 0, borrados: 0, errores: estadoFinca(db).errores.length };
  }
  let resultado;
  try {
    resultado = await escritor.aplicar({
      upserts,
      borrados: borrados.map(({ id, referencia }) => ({ id, referencia }))
    });
  } catch (err) {
    const msg = mensajeError(err);
    for (const fila of upserts) {
      const movId = movimientoDeFila.get(fila.id);
      if (movId) marcarFincaError(db, movId, msg);
    }
    for (const b of borrados) marcarFincaError(db, b.movimientoId, msg);
    return { escritos: 0, borrados: 0, errores: estadoFinca(db).errores.length };
  }
  const fallos = new Map(resultado.fallos.map((f) => [f.id, f.error]));
  const confirmados = new Set(resultado.ok);
  const ahora = (/* @__PURE__ */ new Date()).toISOString();
  let escritos = 0;
  let borradosOk = 0;
  for (const fila of upserts) {
    const movId = movimientoDeFila.get(fila.id);
    if (!movId) continue;
    const fallo = fallos.get(fila.id);
    if (fallo) marcarFincaError(db, movId, fallo);
    else if (confirmados.has(fila.id)) {
      marcarFincaOk(db, movId, fila.id, firmaDe.get(fila.id) ?? firmaFila(fila), ahora);
      escritos += 1;
    } else marcarFincaError(db, movId, "Finca no ha confirmado el apunte.");
  }
  for (const b of borrados) {
    const fallo = fallos.get(b.id);
    if (fallo) marcarFincaError(db, b.movimientoId, fallo);
    else if (confirmados.has(b.id)) {
      limpiarFinca(db, b.movimientoId);
      borradosOk += 1;
    } else marcarFincaError(db, b.movimientoId, "Finca no ha confirmado el borrado.");
  }
  return { escritos, borrados: borradosOk, errores: estadoFinca(db).errores.length };
}
async function retirarArchivoDeFinca(db, escritor, archivoId) {
  const filas = listFincaDeArchivo(db, archivoId);
  if (filas.length === 0) return;
  const resultado = await escritor.aplicar({
    upserts: [],
    borrados: filas.map((f) => ({ id: f.finca_tx_id, referencia: `extractos:${f.id}` }))
  });
  if (resultado.fallos.length > 0) throw new HttpError(502, resultado.fallos[0]?.error ?? "Finca no ha borrado el apunte");
  for (const fila of filas) limpiarFinca(db, fila.id);
}

// server/libro.ts
import { BlobAccessError, BlobNotFoundError, BlobStoreNotFoundError, get as get2, put } from "@vercel/blob";
import { readFileSync as readFileSync2, rmSync, writeFileSync } from "node:fs";
var PATHNAME = "libro/extractos.sqlite";
var TMP = "/tmp/extractos-libro.sqlite";
async function abrirLibroNube() {
  rmSync(TMP, { force: true });
  rmSync(`${TMP}-wal`, { force: true });
  rmSync(`${TMP}-shm`, { force: true });
  try {
    const got = await get2(PATHNAME, { access: "private", useCache: false });
    if (got?.statusCode === 200 && got.stream) {
      const buf = Buffer.from(await new Response(got.stream).arrayBuffer());
      writeFileSync(TMP, buf);
    }
  } catch (err) {
    if (err instanceof BlobNotFoundError) {
    } else if (err instanceof BlobStoreNotFoundError || err instanceof BlobAccessError) {
      throw new Error("Falta el almac\xE9n privado del libro en Vercel.");
    } else {
      throw err;
    }
  }
  const db = openDb(TMP, { wal: false });
  return {
    db,
    cerrar: async (guardar) => {
      db.close();
      if (!guardar) return;
      await put(PATHNAME, readFileSync2(TMP), {
        access: "private",
        allowOverwrite: true,
        contentType: "application/octet-stream"
      });
    }
  };
}

// server/servicio.ts
import { mkdirSync as mkdirSync3, writeFileSync as writeFileSync3 } from "node:fs";
import { join as join4 } from "node:path";
import { randomUUID } from "node:crypto";

// shared/clasificar.ts
function categoriasPara(destino, importeCentimos) {
  if (destino === "finca") return importeCentimos >= 0 ? CATEGORIAS_INGRESO_FINCA : CATEGORIAS_GASTO_FINCA;
  if (destino === "personal") return importeCentimos >= 0 ? CATEGORIAS_INGRESO_PERSONAL : CATEGORIAS_GASTO_PERSONAL;
  return [];
}
function errorClasificacion(input) {
  const { destino, importeCentimos } = input;
  if (destino === "pendiente" || destino === "traspaso" || destino === "ignorar") return null;
  const categoria = destino === "finca" ? input.categoriaFinca : input.categoriaPersonal;
  if (!categoria) return "Falta la categor\xEDa";
  const validas = categoriasPara(destino, importeCentimos);
  if (!validas.includes(categoria)) {
    const lado = importeCentimos >= 0 ? "un ingreso" : "un gasto";
    return `\xAB${categoria}\xBB no es ${lado} de ${destino === "finca" ? "Finca" : "la cuenta personal"}`;
  }
  if (destino === "finca" && !input.propiedadId) return "Falta la propiedad";
  return null;
}
function sugerirPatron(concepto) {
  return normalizar(concepto).replace(/\b\d+\b/g, " ").replace(/\s+/g, " ").trim().split(" ").filter((w) => w.length > 2).slice(0, 5).join(" ");
}
function reglaGanadora(concepto, reglas) {
  const n = normalizar(concepto);
  const hits = reglas.filter((r) => {
    const p = normalizar(r.patron);
    return p.length >= 3 && n.includes(p);
  });
  hits.sort((a, b) => normalizar(b.patron).length - normalizar(a.patron).length || b.creadoEn.localeCompare(a.creadoEn));
  return hits[0] ?? null;
}

// shared/formato.ts
function textoEur(centimos) {
  if (centimos == null || !Number.isFinite(centimos)) return "\u2014";
  const sign = centimos < 0 ? "-" : "";
  const abs = Math.abs(Math.round(centimos));
  const euros = Math.floor(abs / 100);
  const dec = String(abs % 100).padStart(2, "0");
  const miles = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${sign}${miles},${dec} \u20AC`;
}
function textoFecha(iso) {
  if (!iso) return "\u2014";
  const [y, m, d] = iso.slice(0, 10).split("-");
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}
function importeFinca(centimos) {
  const abs = Math.abs(Math.round(centimos));
  return `${Math.floor(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

// shared/exportar.ts
function slug(nombre) {
  const s = normalizar(nombre).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return s || "propiedad";
}
function descripcion(concepto) {
  return concepto.replace(/[;\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 180);
}
function exportarFinca(movs, soloNuevos) {
  const grupos = /* @__PURE__ */ new Map();
  const rechazados = [];
  const elegidos = movs.filter((m) => m.destino === "finca" && (!soloNuevos || !m.exportadoFincaEn)).slice().sort((a, b) => a.fecha.localeCompare(b.fecha) || a.concepto.localeCompare(b.concepto, "es"));
  for (const m of elegidos) {
    const motivo = errorClasificacion({
      destino: "finca",
      importeCentimos: m.importeCentimos,
      categoriaFinca: m.categoriaFinca,
      propiedadId: m.propiedadId
    });
    if (motivo || !m.categoriaFinca || !m.propiedadId || !m.propiedadNombre) {
      rechazados.push({ id: m.id, concepto: m.concepto, motivo: motivo ?? "Falta la propiedad" });
      continue;
    }
    if (m.importeCentimos === 0) continue;
    const tipo = m.importeCentimos < 0 ? "gasto" : "ingreso";
    const linea = `${m.fecha};${tipo};${m.categoriaFinca};${importeFinca(m.importeCentimos)};${descripcion(m.concepto)}`;
    const g = grupos.get(m.propiedadId) ?? { nombre: m.propiedadNombre, lineas: [], ids: [] };
    g.lineas.push(linea);
    g.ids.push(m.id);
    grupos.set(m.propiedadId, g);
  }
  const usados = /* @__PURE__ */ new Set();
  const ficheros = [];
  for (const [propiedadId, g] of grupos) {
    let base = slug(g.nombre);
    if (usados.has(base)) base = `${base}-${propiedadId.slice(0, 8)}`;
    usados.add(base);
    ficheros.push({
      propiedadId,
      propiedadNombre: g.nombre,
      fichero: `${base}.txt`,
      texto: `${g.lineas.join("\n")}
`,
      ids: g.ids,
      lineas: g.lineas.length
    });
  }
  return { ficheros, rechazados };
}
function propuestaFym(input) {
  return {
    nota: "Propuesta para confirmar a mano en Fuck You Money. Extractos no cambia los saldos all\xED. Fuck You Money guarda una foto declarada.",
    generadoEn: input.generadoEn,
    gastoVidaMensualCentimos: input.media.mediaCentimos,
    gastoVidaMensual: textoEur(input.media.mediaCentimos),
    meses: input.media.meses,
    aviso: input.media.aviso,
    cuentas: input.cuentas
  };
}

// shared/patrimonio.ts
function saldoDeCuenta(cuentaId, saldoInicialCentimos, saldoInicialFecha, archivos, movimientos) {
  const propios = archivos.filter((a) => a.cuentaId === cuentaId && a.saldoFinalCentimos != null);
  propios.sort((a, b) => (b.hasta ?? "").localeCompare(a.hasta ?? ""));
  const mejor = propios[0];
  if (mejor && mejor.saldoFinalCentimos != null) {
    return { centimos: mejor.saldoFinalCentimos, fecha: mejor.hasta, origen: "extracto" };
  }
  const conSaldo = movimientos.filter((m) => m.cuentaId === cuentaId && m.saldoCentimos != null).sort((a, b) => a.fecha.localeCompare(b.fecha) || a.orden - b.orden);
  const ultimo = conSaldo[conSaldo.length - 1];
  if (ultimo && ultimo.saldoCentimos != null) {
    return { centimos: ultimo.saldoCentimos, fecha: ultimo.fecha, origen: "extracto" };
  }
  const movs = movimientos.filter((m) => m.cuentaId === cuentaId);
  if (saldoInicialCentimos != null) {
    const suma = movs.reduce((a, m) => a + m.importeCentimos, 0);
    const fecha = movs.reduce((max, m) => max == null || m.fecha > max ? m.fecha : max, saldoInicialFecha);
    return { centimos: saldoInicialCentimos + suma, fecha, origen: "calculado" };
  }
  return { centimos: null, fecha: null, origen: "sin_datos" };
}
function cuadreCentimos(inicial, final, importes) {
  if (inicial == null || final == null) return null;
  const suma = importes.reduce((a, b) => a + b, 0);
  return final - (inicial + suma);
}
function informeMes(movs, mes) {
  const delMes = movs.filter((m) => mesDe(m.fecha) === mes);
  let ingresosFincaCentimos = 0;
  let gastosFincaCentimos = 0;
  let ingresosPersonalCentimos = 0;
  let gastosPersonalCentimos = 0;
  let vidaCentimos = 0;
  let pendientes = 0;
  const grupos = /* @__PURE__ */ new Map();
  for (const m of delMes) {
    if (m.destino === "pendiente") {
      pendientes += 1;
      continue;
    }
    if (m.destino === "traspaso" || m.destino === "ignorar") continue;
    const ambito = m.destino;
    const categoria = (ambito === "finca" ? m.categoriaFinca : m.categoriaPersonal) || "Sin categor\xEDa";
    const key = `${ambito}:${categoria}`;
    const prev = grupos.get(key) ?? { ambito, categoria, centimos: 0 };
    prev.centimos += m.importeCentimos;
    grupos.set(key, prev);
    if (m.importeCentimos >= 0) {
      if (ambito === "finca") ingresosFincaCentimos += m.importeCentimos;
      else ingresosPersonalCentimos += m.importeCentimos;
    } else if (ambito === "finca") gastosFincaCentimos += -m.importeCentimos;
    else gastosPersonalCentimos += -m.importeCentimos;
    if (ambito === "personal" && categoriaVida(categoria)) vidaCentimos -= m.importeCentimos;
  }
  const porCategoria = [...grupos.values()].sort((a, b) => Math.abs(b.centimos) - Math.abs(a.centimos));
  return {
    ingresosFincaCentimos,
    gastosFincaCentimos,
    ingresosPersonalCentimos,
    gastosPersonalCentimos,
    vidaCentimos,
    porCategoria,
    pendientes
  };
}
function gastosBrutos(movs, cuentaIds, mes) {
  let total = 0;
  for (const m of movs) {
    if (!cuentaIds.has(m.cuentaId)) continue;
    if (mesDe(m.fecha) !== mes) continue;
    if (m.destino === "traspaso" || m.destino === "ignorar") continue;
    if (m.importeCentimos >= 0) continue;
    total += -m.importeCentimos;
  }
  return total;
}
function historialSaldos(archivos, cuentas) {
  const nombres = new Map(cuentas.map((c) => [c.id, c.nombre]));
  const puntos = [];
  for (const a of archivos) {
    if (!a.cuentaId || a.saldoFinalCentimos == null || !a.hasta) continue;
    const cuentaNombre = nombres.get(a.cuentaId);
    if (!cuentaNombre) continue;
    puntos.push({
      cuentaId: a.cuentaId,
      cuentaNombre,
      fecha: a.hasta,
      saldoCentimos: a.saldoFinalCentimos,
      extracto: a.extracto
    });
  }
  puntos.sort((a, b) => a.cuentaNombre.localeCompare(b.cuentaNombre, "es") || a.fecha.localeCompare(b.fecha) || a.extracto.localeCompare(b.extracto, "es"));
  return puntos;
}
function mediaGastoVida(movs, hoy) {
  const porMes = /* @__PURE__ */ new Map();
  for (const m of movs) {
    if (m.destino !== "personal") continue;
    const categoria = m.categoriaPersonal ?? "";
    if (!categoriaVida(categoria)) continue;
    const mes = mesDe(m.fecha);
    porMes.set(mes, (porMes.get(mes) ?? 0) - m.importeCentimos);
  }
  const mesActual = hoy.slice(0, 7);
  const cerrados = [...porMes.keys()].filter((m) => m < mesActual).sort();
  const usar = cerrados.length > 0 ? cerrados : [...porMes.keys()].sort();
  const ultimos = usar.slice(-3);
  if (ultimos.length === 0) {
    return {
      mediaCentimos: null,
      meses: [],
      aviso: "Todav\xEDa no hay gastos de vida clasificados."
    };
  }
  const suma = ultimos.reduce((a, m) => a + (porMes.get(m) ?? 0), 0);
  const mediaCentimos = Math.round(suma / ultimos.length);
  const aviso = cerrados.length === 0 ? "Solo est\xE1 el mes en curso. La media se asentar\xE1 cuando cierres un mes." : `Media de ${ultimos.length} ${ultimos.length === 1 ? "mes cerrado" : "meses cerrados"}, sin gastos de finca, traspasos, ahorro ni deuda.`;
  return { mediaCentimos, meses: ultimos, aviso };
}

// shared/visto.ts
function ultimoApunte(movs) {
  if (movs.length === 0) return null;
  let fecha = movs[0].fecha;
  for (const mov of movs) {
    if (mov.fecha > fecha) fecha = mov.fecha;
  }
  const delDia = movs.filter((mov) => mov.fecha === fecha);
  const elegido = [...delDia].sort((a, b) => a.orden - b.orden)[0];
  if (!elegido) return null;
  return {
    fecha,
    concepto: elegido.concepto,
    importeCentimos: elegido.importeCentimos,
    eseDia: delDia.length
  };
}
function saldoIdentificaLinea(movs) {
  if (movs.length === 0) return false;
  const saldos = [];
  for (const mov of movs) {
    if (mov.saldoCentimos == null) return false;
    saldos.push(mov.saldoCentimos);
  }
  return new Set(saldos).size === saldos.length;
}
function diaSiguiente(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m ?? 1) - 1, (d ?? 1) + 1));
  return dt.toISOString().slice(0, 10);
}
function hayHueco(vistoHasta, desde) {
  if (!vistoHasta || !desde) return false;
  return desde > diaSiguiente(vistoHasta);
}

// server/catalogos.ts
import { homedir as homedir2 } from "node:os";
import { join as join2 } from "node:path";
import { Client as Client2 } from "pg";
function centimosPg(value) {
  if (value == null) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value * 100);
  if (typeof value !== "string") return null;
  const s = value.trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return Math.round(Number(s) * 100);
  const c = centimosDesdeTexto(s);
  return Number.isNaN(c) ? null : c;
}
async function consultar(urls, sql) {
  let last = "No se pudo conectar";
  for (const url of urls) {
    const client = new Client2({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      connectionTimeoutMillis: 8e3
    });
    try {
      await client.connect();
      const result = await client.query(sql);
      await client.end().catch(() => {
      });
      return result.rows;
    } catch (err) {
      last = mensajeError(err);
      await client.end().catch(() => {
      });
    }
  }
  throw new Error(last);
}
async function sincronizarCatalogos(db) {
  const errores = [];
  let propiedades = null;
  let fymCuentas = null;
  const ahora = (/* @__PURE__ */ new Date()).toISOString();
  const fincaUrl = urlAplicacion("FINCA_DATABASE_URL", join2(homedir2(), ".finca-db.env"));
  if (!fincaUrl) {
    errores.push("No est\xE1 ~/.finca-db.env, as\xED que no puedo traer las propiedades.");
  } else {
    try {
      const rows = await consultar(fincaUrlsToTry(fincaUrl), "SELECT id, nombre FROM propiedades ORDER BY nombre");
      reemplazarPropiedadesFinca(
        db,
        rows.map((r) => ({
          id: String(r.id),
          nombre: String(r.nombre),
          origen: "finca",
          visto_en: ahora
        }))
      );
      propiedades = rows.length;
    } catch (err) {
      errores.push(`Finca: ${mensajeError(err)}`);
    }
  }
  const fymUrl = urlAplicacion("FYM_DATABASE_URL", join2(homedir2(), ".fuckyoumoney-db.env"));
  if (!fymUrl) {
    errores.push("No est\xE1 ~/.fuckyoumoney-db.env, as\xED que no puedo traer las cuentas.");
  } else {
    try {
      const rows = await consultar(
        [fymUrl],
        `SELECT id, name, manual_value FROM assets WHERE type = 'cash' ORDER BY name`
      );
      reemplazarFym(
        db,
        rows.map((r) => ({
          id: String(r.id),
          nombre: String(r.name),
          valor_centimos: centimosPg(r.manual_value),
          visto_en: ahora
        }))
      );
      fymCuentas = rows.length;
    } catch (err) {
      errores.push(`Fuck You Money: ${mensajeError(err)}`);
    }
  }
  return { propiedades, fymCuentas, errores };
}

// server/importar.ts
import { mkdirSync as mkdirSync2, readdirSync, readFileSync as readFileSync3, unlinkSync, writeFileSync as writeFileSync2, existsSync as existsSync2, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join as join3, resolve, sep } from "node:path";

// shared/asignar.ts
function aliasEnNombre(alias, filename) {
  const a = normalizar(alias);
  if (a.length < 3) return false;
  return normalizar(filename).includes(a);
}
function cccDeCuenta(cuenta) {
  const propio = cuenta.ccc.replace(/\D/g, "");
  if (propio.length === 18) return propio;
  return "";
}
function elegirCuenta(pista, filename, cuentas) {
  const cccBloque = (pista.ccc ?? "").replace(/\D/g, "");
  if (cccBloque.length === 18) {
    const porCcc = cuentas.filter((c) => {
      const propio = cccDeCuenta(c);
      if (propio && propio === cccBloque) return true;
      return ibanCoincideConCcc(c.iban, cccBloque);
    });
    if (porCcc.length === 1) return { id: porCcc[0].id };
    if (porCcc.length > 1) return { ambiguo: "Varias cuentas tienen el mismo IBAN o CCC" };
  }
  const porAlias = cuentas.filter((c) => aliasEnNombre(c.alias, filename));
  if (porAlias.length === 1) return { id: porAlias[0].id };
  if (porAlias.length > 1) return { ambiguo: `Varias cuentas encajan con el nombre \xAB${filename}\xBB` };
  return null;
}

// shared/extracto.ts
function saldosDeMovimientos(movs) {
  if (movs.length === 0) return {};
  const desde = movs.reduce((m, x) => x.fecha < m ? x.fecha : m, movs[0].fecha);
  const hasta = movs.reduce((m, x) => x.fecha > m ? x.fecha : m, movs[0].fecha);
  const descendente = movs[0].fecha > movs[movs.length - 1].fecha;
  const reciente = descendente ? movs[0] : movs[movs.length - 1];
  const antiguo = descendente ? movs[movs.length - 1] : movs[0];
  return {
    desde,
    hasta,
    saldoFinalCentimos: reciente.saldoCentimos,
    saldoInicialCentimos: antiguo.saldoCentimos == null ? void 0 : antiguo.saldoCentimos - antiguo.importeCentimos
  };
}

// shared/csv.ts
var ALIAS = {
  fecha: ["fecha", "fecha operacion", "fecha movimiento", "f operacion", "date"],
  fechaValor: ["fecha valor", "f valor"],
  concepto: ["concepto", "movimiento", "descripcion", "detalle"],
  extra: ["mas datos", "observaciones", "concepto adicional", "ampliacion", "comentario", "comentarios", "nota", "notas"],
  importe: ["importe", "cantidad", "amount", "importe eur"],
  debe: ["debe", "cargo", "cargos"],
  haber: ["haber", "abono", "abonos"],
  saldo: ["saldo", "balance", "saldo eur"],
  signo: ["signo", "dh", "tipo"]
};
function normHeader(s) {
  return normalizar(s).replace(/\([^)]*\)/g, " ").replace(/\beur\b/g, " ").replace(/\s+/g, " ").trim();
}
function campoDe(header) {
  const h = normHeader(header);
  if (!h) return null;
  const orden = ["fechaValor", "fecha", "extra", "concepto", "importe", "debe", "haber", "saldo", "signo"];
  for (const c of orden) {
    if (ALIAS[c].includes(h)) return c;
  }
  if (h.startsWith("fecha valor")) return "fechaValor";
  if (h.startsWith("fecha")) return "fecha";
  if (h.includes("importe") || h === "amount") return "importe";
  if (h.includes("saldo") || h === "balance") return "saldo";
  if (h.includes("concepto") || h.includes("descripcion") || h.includes("movimiento")) return "concepto";
  if (h.includes("mas datos") || h.includes("observacion")) return "extra";
  return null;
}
function splitCsvLine(line, delim) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        cur += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === delim) {
      out.push(cur.trim());
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(cur.trim());
  return out;
}
function lineasCrudas(texto) {
  return texto.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").map((l) => l.trim()).filter((l) => l.length > 0);
}
function delimDe(lineas) {
  const sep2 = lineas.find((l) => /^sep\s*=\s*.$/i.test(l));
  if (sep2) return sep2.slice(-1);
  const cuenta = { ";": 0, ",": 0, "	": 0 };
  for (const l of lineas.slice(0, 30)) {
    cuenta[";"] += (l.match(/;/g) ?? []).length;
    cuenta[","] += (l.match(/,/g) ?? []).length;
    cuenta["	"] += (l.match(/\t/g) ?? []).length;
  }
  if (cuenta[";"] >= cuenta[","] && cuenta[";"] >= cuenta["	"] && cuenta[";"] > 0) return ";";
  if (cuenta["	"] >= cuenta[","] && cuenta["	"] > 0) return "	";
  return ",";
}
function indiceCabecera(filas) {
  for (let i = 0; i < Math.min(filas.length, 40); i++) {
    const mapa = /* @__PURE__ */ new Map();
    filas[i].forEach((cell, col) => {
      const c = campoDe(cell);
      if (!c) return;
      if (!mapa.has(c)) mapa.set(c, col);
      else if (c === "concepto" && !mapa.has("extra")) mapa.set("extra", col);
    });
    const tieneFecha = mapa.has("fecha") || mapa.has("fechaValor");
    const tieneImporte = mapa.has("importe") || mapa.has("debe") || mapa.has("haber");
    if (tieneFecha && tieneImporte) return { index: i, mapa };
  }
  return null;
}
function signoDe(raw) {
  const s = normalizar(raw);
  if (["1", "d", "debe", "cargo", "gasto"].includes(s)) return -1;
  if (["2", "h", "haber", "abono", "ingreso"].includes(s)) return 1;
  return null;
}
function celda(fila, idx) {
  if (idx == null) return "";
  return fila[idx] ?? "";
}
function parseTabla(filas, textoIban, formato) {
  const etiqueta = formato === "excel" ? "La hoja" : "El CSV";
  if (filas.length < 2) return { ok: false, formato, error: `${etiqueta} no tiene filas` };
  const cabecera = indiceCabecera(filas);
  if (!cabecera) return { ok: false, formato, error: "No encuentro columnas de fecha e importe" };
  const { mapa } = cabecera;
  const avisos = [];
  const movimientos = [];
  for (let i = cabecera.index + 1; i < filas.length; i++) {
    const fila = filas[i];
    if (fila.every((c) => c.trim() === "")) continue;
    const fecha = parseFecha(celda(fila, mapa.get("fecha"))) ?? parseFecha(celda(fila, mapa.get("fechaValor")));
    if (!fecha) {
      const concepto2 = celda(fila, mapa.get("concepto"));
      if (normalizar(concepto2) !== "total") avisos.push(`Fila ${i + 1} sin fecha`);
      continue;
    }
    let importe;
    if (mapa.has("importe")) {
      importe = centimosDesdeTexto(celda(fila, mapa.get("importe")));
      const signo = signoDe(celda(fila, mapa.get("signo")));
      if (!Number.isNaN(importe) && importe > 0 && signo === -1) importe = -importe;
    } else {
      const debe = centimosDesdeTexto(celda(fila, mapa.get("debe")));
      const haber = centimosDesdeTexto(celda(fila, mapa.get("haber")));
      const d = Number.isNaN(debe) ? 0 : Math.abs(debe);
      const h = Number.isNaN(haber) ? 0 : Math.abs(haber);
      if (d === 0 && h === 0) importe = NaN;
      else importe = h - d;
    }
    if (Number.isNaN(importe) || importe === 0) {
      avisos.push(`Fila ${i + 1} sin importe`);
      continue;
    }
    const concepto = [celda(fila, mapa.get("concepto")), celda(fila, mapa.get("extra"))].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    const saldoRaw = celda(fila, mapa.get("saldo"));
    const saldo = saldoRaw ? centimosDesdeTexto(saldoRaw) : NaN;
    const fechaValor = parseFecha(celda(fila, mapa.get("fechaValor")));
    movimientos.push({
      orden: movimientos.length,
      fecha,
      fechaValor: fechaValor ?? void 0,
      importeCentimos: importe,
      saldoCentimos: Number.isNaN(saldo) ? void 0 : saldo,
      concepto: concepto || "Sin concepto"
    });
  }
  if (movimientos.length === 0) {
    return { ok: false, formato, error: avisos[0] ?? `${etiqueta} no tiene movimientos` };
  }
  const iban = buscarIban(textoIban) ?? void 0;
  const bloque = {
    iban,
    ccc: iban ? cccDesdeIban(iban) ?? void 0 : ccc18DesdeCuenta(textoIban),
    ...saldosDeMovimientos(movimientos),
    movimientos
  };
  return { ok: true, formato, bloques: [bloque], avisos };
}
function parseCsv(texto) {
  const crudas = lineasCrudas(texto).filter((l) => !/^sep\s*=/i.test(l));
  if (crudas.length < 2) return { ok: false, formato: "csv", error: "El CSV no tiene filas" };
  const delim = delimDe(crudas);
  const filas = crudas.map((l) => splitCsvLine(l, delim));
  return parseTabla(filas, texto, "csv");
}

// shared/norma43.ts
var CONCEPTO_COMUN = {
  "01": "Reintegro",
  "02": "Ingreso",
  "03": "Domiciliaci\xF3n",
  "04": "Transferencia",
  "05": "Amortizaci\xF3n",
  "06": "Remesa de efectos",
  "07": "Suscripci\xF3n",
  "08": "Dividendo",
  "09": "Bolsa",
  "10": "Amortizaci\xF3n",
  "11": "N\xF3mina",
  "12": "Anulaci\xF3n",
  "14": "Devoluci\xF3n",
  "15": "N\xF3mina",
  "16": "Impuestos",
  "17": "Tarjeta",
  "98": "Anulaci\xF3n",
  "99": "Varios"
};
function campo(linea, desde, hasta) {
  return linea.slice(desde - 1, hasta);
}
function centimosFirmados(raw, dh) {
  if (!/^\d+$/.test(raw.trim()) || dh !== "1" && dh !== "2") return null;
  const n = Number(raw);
  if (!Number.isSafeInteger(n)) return null;
  return dh === "1" ? -n : n;
}
function registros(raw) {
  const text = raw.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 1 && lines[0].length >= 160 && lines[0].length % 80 === 0) {
    const s = lines[0];
    const out = [];
    for (let i = 0; i < s.length; i += 80) out.push(s.slice(i, i + 80));
    return out;
  }
  return lines;
}
function esNorma43(texto) {
  return registros(texto).some((l) => /^11\d{18}/.test(l));
}
function parseNorma43(texto) {
  if (!esNorma43(texto)) return { ok: false, formato: "norma43", error: "No es un fichero Norma 43" };
  const avisos = [];
  const bloques = [];
  const sinTextoBanco = /* @__PURE__ */ new Set();
  let actual = null;
  let ultimo = null;
  const cerrar = () => {
    if (!actual) return;
    bloques.push({
      ccc: actual.ccc,
      nombre: actual.nombre,
      desde: actual.desde,
      hasta: actual.hasta,
      saldoInicialCentimos: actual.saldoInicialCentimos,
      saldoFinalCentimos: actual.saldoFinalCentimos,
      movimientos: actual.movimientos
    });
    actual = null;
    ultimo = null;
  };
  for (const linea of registros(texto)) {
    const codigo = linea.slice(0, 2);
    if (codigo === "11") {
      cerrar();
      const entidad = campo(linea, 3, 6);
      const oficina = campo(linea, 7, 10);
      const cuenta = campo(linea, 11, 20);
      if (!/^\d{4}$/.test(entidad) || !/^\d{4}$/.test(oficina) || !/^\d{10}$/.test(cuenta)) {
        return { ok: false, formato: "norma43", error: "Cabecera de cuenta ilegible" };
      }
      const saldo = centimosFirmados(campo(linea, 34, 47), campo(linea, 33, 33));
      actual = {
        ccc: entidad + oficina + cuenta,
        nombre: campo(linea, 52, 77).trim() || void 0,
        desde: fechaYyMmDd(campo(linea, 21, 26)) ?? void 0,
        hasta: fechaYyMmDd(campo(linea, 27, 32)) ?? void 0,
        saldoInicialCentimos: saldo ?? void 0,
        movimientos: [],
        debitos: 0,
        creditos: 0,
        sumaDebe: 0,
        sumaHaber: 0
      };
      continue;
    }
    if (codigo === "22") {
      if (!actual) return { ok: false, formato: "norma43", error: "Movimiento sin cabecera de cuenta" };
      const fecha = fechaYyMmDd(campo(linea, 11, 16));
      const fechaValor = fechaYyMmDd(campo(linea, 17, 22));
      const importe = centimosFirmados(campo(linea, 29, 42), campo(linea, 28, 28));
      if (!fecha || importe == null) {
        avisos.push(`Apunte con fecha o importe ilegible (${campo(linea, 11, 16)})`);
        ultimo = null;
        continue;
      }
      const comun = campo(linea, 23, 24);
      const propio = campo(linea, 25, 27).trim();
      const documento = campo(linea, 43, 52).trim();
      const etiqueta = CONCEPTO_COMUN[comun] ?? `Concepto ${comun}`;
      const mov = {
        orden: actual.movimientos.length,
        fecha,
        fechaValor: fechaValor ?? void 0,
        importeCentimos: importe,
        concepto: propio && propio !== "000" ? `${etiqueta} ${propio}` : etiqueta,
        documento: documento || void 0
      };
      actual.movimientos.push(mov);
      sinTextoBanco.add(mov);
      ultimo = mov;
      if (importe < 0) {
        actual.debitos += 1;
        actual.sumaDebe += -importe;
      } else {
        actual.creditos += 1;
        actual.sumaHaber += importe;
      }
      continue;
    }
    if (codigo === "23") {
      if (!ultimo) continue;
      const a = campo(linea, 5, 42).trim();
      const b = campo(linea, 43, 80).trim();
      const extra = [a, b].filter(Boolean).join(" ");
      if (!extra) continue;
      if (sinTextoBanco.has(ultimo)) {
        ultimo.concepto = extra;
        sinTextoBanco.delete(ultimo);
      } else {
        ultimo.concepto = `${ultimo.concepto} ${extra}`.replace(/\s+/g, " ").trim();
      }
      continue;
    }
    if (codigo === "33") {
      if (!actual) continue;
      const saldo = centimosFirmados(campo(linea, 60, 73), campo(linea, 59, 59));
      if (saldo != null) actual.saldoFinalCentimos = saldo;
      const nDebe = Number(campo(linea, 21, 25));
      const nHaber = Number(campo(linea, 40, 44));
      if (Number.isFinite(nDebe) && nDebe !== actual.debitos) {
        avisos.push(`El cierre dice ${nDebe} cargos y he le\xEDdo ${actual.debitos}`);
      }
      if (Number.isFinite(nHaber) && nHaber !== actual.creditos) {
        avisos.push(`El cierre dice ${nHaber} abonos y he le\xEDdo ${actual.creditos}`);
      }
      cerrar();
      continue;
    }
    if (codigo === "88" || codigo === "24") continue;
  }
  cerrar();
  if (bloques.length === 0) return { ok: false, formato: "norma43", error: "La Norma 43 no trae ninguna cuenta" };
  return { ok: true, formato: "norma43", bloques, avisos };
}

// shared/texto.ts
var LINEA = /^(\d{2}[/\-.]\d{2}[/\-.]\d{4})(?:\s+(\d{2}[/\-.]\d{2}[/\-.]\d{4}))?\s+(.+?)\s+(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2})(?:\s+(-?\d{1,3}(?:\.\d{3})*,\d{2}|-?\d+,\d{2}))?\s*$/;
function parseTexto(texto) {
  const lineas = texto.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const movimientos = [];
  for (const linea of lineas) {
    const m = LINEA.exec(linea.trim());
    if (!m) continue;
    const fecha = parseFecha(m[1]);
    const fechaValor = m[2] ? parseFecha(m[2]) : null;
    const importe = centimosDesdeTexto(m[4]);
    const saldo = m[5] ? centimosDesdeTexto(m[5]) : NaN;
    if (!fecha || Number.isNaN(importe) || importe === 0) continue;
    movimientos.push({
      orden: movimientos.length,
      fecha,
      fechaValor: fechaValor ?? void 0,
      importeCentimos: importe,
      saldoCentimos: Number.isNaN(saldo) ? void 0 : saldo,
      concepto: m[3].replace(/\s+/g, " ").trim() || "Sin concepto"
    });
  }
  if (movimientos.length === 0) {
    return { ok: false, formato: "texto", error: "No veo l\xEDneas con fecha e importe" };
  }
  const iban = buscarIban(texto) ?? void 0;
  const bloque = {
    iban,
    ccc: iban ? cccDesdeIban(iban) ?? void 0 : void 0,
    ...saldosDeMovimientos(movimientos),
    movimientos
  };
  return { ok: true, formato: "texto", bloques: [bloque], avisos: [] };
}

// shared/parse.ts
function parseExtracto(texto) {
  if (esNorma43(texto)) return parseNorma43(texto);
  const csv = parseCsv(texto);
  if (csv.ok) return csv;
  const textoPlano = parseTexto(texto);
  if (textoPlano.ok) return textoPlano;
  return {
    ok: false,
    formato: "desconocido",
    error: "No reconozco el formato. Sirve un CSV, un Excel, un PDF o Norma 43."
  };
}

// shared/formatos.ts
var EXTENSIONES_EXTRACTO = [
  "csv",
  "tsv",
  "txt",
  "pdf",
  "n43",
  "c43",
  "csb43",
  "aeb43",
  "sta",
  "xls",
  "xlsx",
  "xlsm",
  "xlsb",
  "ods",
  "numbers"
];
var ACCEPT_FICHEROS = EXTENSIONES_EXTRACTO.map((ext) => `.${ext}`).join(",");

// server/decode.ts
import { execFileSync } from "node:child_process";
import { extractTextItems } from "unpdf";
function decodeTextoBanco(buf) {
  if (buf.length >= 2 && buf[0] === 255 && buf[1] === 254) return buf.toString("utf16le");
  if (buf.length >= 3 && buf[0] === 239 && buf[1] === 187 && buf[2] === 191) {
    return buf.subarray(3).toString("utf8");
  }
  const utf8 = buf.toString("utf8");
  if (utf8.includes("\uFFFD")) return buf.toString("latin1");
  return utf8;
}
function lineasDeItems(paginas) {
  const lineas = [];
  for (const items of paginas) {
    const ordenados = items.filter((it) => it.str.trim()).sort((a, b) => b.y - a.y || a.x - b.x);
    let grupo = [];
    let y = 0;
    const volcar = () => {
      if (grupo.length === 0) return;
      grupo.sort((a, b) => a.x - b.x);
      let texto = "";
      let cursor = grupo[0]?.x ?? 0;
      for (const it of grupo) {
        if (texto) {
          const hueco = it.x - cursor;
          texto += hueco > Math.max(it.fontSize || 8, 8) ? "  " : " ";
        }
        texto += it.str;
        cursor = it.x + (it.width || it.str.length);
      }
      const limpia = texto.replace(/\s+/g, " ").trim();
      if (limpia) lineas.push(limpia);
      grupo = [];
    };
    for (const it of ordenados) {
      const tolerancia = Math.max(it.fontSize || 8, 8) * 0.6;
      if (grupo.length > 0 && Math.abs(it.y - y) > tolerancia) volcar();
      if (grupo.length === 0) {
        grupo = [it];
        y = it.y;
      } else {
        grupo.push(it);
      }
    }
    volcar();
  }
  return lineas.join("\n");
}
async function textoPdfJs(buf) {
  try {
    const { items } = await extractTextItems(new Uint8Array(buf));
    return lineasDeItems(items);
  } catch {
    throw new Error("No he podido leer el PDF. Exporta el extracto en CSV o Excel.");
  }
}
async function textoPdf(path, buf) {
  if (!process.env.VERCEL) {
    try {
      const texto2 = execFileSync("pdftotext", ["-layout", "-enc", "UTF-8", path, "-"], {
        encoding: "utf8",
        maxBuffer: 2e7
      });
      if (texto2.trim()) return texto2;
    } catch (err) {
      const code = err && typeof err === "object" && "code" in err ? String(err.code) : "";
      if (code !== "ENOENT") {
        const js = await textoPdfJs(buf).catch(() => "");
        if (js.trim()) return js;
        throw new Error("No he podido leer el PDF. Exporta el extracto en CSV o Excel.");
      }
    }
  }
  const texto = await textoPdfJs(buf);
  if (!texto.trim()) throw new Error("El PDF no trae texto. Si es un escaneo, exporta CSV o Excel.");
  return texto;
}

// server/hoja.ts
import { read, utils } from "xlsx";
function textoCelda(value) {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const d = String(value.getDate()).padStart(2, "0");
    const m = String(value.getMonth() + 1).padStart(2, "0");
    return `${d}/${m}/${value.getFullYear()}`;
  }
  return String(value).trim();
}
function parseHoja(buf) {
  let libro;
  try {
    libro = read(buf, { type: "buffer", cellDates: true });
  } catch {
    return { ok: false, formato: "excel", error: "No he podido abrir la hoja de c\xE1lculo." };
  }
  const bloques = [];
  const avisos = [];
  let ultimo = "No encuentro columnas de fecha e importe";
  for (const nombre of libro.SheetNames) {
    const hoja = libro.Sheets[nombre];
    if (!hoja) continue;
    const rows = utils.sheet_to_json(hoja, {
      header: 1,
      raw: false,
      defval: "",
      dateNF: "dd/mm/yyyy",
      blankrows: false
    });
    const filas = rows.map((fila) => (Array.isArray(fila) ? fila : [fila]).map(textoCelda));
    if (filas.every((fila) => fila.every((celda2) => celda2 === ""))) continue;
    const parsed = parseTabla(filas, filas.flat().join("\n"), "excel");
    if (!parsed.ok) {
      ultimo = parsed.error;
      continue;
    }
    bloques.push(...parsed.bloques);
    avisos.push(...parsed.avisos);
  }
  if (bloques.length === 0) return { ok: false, formato: "excel", error: ultimo };
  return { ok: true, formato: "excel", bloques, avisos };
}

// server/importar.ts
var EXT_OK = new Set(EXTENSIONES_EXTRACTO);
var EXT_HOJA = /* @__PURE__ */ new Set(["xls", "xlsx", "xlsm", "xlsb", "ods", "numbers"]);
var MAX_BYTES = 2e7;
function asegurarCarpetas(rutas2) {
  mkdirSync2(rutas2.inbox, { recursive: true });
  mkdirSync2(rutas2.exportDir, { recursive: true });
  mkdirSync2(join3(rutas2.root, "data"), { recursive: true });
}
function extension(nombre) {
  const i = nombre.lastIndexOf(".");
  return i >= 0 ? nombre.slice(i + 1).toLowerCase() : "";
}
function nombreSeguro(raw) {
  const base = raw.split(/[/\\]/).pop() || "extracto";
  const limpio = base.replace(/[^\w.\- ()áéíóúñüÁÉÍÓÚÑÜ]+/g, "_").slice(0, 120);
  return limpio || "extracto";
}
function dentro(dir, file) {
  const root = resolve(dir);
  const full = resolve(file);
  return full === root || full.startsWith(root + sep);
}
function reglasDominio(db) {
  return listReglas(db).map((r) => ({
    id: r.id,
    patron: r.patron,
    destino: destinoDe(r),
    categoriaFinca: r.categoria_finca,
    propiedadId: r.propiedad_id,
    categoriaPersonal: r.categoria_personal,
    creadoEn: r.creado_en
  }));
}
function cuentasPista(db) {
  return listCuentas(db).map((c) => ({
    id: c.id,
    alias: c.alias,
    iban: c.iban,
    ccc: c.ccc,
    nombre: c.nombre
  }));
}
function aplicarRegla(db, reglas, concepto, importeCentimos) {
  const regla = reglaGanadora(concepto, reglas);
  if (!regla) {
    return { destino: "pendiente", categoriaFinca: null, propiedadId: null, categoriaPersonal: null, reglaId: null };
  }
  const error = errorClasificacion({ ...regla, importeCentimos });
  if (error) {
    return { destino: "pendiente", categoriaFinca: null, propiedadId: null, categoriaPersonal: null, reglaId: null };
  }
  if (regla.destino === "finca" && regla.propiedadId && !getPropiedad(db, regla.propiedadId)) {
    return { destino: "pendiente", categoriaFinca: null, propiedadId: null, categoriaPersonal: null, reglaId: null };
  }
  return {
    destino: regla.destino,
    categoriaFinca: regla.destino === "finca" ? regla.categoriaFinca ?? null : null,
    propiedadId: regla.destino === "finca" ? regla.propiedadId ?? null : null,
    categoriaPersonal: regla.destino === "personal" ? regla.categoriaPersonal ?? null : null,
    reglaId: regla.id
  };
}
function apunteDeCuenta(db, cuentaId) {
  return ultimoApunte(
    listApuntesCuenta(db, cuentaId).map((row) => ({
      fecha: row.fecha,
      concepto: row.concepto,
      importeCentimos: row.importe_centimos,
      orden: row.orden
    }))
  );
}
function textoHueco(db, cuentaId, desde) {
  const hasta = maxFechaCuenta(db, cuentaId);
  if (!hayHueco(hasta, desde)) return "";
  return `El libro de esta cuenta llega al ${textoFecha(hasta)} y este extracto empieza el ${textoFecha(desde)}.`;
}
function corto(texto) {
  const limpio = texto.replace(/\s+/g, " ").trim();
  return limpio.length > 60 ? `${limpio.slice(0, 57)}\u2026` : limpio;
}
function notaSinCuenta(nombre, leidos) {
  return `${nombre}: ${leidos} apuntes le\xEDdos, sin cuenta. Crea la cuenta con el IBAN del extracto y se enganchan solos.`;
}
function notaVolcado(nombre, cuenta, nuevos, duplicados, antes, hueco) {
  const ya = antes ? ` El libro ya llegaba al ${textoFecha(antes.fecha)} (${corto(antes.concepto)} \xB7 ${textoEur(antes.importeCentimos)}).` : "";
  const aviso = hueco ? ` ${hueco}` : "";
  const nuevoTxt = nuevos === 1 ? "1 nuevo" : `${nuevos} nuevos`;
  const yaTxt = duplicados === 1 ? "1 que ya estaba" : `${duplicados} que ya estaban`;
  return `${nombre} \xB7 ${cuenta}: ${nuevoTxt} y ${yaTxt}.${ya}${aviso}`;
}
function soltarBytesSiYaNoHacenFalta(db, hash) {
  const quedaSuelto = listArchivosHash(db, hash).some((row) => !row.error && !row.cuenta_id);
  if (!quedaSuelto) borrarFichero(db, hash);
}
function insertarMovimientos(db, cuentaId, archivoId, bloque, reglas, ahora) {
  const porSaldo = saldoIdentificaLinea(bloque.movimientos);
  const vistos = /* @__PURE__ */ new Map();
  let insertados = 0;
  let duplicados = 0;
  for (const mov of bloque.movimientos) {
    const doc = (mov.documento ?? "").replace(/\D/g, "").replace(/^0+$/, "");
    const clave = `${mov.fecha}|${mov.importeCentimos}|${normalizar(mov.concepto)}`;
    const ordinal = doc ? 0 : vistos.get(clave) ?? 0;
    if (!doc) vistos.set(clave, ordinal + 1);
    if (porSaldo && mov.saldoCentimos != null && hayMovimientoPorSaldo(db, cuentaId, mov.fecha, mov.importeCentimos, mov.saldoCentimos)) {
      duplicados += 1;
      continue;
    }
    const id = idMovimiento(cuentaId, {
      fecha: mov.fecha,
      importeCentimos: mov.importeCentimos,
      concepto: mov.concepto,
      documento: mov.documento,
      ordinal
    });
    if (hayMovimiento(db, id)) {
      duplicados += 1;
      continue;
    }
    const clas = aplicarRegla(db, reglas, mov.concepto, mov.importeCentimos);
    insertMovimiento(db, {
      id,
      cuentaId,
      archivoId,
      orden: mov.orden,
      fecha: mov.fecha,
      fechaValor: mov.fechaValor ?? null,
      importeCentimos: mov.importeCentimos,
      saldoCentimos: mov.saldoCentimos ?? null,
      concepto: mov.concepto,
      documento: mov.documento ?? "",
      destino: clas.destino,
      categoriaFinca: clas.categoriaFinca,
      propiedadId: clas.propiedadId,
      categoriaPersonal: clas.categoriaPersonal,
      nota: "",
      reglaId: clas.reglaId,
      clasificadoEn: clas.destino === "pendiente" ? null : ahora
    });
    insertados += 1;
  }
  return { insertados, duplicados };
}
function aprenderCuenta(db, cuentaId, bloque) {
  const cuenta = getCuenta(db, cuentaId);
  if (!cuenta) return;
  const ccc = bloque.ccc ?? "";
  const iban = bloque.iban ?? "";
  if (!cuenta.ccc && ccc || !cuenta.iban && iban) {
    updateCuenta(db, {
      ...cuenta,
      ccc: cuenta.ccc || ccc,
      iban: cuenta.iban || iban
    });
  }
}
function filaArchivo(input) {
  const b = input.bloque;
  return {
    id: input.id,
    nombre: input.nombre,
    contenido_hash: input.hash,
    formato: input.formato,
    cuenta_id: input.cuentaId,
    ccc: b?.ccc ?? "",
    iban: b?.iban ?? "",
    desde: b?.desde ?? null,
    hasta: b?.hasta ?? null,
    saldo_inicial_centimos: b?.saldoInicialCentimos ?? null,
    saldo_final_centimos: b?.saldoFinalCentimos ?? null,
    cuadre_centimos: b ? cuadreCentimos(
      b.saldoInicialCentimos ?? null,
      b.saldoFinalCentimos ?? null,
      b.movimientos.map((m) => m.importeCentimos)
    ) : null,
    leidos: input.leidos,
    movimientos: input.movimientos,
    duplicados: input.duplicados,
    avisos: input.avisos,
    error: input.error,
    importado_en: input.ahora
  };
}
async function parseBuf(nombre, buf, path) {
  const ext = extension(nombre);
  if (EXT_HOJA.has(ext)) return parseHoja(buf);
  if (ext === "pdf") {
    if (path) return parseExtracto(await textoPdf(path, buf));
    const tmp = join3(tmpdir(), `extractos-${sha256(buf).slice(0, 12)}.pdf`);
    writeFileSync2(tmp, buf);
    try {
      return parseExtracto(await textoPdf(tmp, buf));
    } finally {
      try {
        unlinkSync(tmp);
      } catch {
      }
    }
  }
  return parseExtracto(decodeTextoBanco(buf));
}
function volcarBloque(db, cuentaId, archivoId, bloque, reglas, ahora, avisosPrevios) {
  const antes = apunteDeCuenta(db, cuentaId);
  const hueco = textoHueco(db, cuentaId, bloque.desde);
  const avisos = [avisosPrevios, hueco].filter(Boolean).join("\n");
  const volcado = insertarMovimientos(db, cuentaId, archivoId, bloque, reglas, ahora);
  updateArchivoCuenta(db, archivoId, {
    cuentaId,
    movimientos: volcado.insertados,
    duplicados: volcado.duplicados,
    avisos
  });
  aprenderCuenta(db, cuentaId, bloque);
  return { ...volcado, hueco, antes };
}
async function reengancharSueltos(db, nombre, hash, buf, sueltos) {
  const parcial = { movimientos: 0, duplicados: 0, sinCuenta: 0, notas: [], errores: [] };
  let parsed;
  try {
    parsed = await parseBuf(nombre, buf, null);
  } catch (err) {
    const error = err instanceof Error ? err.message : "No he podido leer el fichero";
    parcial.errores.push({ nombre, error });
    return parcial;
  }
  if (!parsed.ok) {
    parcial.errores.push({ nombre, error: parsed.error });
    return parcial;
  }
  const reglas = reglasDominio(db);
  const cuentas = cuentasPista(db);
  const bloques = identificarBloques(hash, parsed.bloques);
  const ahora = (/* @__PURE__ */ new Date()).toISOString();
  db.exec("BEGIN");
  try {
    guardarFichero(db, hash, nombre, buf);
    for (const archivo of sueltos) {
      const bloque = bloques.find((item) => item.id === archivo.id);
      if (!bloque) continue;
      const eleccion = elegirCuenta(bloque, archivo.nombre, cuentas);
      const cuentaId = eleccion && "id" in eleccion ? eleccion.id : null;
      if (!cuentaId) {
        parcial.sinCuenta += 1;
        parcial.notas.push(notaSinCuenta(archivo.nombre, bloque.movimientos.length));
        continue;
      }
      const volcado = volcarBloque(db, cuentaId, archivo.id, bloque, reglas, ahora, archivo.avisos);
      parcial.movimientos += volcado.insertados;
      parcial.duplicados += volcado.duplicados;
      parcial.notas.push(
        notaVolcado(
          archivo.nombre,
          getCuenta(db, cuentaId)?.nombre ?? "Cuenta",
          volcado.insertados,
          volcado.duplicados,
          volcado.antes,
          volcado.hueco
        )
      );
    }
    soltarBytesSiYaNoHacenFalta(db, hash);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    parcial.errores.push({ nombre, error: err instanceof Error ? err.message : "No he podido guardar el extracto" });
    parcial.notas = [];
    parcial.movimientos = 0;
    parcial.duplicados = 0;
    parcial.sinCuenta = 0;
  }
  return parcial;
}
async function importarInbox(db, rutas2) {
  asegurarCarpetas(rutas2);
  const resultado = {
    vistos: 0,
    nuevos: 0,
    movimientos: 0,
    duplicados: 0,
    sinCuenta: 0,
    yaEstaban: 0,
    notas: [],
    errores: []
  };
  const nombres = readdirSync(rutas2.inbox).filter((n) => !n.startsWith("."));
  for (const nombre of nombres) {
    const path = join3(rutas2.inbox, nombre);
    let st;
    try {
      st = statSync(path);
    } catch {
      continue;
    }
    if (!st.isFile()) continue;
    const ext = extension(nombre);
    if (!EXT_OK.has(ext)) continue;
    resultado.vistos += 1;
    if (st.size > MAX_BYTES) {
      resultado.errores.push({ nombre, error: "Pasa de 20 MB" });
      continue;
    }
    const buf = readFileSync3(path);
    const hash = sha256(buf);
    if (hayHash(db, hash) && !olvidarLecturaFallida(db, hash)) {
      const sueltos = listArchivosHash(db, hash).filter((row) => !row.error && !row.cuenta_id && Number(row.movimientos) === 0);
      if (sueltos.length === 0) {
        borrarFichero(db, hash);
        resultado.yaEstaban += 1;
        resultado.notas.push(`${nombre}: este fichero ya estaba en el libro.`);
        continue;
      }
      const reenganche = await reengancharSueltos(db, nombre, hash, buf, sueltos);
      resultado.movimientos += reenganche.movimientos;
      resultado.duplicados += reenganche.duplicados;
      resultado.sinCuenta += reenganche.sinCuenta;
      resultado.notas.push(...reenganche.notas);
      resultado.errores.push(...reenganche.errores);
      continue;
    }
    const ahora = (/* @__PURE__ */ new Date()).toISOString();
    if (buf.length === 0) {
      resultado.errores.push({ nombre, error: "El fichero est\xE1 vac\xEDo" });
      continue;
    }
    let parsed;
    try {
      parsed = await parseBuf(nombre, buf, path);
    } catch (err) {
      const error = err instanceof Error ? err.message : "No he podido leer el fichero";
      insertArchivo(
        db,
        filaArchivo({
          id: sha256(`${hash}|error`).slice(0, 32),
          nombre,
          hash,
          formato: ext === "pdf" ? "pdf" : EXT_HOJA.has(ext) ? "excel" : "desconocido",
          cuentaId: null,
          leidos: 0,
          movimientos: 0,
          duplicados: 0,
          avisos: "",
          error,
          ahora
        })
      );
      resultado.nuevos += 1;
      resultado.errores.push({ nombre, error });
      continue;
    }
    if (!parsed.ok) {
      insertArchivo(
        db,
        filaArchivo({
          id: sha256(`${hash}|error`).slice(0, 32),
          nombre,
          hash,
          formato: parsed.formato,
          cuentaId: null,
          leidos: 0,
          movimientos: 0,
          duplicados: 0,
          avisos: "",
          error: parsed.error,
          ahora
        })
      );
      resultado.nuevos += 1;
      resultado.errores.push({ nombre, error: parsed.error });
      continue;
    }
    const reglas = reglasDominio(db);
    const cuentas = cuentasPista(db);
    const bloques = identificarBloques(hash, parsed.bloques);
    db.exec("BEGIN");
    try {
      let suelto = false;
      for (const bloque of bloques) {
        const eleccion = elegirCuenta(bloque, nombre, cuentas);
        const cuentaId = eleccion && "id" in eleccion ? eleccion.id : null;
        const avisoExtra = eleccion && "ambiguo" in eleccion ? eleccion.ambiguo : "";
        const avisosPrevios = [...parsed.avisos, avisoExtra].filter(Boolean).join("\n");
        insertArchivo(
          db,
          filaArchivo({
            id: bloque.id,
            nombre,
            hash,
            formato: parsed.formato,
            cuentaId,
            bloque,
            leidos: bloque.movimientos.length,
            movimientos: 0,
            duplicados: 0,
            avisos: avisosPrevios,
            error: null,
            ahora
          })
        );
        if (!cuentaId) {
          suelto = true;
          resultado.sinCuenta += 1;
          resultado.notas.push(notaSinCuenta(nombre, bloque.movimientos.length));
          continue;
        }
        const volcado = volcarBloque(db, cuentaId, bloque.id, bloque, reglas, ahora, avisosPrevios);
        resultado.movimientos += volcado.insertados;
        resultado.duplicados += volcado.duplicados;
        resultado.notas.push(
          notaVolcado(
            nombre,
            getCuenta(db, cuentaId)?.nombre ?? "Cuenta",
            volcado.insertados,
            volcado.duplicados,
            volcado.antes,
            volcado.hueco
          )
        );
      }
      if (suelto) guardarFichero(db, hash, nombre, buf);
      else borrarFichero(db, hash);
      db.exec("COMMIT");
      resultado.nuevos += 1;
    } catch (err) {
      db.exec("ROLLBACK");
      const error = err instanceof Error ? err.message : "No he podido guardar el extracto";
      resultado.errores.push({ nombre, error });
    }
  }
  return resultado;
}
function bufDelExtracto(db, rutas2, nombre, hash) {
  const guardado = leerFichero(db, hash);
  if (guardado) return { buf: guardado, path: null };
  try {
    return leerPorHash(rutas2, nombre, hash);
  } catch {
    throw new HttpError(
      400,
      "Este extracto se ley\xF3, pero el fichero no qued\xF3 guardado. Vuelve a elegirlo. Lo que ya est\xE9 en el libro no se duplica."
    );
  }
}
function leerPorHash(rutas2, nombre, hash) {
  const directo = join3(rutas2.inbox, nombre);
  if (existsSync2(directo)) {
    const buf = readFileSync3(directo);
    if (sha256(buf) === hash) return { buf, path: directo };
  }
  for (const entry of readdirSync(rutas2.inbox)) {
    const path = join3(rutas2.inbox, entry);
    if (!statSync(path).isFile()) continue;
    const buf = readFileSync3(path);
    if (sha256(buf) === hash) return { buf, path };
  }
  throw new HttpError(400, "Ya no est\xE1 el fichero en la carpeta inbox");
}
async function asignarArchivo(db, rutas2, archivoId, cuentaId) {
  const archivo = getArchivo(db, archivoId);
  if (!archivo) throw new HttpError(404, "No encuentro ese extracto");
  if (archivo.cuenta_id) throw new HttpError(400, "Este extracto ya tiene cuenta");
  if (archivo.error) throw new HttpError(400, "No pude leer el fichero. B\xF3rralo de la lista y vuelve a dejarlo en inbox.");
  if (!getCuenta(db, cuentaId)) throw new HttpError(400, "No encuentro esa cuenta");
  const encontrado = bufDelExtracto(db, rutas2, archivo.nombre, archivo.contenido_hash);
  const parsed = await parseBuf(archivo.nombre, encontrado.buf, encontrado.path);
  if (!parsed.ok) throw new HttpError(400, parsed.error);
  const bloque = identificarBloques(archivo.contenido_hash, parsed.bloques).find((b) => b.id === archivoId);
  if (!bloque) throw new HttpError(400, "No encuentro ese bloque en el fichero");
  const ahora = (/* @__PURE__ */ new Date()).toISOString();
  const reglas = reglasDominio(db);
  db.exec("BEGIN");
  try {
    volcarBloque(db, cuentaId, archivoId, bloque, reglas, ahora, archivo.avisos);
    soltarBytesSiYaNoHacenFalta(db, archivo.contenido_hash);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}
async function engancharPendientes(db, cuentaId) {
  const cuentas = cuentasPista(db).filter((cuenta) => !cuentaId || cuenta.id === cuentaId);
  const sueltos = listArchivos(db).filter((archivo) => !archivo.cuenta_id && !archivo.error);
  let movimientos = 0;
  let duplicados = 0;
  for (const archivo of sueltos) {
    const buf = leerFichero(db, archivo.contenido_hash);
    if (!buf) continue;
    let parsed;
    try {
      parsed = await parseBuf(archivo.nombre, buf, null);
    } catch {
      continue;
    }
    if (!parsed.ok) continue;
    const bloque = identificarBloques(archivo.contenido_hash, parsed.bloques).find((item) => item.id === archivo.id);
    if (!bloque) continue;
    const eleccion = elegirCuenta(bloque, archivo.nombre, cuentas);
    if (!eleccion || !("id" in eleccion)) continue;
    const ahora = (/* @__PURE__ */ new Date()).toISOString();
    db.exec("BEGIN");
    try {
      const volcado = volcarBloque(db, eleccion.id, archivo.id, bloque, reglasDominio(db), ahora, archivo.avisos);
      soltarBytesSiYaNoHacenFalta(db, archivo.contenido_hash);
      db.exec("COMMIT");
      movimientos += volcado.insertados;
      duplicados += volcado.duplicados;
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
  }
  return { movimientos, duplicados };
}
function borrarArchivo(db, rutas2, archivoId) {
  const archivo = getArchivo(db, archivoId);
  if (!archivo) throw new HttpError(404, "No encuentro ese extracto");
  const hash = archivo.contenido_hash;
  const nombre = archivo.nombre;
  db.exec("BEGIN");
  try {
    deleteMovimientosArchivo(db, archivoId);
    deleteArchivo(db, archivoId);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  if (contarArchivosHash(db, hash) > 0) return;
  borrarFichero(db, hash);
  const directo = join3(rutas2.inbox, nombre);
  if (existsSync2(directo)) {
    try {
      if (sha256(readFileSync3(directo)) === hash) unlinkSync(directo);
    } catch {
    }
  }
}
function guardarSubida(rutas2, nombre, buf) {
  asegurarCarpetas(rutas2);
  if (buf.length === 0) throw new HttpError(400, "El fichero est\xE1 vac\xEDo");
  if (buf.length > MAX_BYTES) throw new HttpError(413, "El fichero pasa de 20 MB");
  const seguro = nombreSeguro(nombre);
  const punto = seguro.lastIndexOf(".");
  const base = punto > 0 ? seguro.slice(0, punto) : seguro;
  const ext = punto > 0 ? seguro.slice(punto) : "";
  let candidato = join3(rutas2.inbox, seguro);
  if (!dentro(rutas2.inbox, candidato)) throw new HttpError(400, "Nombre de fichero no v\xE1lido");
  for (let i = 2; existsSync2(candidato) && i < 1e3; i++) {
    candidato = join3(rutas2.inbox, `${base}-${i}${ext}`);
  }
  if (existsSync2(candidato)) throw new HttpError(400, "Demasiados ficheros con el mismo nombre");
  writeFileSync2(candidato, buf);
  return candidato;
}
function aplicarReglasPendientes(db) {
  const reglas = reglasDominio(db);
  const pendientes = listPendientes(db);
  const ahora = (/* @__PURE__ */ new Date()).toISOString();
  let n = 0;
  for (const mov of pendientes) {
    const clas = aplicarRegla(db, reglas, mov.concepto, mov.importe_centimos);
    if (clas.destino === "pendiente") continue;
    db.prepare(
      `UPDATE movimientos SET destino = ?, categoria_finca = ?, propiedad_id = ?, categoria_personal = ?,
        regla_id = ?, clasificado_en = ? WHERE id = ? AND destino = 'pendiente'`
    ).run(
      clas.destino,
      clas.categoriaFinca,
      clas.propiedadId,
      clas.categoriaPersonal,
      clas.reglaId,
      ahora,
      mov.id
    );
    n += 1;
  }
  return n;
}
function listPendientes(db) {
  return db.prepare(`SELECT id, concepto, importe_centimos FROM movimientos WHERE destino = 'pendiente'`).all();
}

// server/servicio.ts
function cuentaJson(db, cuentas = listCuentas(db)) {
  const archivos = listArchivos(db);
  const movs = listMovimientosInforme(db);
  const fym = listFym(db);
  const porCuenta = /* @__PURE__ */ new Map();
  for (const mov of movs) {
    const lista = porCuenta.get(mov.cuenta_id) ?? [];
    lista.push({
      fecha: mov.fecha,
      concepto: mov.concepto,
      importeCentimos: mov.importe_centimos,
      orden: mov.orden
    });
    porCuenta.set(mov.cuenta_id, lista);
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
        saldoFinalCentimos: a.saldo_final_centimos
      })),
      movs.map((m) => ({
        cuentaId: m.cuenta_id,
        archivoId: m.archivo_id,
        fecha: m.fecha,
        orden: m.orden,
        importeCentimos: m.importe_centimos,
        saldoCentimos: m.saldo_centimos
      }))
    );
    const enlace = c.fym_asset_id ? fym.find((f) => f.id === c.fym_asset_id) : void 0;
    const diferencia = saldo.centimos != null && enlace?.valor_centimos != null ? saldo.centimos - enlace.valor_centimos : null;
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
      ultimoApunte: ultimoApunte(porCuenta.get(c.id) ?? [])
    };
  });
}
function movJson(row) {
  return {
    id: row.id,
    cuentaId: row.cuenta_id,
    cuentaNombre: row.cuenta_nombre ?? "",
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
    fincaError: row.finca_error
  };
}
function informes(db) {
  return listMovimientosInforme(db).map((m) => ({
    fecha: m.fecha,
    importeCentimos: m.importe_centimos,
    destino: destinoDe(m),
    categoriaFinca: m.categoria_finca,
    categoriaPersonal: m.categoria_personal
  }));
}
function armarExportacion(db, soloNuevos) {
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
      exportadoFincaEn: m.exportado_finca_en
    })),
    soloNuevos
  );
  const media = mediaGastoVida(informes(db), hoyLocal());
  const cuentas = cuentaJson(db).map((c) => ({
    nombre: c.nombre,
    fymAssetId: c.fymAssetId,
    fymNombre: c.fymNombre,
    saldoCentimos: c.saldoCentimos,
    saldo: textoEur(c.saldoCentimos),
    fechaSaldo: c.fechaSaldo,
    declaradoCentimos: c.fymValorCentimos,
    declarado: textoEur(c.fymValorCentimos),
    diferenciaCentimos: c.diferenciaCentimos
  }));
  return {
    ficheros: ficheros.ficheros,
    rechazados: ficheros.rechazados,
    fym: propuestaFym({ generadoEn: hoyLocal(), media, cuentas })
  };
}
function normalizarIban(raw) {
  const iban = (raw ?? "").replace(/\s/g, "").toUpperCase();
  if (!iban) return "";
  if (!/^ES\d{22}$/.test(iban)) throw new HttpError(400, "El IBAN no parece espa\xF1ol");
  return iban;
}
function crearServicio(db, rutas2, opciones = {}) {
  const escritor = opciones.finca || null;
  return {
    resumen() {
      const archivos = listArchivos(db);
      const guardados = hashesGuardados(db);
      return {
        cuentas: cuentaJson(db),
        propiedades: listPropiedades(db).map((p) => ({
          id: p.id,
          nombre: p.nombre,
          origen: p.origen === "finca" ? "finca" : "manual"
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
          guardado: guardados.has(a.contenido_hash)
        })),
        reglas: listReglas(db).map((r) => ({
          id: r.id,
          patron: r.patron,
          destino: destinoDe(r),
          categoriaFinca: r.categoria_finca,
          propiedadId: r.propiedad_id,
          categoriaPersonal: r.categoria_personal
        })),
        recuento: recuento(db),
        rutas: { inbox: rutas2.inbox, exportDir: rutas2.exportDir },
        nube: Boolean(process.env.VERCEL)
      };
    },
    async importar() {
      const resultado = await importarInbox(db, rutas2);
      await sincronizarFinca(db, escritor);
      return resultado;
    },
    async subir(nombre, buf) {
      guardarSubida(rutas2, nombre, buf);
      const resultado = await importarInbox(db, rutas2);
      await sincronizarFinca(db, escritor);
      return resultado;
    },
    async engancharPendientes(cuentaId) {
      const resultado = await engancharPendientes(db, cuentaId);
      if (resultado.movimientos > 0) await sincronizarFinca(db, escritor);
      return resultado;
    },
    movimientos(filtro) {
      const destino = filtro.destino && esDestino(filtro.destino) ? filtro.destino : null;
      const q = normalizar(filtro.q ?? "");
      const rows = listMovimientos(db, { destino, cuentaId: filtro.cuentaId || null, limit: q ? 2e3 : 500 });
      return rows.filter((r) => !q || normalizar(`${r.concepto} ${r.nota}`).includes(q)).slice(0, 500).map(movJson);
    },
    async clasificar(id, body) {
      if (!esDestino(body.destino)) throw new HttpError(400, "Destino desconocido");
      const mov = getMovimiento(db, id);
      if (!mov) throw new HttpError(404, "No encuentro el movimiento");
      const destino = body.destino;
      const categoriaFinca = destino === "finca" ? body.categoriaFinca ?? null : null;
      const propiedadId = destino === "finca" ? body.propiedadId ?? null : null;
      const categoriaPersonal = destino === "personal" ? body.categoriaPersonal ?? null : null;
      const error = errorClasificacion({
        destino,
        importeCentimos: mov.importe_centimos,
        categoriaFinca,
        propiedadId,
        categoriaPersonal
      });
      if (error) throw new HttpError(400, error);
      if (destino === "finca" && propiedadId && !getPropiedad(db, propiedadId)) {
        throw new HttpError(400, "No tengo esa propiedad. Tr\xE1ela de Finca o a\xF1\xE1dela a mano.");
      }
      let reglaId = null;
      if (body.recordar) {
        if (destino === "pendiente") throw new HttpError(400, "Elige un destino antes de recordar el concepto");
        const patron = normalizar(body.patron || sugerirPatron(mov.concepto));
        if (patron.length < 3) {
          throw new HttpError(400, "El patr\xF3n es demasiado corto. Deja una palabra del concepto, por ejemplo endesa.");
        }
        reglaId = upsertRegla(db, {
          id: randomUUID(),
          patron,
          destino,
          categoria_finca: categoriaFinca,
          propiedad_id: propiedadId,
          categoria_personal: categoriaPersonal,
          creado_en: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      updateClasificacion(db, {
        id,
        destino,
        categoriaFinca,
        propiedadId,
        categoriaPersonal,
        nota: body.nota ?? mov.nota,
        reglaId,
        clasificadoEn: destino === "pendiente" ? null : (/* @__PURE__ */ new Date()).toISOString(),
        exportadoFincaEn: mov.exportado_finca_en
      });
      if (reglaId) aplicarReglasPendientes(db);
      await sincronizarFinca(db, escritor);
    },
    registro(mes) {
      if (!/^\d{4}-\d{2}$/.test(mes)) throw new HttpError(400, "El mes tiene que ser AAAA-MM");
      const crudas = listMovimientosInforme(db);
      const movs = crudas.map((m) => ({
        fecha: m.fecha,
        importeCentimos: m.importe_centimos,
        destino: destinoDe(m),
        categoriaFinca: m.categoria_finca,
        categoriaPersonal: m.categoria_personal
      }));
      const inf = informeMes(movs, mes);
      const cuentas = listCuentas(db);
      const deFym = cuentas.filter((c) => Number(c.en_fym) === 1);
      const brutoCentimos = gastosBrutos(
        crudas.map((m) => ({
          cuentaId: m.cuenta_id,
          fecha: m.fecha,
          importeCentimos: m.importe_centimos,
          destino: destinoDe(m)
        })),
        new Set(deFym.map((c) => c.id)),
        mes
      );
      const nombres = new Map(cuentas.map((c) => [c.id, c.nombre]));
      const descuadres = listArchivos(db).filter((a) => a.cuadre_centimos != null && a.cuadre_centimos !== 0).map((a) => ({
        archivoId: a.id,
        nombre: a.nombre,
        cuentaNombre: a.cuenta_id && nombres.get(a.cuenta_id) || "Sin cuenta",
        diferenciaCentimos: a.cuadre_centimos ?? 0
      }));
      return {
        mes,
        ingresosFincaCentimos: inf.ingresosFincaCentimos,
        gastosFincaCentimos: inf.gastosFincaCentimos,
        brutoCentimos,
        cuentasFym: deFym.length,
        brutoAviso: deFym.length === 0 ? "Marca en Cuentas las que quieres seguir para Fuck You Money. El gasto en bruto sale de esas." : "Cargos del extracto, sin traspasos ni apuntes que has dejado fuera.",
        porCategoria: inf.porCategoria.filter((l) => l.ambito === "finca"),
        pendientes: inf.pendientes,
        descuadres,
        historial: historialSaldos(
          listArchivos(db).map((a) => ({
            cuentaId: a.cuenta_id,
            hasta: a.hasta,
            saldoFinalCentimos: a.saldo_final_centimos,
            extracto: a.nombre
          })),
          deFym.map((c) => ({ id: c.id, nombre: c.nombre }))
        )
      };
    },
    crearCuenta(body) {
      const nombre = (body.nombre ?? "").trim();
      if (!nombre) throw new HttpError(400, "Falta el nombre de la cuenta");
      if (body.tipo && !esTipoCuenta(body.tipo)) throw new HttpError(400, "Tipo de cuenta desconocido");
      const iban = normalizarIban(body.iban);
      if (body.saldoInicialCentimos != null && !Number.isInteger(body.saldoInicialCentimos)) {
        throw new HttpError(400, "El saldo inicial va en c\xE9ntimos enteros");
      }
      if (body.saldoInicialFecha && !parseFecha(body.saldoInicialFecha)) {
        throw new HttpError(400, "La fecha del saldo inicial no vale");
      }
      const id = randomUUID();
      const ahora = (/* @__PURE__ */ new Date()).toISOString();
      insertCuenta(db, {
        id,
        nombre,
        banco: (body.banco ?? "").trim(),
        alias: (body.alias ?? "").trim(),
        iban,
        ccc: cccDesdeIban(iban) ?? "",
        tipo: body.tipo && esTipoCuenta(body.tipo) ? body.tipo : "corriente",
        fym_asset_id: body.fymAssetId || null,
        en_fym: body.enFym ? 1 : 0,
        saldo_inicial_centimos: body.saldoInicialCentimos ?? null,
        saldo_inicial_fecha: body.saldoInicialFecha || null,
        creado_en: ahora
      });
      const creada = cuentaJson(db).find((c) => c.id === id);
      if (!creada) throw new HttpError(500, "No he podido crear la cuenta");
      return creada;
    },
    actualizarCuenta(id, body) {
      const actual = getCuenta(db, id);
      if (!actual) throw new HttpError(404, "No encuentro esa cuenta");
      const nombre = body.nombre != null ? body.nombre.trim() : actual.nombre;
      if (!nombre) throw new HttpError(400, "Falta el nombre de la cuenta");
      if (body.tipo && !esTipoCuenta(body.tipo)) throw new HttpError(400, "Tipo de cuenta desconocido");
      const iban = body.iban != null ? normalizarIban(body.iban) : actual.iban;
      updateCuenta(db, {
        ...actual,
        nombre,
        banco: body.banco != null ? body.banco.trim() : actual.banco,
        alias: body.alias != null ? body.alias.trim() : actual.alias,
        iban,
        ccc: cccDesdeIban(iban) || actual.ccc,
        tipo: body.tipo && esTipoCuenta(body.tipo) ? body.tipo : actual.tipo,
        fym_asset_id: body.fymAssetId === void 0 ? actual.fym_asset_id : body.fymAssetId || null,
        en_fym: body.enFym === void 0 ? Number(actual.en_fym) === 1 ? 1 : 0 : body.enFym ? 1 : 0,
        saldo_inicial_centimos: body.saldoInicialCentimos === void 0 ? actual.saldo_inicial_centimos : body.saldoInicialCentimos,
        saldo_inicial_fecha: body.saldoInicialFecha === void 0 ? actual.saldo_inicial_fecha : body.saldoInicialFecha || null
      });
    },
    borrarCuenta(id) {
      if (!getCuenta(db, id)) throw new HttpError(404, "No encuentro esa cuenta");
      if (contarMovimientosCuenta(db, id) > 0) {
        throw new HttpError(400, "Tiene movimientos. Borra antes sus extractos.");
      }
      const conArchivo = listArchivos(db).some((a) => a.cuenta_id === id);
      if (conArchivo) throw new HttpError(400, "Tiene extractos importados. B\xF3rralos antes.");
      deleteCuenta(db, id);
    },
    async asignar(archivoId, cuentaId) {
      await asignarArchivo(db, rutas2, archivoId, cuentaId);
      await sincronizarFinca(db, escritor);
    },
    async borrarArchivo(archivoId) {
      if (escritor) await retirarArchivoDeFinca(db, escritor, archivoId);
      borrarArchivo(db, rutas2, archivoId);
    },
    crearPropiedad(nombreRaw) {
      const nombre = nombreRaw.trim();
      if (!nombre) throw new HttpError(400, "Falta el nombre de la propiedad");
      const ya = listPropiedades(db).find((p) => normalizar(p.nombre) === normalizar(nombre));
      if (ya) throw new HttpError(400, "Ya tengo una propiedad con ese nombre");
      const row = { id: `local-${randomUUID()}`, nombre, origen: "manual", visto_en: (/* @__PURE__ */ new Date()).toISOString() };
      upsertPropiedad(db, row);
      return { id: row.id, nombre, origen: "manual" };
    },
    borrarRegla(id) {
      deleteRegla(db, id);
    },
    sincronizar() {
      return sincronizarCatalogos(db);
    },
    estadoFinca() {
      return estadoFinca(db);
    },
    async reintentarFinca() {
      if (!escritor) throw new HttpError(400, "Este proceso no escribe en Finca.");
      await sincronizarFinca(db, escritor);
      return estadoFinca(db);
    },
    exportacion(soloNuevos = true) {
      return armarExportacion(db, soloNuevos);
    },
    escribirExportacion(soloNuevos = true) {
      const payload = armarExportacion(db, soloNuevos);
      const dir = join4(rutas2.exportDir, "finca");
      mkdirSync3(dir, { recursive: true });
      const ficheros = payload.ficheros.map((f) => {
        const ruta = join4(dir, f.fichero);
        writeFileSync3(ruta, f.texto);
        return { ...f, ruta };
      });
      const rutaFym = join4(rutas2.exportDir, "fym-propuesta.json");
      writeFileSync3(rutaFym, `${JSON.stringify(payload.fym, null, 2)}
`);
      return { ...payload, ficheros, rutaFym };
    },
    marcar(ids) {
      if (!Array.isArray(ids) || ids.some((id) => typeof id !== "string")) {
        throw new HttpError(400, "Faltan los movimientos a marcar");
      }
      return { marcados: marcarExportados(db, ids, (/* @__PURE__ */ new Date()).toISOString()) };
    }
  };
}

// server/nube.ts
var maxDuration = 60;
var rutas = {
  root: "/tmp/extractos",
  inbox: join5("/tmp/extractos", "inbox"),
  exportDir: join5("/tmp/extractos", "export")
};
function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(body));
}
async function handler(req, res) {
  const method = req.method || "GET";
  const url = urlDe(req);
  if (process.env.VERCEL && !claveConfigurada()) {
    json(res, 503, { error: "Falta la clave de acceso en el servidor." });
    return;
  }
  const entra = method === "POST" && url.pathname === "/api/entrar";
  if (!entra && !sesionValida(leerCookie(req.headers.cookie))) {
    json(res, 401, { error: "Hace falta entrar" });
    return;
  }
  if (entra) {
    const db = openDb(":memory:");
    try {
      await despachar(req, res, crearServicio(db, rutas, { finca: false }));
    } catch (err) {
      responderError(res, err);
    } finally {
      db.close();
    }
    return;
  }
  mkdirSync4(rutas.inbox, { recursive: true });
  mkdirSync4(rutas.exportDir, { recursive: true });
  const libro = await abrirLibroNube();
  const svc = crearServicio(libro.db, rutas, { finca: escritorFincaReal() });
  try {
    await despachar(req, res, svc);
  } catch (err) {
    responderError(res, err);
  } finally {
    await libro.cerrar(method !== "GET" && method !== "HEAD");
  }
}
export {
  handler as default,
  maxDuration
};
