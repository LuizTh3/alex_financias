// Emuladores locais do Firebase (login e Firestore) para testes e desenvolvimento.
//   node scripts/emulators.mjs test  → sobe o Firestore, roda os testes de regras/repositórios e desliga
//   node scripts/emulators.mjs dev   → sobe login + Firestore e o app em http://localhost:5180 ligado a eles
// Nada aqui acessa o Firebase real: o projeto usado é "demo-alex-financias".
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const mode = process.argv[2]
const windows = process.platform === 'win32'
const env = { ...process.env }
// No Windows, o Java cria sockets locais na pasta temporária do usuário; um espaço no caminho
// (ex.: C:\Users\Nome Sobrenome) derruba o emulador com "Unable to establish loopback connection".
if (windows && !env.JAVA_TOOL_OPTIONS?.includes('jdk.net.unixdomain.tmpdir')) {
  const tmp = resolve('.firebase', 'jdk-tmp')
  if (/\s/.test(tmp)) console.warn(`Aviso: o caminho ${tmp} tem espaço; mova o projeto para uma pasta sem espaços se o emulador falhar.`)
  mkdirSync(tmp, { recursive: true })
  env.JAVA_TOOL_OPTIONS = `${env.JAVA_TOOL_OPTIONS ?? ''} -Djdk.net.unixdomain.tmpdir=${tmp}`.trim()
}

const npx = (args, options = {}) => spawn('npx', args, { env, shell: true, ...options })
/** Encerra o processo e os filhos. No Windows, o Java do emulador sobrevive a um kill simples. */
function stop(child) {
  if (!child || child.exitCode !== null) return
  if (windows) spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
  else child.kill('SIGINT')
}

/** Sobe os emuladores e resolve quando estiverem prontos (ou rejeita se falharem). */
function startEmulators(only) {
  const child = npx(['firebase', 'emulators:start', '--project', 'demo-alex-financias', '--only', only], { stdio: ['ignore', 'pipe', 'pipe'] })
  const ready = new Promise((resolveReady, reject) => {
    const onData = chunk => {
      process.stdout.write(chunk)
      if (String(chunk).includes('All emulators ready')) resolveReady(child)
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', chunk => process.stderr.write(chunk))
    child.on('exit', code => reject(new Error(`Os emuladores encerraram antes de ficar prontos (código ${code}). A porta 8080 ou 9099 pode estar ocupada.`)))
  })
  return { child, ready }
}

const cleanup = []
const shutdown = code => { cleanup.forEach(stop); process.exit(code) }
process.on('SIGINT', () => shutdown(130))

try {
  if (mode === 'test') {
    const emulators = startEmulators('firestore')
    cleanup.push(emulators.child)
    await emulators.ready
    const tests = npx(['vitest', 'run', '--testTimeout=60000', '--hookTimeout=60000', 'tests/rules.test.ts', 'tests/repository.test.ts'],
      { stdio: 'inherit', env: { ...env, FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080' } })
    tests.on('exit', code => shutdown(code ?? 1))
  } else if (mode === 'dev') {
    const emulators = startEmulators('auth,firestore')
    cleanup.push(emulators.child)
    await emulators.ready
    const app = npx(['vite', '--mode', 'emulator', '--port', '5180'], { stdio: 'inherit' })
    cleanup.push(app)
    app.on('exit', code => shutdown(code ?? 0))
  } else {
    console.error('Use: node scripts/emulators.mjs test | dev')
    process.exit(1)
  }
} catch (failure) {
  console.error(failure instanceof Error ? failure.message : failure)
  shutdown(1)
}
