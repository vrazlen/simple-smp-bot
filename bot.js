const mineflayer = require('mineflayer')

// --- Configuration ---
const config = {
  host: 'localhost',       // Server IP
  port: 25565,             // Server Port
  username: 'AFK_Bot',     // Username or Email
  auth: 'offline',         // 'microsoft' or 'offline'
  password: null,          // /login password (optional)
  version: false           // Auto-detect version
}

// --- CLI Argument Parsing ---
// Usage: node bot.js <host> <username> <auth> <password>
const args = process.argv.slice(2)
if (args.length > 0) config.host = args[0]
if (args.length > 1) config.username = args[1]
if (args.length > 2) config.auth = args[2]
if (args.length > 3) config.password = args[3]

console.log(`\n[Bot] Initializing...`)
console.log(`[Bot] Target: ${config.host}:${config.port}`)
console.log(`[Bot] User: ${config.username}`)
console.log(`[Bot] Auth: ${config.auth}\n`)

// --- Bot Logic ---
function createBot() {
  const bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    auth: config.auth,
    version: config.version
  })

  bot.on('login', () => {
    console.log(`[Bot] Logged in as ${bot.username}`)
  })

  bot.on('spawn', () => {
    console.log('[Bot] Spawned in world.')

    // Handle AuthMe /login
    if (config.password) {
      console.log('[Bot] Authenticating...')
      setTimeout(() => {
        bot.chat(`/login ${config.password}`)
      }, 2000)
    }

    startAfkRoutine(bot)
  })

  bot.on('chat', (username, message) => {
    if (username === bot.username) return
    console.log(`[Chat] <${username}> ${message}`)
  })

  bot.on('kicked', (reason) => {
    console.log(`[Bot] Kicked: ${reason}`)
  })

  bot.on('error', (err) => {
    console.log(`[Bot] Error: ${err.message}`)
  })

  bot.on('end', () => {
    console.log('[Bot] Disconnected. Reconnecting in 30 seconds...')
    setTimeout(createBot, 30000)
  })
}

function startAfkRoutine(bot) {
  console.log('[Bot] AFK routine started.')

  // 1. Random Look
  setInterval(() => {
    if (!bot.entity) return
    const yaw = (Math.random() * Math.PI) - (Math.PI / 2)
    const pitch = (Math.random() * Math.PI / 2) - (Math.PI / 4)
    bot.look(yaw, pitch)
  }, 5000)

  // 2. Random Movement (Jump/Sneak)
  setInterval(() => {
    if (!bot.entity) return
    if (Math.random() > 0.5) {
      bot.setControlState('jump', true)
      setTimeout(() => bot.setControlState('jump', false), 500)
    } else {
      bot.setControlState('sneak', true)
      setTimeout(() => bot.setControlState('sneak', false), 1000)
    }
  }, 15000)

  // 3. Swing Arm (Prevent timeout)
  setInterval(() => {
    if (!bot.entity) return
    bot.swingArm()
  }, 30000)
}

createBot()
