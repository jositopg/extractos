# Extractos

Libro de extractos bancarios de Jose. Uso personal. La interfaz y los mensajes van en español.

Jose suelta los extractos. La app guarda el saldo de cada cuenta. Si marca un concepto como de una propiedad, el siguiente extracto parecido se sugiere en Apuntes y entra en Finca cuando lo acepta. Aparte, las cuentas que marca se siguen aquí para cuando él actualice Fuck You Money a mano: historial de saldo y gasto en bruto. Fuck You Money no se modifica.

No es Open Banking. No sincroniza el banco. No confundir con `gestion-financiera`.

## Qué no hacer

- No escribir en Fuck You Money. El catálogo es un `SELECT`. El saldo declarado lo confirma Jose.
- No borrar en Finca filas que este libro no haya creado. El borrado es `DELETE FROM transacciones WHERE id = $1 AND referencia = $2`. La referencia de una línea entera es `extractos:${movimientoId}`. Si el apunte está partido, cada parte es `extractos:${movimientoId}:${repartoId}`.
- No insertar en Finca un apunte que Jose no haya dejado en destino `finca` con propiedad y categoría. Una propiedad `local-*` no existe en Finca: se guarda aquí y se deja `finca_error`.
- No llamar a Postgres, Blob ni a la web de producción desde los tests. El escritor de Finca se inyecta. `crearServicio(db, rutas, { finca })`. Sin escritor, o con `finca: false`, no hay escritura.
- No arrancar `npm run dev` ni `npm run import` contra un `inbox/` real para probar. Al leer la carpeta se sincroniza Finca.
- El repo es `jositopg/extractos`, público, como Finca y Fuck You Money. Tras un cambio pedido, commit y `git push` a `main`. Vercel despliega producción desde esa rama. No hagas force-push. No subas `.env*`, el sqlite, `inbox/` ni `export/`. `api/despacho.js` sí se sube: es la función que Vercel tiene que ver al clonar.
- No leer, imprimir ni copiar al repo `~/.finca-db.env`, `~/.fuckyoumoney-db.env`, `.env.local` ni `EXTRACTOS_PASSWORD`. Los errores pasan por `mensajeError`, que tapa las URLs `postgresql://`.
- No meter `FINCA_DATABASE_URL` y `FYM_DATABASE_URL` en el mismo `process.env` de un shell local.
- No guardar el libro en la base de Finca ni en la de Fuck You Money. No crees un Supabase para esta app: el duplicado lo resuelve la identidad del apunte, no otra base. El libro sigue en el Blob privado.

## Dónde está cada cosa

- `shared/` es puro: céntimos, parseo, reglas, informes. Sin Node.
- `server/` es el libro SQLite, la API y la escritura en Finca. `server/index.ts` escucha en local y vigila `inbox/`. No lo importe el handler de Vercel.
- `server/despachar.ts` reparte las rutas. Lo usan el servidor local y la nube.
- `server/nube.ts` es el handler de Vercel. `npm run build` lo empaqueta a `api/despacho.js`. Ese fichero entra en git y no se edita a mano.
- `src/` es la interfaz. Vite en el puerto 5173 hace proxy de `/api` a `127.0.0.1:8787`.
- El libro local es `data/extractos.sqlite`. `inbox/` y `export/` no entran en git.

`npm run check` y `npm test` se lanzan dentro de este directorio. `npx tsc` desde `~/` instala otro paquete.

## Dinero y extractos

Los importes son céntimos enteros. `centimosDesdeTexto` no pasa por un float. A Postgres el importe va como texto exacto (`eurosExactos`: `45.20`), y el tipo `ingreso` o `gasto` lleva el signo.

Norma 43 son registros de 80 caracteres. Un cargo es DH 1 (negativo) y un abono es DH 2 (positivo). El importe de Norma 43 son 14 dígitos con los céntimos implícitos. No cambies las posiciones sin un test del fixture.

El CSV huele el separador y acepta cabeceras en español y coma decimal. Basta «F. VALOR» o «Fecha» más el importe. «Descripción» es el concepto y «Comentario» se le añade. Un «Número de cuenta» de 20 dígitos se guarda como CCC de 18, sin los dos de control. El Excel (`.xls`, `.xlsx`, `.xlsm`, `.xlsb`, `.ods`, `.numbers`) pasa por las mismas columnas: `parseHoja` y `parseTabla`. El selector usa `ACCEPT_FICHEROS`, la misma lista que el inbox. Si el mismo fichero ya se guardó como lectura fallida, se vuelve a leer. Si ya tenía movimientos, no se toca. El PDF usa `pdftotext -layout` si hay poppler y no estamos en Vercel. Si no, `textoPdfJs` reconstruye las líneas. Un escaneo sin texto no se lee.

El IBAN se busca con `/ES(?:\s*\d){22}/`. Primero casa cuenta por IBAN o CCC. Si no, por alias del nombre de fichero, normalizado y de al menos 3 caracteres. Un caso ambiguo es aviso, no error. Un fichero sin cuenta no inserta movimientos hasta que se asigna.

Un fichero repetido, ya leído y con cuenta, se salta por el sha256 del contenido. Un movimiento repetido es sha256 de cuenta, fecha, céntimos, concepto normalizado y documento (Norma 43, sin ceros a la izquierda). Sin documento, el ordinal cuenta cuántas veces se repite esa misma clave dentro del fichero: no es el número de fila, así que el orden da igual. Ese ordinal se guarda en `ordinal_clave` para poder cambiar de cuenta aunque el fichero ya no esté. Si cada línea trae su saldo y no se repite, la misma fecha, el mismo importe y el mismo saldo son el mismo apunte aunque el comentario haya cambiado. No se corta por la última fecha: un apunte anterior que faltaba puede entrar en el extracto siguiente. Cada cuenta enseña el día más reciente y un apunte de ese día. Si el extracto nuevo empieza más de un día después, el fichero avisa del hueco y aun así se importa.

Solo el Excel de ING está comprobado con un extracto real. Los otros dos bancos no se interpretan hasta ver un fichero de cada uno: no inventes el lector. Una lectura mala del mismo fichero se queda, porque el sha256 con movimientos no se vuelve a leer. Hay que quitar el extracto (eso borra sus filas de Finca) y subirlo otra vez.

El saldo de la cuenta es el saldo final del extracto con el `hasta` más reciente. Todos los movimientos mueven ese criterio. El destino solo cambia informes y Finca.

Hay que insertar la fila de `archivos` antes que los movimientos. La clave ajena lo exige.

## Reglas y destinos

Un destino es `pendiente`, `duda`, `finca`, `personal`, `traspaso` o `ignorar`. `duda` es «No lo sé»: sigue a la vista, cuenta en el bruto y en el número de Apuntes, y no escribe en Finca ni crea regla. `ignorar` es «No es de una propiedad» y sale del bruto. El signo elige la lista de categorías de Finca. Un abono no puede llevar una categoría de gasto, ni al revés. Las listas son las de Finca, copiadas en `shared/categorias.ts`.

La regla es una subcadena normalizada, mínima de 3 caracteres. Gana el patrón más largo y, a igualdad, el más nuevo. No se aplica al importar: el apunte entra en `pendiente` y, si una regla encaja, Apuntes lo sugiere para aceptarlo con un clic. Antes de guardar una regla se listan los pendientes que ganaría (`POST /api/reglas/vista`). Confirmar la guarda y la aplica a esos pendientes. Cancelar no guarda nada. Una regla a medias no se aplica sola. `upsertRegla` devuelve el id que ya existía si el patrón es el mismo.

El gasto en bruto suma los cargos de las cuentas con `en_fym`, menos traspasos e ignorados. Un cargo pendiente o en duda sí cuenta. Si no hay ninguna cuenta marcada, el registro lo dice. El texto de la pantalla es el de los cargos del extracto, sin traspasos ni apuntes dejados fuera. El historial para Fuck You Money son los cierres (`hasta` + `saldo_final`) de esas cuentas. No se empujan saldos.

Asignar un extracto suelto pide confirmación: el IBAN se aprende en esa cuenta si el campo estaba vacío. Un extracto ya cargado se puede mover a otra cuenta. Antes de cambiar los ids se retiran de Finca las filas de ese extracto; si el apunte sigue en una propiedad, se reescribe con el id nuevo. Si el IBAN o el CCC de la cuenta vieja solo lo aportaba ese fichero, se quitan. La cuenta nueva los aprende si los suyos están vacíos. Un id que ya exista en la cuenta de destino no se duplica: se suelta la copia que se movía.

Un apunte se puede partir en dos o más propiedades. La suma de las partes, en céntimos y con el mismo signo, es el importe original. La tabla `repartos` no tiene clave ajena, porque el id del movimiento cambia al mover el extracto. Si hay partes, no se escribe la fila entera; si ya existía, se borra. Volver a pendiente, ignorar, traspaso o duda borra también las filas de las partes. Varios apuntes se concilian en una sola llamada y una sola sincronización.

El mismo importe con signo contrario, en otra cuenta y a tres días o menos, se sugiere como traspaso. No se marca solo. El registro avisa si falta el alquiler de una propiedad que ya lo cobró, el IBI o la comunidad que cayeron en el mismo mes del año pasado, o la luz repercutida cuando este mes hay electricidad. El cierre, al asignar, enseña saldo del extracto, saldo declarado, diferencia, huecos y apuntes sin puntear. Jose copia el saldo en Fuck You Money.

Las categorías personales siguen en la API para no romper filas viejas. No son el formulario principal.

## Finca

`escritorFincaReal()` abre Postgres con `FINCA_DATABASE_URL` o, en local, `~/.finca-db.env`. Prueba el host directo y luego el pooler. Guarda en memoria la URL que conectó. Un fallo de consulta no se disfraza de fallo de conexión: solo un fallo al conectar prueba el siguiente host. `ssl.rejectUnauthorized` es false y el timeout es 8000 ms.

La fila usa un UUID estable: sha256 de la referencia, nibble de versión `5` y variante `8`. El mismo apunte actualiza la misma fila. No se pisa `creado_en`. `archivos` va como `'{}'::text[]`.

Se sincroniza después de importar, subir, clasificar y asignar. Borrar un extracto llama antes a `retirarArchivoDeFinca`. Si Finca no borra, es un 502 y las filas locales se quedan. Sacar un apunte de una propiedad borra solo la fila creada aquí. Un apunte ya sincronizado se puede corregir: el mismo UUID se actualiza.

Si falta `~/.finca-db.env` y no hay variable de entorno, se clasifica en local y se informa el error. El import no falla entero.

El catálogo de propiedades es `SELECT id, nombre FROM propiedades`. El de Fuck You Money es `SELECT id, name, manual_value, institution FROM assets WHERE type = 'cash'`, por el host directo, los tres poolers de sesión y, al final, el pooler de transacción `aws-1-eu-central-1.pooler.supabase.com:6543`. Ese es el que responde: el proyecto está en eu-central-1 y el host directo es solo IPv6. Entran `corriente`, `ahorro`, `remunerada` y `nomina`, y el efectivo sin tipo: el formulario de Fuck You Money no guarda el tipo. `otro` no entra. Cada fila se asegura como cuenta local: si ya hay `fym_asset_id`, se actualiza el nombre y no se toca el IBAN ni `en_fym`; si no, se crea con el id del activo y `en_fym` marcado. No se borran cuentas locales. `resumen()` no sincroniza. La web llama a `POST /api/catalogos` una vez al abrir. Si el host no resuelve, el aviso dice que el proyecto puede estar pausado. No se escribe en Fuck You Money.

## Web

Producción: https://extractos-wine.vercel.app. El proyecto de Vercel es `extractos`, en el equipo `joses-projects-4845422c`, ligado a `jositopg/extractos`. Un push a `main` despliega. El comando `vercel deploy` queda para un arreglo suelto, sin pasar por git.

Con `VERCEL` definido hace falta `EXTRACTOS_PASSWORD`. Si no está, la función responde 503 y no abre el libro. La sesión es la cookie `extractos_sesion`: HMAC del vencimiento, 30 días, HttpOnly, SameSite Lax, Secure en Vercel. `POST /api/entrar` entra. El resto, sin cookie válida, es 401 `Hace falta entrar`. En local, sin clave, no hay puerta, para que los tests sigan abiertos.

El libro de la web es un Blob privado, `libro/extractos.sqlite`, almacén `extractos-libro`. Cada petición lo baja a `/tmp/extractos-libro.sqlite`, lo abre con journal `DELETE` (`wal: false`) y solo hace `put` si el método no es GET ni HEAD. Un Blob que aún no existe es un libro nuevo, no un error de almacén. `useCache: false`. Dos escrituras a la vez: gana la última. Vale para un solo usuario. `GET /api/libro` exige la misma sesión y devuelve una copia hecha con `VACUUM INTO`, `application/octet-stream`. La pantalla es un enlace al mismo origen, para que viaje la cookie: el cliente JSON no sirve.

La carpeta `/tmp` de la función no sobrevive a la siguiente petición. Un extracto leído y todavía sin cuenta guarda sus bytes en la tabla `ficheros`, dentro del mismo sqlite. Al crear o corregir la cuenta, si el IBAN o el CCC encajan, esos apuntes se enganchan y los bytes se borran. Si el extracto ya tenía cuenta, no se guardan los bytes. Un extracto subido antes de esto no tiene bytes: hay que volver a elegirlo. Lo que ya esté en el libro no se duplica.

En el plan Hobby solo cabe una función. `scripts/bundle-api.mjs` escribe `api/despacho.js`. Ese fichero entra en git: al clonar, Vercel tiene que verlo, y si falta el deploy desde GitHub publica la web sin API. `npm run build` lo regenera. Si cambias `server/`, el commit lleva el js nuevo. No lo edites a mano. `vercel.json` le pone `maxDuration` 60 y reescribe `/api/:path*` hacia esa función con la ruta real en `__ruta`, y `urlDe` la reconstruye. No añadas más ficheros en `api/`: cada uno cuenta como función y el tope es 12. Un catch-all `api/[...path].js` en Vercel solo casa un tramo, así que `/api/archivos/:id` no llega y el navegador ve «The page could not be found». esbuild deja `pg` y `@vercel/blob` como imports externos para que Vercel los tracee. `node:sqlite` se queda como builtin. Node de la función: 24.x.

`resumen.nube` es true en Vercel. La interfaz esconde la carpeta inbox y «Leer inbox», y pide el fichero. El tope de subida local es 20 MB. En el plan Hobby de Vercel el cuerpo de la función se queda cerca de 4,5 MB.

## SQLite

`node:sqlite` (`DatabaseSync`) en Node 24. Avisa de experimental. Este build no admite `ALTER TABLE … ADD COLUMN IF NOT EXISTS`. Las columnas nuevas pasan por `asegurarColumna`. `.run().changes` puede ser `bigint`: se convierte con `Number()`. En `:memory:` no se activa WAL.

## Al tocar la interfaz

CSS propio, sin Tailwind. Comprueba el flujo en el navegador si el cambio se ve: entrar, subir, apuntes, cuentas, registro y la pestaña Finca. Un pantallazo no basta. Si no hay navegador, dilo.

La pestaña de los movimientos se llama Apuntes. El filtro inicial es Abiertos: pendiente y duda. Al confirmar la cuenta de un extracto suelto, la pantalla cambia a esa pestaña y enseña el cierre. Conciliar muestra antes los pendientes que cogería la regla; «Guardar y aplicar» la guarda y escribe. «Solo este apunte» no crea regla. «Es un traspaso» y «No es de una propiedad» sacan el cargo del bruto. «No lo sé» lo deja en el bruto. «Volver a pendiente» deshace la línea y, si estaba en Finca, borra solo esa fila. La otra pestaña se llama Finca.

## Al cambiar el diseño

Actualiza este archivo en el mismo cambio si mueves una invariante de las de arriba. El README es la explicación para Jose. Este archivo es la que tiene que respetar quien escriba código.
