export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export const DIFFICULTIES = ['easy', 'medium', 'challenging', 'hard', 'very-hard'] as const

export type Digit = (typeof DIGITS)[number]
export type Difficulty = (typeof DIFFICULTIES)[number]
export type InputMode = 'number' | 'pencil'
export type ToolTransition = 'initial' | 'unchanged' | 'changed'

export interface CellState {
  given: boolean
  value: Digit | null
  pencils: Digit[]
}

export interface PuzzleRecord {
  id: string
  difficulty: Difficulty
  puzzle: string
  solution: string
  hodokuLevel: string
  score: number
}

export interface PuzzleBank {
  schemaVersion: 1
  counts: Record<Difficulty, number>
  puzzles: PuzzleRecord[]
}

export function getToolTransition(
  activeDigit: Digit | null,
  activeMode: InputMode,
  nextDigit: Digit,
  nextMode: InputMode,
): ToolTransition {
  if (activeDigit === null) return 'initial'
  if (activeDigit === nextDigit && activeMode === nextMode) return 'unchanged'
  return 'changed'
}

export function parsePuzzle(input: string): Array<Digit | null> {
  const compact = input.replace(/\s/g, '')
  if (!/^[0-9.]{81}$/.test(compact)) {
    throw new Error('Expected exactly 81 cells made from digits, zeroes, or dots.')
  }
  return [...compact].map((character) =>
    character === '.' || character === '0' ? null : Number(character) as Digit,
  )
}

export function parsePuzzleBank(input: unknown): PuzzleBank {
  if (!input || typeof input !== 'object') throw new Error('Puzzle bank must be an object.')
  const bank = input as Partial<PuzzleBank>
  if (bank.schemaVersion !== 1 || !Array.isArray(bank.puzzles) || !bank.counts) {
    throw new Error('Puzzle bank must use schema version 1.')
  }
  if (bank.puzzles.length === 0) throw new Error('Puzzle bank must contain puzzles.')

  const seenIds = new Set<string>()
  const seenPuzzles = new Set<string>()
  const counts = Object.fromEntries(DIFFICULTIES.map((level) => [level, 0])) as Record<Difficulty, number>
  for (const [index, puzzle] of bank.puzzles.entries()) {
    if (!puzzle || typeof puzzle !== 'object') throw new Error(`Puzzle ${index + 1} is invalid.`)
    if (typeof puzzle.id !== 'string' || seenIds.has(puzzle.id)) {
      throw new Error(`Puzzle ${index + 1} has a missing or duplicate id.`)
    }
    if (!DIFFICULTIES.includes(puzzle.difficulty)) {
      throw new Error(`Puzzle ${puzzle.id} has an invalid difficulty.`)
    }
    if (!/^[0-9]{81}$/.test(puzzle.puzzle) || !/^[1-9]{81}$/.test(puzzle.solution)) {
      throw new Error(`Puzzle ${puzzle.id} has an invalid grid or solution.`)
    }
    if (seenPuzzles.has(puzzle.puzzle)) throw new Error(`Puzzle ${puzzle.id} is duplicated.`)
    seenIds.add(puzzle.id)
    seenPuzzles.add(puzzle.puzzle)
    counts[puzzle.difficulty] += 1
  }
  if (DIFFICULTIES.some((level) => bank.counts?.[level] !== counts[level])) {
    throw new Error('Puzzle bank counts do not match its records.')
  }
  return bank as PuzzleBank
}

export function createCells(values: Array<Digit | null>): CellState[] {
  if (values.length !== 81) throw new Error('A Sudoku puzzle must contain 81 squares.')

  return values.map((value) => ({ given: value !== null, value, pencils: [] }))
}

export function cloneCells(cells: CellState[]): CellState[] {
  return cells.map((cell) => ({ ...cell, pencils: [...cell.pencils] }))
}

export function getDigitCounts(cells: CellState[]): Record<Digit, number> {
  const counts = Object.fromEntries(DIGITS.map((digit) => [digit, 0])) as Record<Digit, number>
  cells.forEach((cell) => {
    if (cell.value !== null) counts[cell.value] += 1
  })
  return counts
}

export function getConflictingIndexes(cells: CellState[]): Set<number> {
  const conflicts = new Set<number>()
  cells.forEach((cell, index) => {
    if (cell.value === null) return
    cells.slice(index + 1).forEach((otherCell, offset) => {
      const otherIndex = index + offset + 1
      if (otherCell.value === cell.value && isPeer(index, otherIndex)) {
        conflicts.add(index)
        conflicts.add(otherIndex)
      }
    })
  })
  return conflicts
}

export function isSolved(cells: CellState[]): boolean {
  return cells.every((cell) => cell.value !== null) && getConflictingIndexes(cells).size === 0
}

export function placeNumber(cells: CellState[], index: number, digit: Digit): boolean {
  const cell = cells[index]
  if (cell.given || cell.value !== null || getDigitCounts(cells)[digit] >= 9) return false

  cell.value = digit
  cell.pencils = []

  const row = Math.floor(index / 9)
  const column = index % 9
  const boxRow = Math.floor(row / 3)
  const boxColumn = Math.floor(column / 3)
  cells.forEach((otherCell, otherIndex) => {
    const otherRow = Math.floor(otherIndex / 9)
    const otherColumn = otherIndex % 9
    const sharesRow = otherRow === row
    const sharesColumn = otherColumn === column
    const sharesBox = Math.floor(otherRow / 3) === boxRow
      && Math.floor(otherColumn / 3) === boxColumn
    if (otherIndex !== index && (sharesRow || sharesColumn || sharesBox)) {
      otherCell.pencils = otherCell.pencils.filter((pencil) => pencil !== digit)
    }
  })

  return true
}

export function togglePencil(cells: CellState[], index: number, digit: Digit): boolean {
  const cell = cells[index]
  if (cell.given || cell.value !== null || getDigitCounts(cells)[digit] >= 9) return false
  cell.pencils = cell.pencils.includes(digit)
    ? cell.pencils.filter((pencil) => pencil !== digit)
    : [...cell.pencils, digit].sort((left, right) => left - right)
  return true
}

export function eraseCell(cells: CellState[], index: number): boolean {
  const cell = cells[index]
  if (cell.given || (cell.value === null && cell.pencils.length === 0)) return false
  cell.value = null
  cell.pencils = []
  return true
}

export function cellContainsDigit(cell: CellState, digit: Digit): boolean {
  return cell.value === digit || cell.pencils.includes(digit)
}

export function isPeer(leftIndex: number, rightIndex: number): boolean {
  if (leftIndex === rightIndex) return false
  const leftRow = Math.floor(leftIndex / 9)
  const leftColumn = leftIndex % 9
  const rightRow = Math.floor(rightIndex / 9)
  const rightColumn = rightIndex % 9
  return leftRow === rightRow || leftColumn === rightColumn
    || (Math.floor(leftRow / 3) === Math.floor(rightRow / 3)
      && Math.floor(leftColumn / 3) === Math.floor(rightColumn / 3))
}
