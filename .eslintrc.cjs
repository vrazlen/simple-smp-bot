module.exports = {
  env: {
    node: true,
    es2021: true
  },
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    ecmaVersion: 2021
  },
  rules: {
    semi: ['error', 'never'],
    quotes: ['error', 'single', { avoidEscape: true }]
  }
}
