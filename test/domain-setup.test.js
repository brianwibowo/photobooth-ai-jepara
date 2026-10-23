import test from 'node:test'
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execute = promisify(execFile)
test('custom-domain setup preserves the existing gateway and recovers safely from failures', async () => {
  const { stderr } = await execute('python3', ['test/domain_setup_test.py'], {
    cwd: fileURLToPath(new URL('../', import.meta.url)), timeout: 20000,
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
  })
  assert.match(stderr, /Ran 10 tests/)
  assert.match(stderr, /OK/)
})
