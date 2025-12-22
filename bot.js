const mineflayer = require('mineflayer')
const { buildConfig, loadEnv, validateConfig } = require('./src/config')

loadEnv()

const { config, errors } = buildConfig({ argv: process.argv, env: process.env })
const issues = validateConfig(config, errors)
if (issues.length > 0) {
  console.error('[Bot] Configuration errors:')
  issues.forEach((issue) => console.error(`- ${issue}`))
  process.exit(1)
}

let reconnectAttempts = 0
let reconnectTimer = null
let activeBot = null
let shouldReconnect = true

function logInfo(message) {
  console.log(`[Bot] ${message}`)
}

function logWarn(message) {
  console.warn(`[Bot] ${message}`)
}

function logError(message) {
  console.error(`[Bot] ${message}`)
}

function printStartupConfig() {
  logInfo('Initializing...')
  logInfo(`Target: ${config.host}:${config.port}`)
  logInfo(`User: ${config.username}`)
  logInfo(`Auth: ${config.auth}`)
  logInfo(`Password set: ${config.password ? 'yes' : 'no'}`)
  logInfo(`Version: ${config.version || 'auto'}`)
}

function computeReconnectDelay() {
  const base = config.reconnectBaseMs
  const max = config.reconnectMaxMs
  const expDelay = Math.min(max, base * Math.pow(2, reconnectAttempts))
  const jitter = Math.floor(Math.random() * 1000)
  return expDelay + jitter
}

function scheduleReconnect() {
  if (!shouldReconnect) return
  if (reconnectTimer) return

  const delay = computeReconnectDelay()
  reconnectAttempts += 1

  logWarn(`Disconnected. Reconnecting in ${Math.round(delay / 1000)}s...`)
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    createBot()
  }, delay)
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }
}

function createBot() {
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    auth: config.auth,
    version: config.version,
  })

  activeBot = bot
  let stopAfkRoutine = null

  bot.on('login', () => {
    logInfo(`Logged in as ${bot.username}`)
  })

  bot.on('spawn', () => {
    logInfo('Spawned in world.')
    reconnectAttempts = 0

    if (config.password) {
      logInfo('Authenticating...')
      setTimeout(() => {
        bot.chat(`/login ${config.password}`)
      }, 2000)
    }

    stopAfkRoutine = startAfkRoutine(bot)
  })

  bot.on('chat', (username, message) => {
    if (username === bot.username) return
    console.log(`[Chat] <${username}> ${message}`)
  })

  bot.on('kicked', (reason) => {
    logWarn(`Kicked: ${formatReason(reason)}`)
  })

  bot.on('error', (err) => {
    const message = err && err.stack ? err.stack : String(err)
    logError(message)
    if (message.includes('Unsupported protocol version')) {
      logWarn('Protocol mismatch. Run: npm run fix:protocol -- <mc_version>')
    }
  })

  bot.on('end', () => {
    if (stopAfkRoutine) stopAfkRoutine()
    scheduleReconnect()
  })
}

function startAfkRoutine(bot) {
  logInfo('AFK routine started.')

  const timers = []

  timers.push(
    setInterval(() => {
      if (!bot.entity) return
      const yaw = Math.random() * Math.PI - Math.PI / 2
      const pitch = Math.random() * (Math.PI / 2) - Math.PI / 4
      bot.look(yaw, pitch)
    }, 5000),
  )

  timers.push(
    setInterval(() => {
      if (!bot.entity) return
      if (Math.random() > 0.5) {
        bot.setControlState('jump', true)
        setTimeout(() => bot.setControlState('jump', false), 500)
      } else {
        bot.setControlState('sneak', true)
        setTimeout(() => bot.setControlState('sneak', false), 1000)
      }
    }, 15000),
  )

  timers.push(
    setInterval(() => {
      if (!bot.entity) return
      bot.swingArm()
    }, 30000),
  )

  return () => timers.forEach((timer) => clearInterval(timer))
}

function formatReason(reason) {
  if (reason === undefined || reason === null) return 'unknown'
  if (typeof reason === 'string') return reason
  try {
    return JSON.stringify(reason)
  } catch (error) {
    return String(reason)
  }
}

function shutdown(signal) {
  logWarn(`Received ${signal}. Shutting down...`)
  shouldReconnect = false
  clearReconnectTimer()

  if (activeBot) {
    activeBot.quit('Shutdown requested')
  }

  setTimeout(() => process.exit(0), 2000)
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('unhandledRejection', (reason) => {
  logError(`Unhandled rejection: ${formatReason(reason)}`)
})
process.on('uncaughtException', (err) => {
  logError(err && err.stack ? err.stack : String(err))
  shutdown('uncaughtException')
})

printStartupConfig()
createBot()
