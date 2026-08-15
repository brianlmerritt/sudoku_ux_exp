export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const

export type Digit = (typeof DIGITS)[number]
export type InputMode = 'number' | 'pencil'
export type ToolTransition = 'initial' | 'unchanged' | 'changed'

export interface CellState {
  given: boolean
  value: Digit | null
  pencils: Digit[]
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
  const rows = input
    .split(/\r?\n/)
    .map((line) => line.replace(/\s/g, ''))
    .filter((line) => /^[1-9.]{9}$/.test(line))

  if (rows.length !== 9) {
    throw new Error('Expected exactly nine puzzle rows made from digits 1–9 and dots.')
  }

  return rows.flatMap((row) =>
    [...row].map((character) => character === '.' ? null : Number(character) as Digit),
  )
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
