import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import pluginVue from 'eslint-plugin-vue'
import { vueTsConfigs, withVueTs } from '@vue/eslint-config-typescript'

const appConfig = await withVueTs(
  {
    name: 'project/ignores',
    ignores: [
      'dist/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
  js.configs.recommended,
  pluginVue.configs['flat/essential'],
  vueTsConfigs.recommendedTypeChecked,
  eslintConfigPrettier,
)

export default [
  ...appConfig,
  {
    ...vueTsConfigs.disableTypeChecked[0],
    name: 'project/config-and-e2e-without-type-information',
    files: ['vite.config.ts', 'playwright.config.ts', 'e2e/**/*.{ts,mjs}'],
  },
  {
    name: 'project/e2e-node-globals',
    files: ['e2e/support/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        URLSearchParams: 'readonly',
      },
    },
  },
]
