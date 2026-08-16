<script lang="ts">
  import { onMount } from 'svelte'
  import puzzleBankData from 'virtual:puzzle-bank'
  import {
    DIFFICULTIES, DIFFICULTY_GUIDES, DIGITS, cellContainsDigit, choosePuzzle, cloneCells, createCells,
    createPlayerProgress, eraseCell, getConflictingIndexes, getDigitCounts, getLevelProgress,
    getScore, getToolTransition, isPeer, isSolved, parsePlayerProgress, parsePuzzle,
    parsePuzzleBank, placeNumber, recordCompletion, togglePencil,
    type CellState, type CompletionUpdate, type Difficulty, type Digit, type InputMode,
    type LevelProgress, type PlayerProgress, type PuzzleRecord,
  } from './lib/sudoku'

  const SAVE_KEY = 'sudoku-desk-game'
  const PROGRESS_KEY = 'sudoku-desk-progress'
  const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    easy: 'Easy',
    medium: 'Medium',
    challenging: 'Challenging',
    hard: 'Hard',
    'very-hard': 'Very Hard',
  }
  const puzzleBank = parsePuzzleBank(puzzleBankData)
  const initialPuzzle = puzzleBank.puzzles.find((puzzle) => puzzle.difficulty === 'easy')
    ?? puzzleBank.puzzles[0]!

  interface SavedGame {
    version: 2
    puzzleId: string | null
    difficulty: Difficulty | null
    puzzleText: string
    cells: CellState[]
    history: CellState[][]
    elapsedSeconds: number
  }

  interface LegacySavedGame extends Omit<SavedGame, 'version' | 'puzzleId' | 'difficulty'> {
    version: 1
  }

  let puzzleText = $state(initialPuzzle.puzzle)
  let currentPuzzleId = $state<string | null>(initialPuzzle.id)
  let currentDifficulty = $state<Difficulty | null>(initialPuzzle.difficulty)
  let cells = $state(createCells(parsePuzzle(initialPuzzle.puzzle)))
  let selectedIndex = $state<number | null>(null)
  let selectedDigit = $state<Digit | null>(null)
  let inputMode = $state<InputMode>('number')
  let error = $state('')
  let notice = $state('Easy puzzle ready. Select a square to begin.')
  let paused = $state(false)
  let elapsedSeconds = $state(0)
  let loaderOpen = $state(false)
  let newGameOpen = $state(false)
  let helpOpen = $state(false)
  let helpDifficulty = $state<Difficulty>(initialPuzzle.difficulty)
  let history = $state<CellState[][]>([])
  let storageReady = $state(false)
  let saveEnabled = $state(false)
  let playerProgress = $state<PlayerProgress>(createPlayerProgress())
  let completionRecorded = $state(false)
  let completionUpdate = $state<CompletionUpdate | null>(null)
  let startingCount = $derived(cells.filter((cell) => cell.given).length)
  let solvedCount = $derived(cells.filter((cell) => cell.value !== null).length)
  let digitCounts = $derived(getDigitCounts(cells))
  let conflictingIndexes = $derived(getConflictingIndexes(cells))
  let solved = $derived(isSolved(cells))
  let totalScore = $derived(getScore(playerProgress))
  let progressByLevel = $derived(Object.fromEntries(
    DIFFICULTIES.map((difficulty) => [difficulty, getLevelProgress(playerProgress, difficulty)]),
  ) as Record<Difficulty, LevelProgress>)
  let canErase = $derived(selectedIndex !== null
    && !cells[selectedIndex].given
    && (cells[selectedIndex].value !== null || cells[selectedIndex].pencils.length > 0))

  onMount(() => {
    try {
      const rawProgress = localStorage.getItem(PROGRESS_KEY)
      playerProgress = rawProgress
        ? parsePlayerProgress(JSON.parse(rawProgress))
        : createPlayerProgress()
    } catch {
      localStorage.removeItem(PROGRESS_KEY)
      playerProgress = createPlayerProgress()
    }

    let restoredGame = false
    try {
      const rawSave = localStorage.getItem(SAVE_KEY)
      const saved = rawSave ? JSON.parse(rawSave) as SavedGame | LegacySavedGame : null
      if ((saved?.version === 1 || saved?.version === 2)
        && saved.cells?.length === 81 && !isSolved(saved.cells)) {
        puzzleText = saved.puzzleText
        cells = cloneCells(saved.cells)
        history = Array.isArray(saved.history) ? saved.history.map(cloneCells) : []
        elapsedSeconds = Math.max(0, saved.elapsedSeconds || 0)
        if (saved.version === 2) {
          const storedPuzzle = puzzleBank.puzzles.find((puzzle) => puzzle.id === saved.puzzleId)
          currentPuzzleId = storedPuzzle?.id ?? null
          currentDifficulty = storedPuzzle?.difficulty ?? null
        } else {
          currentPuzzleId = null
          currentDifficulty = null
        }
        selectedIndex = null
        selectedDigit = null
        paused = true
        saveEnabled = true
        restoredGame = true
        notice = 'Saved game restored.'
      }
    } catch {
      localStorage.removeItem(SAVE_KEY)
    }
    if (!restoredGame) {
      const nextPuzzle = choosePuzzle(
        puzzleBank.puzzles, 'easy', new Set(Object.keys(playerProgress.puzzles)), null,
      )
      if (nextPuzzle) setBankPuzzle(nextPuzzle, 'Easy puzzle ready. Select a square to begin.', false)
    }
    storageReady = true
  })

  $effect(() => {
    if (!storageReady) return
    if (solved || !saveEnabled) {
      localStorage.removeItem(SAVE_KEY)
      return
    }

    const savedGame: SavedGame = {
      version: 2,
      puzzleId: currentPuzzleId,
      difficulty: currentDifficulty,
      puzzleText,
      cells: cloneCells(cells),
      history: history.map(cloneCells),
      elapsedSeconds,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(savedGame))
  })

  $effect(() => {
    if (!storageReady) return
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(playerProgress))
  })

  $effect(() => {
    if (!storageReady || !solved || completionRecorded) return
    completionRecorded = true
    if (currentPuzzleId === null || currentDifficulty === null) return
    completionUpdate = recordCompletion(
      playerProgress, currentPuzzleId, currentDifficulty, elapsedSeconds,
    )
    playerProgress = completionUpdate.progress
  })

  $effect(() => {
    if (paused || solved || newGameOpen || helpOpen) return
    const timer = setInterval(() => elapsedSeconds += 1, 1000)
    return () => clearInterval(timer)
  })

  function recordMove() {
    history = [...history.slice(-199), cloneCells(cells)]
    saveEnabled = true
  }

  function setBankPuzzle(puzzle: PuzzleRecord, message: string, persist: boolean) {
    puzzleText = puzzle.puzzle
    currentPuzzleId = puzzle.id
    currentDifficulty = puzzle.difficulty
    cells = createCells(parsePuzzle(puzzle.puzzle))
    history = []
    selectedIndex = null
    selectedDigit = null
    inputMode = 'number'
    elapsedSeconds = 0
    paused = false
    newGameOpen = false
    helpOpen = false
    saveEnabled = persist
    completionRecorded = false
    completionUpdate = null
    error = ''
    notice = message
  }

  function loadPuzzle() {
    try {
      cells = createCells(parsePuzzle(puzzleText))
      currentPuzzleId = null
      currentDifficulty = null
      selectedIndex = null
      selectedDigit = null
      inputMode = 'number'
      history = []
      paused = false
      elapsedSeconds = 0
      loaderOpen = false
      saveEnabled = true
      completionRecorded = false
      completionUpdate = null
      error = ''
      notice = 'Puzzle loaded. Select a square to begin.'
    } catch (caught) {
      error = caught instanceof Error ? caught.message : 'Could not read that puzzle.'
    }
  }

  function applyTool(index: number) {
    if (selectedDigit === null) return
    const digit = selectedDigit
    const cell = cells[index]
    if (cell.given) {
      notice = 'Starting numbers cannot be changed.'
      return
    }
    if (digitCounts[digit] >= 9) {
      selectedDigit = null
      selectedIndex = null
      notice = `All nine ${digit}s are already placed. Erase one to use ${digit} again.`
      return
    }
    if (inputMode === 'pencil') {
      if (cell.value !== null) {
        notice = 'Erase the large number before adding pencil marks.'
        return
      }
      recordMove()
      togglePencil(cells, index, digit)
      notice = `Pencil ${digit} updated. The pencil tool stays active.`
      return
    }
    if (cell.value !== null) {
      notice = cell.value === digit
        ? `Large ${digit} is already in this square.`
        : 'Erase the large number before replacing it.'
      return
    }
    recordMove()
    placeNumber(cells, index, digit)
    if (getDigitCounts(cells)[digit] >= 9) {
      selectedDigit = null
      selectedIndex = null
      notice = `All nine ${digit}s are placed. The ${digit} tools are now unavailable.`
      return
    }
    notice = `Large ${digit} entered. Select another square to repeat it.`
  }

  function selectCell(index: number) {
    selectedIndex = index
    if (selectedDigit !== null) applyTool(index)
    else notice = `Row ${Math.floor(index / 9) + 1}, column ${(index % 9) + 1} selected.`
  }

  function chooseDigit(digit: Digit, mode: InputMode) {
    if (digitCounts[digit] >= 9) {
      notice = `All nine ${digit}s are already placed. Erase one to use ${digit} again.`
      return
    }
    const transition = getToolTransition(selectedDigit, inputMode, digit, mode)
    if (transition === 'unchanged') {
      selectedDigit = null
      notice = `${mode === 'number' ? 'Large' : 'Pencil'} ${digit} deselected.`
      return
    }

    selectedDigit = digit
    inputMode = mode
    if (transition === 'initial' && selectedIndex !== null) {
      applyTool(selectedIndex)
      return
    }

    selectedIndex = null
    notice = `${mode === 'number' ? 'Large' : 'Pencil'} ${digit} is active. Select a square.`
  }

  function switchMode() {
    const nextMode = inputMode === 'number' ? 'pencil' : 'number'
    if (selectedDigit !== null) {
      chooseDigit(selectedDigit, nextMode)
      return
    }

    inputMode = nextMode
    selectedIndex = null
    notice = `${inputMode === 'number' ? 'Large number' : 'Pencil'} mode selected. Select a square.`
  }

  function eraseSelected() {
    if (selectedIndex === null) {
      notice = 'Select a square to erase.'
      return
    }
    if (cells[selectedIndex].given) {
      notice = 'Starting numbers cannot be erased.'
      return
    }
    if (!canErase) {
      notice = 'That square is already empty.'
      return
    }
    recordMove()
    notice = eraseCell(cells, selectedIndex)
      ? 'Square erased. Your active tool is unchanged.'
      : 'That square is already empty.'
  }

  function undoMove() {
    const previousCells = history.at(-1)
    if (!previousCells) {
      notice = 'There is nothing to undo.'
      return
    }

    cells = cloneCells(previousCells)
    history = history.slice(0, -1)
    saveEnabled = true
    notice = 'Last move undone. Your active tool is unchanged.'
  }

  function restartPuzzle() {
    if (!window.confirm('Restart this puzzle and clear all of your entries?')) return
    cells = createCells(parsePuzzle(puzzleText))
    history = []
    selectedIndex = null
    selectedDigit = null
    inputMode = 'number'
    elapsedSeconds = 0
    paused = false
    saveEnabled = true
    completionRecorded = false
    completionUpdate = null
    notice = 'Puzzle restarted.'
  }

  function openNewGame() {
    selectedIndex = null
    selectedDigit = null
    loaderOpen = false
    helpOpen = false
    newGameOpen = true
  }

  function openHelp() {
    selectedIndex = null
    loaderOpen = false
    newGameOpen = false
    helpDifficulty = currentDifficulty ?? 'easy'
    helpOpen = true
  }

  function startNewGame(difficulty: Difficulty) {
    const matching = puzzleBank.puzzles.filter((puzzle) => puzzle.difficulty === difficulty)
    const completedIds = new Set(Object.keys(playerProgress.puzzles))
    const nextPuzzle = choosePuzzle(
      puzzleBank.puzzles, difficulty, completedIds, currentPuzzleId,
    )
    if (!nextPuzzle) {
      notice = `No ${DIFFICULTY_LABELS[difficulty]} puzzles are available.`
      newGameOpen = false
      return
    }

    if (saveEnabled && !solved
      && !window.confirm(`Start a new ${DIFFICULTY_LABELS[difficulty]} puzzle? Your unfinished progress on this puzzle will be lost.`)) {
      return
    }

    const completedAtLevel = progressByLevel[difficulty].completed
    const message = completedAtLevel >= matching.length
      ? `All ${DIFFICULTY_LABELS[difficulty]} puzzles completed. Starting a replay.`
      : `${DIFFICULTY_LABELS[difficulty]} puzzle started.`
    setBankPuzzle(nextPuzzle, message, true)
  }

  function resetProgress() {
    if (!window.confirm('Reset all completion scores and best times? Your current game will remain open.')) {
      return
    }
    playerProgress = createPlayerProgress()
    completionUpdate = null
    notice = 'Completion score and best times reset. Current puzzle unchanged.'
  }

  function unselectCell() {
    selectedIndex = null
    notice = selectedDigit === null
      ? 'No square is selected.'
      : `${inputMode === 'number' ? 'Large' : 'Pencil'} ${selectedDigit} remains active.`
  }

  function cellLabel(cell: CellState, index: number, conflicting: boolean) {
    const location = `Row ${Math.floor(index / 9) + 1}, column ${(index % 9) + 1}`
    if (cell.value !== null) {
      const status = cell.given ? ', starting number' : ''
      return `${location}: ${cell.value}${status}${conflicting ? ', conflict' : ''}`
    }
    if (cell.pencils.length) return `${location}: pencil marks ${cell.pencils.join(', ')}`
    return `${location}: empty`
  }

  function togglePause() {
    if (solved) return
    paused = !paused
    selectedIndex = null
    loaderOpen = false
    newGameOpen = false
    helpOpen = false
    notice = paused ? 'Puzzle paused.' : 'Puzzle resumed. Select a square to continue.'
  }

  function formatTime(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    return hours > 0 ? `${hours}:${clock}` : clock
  }
</script>

<svelte:head>
  <title>Sudoku Desk</title>
  <meta name="description" content="A fast, pencil-friendly Sudoku game with five difficulty levels." />
</svelte:head>

<main class="app-shell">
  <header class="masthead">
    <div>
      <p class="eyebrow">
        {currentDifficulty ? `${DIFFICULTY_LABELS[currentDifficulty]} puzzle` : 'Custom puzzle'}
      </p>
      <h1>Sudoku Desk</h1>
    </div>
    <div class="session-status">
      <div class="score-total" aria-label={`Completion score ${totalScore}`}>
        <span>Score</span><strong>{totalScore}</strong>
      </div>
      <div class="timer" aria-label={`Elapsed time ${formatTime(elapsedSeconds)}`}>
        <span>Time</span><strong>{formatTime(elapsedSeconds)}</strong>
      </div>
      <button class="pause-button" type="button" disabled={solved} onclick={togglePause}>
        {paused ? 'Resume' : 'Pause'}
      </button>
      <div class="progress" aria-label={`${solvedCount} of 81 squares filled`}>
        <strong>{solvedCount}</strong><span>/ 81 filled</span>
      </div>
    </div>
  </header>

  {#if !paused}
    <details class="puzzle-loader" bind:open={loaderOpen}>
      <summary><span>Paste a puzzle</span><small>{startingCount} starting numbers</small></summary>
      <div class="loader-body">
        <div>
          <label for="puzzle-input">Generator output</label>
          <p>Paste nine rows containing digits and dots. Spaces and blank lines are fine.</p>
        </div>
        <textarea id="puzzle-input" bind:value={puzzleText} spellcheck="false"></textarea>
        <button class="load-button" type="button" onclick={loadPuzzle}>Load puzzle</button>
      </div>
      {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    </details>
  {/if}

  {#if paused}
    <section class="paused-panel" aria-label="Puzzle paused">
      <p class="paused-label">Timer stopped</p>
      <h2>Paused</h2>
      <button type="button" onclick={togglePause}>Resume puzzle</button>
    </section>
  {:else}
    <section class="game-layout" aria-label="Sudoku game">
    <div class="board-column">
      {#if solved}
        <div class="complete-banner" role="status">
          <strong>
            Solved{currentDifficulty ? ` — ${DIFFICULTY_LABELS[currentDifficulty]}` : ''}
            in {formatTime(elapsedSeconds)}.
          </strong>
          {#if completionUpdate?.firstCompletion}
            <span>+{completionUpdate.pointsAwarded} {completionUpdate.pointsAwarded === 1 ? 'point' : 'points'}</span>
          {:else if completionUpdate?.personalBest}
            <span>New personal best</span>
          {:else if currentPuzzleId}
            <span>Replay complete</span>
          {/if}
        </div>
      {:else if solvedCount === 81}
        <div class="conflict-banner" role="status">Not solved — resolve the red conflicts.</div>
      {/if}
      <div class="sudoku-board" role="grid" aria-label="Sudoku puzzle">
        {#each cells as cell, index}
          <button
            class="cell"
            class:selected={selectedIndex === index}
            class:peer={selectedIndex !== null && isPeer(selectedIndex, index)}
            class:digit-match={selectedDigit !== null && cellContainsDigit(cell, selectedDigit)}
            class:box-right={index % 9 === 2 || index % 9 === 5}
            class:box-bottom={Math.floor(index / 9) === 2 || Math.floor(index / 9) === 5}
            class:given={cell.given}
            class:conflict={conflictingIndexes.has(index)}
            type="button" role="gridcell"
            aria-label={cellLabel(cell, index, conflictingIndexes.has(index))}
            aria-selected={selectedIndex === index} onclick={() => selectCell(index)}
          >
            {#if cell.value !== null}
              <span class="large-value">{cell.value}</span>
            {:else}
              <span class="pencil-grid" aria-hidden="true">
                {#each DIGITS as digit}
                  <span class:matching-pencil={selectedDigit === digit}>
                    {cell.pencils.includes(digit) ? digit : ''}
                  </span>
                {/each}
              </span>
            {/if}
          </button>
        {/each}
      </div>
      <p class="board-note">Starting numbers are dark. Your entries are blue; conflicts are red.</p>
    </div>

    <aside class="control-panel" aria-label="Number controls">
      <div class="active-tool">
        <span>Active tool</span>
        <strong>{selectedDigit === null
          ? 'None'
          : `${inputMode === 'number' ? 'Large' : 'Pencil'} ${selectedDigit}`}</strong>
      </div>

      <div class="pad-sections">
        <section class="number-pad" aria-labelledby="numbers-label">
          <div class="pad-heading"><h2 id="numbers-label">Large numbers</h2><span>Answer</span></div>
          <div class="key-grid">
            {#each DIGITS as digit}
              <button class="number-key" class:active={selectedDigit === digit && inputMode === 'number'}
                type="button" aria-label={`Enter large ${digit}`}
                aria-pressed={selectedDigit === digit && inputMode === 'number'}
                disabled={digitCounts[digit] >= 9}
                onclick={() => chooseDigit(digit, 'number')}>{digit}</button>
            {/each}
          </div>
        </section>

        <section class="pencil-pad" aria-labelledby="pencils-label">
          <div class="pad-heading"><h2 id="pencils-label">Pencil numbers</h2><span>Maybe</span></div>
          <div class="key-grid pencil-keys">
            {#each DIGITS as digit}
              <button class="pencil-key" class:active={selectedDigit === digit && inputMode === 'pencil'}
                type="button" aria-label={`Toggle pencil ${digit}`}
                aria-pressed={selectedDigit === digit && inputMode === 'pencil'}
                disabled={digitCounts[digit] >= 9}
                onclick={() => chooseDigit(digit, 'pencil')}>{digit}</button>
            {/each}
          </div>
        </section>
      </div>

      <div class="control-actions">
        <button class="control-button" type="button" disabled={history.length === 0} onclick={undoMove}>
          Undo
        </button>
        <button class="control-button erase-button" type="button" disabled={!canErase} onclick={eraseSelected}>
          Erase
        </button>
        <button class="control-button mode-switch" type="button" disabled={selectedDigit === null} onclick={switchMode}>
          <span>Switch input</span>
          <strong>{inputMode === 'number' ? 'Large → Pencil' : 'Pencil → Large'}</strong>
        </button>
        <button class="control-button" type="button" disabled={selectedIndex === null} onclick={unselectCell}>
          Unselect
        </button>
      </div>

      <div class="restart-actions">
        <button class="restart-button" type="button" onclick={restartPuzzle}>Restart</button>
        <button class="new-button" type="button" onclick={openNewGame}>New</button>
        <button class="help-button" type="button" onclick={openHelp}>Help</button>
      </div>
      <p class="notice" aria-live="polite">{notice}</p>
    </aside>
    </section>
  {/if}

  {#if helpOpen}
    <div class="dialog-backdrop">
      <dialog class="level-dialog help-dialog" open aria-labelledby="help-title">
        <p class="dialog-label">How to solve</p>
        <h2 id="help-title">Difficulty guide</h2>
        <p>These are the methods HoDoKu may use when rating a puzzle, not a hint for the current grid.</p>
        <div class="guide-levels" aria-label="Choose a difficulty guide">
          {#each DIFFICULTIES as difficulty}
            <button type="button"
              class:active={helpDifficulty === difficulty}
              aria-pressed={helpDifficulty === difficulty}
              onclick={() => helpDifficulty = difficulty}>
              {DIFFICULTY_LABELS[difficulty]}
            </button>
          {/each}
        </div>
        <section class="guide-content" aria-live="polite">
          <h3>{DIFFICULTY_LABELS[helpDifficulty]}</h3>
          <p>{DIFFICULTY_GUIDES[helpDifficulty].summary}</p>
          <h4>Methods to know</h4>
          <ul>
            {#each DIFFICULTY_GUIDES[helpDifficulty].methods as method}
              <li>{method}</li>
            {/each}
          </ul>
        </section>
        <div class="dialog-actions guide-actions">
          <span>No next move or solution is shown.</span>
          <button class="cancel-new" type="button" onclick={() => helpOpen = false}>Close</button>
        </div>
      </dialog>
    </div>
  {/if}

  {#if newGameOpen}
    <div class="dialog-backdrop">
      <dialog class="level-dialog" open aria-labelledby="new-game-title">
        <p class="dialog-label">New puzzle</p>
        <h2 id="new-game-title">Choose a level</h2>
        <p>Uncompleted puzzles are selected first. Only solved games count towards your score.</p>
        <div class="level-options">
          {#each DIFFICULTIES as difficulty}
            <button type="button" onclick={() => startNewGame(difficulty)}>
              <span class="level-name">
                <strong>{DIFFICULTY_LABELS[difficulty]}</strong>
                <small>{progressByLevel[difficulty].completed} / {puzzleBank.counts[difficulty]} completed</small>
              </span>
              <span class="level-score">
                <strong>{progressByLevel[difficulty].score} pts</strong>
                <small>
                  {progressByLevel[difficulty].completed >= puzzleBank.counts[difficulty]
                    ? 'Replay'
                    : progressByLevel[difficulty].bestSeconds === null
                      ? 'No time yet'
                      : `Best ${formatTime(progressByLevel[difficulty].bestSeconds)}`}
                </small>
              </span>
            </button>
          {/each}
        </div>
        <div class="dialog-actions">
          <button class="reset-progress" type="button" disabled={totalScore === 0} onclick={resetProgress}>
            Reset progress
          </button>
          <button class="cancel-new" type="button" onclick={() => newGameOpen = false}>Cancel</button>
        </div>
      </dialog>
    </div>
  {/if}

  <footer>
    <span>Fast entry, fewer taps.</span>
    <span>{saveEnabled && storageReady && !solved ? 'Progress saved locally.' : 'Your puzzle stays in this browser.'}</span>
  </footer>
</main>
