import { describe, expect, it } from 'vitest'
import {
  DIFFICULTIES, DIFFICULTY_GUIDES, cellContainsDigit, choosePuzzle, cloneCells, createCells, createPlayerProgress,
  eraseCell, getConflictingIndexes, getDigitCounts, getLevelProgress, getTotalGames,
  getToolTransition, isPeer, isSolved, parsePlayerProgress, parsePuzzle, parsePuzzleBank,
  placeNumber, recordCompletion, togglePencil, type PuzzleRecord,
} from './sudoku'

const PUZZLE = `5 3 .  . 7 .  . . .
6 . .  1 9 5  . . .
. 9 8  . . .  . 6 .

8 . .  . 6 .  . . 3
4 . .  8 . 3  . . 1
7 . .  . 2 .  . . 6

. 6 .  . . .  2 8 .
. . .  4 1 9  . . 5
. . .  . 8 .  . 7 9`

const SOLUTION = `534678912
672195348
198342567
859761423
426853791
713924856
961537284
287419635
345286179`

describe('parsePuzzle', () => {
  it('reads generator text', () => {
    const values = parsePuzzle(PUZZLE)
    expect(values).toHaveLength(81)
    expect(values.slice(0, 9)).toEqual([5, 3, null, null, 7, null, null, null, null])
  })

  it('rejects incomplete input', () => {
    expect(() => parsePuzzle('1 2 3')).toThrow(/81 cells/)
  })

  it('reads a compact zero-filled bank puzzle', () => {
    const values = parsePuzzle(`53${'0'.repeat(79)}`)
    expect(values).toHaveLength(81)
    expect(values.slice(0, 4)).toEqual([5, 3, null, null])
  })
})

describe('parsePuzzleBank', () => {
  const puzzle = `53${'0'.repeat(79)}`
  const record = {
    id: 'easy-example', difficulty: 'easy' as const, puzzle,
    solution: SOLUTION.replace(/\s/g, ''), hodokuLevel: 'Easy', score: 400,
  }

  it('checks the bank schema and difficulty counts', () => {
    const counts = Object.fromEntries(DIFFICULTIES.map((level) => [level, level === 'easy' ? 1 : 0]))
    expect(parsePuzzleBank({ schemaVersion: 1, counts, puzzles: [record] }).puzzles).toEqual([record])
  })

  it('rejects duplicate puzzle records', () => {
    const counts = Object.fromEntries(DIFFICULTIES.map((level) => [level, level === 'easy' ? 2 : 0]))
    expect(() => parsePuzzleBank({ schemaVersion: 1, counts, puzzles: [record, record] }))
      .toThrow(/duplicate id/)
  })
})

describe('local history and progress', () => {
  it('starts with no completed games', () => {
    const progress = createPlayerProgress()
    expect(getTotalGames(progress)).toBe(0)
    expect(getLevelProgress(progress, 'medium')).toEqual({
      completed: 0, games: 0, bestSeconds: null,
      averageSeconds: null, slowestSeconds: null,
    })
  })

  it('counts a clean replay and calculates level times', () => {
    const first = recordCompletion(createPlayerProgress(), 'medium-1', 'medium', 900)
    expect(first).toMatchObject({ firstCompletion: true, personalBest: true })
    expect(getTotalGames(first.progress)).toBe(1)

    const replay = recordCompletion(first.progress, 'medium-1', 'medium', 720)
    expect(replay).toMatchObject({ firstCompletion: false, personalBest: true })
    expect(replay.progress.puzzles['medium-1']).toEqual({
      difficulty: 'medium', firstSeconds: 900, bestSeconds: 720,
    })
    expect(getLevelProgress(replay.progress, 'medium')).toEqual({
      completed: 1,
      games: 2,
      bestSeconds: 720,
      averageSeconds: 810,
      slowestSeconds: 900,
    })
    expect(parsePlayerProgress(replay.progress)).toEqual(replay.progress)
  })

  it('migrates the previous completion format into history', () => {
    const migrated = parsePlayerProgress({
      version: 1,
      puzzles: {
        'medium-1': { difficulty: 'medium', firstSeconds: 900, bestSeconds: 720 },
        'medium-2': { difficulty: 'medium', firstSeconds: 840, bestSeconds: 840 },
      },
    })
    expect(migrated.version).toBe(2)
    expect(getLevelProgress(migrated, 'medium')).toEqual({
      completed: 2,
      games: 2,
      bestSeconds: 720,
      averageSeconds: 870,
      slowestSeconds: 900,
    })
  })

  it('chooses unplayed puzzles before allowing replays', () => {
    const puzzles = ['one', 'two', 'three'].map((id) => ({
      id, difficulty: 'easy', puzzle: '0'.repeat(81), solution: '1'.repeat(81),
      hodokuLevel: 'Easy', score: 100,
    })) satisfies PuzzleRecord[]
    expect(choosePuzzle(puzzles, 'easy', new Set(['one']), 'two', () => 0)?.id).toBe('three')
    expect(choosePuzzle(puzzles, 'easy', new Set(['one', 'two', 'three']), 'two', () => 0)?.id)
      .toBe('one')
  })
})

describe('difficulty guides', () => {
  it('covers every player-facing level', () => {
    expect(Object.keys(DIFFICULTY_GUIDES)).toEqual(DIFFICULTIES)
    expect(DIFFICULTY_GUIDES.easy.methods).toContain('Hidden single')
  })

  it('reflects the score splits within HoDoKu levels', () => {
    expect(DIFFICULTY_GUIDES.challenging.methods).toEqual(DIFFICULTY_GUIDES.medium.methods)
    expect(DIFFICULTY_GUIDES['very-hard'].methods).toEqual(DIFFICULTY_GUIDES.hard.methods)
    expect(DIFFICULTY_GUIDES.challenging.summary).toContain('above 800')
    expect(DIFFICULTY_GUIDES['very-hard'].summary).toContain('above 1300')
  })
})

describe('cell editing', () => {
  it('creates independent snapshots for undo', () => {
    const cells = createCells(parsePuzzle(PUZZLE))
    togglePencil(cells, 2, 4)
    const snapshot = cloneCells(cells)

    placeNumber(cells, 2, 8)
    expect(snapshot[2]).toMatchObject({ value: null, pencils: [4] })
    expect(cells[2]).toMatchObject({ value: 8, pencils: [] })
  })

  it('keeps starting numbers immutable', () => {
    const cells = createCells(parsePuzzle(PUZZLE))
    expect(placeNumber(cells, 0, 2)).toBe(false)
    expect(togglePencil(cells, 0, 2)).toBe(false)
    expect(eraseCell(cells, 0)).toBe(false)
    expect(cells[0].value).toBe(5)
  })

  it('requires erase before changing a large number', () => {
    const cells = createCells(parsePuzzle(PUZZLE))
    expect(placeNumber(cells, 2, 3)).toBe(true)
    expect(placeNumber(cells, 2, 4)).toBe(false)
    expect(togglePencil(cells, 2, 2)).toBe(false)
    expect(eraseCell(cells, 2)).toBe(true)
    expect(togglePencil(cells, 2, 2)).toBe(true)
  })

  it('toggles pencils and clears them for a large number', () => {
    const cells = createCells(parsePuzzle(PUZZLE))
    togglePencil(cells, 2, 5)
    togglePencil(cells, 2, 2)
    togglePencil(cells, 3, 8) // Same row.
    togglePencil(cells, 29, 8) // Same column.
    togglePencil(cells, 10, 8) // Same box.
    togglePencil(cells, 40, 8) // Unrelated square.
    expect(cells[2].pencils).toEqual([2, 5])
    expect(cellContainsDigit(cells[2], 5)).toBe(true)

    placeNumber(cells, 2, 8)

    expect(cells[2]).toMatchObject({ value: 8, pencils: [] })
    expect(cells[3].pencils).not.toContain(8)
    expect(cells[29].pencils).not.toContain(8)
    expect(cells[10].pencils).not.toContain(8)
    expect(cells[40].pencils).toContain(8)
  })
})

describe('tool transitions', () => {
  it('distinguishes first selection, repeated selection, and tool changes', () => {
    expect(getToolTransition(null, 'number', 2, 'number')).toBe('initial')
    expect(getToolTransition(2, 'number', 2, 'number')).toBe('unchanged')
    expect(getToolTransition(2, 'number', 3, 'number')).toBe('changed')
    expect(getToolTransition(2, 'pencil', 2, 'number')).toBe('changed')
  })
})

describe('completion and conflicts', () => {
  it('only solves a complete, conflict-free grid', () => {
    const solvedCells = createCells(parsePuzzle(SOLUTION))
    expect(isSolved(solvedCells)).toBe(true)

    solvedCells[1].value = 5
    expect(isSolved(solvedCells)).toBe(false)
    expect(getConflictingIndexes(solvedCells)).toEqual(new Set([0, 1, 28]))
  })

  it('finds equal large numbers sharing a row, column, or box', () => {
    const cells = createCells(Array.from({ length: 81 }, () => null))
    cells[0].value = 1
    cells[8].value = 1
    cells[20].value = 1
    cells[72].value = 1
    expect(getConflictingIndexes(cells)).toEqual(new Set([0, 8, 20, 72]))
  })

  it('blocks a digit after nine large instances until one is erased', () => {
    const cells = createCells(Array.from({ length: 81 }, () => null))
    for (let index = 0; index < 9; index += 1) cells[index].value = 4

    expect(getDigitCounts(cells)[4]).toBe(9)
    expect(placeNumber(cells, 9, 4)).toBe(false)
    expect(togglePencil(cells, 9, 4)).toBe(false)
    expect(eraseCell(cells, 0)).toBe(true)
    expect(placeNumber(cells, 9, 4)).toBe(true)
  })
})

it('recognises row, column, and box peers', () => {
  expect(isPeer(0, 8)).toBe(true)
  expect(isPeer(0, 72)).toBe(true)
  expect(isPeer(0, 20)).toBe(true)
  expect(isPeer(0, 40)).toBe(false)
})
