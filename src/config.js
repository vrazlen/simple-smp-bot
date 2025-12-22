const dotenv = require('dotenv')

const DEFAULTS = {
  host: 'localhost',
  port: 25565,
  username: 'AFK_Bot',
  auth: 'offline',
  password: null,
  version: false,
  reconnectBaseMs: 5000,
  reconnectMaxMs: 30000,
}

function loadEnv() {
  dotenv.config()
}

function parsePort(value, errors) {
  if (value === undefined || value === null || value === '') return null
  const port = Number.parseInt(value, 10)
  if (!Number.isInteger(port) || port <= 0 || port >= 65536) {
    errors.push(`Invalid BOT_PORT: ${value}`)
    return null
  }
  return port
}

function parseMs(value, label, errors) {
  if (value === undefined || value === null || value === '') return null
  const ms = Number.parseInt(value, 10)
  if (!Number.isInteger(ms) || ms < 0) {
    errors.push(`Invalid ${label}: ${value}`)
    return null
  }
  return ms
}

function parseVersion(value) {
  if (value === undefined || value === null || value === '') return null
  if (value === 'false' || value === 'auto') return false
  return value
}

function buildConfig({ argv, env }) {
  const errors = []
  const config = { ...DEFAULTS }

  if (env.BOT_HOST) config.host = env.BOT_HOST
  if (env.BOT_USERNAME) config.username = env.BOT_USERNAME
  if (env.BOT_AUTH) config.auth = env.BOT_AUTH
  if (env.BOT_PASSWORD) config.password = env.BOT_PASSWORD

  const port = parsePort(env.BOT_PORT, errors)
  if (port !== null) config.port = port

  const version = parseVersion(env.BOT_VERSION)
  if (version !== null) config.version = version

  const reconnectBaseMs = parseMs(env.RECONNECT_BASE_MS, 'RECONNECT_BASE_MS', errors)
  if (reconnectBaseMs !== null) config.reconnectBaseMs = reconnectBaseMs

  const reconnectMaxMs = parseMs(env.RECONNECT_MAX_MS, 'RECONNECT_MAX_MS', errors)
  if (reconnectMaxMs !== null) config.reconnectMaxMs = reconnectMaxMs

  const args = argv.slice(2)
  if (args.length > 0) config.host = args[0]
  if (args.length > 1) config.username = args[1]
  if (args.length > 2) config.auth = args[2]
  if (args.length > 3) config.password = args[3]

  return { config, errors }
}

function validateConfig(config, errors) {
  const issues = [...errors]

  if (!config.host) issues.push('BOT_HOST is required (or pass <host> as CLI arg)')
  if (!config.username) issues.push('BOT_USERNAME is required (or pass <username> as CLI arg)')

  if (!['offline', 'microsoft'].includes(config.auth)) {
    issues.push('BOT_AUTH must be "offline" or "microsoft"')
  }

  if (config.reconnectMaxMs < config.reconnectBaseMs) {
    issues.push('RECONNECT_MAX_MS must be >= RECONNECT_BASE_MS')
  }

  return issues
}

module.exports = {
  DEFAULTS,
  buildConfig,
  loadEnv,
  validateConfig,
}
