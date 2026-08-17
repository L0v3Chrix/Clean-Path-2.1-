import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import { releaseMetadataPlugin } from './scripts/operations/release-metadata.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = { ...process.env, ...loadEnv(mode, __dirname, '') }
  return {
    logLevel: 'error', // Suppress warnings, only show errors
    plugins: [react(), releaseMetadataPlugin({ env, cwd: __dirname })],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    test: {
      exclude: ['e2e/**', 'node_modules/**'],
    },
  }
})
