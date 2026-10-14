# Extractos

Libro local de los extractos bancarios.

- El saldo de cada cuenta queda aquí, con el cierre de cada extracto.
- Si un apunte es de un piso, lo concilias con la propiedad. El concepto se recuerda: el siguiente extracto parecido se queda pendiente y te lo señala, para aceptarlo con un clic. Hasta que lo aceptas, no se escribe en Finca.
- Las cuentas que marques se siguen aparte, para cuando actualices Fuck You Money a mano. Aquí ves cómo va cambiando su saldo y el gasto en bruto: los cargos del extracto, sin traspasos entre tus cuentas. Fuck You Money no se modifica.

El código está en https://github.com/jositopg/extractos. Un push a `main` despliega la web. Los extractos, el sqlite y la clave no entran en git.

## Cómo se usa

```bash
cd ~/Proyectos/extractos
npm install
npm run dev
```

Abre http://127.0.0.1:5173

La misma interfaz está en https://extractos-wine.vercel.app. Allí no hay carpeta inbox: se elige el fichero en el navegador. Pide una clave (está en Vercel, no en el repo). El libro se guarda en un almacén privado, no en el ordenador. Si guardas desde dos pestañas a la vez, se queda la última. En la web valen CSV, Excel, PDF y Norma 43. Un PDF escaneado, sin texto, no se lee. Si subes un extracto antes de que exista la cuenta, el fichero queda guardado en el libro y se engancha solo cuando el IBAN coincide.

1. Al abrir, Extractos trae las cuentas bancarias de Fuck You Money y las deja listas para asignar el extracto. No hace falta crearlas. Una que no esté allí se añade en **Cuentas**. El alias reconoce el fichero (`caixa-nomina-enero.csv` con alias `caixa-nomina`). El IBAN, si viene en el extracto, también. Las que vienen de Fuck You Money ya entran en el saldo de esa app; puedes desmarcarlas.
2. **Traer propiedades y cuentas** vuelve a leer Finca y esas cuentas. No cambia Fuck You Money. Solo entran las cuentas bancarias: corriente, ahorro, remunerada y nómina. Un saldo marcado como otra cosa se deja fuera. Las que llegan sin tipo también entran, y puedes desmarcar «Saldo para Fuck You Money».
3. Deja los extractos en `inbox/` (CSV, Excel, Norma 43 o PDF) o elígelos desde la pantalla. `npm run import` hace lo mismo sin abrir la interfaz. Si el extracto no reconoce la cuenta, elígela en el aviso y confirma. El IBAN se queda en esa cuenta si todavía no tenía. En **Cuentas** puedes mover un extracto ya cargado a otra.
4. En **Apuntes**, puntea cada línea. El filtro de entrada son los abiertos: pendientes y los que marcaste como «No lo sé». Si una regla encaja, la línea dice a qué piso se parece y se acepta con un clic. **Conciliar con la propiedad** enseña antes qué pendientes cogería; al confirmar, se guarda y se escribe en Finca. **Solo este apunte** no crea regla. Un alquiler cobrado es un ingreso, con la categoría Alquiler mensual. **Es un traspaso** si mueves dinero entre cuentas tuyas; si el importe sale de una y entra en otra en pocos días, te lo señala. **No es de una propiedad** lo deja fuera del gasto en bruto. **No lo sé** lo deja a la vista. **Volver a pendiente** deshace la línea. **Partir en dos** reparte un cargo entre dos pisos. Puedes marcar varias líneas y conciliarlas juntas.
5. Al confirmar la cuenta sale el cierre: saldo del extracto, lo declarado en Fuck You Money, la diferencia y lo que queda sin puntear. El saldo lo copias tú en Fuck You Money. En **Registro** ves el mes, el historial y avisos si falta el alquiler, el IBI, la comunidad o la luz repercutida.
6. En **Finca** ves qué se ha escrito y puedes reintentar si la base no respondió. Corregir el apunte aquí actualiza la misma fila de Finca. Si lo sacas de la propiedad, se borra solo la fila que creó este libro.
7. **Descargar copia del libro** guarda el sqlite. En la web el libro vive en un almacén privado: si trabajas en dos pestañas, se queda la última escritura.

Una propiedad añadida a mano no existe en Finca: el apunte se guarda aquí y la pestaña Finca dice por qué no se ha escrito. Trae antes las propiedades.

## Formatos

- **Norma 43** (Cuaderno 43, `.n43`, `.c43` o `.txt`).
- **CSV** con columnas de fecha e importe (o debe/haber) y, si el banco lo trae, saldo. Acepta el punto y coma y la coma decimal.
- **Excel** (`.xls`, `.xlsx` y también `.ods`). La hoja tiene que traer columnas de fecha e importe, como el CSV. Si hay varias, se leen las que traen movimientos.
- **PDF** con texto. En el ordenador, si tienes poppler (`brew install poppler`), se usa `pdftotext`. Si no, y en la web, se lee igual. Un escaneo sin texto no se lee: exporta CSV o Excel.

El saldo de la cuenta es el del extracto más reciente. En Cuentas también ves hasta qué día llega el libro y un apunte de ese día. Si el cierre no cuadra con los apuntes, el registro lo dice.

De momento solo está comprobado el Excel de ING. Los otros dos bancos hay que verlos con un extracto real de cada uno antes de fiarse de la lectura. Si un fichero se leyó mal y ya tiene apuntes, quítalo y vuelve a subirlo: el mismo fichero no se relee solo.

Puedes subir el extracto cada cierto tiempo, aunque pise días que ya están. Un apunte que ya se vio no se repite: cuenta la cuenta, la fecha, el importe, el concepto y, si el banco lo trae, el número de documento. Si dos cargos iguales caen el mismo día, se distinguen entre sí, y da igual el orden de las filas. Si el banco pone el saldo detrás de cada línea, un comentario que cambie en una descarga posterior no crea otro apunte. No se descarta todo lo anterior a una fecha: si en el solape faltaba una línea, entra. Si el fichero nuevo empieza con más de un día de hueco, la pantalla lo dice. Al subir ves cuántos apuntes son nuevos y cuál era el último que el libro ya tenía.

## Qué no hace

No mueve saldos en Fuck You Money. Esa foto la confirmas tú. No borra en Finca filas que no haya creado este libro.

## Datos

`data/extractos.sqlite` es el libro. `inbox/` guarda los extractos. No entran en git. Para una copia, guarda esas dos carpetas.
