import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = dirname(fileURLToPath(import.meta.url))
const configuredPuzzleFile = process.env.SUDOKU_PUZZLES_FILE
const puzzleCandidates = [
  configuredPuzzleFile ? resolve(projectRoot, configuredPuzzleFile) : null,
  resolve(projectRoot, 'puzzles.json'),
  resolve(projectRoot, '../genduku/puzzles.json'),
].filter((candidate): candidate is string => candidate !== null)
const puzzleFile = puzzleCandidates.find(existsSync)

if (!puzzleFile) {
  throw new Error(
    `Could not find puzzles.json. Checked: ${puzzleCandidates.join(', ')}`,
  )
}

function puzzleBankPlugin(file: string): Plugin {
  const publicId = 'virtual:puzzle-bank'
  const resolvedId = `\0${publicId}`
  return {
    name: 'embedded-puzzle-bank',
    resolveId(id) {
      return id === publicId ? resolvedId : undefined
    },
    load(id) {
      if (id !== resolvedId) return undefined
      this.addWatchFile(file)
      return `export default ${readFileSync(file, 'utf8')}`
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    puzzleBankPlugin(puzzleFile),
    svelte(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'script',
      manifest: {
        id: './',
        name: 'Sudoku CooCoo',
        short_name: 'Sudoku CooCoo',
        description: 'A pencil-friendly Sudoku game with five difficulty levels.',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f2eee5',
        theme_color: '#f2eee5',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}'],
        globIgnores: ['**/icon-concept.png'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
        inlineWorkboxRuntime: true,
      },
    }),
  ],
})
