const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const vendorDir = path.join(repoRoot, 'vendor')
const protocolRepo = path.join(vendorDir, 'node-minecraft-protocol')
const mineflayerRepo = path.join(vendorDir, 'mineflayer')

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    cwd
  })

  if (result.error) {
    console.error(`[Fix] Failed to run ${command}: ${result.error.message}`)
    process.exit(1)
  }

  if (result.status !== 0) {
    console.error(`[Fix] ${command} exited with code ${result.status}`)
    process.exit(result.status || 1)
  }
}

function ensureRepo(dir, url) {
  if (!fs.existsSync(dir)) {
    run('git', ['clone', url, dir])
    return
  }

  const gitDir = path.join(dir, '.git')
  if (!fs.existsSync(gitDir)) {
    console.warn(`[Fix] ${dir} exists but is not a git repo. Skipping update.`)
    return
  }

  run('git', ['-C', dir, 'pull', '--ff-only'])
}

function patchAutoVersion() {
  const filePath = path.join(protocolRepo, 'src', 'client', 'autoVersion.js')
  if (!fs.existsSync(filePath)) {
    console.error('[Fix] autoVersion.js not found; cannot patch protocol fallback.')
    process.exit(1)
  }

  const original = fs.readFileSync(filePath, 'utf8')
  if (original.includes('Unsupported protocol') && original.includes('falling back') && original.includes('selectedVersion')) {
    console.log('[Fix] Protocol fallback already applied.')
    return
  }

  const target = 'const versions = (minecraftData.postNettyVersionsByProtocolVersion.pc[protocolVersion] || []).concat(guessFromName)\n    if (versions.length === 0) {\n      client.emit(\'error\', new Error(`Unsupported protocol version \'${protocolVersion}\'; try updating your packages with \'npm update\'`))\n    }\n    const minecraftVersion = versions[0].minecraftVersion\n'

  const replacement = "let versions = (minecraftData.postNettyVersionsByProtocolVersion.pc[protocolVersion] || []).concat(guessFromName)\n    if (versions.length === 0) {\n      const supported = minecraftData.supportedVersions?.pc || []\n      const latestSupported = supported[supported.length - 1]\n      const fallback = latestSupported ? minecraftData.versionsByMinecraftVersion.pc[latestSupported] : null\n      if (!fallback) {\n        client.emit('error', new Error(`Unsupported protocol version '${protocolVersion}'; try updating your packages with 'npm update'`))\n        return\n      }\n      versions = [fallback]\n      debug(`Unsupported protocol ${protocolVersion}; falling back to ${fallback.minecraftVersion}`)\n    }\n    const selectedVersion = versions[0]\n    const minecraftVersion = selectedVersion.minecraftVersion\n"

  if (!original.includes(target)) {
    console.error('[Fix] autoVersion.js format changed; manual patch required.')
    process.exit(1)
  }

  const patched = original.replace(target, replacement)
  const patchedProtocol = patched.replace(
    'options.protocolVersion = protocolVersion',
    'options.protocolVersion = selectedVersion.version || protocolVersion'
  )

  fs.writeFileSync(filePath, patchedProtocol, 'utf8')
  console.log('[Fix] Applied protocol fallback patch.')
}

function printSupportedVersions(targetVersion) {
  let supportedVersions = []
  try {
    const versionInfo = require('minecraft-protocol/src/version')
    supportedVersions = versionInfo.supportedVersions || []
  } catch (error) {
    console.warn('[Fix] Could not read supported versions from minecraft-protocol.')
  }

  if (targetVersion) {
    if (supportedVersions.includes(targetVersion)) {
      console.log(`[Fix] Version ${targetVersion} is supported by the installed protocol.`)
    } else if (supportedVersions.length > 0) {
      console.warn(`[Fix] Version ${targetVersion} is not listed as supported.`)
      console.warn(`[Fix] Supported versions: ${supportedVersions.join(', ')}`)
    }
  }
}

const targetVersion = process.argv[2] || process.env.BOT_VERSION

console.log('[Fix] Syncing forked dependencies...')
fs.mkdirSync(vendorDir, { recursive: true })
ensureRepo(protocolRepo, 'https://github.com/PrismarineJS/node-minecraft-protocol.git')
ensureRepo(mineflayerRepo, 'https://github.com/PrismarineJS/mineflayer.git')

patchAutoVersion()

console.log('[Fix] Installing dependencies from local forks...')
run('npm', ['install'], repoRoot)

printSupportedVersions(targetVersion)

console.log('[Fix] Done. Retry: npm start -- <host> <username> <auth_type> [password]')
if (targetVersion) {
  console.log(`[Fix] If needed, set BOT_VERSION=${targetVersion} in your .env.`)
}
