export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export const DIFFICULTIES = ['easy', 'medium', 'challenging', 'hard', 'very-hard'] as const
export const SCORE_BY_DIFFICULTY = {
  easy: 1,
  medium: 2,
  challenging: 3,
  hard: 4,
  'very-hard': 5,
} as const satisfies Record<Difficulty, number>

const MEDIUM_METHODS = [
  'Locked candidates (pointing and claiming)',
  'Locked pairs and triples',
  'Naked pairs and triples',
  'Hidden pairs and triples',
] as const

const HARD_METHODS = [
  'Naked and hidden quadruples',
  'X-Wing, Swordfish, and Jellyfish',
  'Remote Pair and BUG + 1',
  'Skyscraper and Two-String Kite',
  'W-Wing, XY-Wing, and XYZ-Wing',
  'Uniqueness Tests 1–6',
  'Finned and Sashimi X-Wing',
] as const

export const DIFFICULTY_GUIDES = {
  easy: {
    summary: 'Start with direct placements. Every puzzle can still use these methods at later levels.',
    methods: ['Full house', 'Naked single', 'Hidden single'],
  },
  medium: {
    summary: 'Includes the Easy methods and adds the following HoDoKu Medium methods.',
    methods: MEDIUM_METHODS,
  },
  challenging: {
    summary: 'Uses the same methods as Medium, but has a HoDoKu solve score above 800. Expect a longer path or eliminations that are harder to spot.',
    methods: MEDIUM_METHODS,
  },
  hard: {
    summary: 'Includes all earlier methods and adds the following HoDoKu Hard methods.',
    methods: HARD_METHODS,
  },
  'very-hard': {
    summary: 'Uses the same methods as Hard, but has a HoDoKu solve score above 1300. Expect more steps or more demanding combinations.',
    methods: HARD_METHODS,
  },
} as const satisfies Record<Difficulty, { summary: string, methods: readonly string[] }>

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

export interface PuzzleCompletion {
  difficulty: Difficulty
  firstSeconds: number
  bestSeconds: number
}

export interface PlayerProgress {
  version: 1
  puzzles: Record<string, PuzzleCompletion>
}

export interface CompletionUpdate {
  progress: PlayerProgress
  firstCompletion: boolean
  personalBest: boolean
  pointsAwarded: number
}

export interface LevelProgress {
  completed: number
  bestSeconds: number | null
  score: number
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

export function createPlayerProgress(): PlayerProgress {
  return { version: 1, puzzles: {} }
}

export function parsePlayerProgress(input: unknown): PlayerProgress {
  if (!input || typeof input !== 'object') throw new Error('Player progress must be an object.')
  const raw = input as Partial<PlayerProgress>
  if (raw.version !== 1 || !raw.puzzles || typeof raw.puzzles !== 'object') {
    throw new Error('Player progress must use version 1.')
  }

  const puzzles: Record<string, PuzzleCompletion> = {}
  for (const [puzzleId, completion] of Object.entries(raw.puzzles)) {
    if (!completion || !DIFFICULTIES.includes(completion.difficulty)
      || !Number.isInteger(completion.firstSeconds) || completion.firstSeconds < 0
      || !Number.isInteger(completion.bestSeconds) || completion.bestSeconds < 0
      || completion.bestSeconds > completion.firstSeconds) {
      throw new Error(`Player progress for ${puzzleId} is invalid.`)
    }
    puzzles[puzzleId] = { ...completion }
  }
  return { version: 1, puzzles }
}

export function recordCompletion(
  progress: PlayerProgress,
  puzzleId: string,
  difficulty: Difficulty,
  elapsedSeconds: number,
): CompletionUpdate {
  const seconds = Math.max(0, Math.floor(elapsedSeconds))
  const previous = progress.puzzles[puzzleId]
  const firstCompletion = previous === undefined
  const personalBest = firstCompletion || seconds < previous.bestSeconds
  const completion: PuzzleCompletion = previous
    ? { ...previous, bestSeconds: personalBest ? seconds : previous.bestSeconds }
    : { difficulty, firstSeconds: seconds, bestSeconds: seconds }
  return {
    progress: {
      version: 1,
      puzzles: { ...progress.puzzles, [puzzleId]: completion },
    },
    firstCompletion,
    personalBest,
    pointsAwarded: firstCompletion ? SCORE_BY_DIFFICULTY[difficulty] : 0,
  }
}

export function getScore(progress: PlayerProgress): number {
  return Object.values(progress.puzzles)
    .reduce((score, completion) => score + SCORE_BY_DIFFICULTY[completion.difficulty], 0)
}

export function getLevelProgress(progress: PlayerProgress, difficulty: Difficulty): LevelProgress {
  const completions = Object.values(progress.puzzles)
    .filter((completion) => completion.difficulty === difficulty)
  return {
    completed: completions.length,
    bestSeconds: completions.length > 0
      ? Math.min(...completions.map((completion) => completion.bestSeconds))
      : null,
    score: completions.length * SCORE_BY_DIFFICULTY[difficulty],
  }
}

export function choosePuzzle(
  puzzles: PuzzleRecord[],
  difficulty: Difficulty,
  completedIds: Set<string>,
  currentPuzzleId: string | null,
  random: () => number = Math.random,
): PuzzleRecord | null {
  const matching = puzzles.filter((puzzle) => puzzle.difficulty === difficulty)
  const unplayed = matching.filter((puzzle) =>
    !completedIds.has(puzzle.id) && puzzle.id !== currentPuzzleId)
  const replays = matching.filter((puzzle) => puzzle.id !== currentPuzzleId)
  const candidates = unplayed.length > 0 ? unplayed : replays.length > 0 ? replays : matching
  if (candidates.length === 0) return null
  const index = Math.min(candidates.length - 1, Math.floor(random() * candidates.length))
  return candidates[index]
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
