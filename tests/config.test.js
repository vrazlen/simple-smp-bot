const assert = require('assert')
const { buildConfig, validateConfig, DEFAULTS } = require('../src/config')

function runTest(name, fn) {
  try {
    fn()
    console.log(`ok - ${name}`)
  } catch (error) {
    console.error(`not ok - ${name}`)
    console.error(error)
    process.exitCode = 1
  }
}

runTest('defaults load correctly', () => {
  const { config, errors } = buildConfig({ argv: ['node', 'bot.js'], env: {} })
  const issues = validateConfig(config, errors)
  assert.deepStrictEqual(issues, [])
  assert.strictEqual(config.host, DEFAULTS.host)
  assert.strictEqual(config.port, DEFAULTS.port)
  assert.strictEqual(config.auth, DEFAULTS.auth)
})

runTest('env vars override defaults', () => {
  const { config } = buildConfig({
    argv: ['node', 'bot.js'],
    env: {
      BOT_HOST: 'example.com',
      BOT_USERNAME: 'EnvUser',
      BOT_AUTH: 'offline',
      BOT_PORT: '25570',
    },
  })
  assert.strictEqual(config.host, 'example.com')
  assert.strictEqual(config.username, 'EnvUser')
  assert.strictEqual(config.port, 25570)
})

runTest('cli args override env vars', () => {
  const { config } = buildConfig({
    argv: ['node', 'bot.js', 'cli.host', 'CliUser', 'microsoft', 'secret'],
    env: {
      BOT_HOST: 'env.host',
      BOT_USERNAME: 'EnvUser',
      BOT_AUTH: 'offline',
    },
  })
  assert.strictEqual(config.host, 'cli.host')
  assert.strictEqual(config.username, 'CliUser')
  assert.strictEqual(config.auth, 'microsoft')
  assert.strictEqual(config.password, 'secret')
})

runTest('invalid auth is rejected', () => {
  const { config, errors } = buildConfig({
    argv: ['node', 'bot.js'],
    env: { BOT_AUTH: 'bad-auth' },
  })
  const issues = validateConfig(config, errors)
  assert.ok(issues.find((issue) => issue.includes('BOT_AUTH')))
})
