<script lang="ts">
  import { onMount } from 'svelte'
  import puzzleBankData from 'virtual:puzzle-bank'
  import ControlIcon from './lib/ControlIcon.svelte'
  import {
    DIFFICULTIES, DIFFICULTY_GUIDES, DIGITS, cellContainsDigit, choosePuzzle, cloneCells, createCells,
    createPlayerProgress, eraseCell, getConflictingIndexes, getDigitCounts, getLevelProgress,
    getToolTransition, getTotalGames, isPeer, isSolved, parsePlayerProgress, parsePuzzle,
    parsePuzzleBank, placeNumber, recordCompletion, togglePencil,
    type CellState, type CompletionUpdate, type Difficulty, type Digit, type InputMode,
    type LevelProgress, type PlayerProgress, type PuzzleRecord,
  } from './lib/sudoku'

  const SAVE_KEY = 'sudoku-desk-game'
  const PROGRESS_KEY = 'sudoku-desk-progress'
  const LAYOUT_KEY = 'sudoku-coocoo-layout'
  const DIFFICULTY_LABELS: Record<Difficulty, string> = {
    easy: 'Easy',
    medium: 'Medium',
    challenging: 'Challenging',
    hard: 'Hard',
    'very-hard': 'Very Hard',
  }
  const puzzleBank = parsePuzzleBank(puzzleBankData)

  interface SavedGame {
    version: 2
    puzzleId: string | null
    difficulty: Difficulty | null
    puzzleText: string
    cells: CellState[]
    history: CellState[][]
    redoHistory?: CellState[][]
    elapsedSeconds: number
  }

  interface LegacySavedGame extends Omit<SavedGame, 'version' | 'puzzleId' | 'difficulty'> {
    version: 1
  }

  let puzzleText = $state('')
  let currentPuzzleId = $state<string | null>(null)
  let currentDifficulty = $state<Difficulty | null>(null)
  let cells = $state(createCells(Array.from({ length: 81 }, () => null)))
  let gameStarted = $state(false)
  let selectedIndex = $state<number | null>(null)
  let selectedDigit = $state<Digit | null>(null)
  let inputMode = $state<InputMode>('number')
  let mobileLayout = $state(false)
  let completionOpen = $state(false)
  let completionDialog = $state<HTMLDialogElement>()
  let error = $state('')
  let notice = $state('Choose a level or paste a puzzle to begin.')
  let paused = $state(false)
  let elapsedSeconds = $state(0)
  let loaderOpen = $state(false)
  let newGameOpen = $state(false)
  let helpOpen = $state(false)
  let historyOpen = $state(false)
  let helpDifficulty = $state<Difficulty>('easy')
  let history = $state<CellState[][]>([])
  let redoHistory = $state<CellState[][]>([])
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
  let totalGames = $derived(getTotalGames(playerProgress))
  let progressByLevel = $derived(Object.fromEntries(
    DIFFICULTIES.map((difficulty) => [difficulty, getLevelProgress(playerProgress, difficulty)]),
  ) as Record<Difficulty, LevelProgress>)
  let canErase = $derived(selectedIndex !== null
    && !cells[selectedIndex].given
    && (cells[selectedIndex].value !== null || cells[selectedIndex].pencils.length > 0))

  onMount(() => {
    mobileLayout = window.matchMedia('(max-width: 560px)').matches
    try {
      const savedLayout = localStorage.getItem(LAYOUT_KEY)
      if (savedLayout === 'mobile' || savedLayout === 'desktop' || savedLayout === 'normal') {
        mobileLayout = savedLayout === 'mobile'
      }
    } catch { /* Use the screen-size default when preferences are unavailable. */ }
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
        redoHistory = Array.isArray(saved.redoHistory) ? saved.redoHistory.map(cloneCells) : []
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
        gameStarted = true
        notice = 'Saved game restored.'
      }
    } catch {
      localStorage.removeItem(SAVE_KEY)
    }
    if (!restoredGame) newGameOpen = true
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
      redoHistory: redoHistory.map(cloneCells),
      elapsedSeconds,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(savedGame))
  })

  $effect(() => {
    if (!storageReady) return
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(playerProgress))
  })

  $effect(() => {
    if (!storageReady) return
    localStorage.setItem(LAYOUT_KEY, mobileLayout ? 'mobile' : 'desktop')
  })

  $effect(() => {
    if (completionOpen) completionDialog?.showModal()
    else completionDialog?.close()
  })

  $effect(() => {
    if (!storageReady || !solved || completionRecorded) return
    completionRecorded = true
    completionOpen = true
    if (currentPuzzleId === null || currentDifficulty === null) return
    completionUpdate = recordCompletion(
      playerProgress, currentPuzzleId, currentDifficulty, elapsedSeconds,
    )
    playerProgress = completionUpdate.progress
  })

  $effect(() => {
    if (!gameStarted || paused || solved || newGameOpen || helpOpen || historyOpen || (mobileLayout && loaderOpen)) return
    const timer = setInterval(() => elapsedSeconds += 1, 1000)
    return () => clearInterval(timer)
  })

  function recordMove() {
    history = [...history.slice(-199), cloneCells(cells)]
    redoHistory = []
    saveEnabled = true
  }

  function setBankPuzzle(puzzle: PuzzleRecord, message: string, persist: boolean) {
    gameStarted = true
    puzzleText = puzzle.puzzle
    currentPuzzleId = puzzle.id
    currentDifficulty = puzzle.difficulty
    cells = createCells(parsePuzzle(puzzle.puzzle))
    history = []
    redoHistory = []
    completionOpen = false
    selectedIndex = null
    selectedDigit = null
    inputMode = 'number'
    elapsedSeconds = 0
    paused = false
    newGameOpen = false
    helpOpen = false
    historyOpen = false
    saveEnabled = persist
    completionRecorded = false
    completionUpdate = null
    error = ''
    notice = message
  }

  function loadPuzzle() {
    try {
      cells = createCells(parsePuzzle(puzzleText))
      gameStarted = true
      currentPuzzleId = null
      currentDifficulty = null
      selectedIndex = null
      selectedDigit = null
      inputMode = 'number'
      history = []
      redoHistory = []
      completionOpen = false
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
        notice = 'Erase the number before adding pencil marks.'
        return
      }
      recordMove()
      togglePencil(cells, index, digit)
      notice = `Pencil ${digit} updated. The pencil tool stays active.`
      return
    }
    if (cell.value !== null) {
      notice = cell.value === digit
        ? `Number ${digit} is already in this square.`
        : 'Erase the number before replacing it.'
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
    notice = `Number ${digit} entered. Select another square to repeat it.`
  }

  function selectCell(index: number) {
    if (solved) return
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
    if (transition === 'unchanged') return

    selectedDigit = digit
    inputMode = mode
    if (transition === 'initial' && selectedIndex !== null) {
      applyTool(selectedIndex)
      return
    }

    selectedIndex = null
    notice = `${mode === 'number' ? 'Number' : 'Pencil'} ${digit} is active. Select a square.`
  }

  function chooseMobileDigit(digit: Digit) {
    chooseDigit(digit, selectedDigit === digit
      ? inputMode === 'number' ? 'pencil' : 'number'
      : inputMode)
  }

  function setLayout(mobile: boolean) {
    mobileLayout = mobile
    notice = `${mobile ? 'Mobile' : 'Desktop'} controls selected.`
  }

  function switchMode() {
    const nextMode = inputMode === 'number' ? 'pencil' : 'number'
    if (selectedDigit !== null) {
      chooseDigit(selectedDigit, nextMode)
      return
    }

    inputMode = nextMode
    selectedIndex = null
    notice = `${inputMode === 'number' ? 'Number' : 'Pencil'} mode selected. Select a square.`
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
    if (solved) return
    const previousCells = history.at(-1)
    if (!previousCells) {
      notice = 'There is nothing to undo.'
      return
    }

    redoHistory = [...redoHistory, cloneCells(cells)]
    cells = cloneCells(previousCells)
    history = history.slice(0, -1)
    saveEnabled = true
    notice = 'Last move undone. Your active tool is unchanged.'
  }

  function redoMove() {
    if (solved) return
    const nextCells = redoHistory.at(-1)
    if (!nextCells) return
    history = [...history.slice(-199), cloneCells(cells)]
    cells = cloneCells(nextCells)
    redoHistory = redoHistory.slice(0, -1)
    saveEnabled = true
    notice = 'Last move restored. Your active tool is unchanged.'
  }

  function restartPuzzle() {
    if (!window.confirm('Restart this puzzle and clear all of your entries?')) return
    cells = createCells(parsePuzzle(puzzleText))
    history = []
    redoHistory = []
    completionOpen = false
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
    completionOpen = false
    selectedIndex = null
    selectedDigit = null
    loaderOpen = false
    helpOpen = false
    historyOpen = false
    newGameOpen = true
  }

  function openHelp() {
    selectedIndex = null
    loaderOpen = false
    newGameOpen = false
    historyOpen = false
    helpDifficulty = currentDifficulty ?? 'easy'
    helpOpen = true
  }

  function openHistory() {
    selectedIndex = null
    loaderOpen = false
    newGameOpen = false
    helpOpen = false
    historyOpen = true
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

  function resetHistory() {
    if (!window.confirm('Reset all puzzle history? Every puzzle will be marked unplayed. Your current game will remain open.')) {
      return
    }
    playerProgress = createPlayerProgress()
    completionUpdate = null
    notice = 'Puzzle history reset. Current puzzle unchanged.'
  }

  function unselectCell() {
    selectedIndex = null
    notice = selectedDigit === null
      ? 'No square is selected.'
      : `${inputMode === 'number' ? 'Number' : 'Pencil'} ${selectedDigit} remains active.`
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
    if (!gameStarted || solved) return
    paused = !paused
    selectedIndex = null
    loaderOpen = false
    newGameOpen = false
    helpOpen = false
    historyOpen = false
    notice = paused ? 'Puzzle paused.' : 'Puzzle resumed. Select a square to continue.'
  }

  function formatTime(totalSeconds: number) {
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const clock = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    return hours > 0 ? `${hours}:${clock}` : clock
  }

  function formatHistoryTime(totalSeconds: number | null) {
    return totalSeconds === null ? '—' : formatTime(totalSeconds)
  }
</script>

<svelte:head>
  <title>Sudoku CooCoo</title>
  <meta name="description" content="A fast, pencil-friendly Sudoku game with five difficulty levels." />
</svelte:head>

{#snippet layoutSwitch()}
  <div class="layout-switch" role="group" aria-label="Control layout">
    <button type="button" class:active={mobileLayout} aria-pressed={mobileLayout}
      onclick={() => setLayout(true)}>Mobile</button>
    <button type="button" class:active={!mobileLayout} aria-pressed={!mobileLayout}
      onclick={() => setLayout(false)}>Desktop</button>
  </div>
{/snippet}

{#snippet puzzleForm()}
  <div class="loader-body">
    <div>
      <label for="puzzle-input">Generator output</label>
      <p>Paste 81 digits or nine rows. Zeroes or dots mark empty squares.</p>
    </div>
    <textarea id="puzzle-input" bind:value={puzzleText} spellcheck="false"></textarea>
    <button class="load-button" type="button" onclick={loadPuzzle}>Load puzzle</button>
  </div>
  {#if error}<p class="form-error" role="alert">{error}</p>{/if}
{/snippet}

<main class="app-shell" class:mobile-layout={mobileLayout}>
  <header class="masthead">
    <div>
      <p class="eyebrow">
        {currentDifficulty ? `${DIFFICULTY_LABELS[currentDifficulty]} puzzle` : gameStarted ? 'Custom puzzle' : 'Choose a puzzle'}
      </p>
      <h1>Sudoku CooCoo</h1>
    </div>
    <div class="session-status">
      {#if mobileLayout}
        <button class="paste-button" type="button" disabled={paused} onclick={() => loaderOpen = true}>Paste</button>
      {/if}
      <button class="history-button" type="button" aria-label={`Open history: ${totalGames} solved`}
        onclick={openHistory}>
        <span>History</span><strong>{totalGames} solved</strong>
      </button>
      <div class="timer" aria-label={`Elapsed time ${formatTime(elapsedSeconds)}`}>
        <span>Time</span><strong>{formatTime(elapsedSeconds)}</strong>
      </div>
      <button class="pause-button" type="button" disabled={!gameStarted || solved} onclick={togglePause}>
        {paused ? 'Resume' : 'Pause'}
      </button>
      <div class="progress" aria-label={`${solvedCount} of 81 squares filled`}>
        <strong>{solvedCount}</strong><span>/ 81 filled</span>
      </div>
    </div>
  </header>

  {#if !paused && !mobileLayout}
    <details class="puzzle-loader" bind:open={loaderOpen}>
      <summary><span>Paste a puzzle</span><small>{startingCount} starting numbers</small></summary>
      {@render puzzleForm()}
    </details>
  {/if}

  {#if !gameStarted}
    <section class="paused-panel" aria-label="Choose a puzzle">
      <h2>Choose a puzzle</h2>
      <button type="button" onclick={openNewGame}>Choose a level</button>
    </section>
  {:else if paused}
    <section class="paused-panel" aria-label="Puzzle paused">
      <p class="paused-label">Timer stopped</p>
      <h2>Paused</h2>
      <button type="button" onclick={togglePause}>Resume puzzle</button>
    </section>
  {:else}
    <section class="game-layout" aria-label="Sudoku game">
    <div class="board-column">
      {#if !solved && solvedCount === 81}
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
      {#if mobileLayout}
        <div class="mobile-keypad">
          <div class="key-grid mobile-digits" role="group" aria-label="Numbers">
            {#each DIGITS as digit}
              <button class="number-key" class:active={selectedDigit === digit}
                class:pencil-digit={inputMode === 'pencil'}
                type="button" aria-label={`Select ${inputMode === 'number' ? 'number' : 'pencil'} ${digit}`}
                aria-pressed={selectedDigit === digit} disabled={digitCounts[digit] >= 9}
                onclick={() => chooseMobileDigit(digit)}>{digit}</button>
            {/each}
          </div>
          <button class="vertical-mode" type="button" aria-label="Pencil mode"
            aria-pressed={inputMode === 'pencil'} title="Switch Number / Pencil"
            onclick={switchMode}>
            <span class:active={inputMode === 'number'}><b>1</b><small>Number</small></span>
            <span class:active={inputMode === 'pencil'}><b class="pencil-symbol">1</b><small>Pencil</small></span>
          </button>
          <div class="mobile-tools">
            <button class="control-button icon-button" type="button" aria-label="Undo" title="Undo"
              disabled={solved || history.length === 0} onclick={undoMove}><ControlIcon name="undo" /></button>
            <button class="control-button icon-button" type="button" aria-label="Redo" title="Redo"
              disabled={solved || redoHistory.length === 0} onclick={redoMove}><ControlIcon name="redo" /></button>
            <button class="control-button icon-button" type="button" aria-label="Unselect square" title="Unselect square"
              disabled={selectedIndex === null} onclick={unselectCell}><ControlIcon name="unselect" /></button>
            <button class="control-button icon-button erase-button" type="button" aria-label="Erase" title="Erase"
              disabled={solved || !canErase} onclick={eraseSelected}><ControlIcon name="erase" /></button>
            {@render layoutSwitch()}
          </div>
        </div>
      {:else}
      <div class="active-tool">
        <span>Active tool</span>
        <strong>{selectedDigit === null
          ? 'None'
          : `${inputMode === 'number' ? 'Number' : 'Pencil'} ${selectedDigit}`}</strong>
      </div>

      <div class="pad-sections">
        <section class="number-pad" aria-labelledby="numbers-label">
          <div class="pad-heading"><h2 id="numbers-label">Numbers</h2><span>Answer</span></div>
          <div class="key-grid">
            {#each DIGITS as digit}
              <button class="number-key" class:active={selectedDigit === digit && inputMode === 'number'}
                type="button" aria-label={`Enter number ${digit}`}
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
        <button class="control-button" type="button" disabled={solved || history.length === 0} onclick={undoMove}>
          Undo
        </button>
        <button class="control-button" type="button" disabled={solved || redoHistory.length === 0} onclick={redoMove}>
          Redo
        </button>
        <button class="control-button erase-button" type="button" disabled={!canErase} onclick={eraseSelected}>
          Erase
        </button>
        <button class="control-button mode-switch" class:pencil-active={inputMode === 'pencil'} type="button"
          aria-label="Pencil mode" aria-pressed={inputMode === 'pencil'} onclick={switchMode}>
          <span>Input mode</span>
          <strong>{inputMode === 'number' ? 'Number' : 'Pencil'}</strong>
        </button>
        <button class="control-button" type="button" disabled={selectedIndex === null} onclick={unselectCell}>
          Unselect
        </button>
        {@render layoutSwitch()}
      </div>
      {/if}

      <div class="restart-actions">
        <button class="restart-button" type="button" onclick={restartPuzzle}>Restart</button>
        <button class="new-button" type="button" onclick={openNewGame}>New</button>
        <button class="help-button" type="button" onclick={openHelp}>Help</button>
      </div>
      <p class="notice" aria-live="polite">{notice}</p>
    </aside>
    </section>
  {/if}

  <dialog class="level-dialog completion-dialog" bind:this={completionDialog}
    aria-labelledby="completion-title" onclose={() => completionOpen = false}>
    <p class="dialog-label">Puzzle complete</p>
    <h2 id="completion-title">Solved!</h2>
    <p>{currentDifficulty ? `${DIFFICULTY_LABELS[currentDifficulty]} — ` : ''}{formatTime(elapsedSeconds)}</p>
    {#if completionUpdate?.firstCompletion}
      <p>Game added to History.</p>
    {:else if completionUpdate?.personalBest}
      <p>Replay added to History — new best time.</p>
    {:else if completionUpdate}
      <p>Replay added to History.</p>
    {/if}
    <div class="dialog-actions">
      <button class="cancel-new" type="button" onclick={() => completionOpen = false}>Close</button>
      <button class="load-button" type="button" onclick={openNewGame}>New puzzle</button>
    </div>
  </dialog>

  {#if mobileLayout && loaderOpen && !paused}
    <div class="dialog-backdrop">
      <dialog class="level-dialog paste-dialog" open aria-labelledby="paste-title">
        <h2 id="paste-title">Paste a puzzle</h2>
        {@render puzzleForm()}
        <div class="dialog-actions">
          <button class="cancel-new" type="button" onclick={() => loaderOpen = false}>Cancel</button>
        </div>
      </dialog>
    </div>
  {/if}

  {#if historyOpen}
    <div class="dialog-backdrop">
      <dialog class="level-dialog history-dialog" open aria-labelledby="history-title">
        <p class="dialog-label">Your solving record</p>
        <h2 id="history-title">History</h2>
        <p>Completed games are counted, including replays and games completed after a restart. Unfinished games are excluded.</p>
        <div class="history-table-wrap">
          <table class="history-table">
            <thead>
              <tr>
                <th scope="col">Level</th>
                <th scope="col">Solved</th>
                <th scope="col">Best</th>
                <th scope="col">Average</th>
                <th scope="col">Slowest</th>
              </tr>
            </thead>
            <tbody>
              {#each DIFFICULTIES as difficulty}
                <tr>
                  <th scope="row">{DIFFICULTY_LABELS[difficulty]}</th>
                  <td>{progressByLevel[difficulty].games}</td>
                  <td>{formatHistoryTime(progressByLevel[difficulty].bestSeconds)}</td>
                  <td>{formatHistoryTime(progressByLevel[difficulty].averageSeconds)}</td>
                  <td>{formatHistoryTime(progressByLevel[difficulty].slowestSeconds)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
        <div class="dialog-actions">
          <button class="reset-history" type="button" disabled={totalGames === 0} onclick={resetHistory}>
            Reset History
          </button>
          <button class="cancel-new" type="button" onclick={() => historyOpen = false}>Close</button>
        </div>
      </dialog>
    </div>
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
        <p>Uncompleted puzzles are selected first. Clean solves are added to History.</p>
        <div class="level-options">
          {#each DIFFICULTIES as difficulty}
            <button type="button" onclick={() => startNewGame(difficulty)}>
              <span class="level-name">
                <strong>{DIFFICULTY_LABELS[difficulty]}</strong>
                <small>{progressByLevel[difficulty].completed} / {puzzleBank.counts[difficulty]} completed</small>
              </span>
              <span class="level-history">
                <strong>{progressByLevel[difficulty].games} solved</strong>
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
        <div class="dialog-actions new-dialog-actions">
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
