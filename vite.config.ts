import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
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
  plugins: [puzzleBankPlugin(puzzleFile), svelte()],
})
