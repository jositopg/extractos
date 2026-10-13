import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { openDb } from './db'
import { escritorFincaReal } from './finca'
import { crearServicio } from './servicio'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const db = openDb(join(root, 'data', 'extractos.sqlite'))
const svc = crearServicio(db, {
  root,
  inbox: join(root, 'inbox'),
  exportDir: join(root, 'export'),
}, { finca: escritorFincaReal() })
const resultado = await svc.importar()
console.log(
  `Vistos ${resultado.vistos}. Nuevos ${resultado.nuevos}. Movimientos ${resultado.movimientos}. Duplicados ${resultado.duplicados}. Sin cuenta ${resultado.sinCuenta}. Ya estaban ${resultado.yaEstaban}.`,
)
for (const nota of resultado.notas) console.log(nota)
for (const error of resultado.errores) console.log(`- ${error.nombre}: ${error.error}`)
db.close()
