import js from '@eslint/js'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import pluginVue from 'eslint-plugin-vue'
import { vueTsConfigs, withVueTs } from '@vue/eslint-config-typescript'

const appConfig = await withVueTs(
  {
    name: 'project/ignores',
    ignores: ['dist/**', 'coverage/**'],
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
    name: 'project/vite-config-without-type-information',
    files: ['vite.config.ts'],
  },
]
