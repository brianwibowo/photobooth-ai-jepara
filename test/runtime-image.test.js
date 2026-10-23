import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execute = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))

test('server imports resolve using only the source modules copied into the Docker runtime', async (t) => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'photobooth-runtime-'))
  t.after(() => fs.rm(dir, { recursive: true, force: true }))
  const dockerfile = await fs.readFile(path.join(root, 'Dockerfile'), 'utf8')
  const runtime = dockerfile.split(' AS runtime\n')[1]
  assert.ok(runtime, 'Docker runtime stage must exist')
  assert.match(runtime, /RUN node --input-type=module -e "await import\('\.\/server\/index\.js'\)"/)
  await fs.copyFile(path.join(root, 'package.json'), path.join(dir, 'package.json'))
  await fs.symlink(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), 'dir')
  assert.match(runtime, /^COPY server \.\/server$/m)
  await fs.cp(path.join(root, 'server'), path.join(dir, 'server'), { recursive: true })
  // Read the actual Docker COPY list: copying all of src here would hide omissions.
  for (const [, source, destination] of runtime.matchAll(/^COPY --from=build \/app\/(src\/\S+) \.\/(src\/\S+)$/gm)) {
    const target = path.join(dir, destination)
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.copyFile(path.join(root, source), target)
  }
  const { stdout } = await execute(process.execPath, ['--input-type=module', '-e', "await import('./server/index.js'); console.log('runtime imports ready')"], {
    cwd: dir, timeout: 10000, env: { PATH: process.env.PATH, NODE_ENV: 'production' },
  })
  assert.match(stdout, /runtime imports ready/)
  // Reproduce the broken image: the same server must fail if config.js is absent.
  await fs.rm(path.join(dir, 'src/config.js'))
  await assert.rejects(() => execute(process.execPath, ['--input-type=module', '-e', "await import('./server/index.js')"], {
    cwd: dir, timeout: 10000, env: { PATH: process.env.PATH, NODE_ENV: 'production' },
  }), /ERR_MODULE_NOT_FOUND/)
})
