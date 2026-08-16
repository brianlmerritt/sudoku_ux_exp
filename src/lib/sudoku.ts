export const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const
export const DIFFICULTIES = ['easy', 'medium', 'challenging', 'hard', 'very-hard'] as const

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
  version: 2
  puzzles: Record<string, PuzzleCompletion>
  history: Record<Difficulty, LevelHistory>
}

export interface LevelHistory {
  games: number
  totalSeconds: number
  bestSeconds: number | null
  slowestSeconds: number | null
}

export interface CompletionUpdate {
  progress: PlayerProgress
  firstCompletion: boolean
  personalBest: boolean
}

export interface LevelProgress {
  completed: number
  games: number
  bestSeconds: number | null
  averageSeconds: number | null
  slowestSeconds: number | null
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
  return { version: 2, puzzles: {}, history: createEmptyHistory() }
}

export function parsePlayerProgress(input: unknown): PlayerProgress {
  if (!input || typeof input !== 'object') throw new Error('Player progress must be an object.')
  const raw = input as {
    version?: unknown
    puzzles?: unknown
    history?: unknown
  }
  const puzzles = parsePuzzleCompletions(raw.puzzles)
  if (raw.version === 1) {
    const history = createEmptyHistory()
    Object.values(puzzles).forEach((completion) => {
      const level = history[completion.difficulty]
      level.games += 1
      level.totalSeconds += completion.firstSeconds
      level.bestSeconds = level.bestSeconds === null
        ? completion.bestSeconds
        : Math.min(level.bestSeconds, completion.bestSeconds)
      level.slowestSeconds = level.slowestSeconds === null
        ? completion.firstSeconds
        : Math.max(level.slowestSeconds, completion.firstSeconds)
    })
    return { version: 2, puzzles, history }
  }
  if (raw.version !== 2 || !raw.history || typeof raw.history !== 'object') {
    throw new Error('Player progress must use version 1 or 2.')
  }

  const rawHistory = raw.history as Partial<Record<Difficulty, unknown>>
  const history = createEmptyHistory()
  for (const difficulty of DIFFICULTIES) {
    const level = rawHistory[difficulty] as Partial<LevelHistory> | undefined
    const games = level?.games
    const totalSeconds = level?.totalSeconds
    const bestSeconds = level?.bestSeconds
    const slowestSeconds = level?.slowestSeconds
    if (typeof games !== 'number' || !Number.isInteger(games) || games < 0
      || typeof totalSeconds !== 'number'
      || !Number.isInteger(totalSeconds) || totalSeconds < 0) {
      throw new Error(`Player history for ${difficulty} is invalid.`)
    }
    if (games === 0) {
      if (totalSeconds !== 0 || bestSeconds !== null || slowestSeconds !== null) {
        throw new Error(`Player history for ${difficulty} is invalid.`)
      }
    } else if (typeof bestSeconds !== 'number' || !Number.isInteger(bestSeconds)
      || bestSeconds < 0 || typeof slowestSeconds !== 'number'
      || !Number.isInteger(slowestSeconds) || slowestSeconds < 0
      || bestSeconds > slowestSeconds || totalSeconds < bestSeconds * games
      || totalSeconds > slowestSeconds * games) {
      throw new Error(`Player history for ${difficulty} is invalid.`)
    }
    history[difficulty] = {
      games,
      totalSeconds,
      bestSeconds: bestSeconds ?? null,
      slowestSeconds: slowestSeconds ?? null,
    }
  }
  return { version: 2, puzzles, history }
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
  const previousHistory = progress.history[difficulty]
  const levelHistory: LevelHistory = {
    games: previousHistory.games + 1,
    totalSeconds: previousHistory.totalSeconds + seconds,
    bestSeconds: previousHistory.bestSeconds === null
      ? seconds
      : Math.min(previousHistory.bestSeconds, seconds),
    slowestSeconds: previousHistory.slowestSeconds === null
      ? seconds
      : Math.max(previousHistory.slowestSeconds, seconds),
  }
  return {
    progress: {
      version: 2,
      puzzles: { ...progress.puzzles, [puzzleId]: completion },
      history: { ...progress.history, [difficulty]: levelHistory },
    },
    firstCompletion,
    personalBest,
  }
}

export function getTotalGames(progress: PlayerProgress): number {
  return DIFFICULTIES.reduce(
    (games, difficulty) => games + progress.history[difficulty].games,
    0,
  )
}

export function getLevelProgress(progress: PlayerProgress, difficulty: Difficulty): LevelProgress {
  const completions = Object.values(progress.puzzles)
    .filter((completion) => completion.difficulty === difficulty)
  const history = progress.history[difficulty]
  return {
    completed: completions.length,
    games: history.games,
    bestSeconds: history.bestSeconds,
    averageSeconds: history.games === 0
      ? null
      : Math.round(history.totalSeconds / history.games),
    slowestSeconds: history.slowestSeconds,
  }
}

function createEmptyHistory(): Record<Difficulty, LevelHistory> {
  return Object.fromEntries(DIFFICULTIES.map((difficulty) => [difficulty, {
    games: 0,
    totalSeconds: 0,
    bestSeconds: null,
    slowestSeconds: null,
  }])) as Record<Difficulty, LevelHistory>
}

function parsePuzzleCompletions(input: unknown): Record<string, PuzzleCompletion> {
  if (!input || typeof input !== 'object') {
    throw new Error('Player progress must include completed puzzles.')
  }
  const puzzles: Record<string, PuzzleCompletion> = {}
  for (const [puzzleId, value] of Object.entries(input)) {
    const completion = value as Partial<PuzzleCompletion> | null
    if (!completion || !DIFFICULTIES.includes(completion.difficulty!)
      || !Number.isInteger(completion.firstSeconds) || completion.firstSeconds! < 0
      || !Number.isInteger(completion.bestSeconds) || completion.bestSeconds! < 0
      || completion.bestSeconds! > completion.firstSeconds!) {
      throw new Error(`Player progress for ${puzzleId} is invalid.`)
    }
    puzzles[puzzleId] = {
      difficulty: completion.difficulty!,
      firstSeconds: completion.firstSeconds!,
      bestSeconds: completion.bestSeconds!,
    }
  }
  return puzzles
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
