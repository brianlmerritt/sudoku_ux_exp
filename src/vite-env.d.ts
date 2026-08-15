/// <reference types="vite/client" />

declare module 'virtual:puzzle-bank' {
  import type { PuzzleBank } from './lib/sudoku'

  const puzzleBank: PuzzleBank
  export default puzzleBank
}
