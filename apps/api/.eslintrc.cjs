module.exports = {
  root: true,
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: './tsconfig.json'
  },
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    'no-console': ['error', { allow: ['error'] }]
  }
};
