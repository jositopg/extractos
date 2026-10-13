import { mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const api = join(root, 'api')

rmSync(api, { recursive: true, force: true })
mkdirSync(api, { recursive: true })

await build({
  entryPoints: [join(root, 'server/nube.ts')],
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile: join(api, 'despacho.js'),
  packages: 'external',
  banner: { js: '// Generado por npm run build. No lo edites.' },
})
