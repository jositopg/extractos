# Extractos

Libro local de los extractos bancarios.

- El saldo de cada cuenta queda aquí, con el cierre de cada extracto.
- Si un apunte es de un piso, lo concilias con la propiedad. El concepto se recuerda: el siguiente extracto que traiga un gasto o un alquiler parecido entra en esa propiedad y se escribe en Finca.
- Las cuentas que marques se siguen aparte, para cuando actualices Fuck You Money a mano. Aquí ves cómo va cambiando su saldo y el gasto en bruto: los cargos del extracto, sin traspasos entre tus cuentas. Fuck You Money no se modifica.

El código está en https://github.com/jositopg/extractos. Un push a `main` despliega la web. Los extractos, el sqlite y la clave no entran en git.

## Cómo se usa

```bash
cd ~/Proyectos/extractos
npm install
npm run dev
```

Abre http://127.0.0.1:5173

La misma interfaz está en https://extractos-wine.vercel.app. Allí no hay carpeta inbox: se elige el fichero en el navegador. Pide una clave (está en Vercel, no en el repo). El libro se guarda en un almacén privado, no en el ordenador. Si guardas desde dos pestañas a la vez, se queda la última. En la web valen CSV, Excel, PDF y Norma 43. Un PDF escaneado, sin texto, no se lee. Si subes un extracto antes de crear la cuenta, el fichero queda guardado en el libro y se engancha solo cuando el IBAN coincide.

1. En **Cuentas**, crea una cuenta por cada banco. El alias reconoce el fichero (`caixa-nomina-enero.csv` con alias `caixa-nomina`). El IBAN, si viene en el extracto, también. Marca **Saldo para Fuck You Money** en las que quieras seguir.
2. Pulsa **Traer propiedades y cuentas**. Lee los nombres de Finca y los saldos declarados de Fuck You Money. No cambia Fuck You Money.
3. Deja los extractos en `inbox/` (CSV, Excel, Norma 43 o PDF) o elígelos desde la pantalla. `npm run import` hace lo mismo sin abrir la interfaz.
4. En **Bandeja**, en cada apunte de un piso elige propiedad, categoría de Finca y el concepto. **Conciliar con la propiedad** lo recuerda y lo escribe en Finca. Un alquiler cobrado es un ingreso, con la categoría Alquiler mensual. **Es un traspaso** si mueves dinero entre cuentas tuyas. **No es de una propiedad** lo deja fuera del gasto en bruto.
5. En **Registro** ves el saldo, el historial de las cuentas marcadas y el gasto en bruto del mes.
6. En **Finca** ves qué se ha escrito y puedes reintentar si la base no respondió. Corregir el apunte aquí actualiza la misma fila de Finca. Si lo sacas de la propiedad, se borra solo la fila que creó este libro.

Una propiedad añadida a mano no existe en Finca: el apunte se guarda aquí y la pestaña Finca dice por qué no se ha escrito. Trae antes las propiedades.

## Formatos

- **Norma 43** (Cuaderno 43, `.n43`, `.c43` o `.txt`).
- **CSV** con columnas de fecha e importe (o debe/haber) y, si el banco lo trae, saldo. Acepta el punto y coma y la coma decimal.
- **Excel** (`.xls`, `.xlsx` y también `.ods`). La hoja tiene que traer columnas de fecha e importe, como el CSV. Si hay varias, se leen las que traen movimientos.
- **PDF** con texto. En el ordenador, si tienes poppler (`brew install poppler`), se usa `pdftotext`. Si no, y en la web, se lee igual. Un escaneo sin texto no se lee: exporta CSV o Excel.

El saldo de la cuenta es el del extracto más reciente. En Cuentas también ves hasta qué día llega el libro y un apunte de ese día. Si el cierre no cuadra con los apuntes, el registro lo dice.

Puedes subir el extracto cada cierto tiempo, aunque pise días que ya están. Un apunte que ya se vio no se repite: cuenta la cuenta, la fecha, el importe, el concepto y, si el banco lo trae, el número de documento. Si dos cargos iguales caen el mismo día, se distinguen entre sí, y da igual el orden de las filas. Si el banco pone el saldo detrás de cada línea, un comentario que cambie en una descarga posterior no crea otro apunte. No se descarta todo lo anterior a una fecha: si en el solape faltaba una línea, entra. Si el fichero nuevo empieza con más de un día de hueco, la pantalla lo dice. Al subir ves cuántos apuntes son nuevos y cuál era el último que el libro ya tenía.

## Qué no hace

No mueve saldos en Fuck You Money. Esa foto la confirmas tú. No borra en Finca filas que no haya creado este libro.

## Datos

`data/extractos.sqlite` es el libro. `inbox/` guarda los extractos. No entran en git. Para una copia, guarda esas dos carpetas.
