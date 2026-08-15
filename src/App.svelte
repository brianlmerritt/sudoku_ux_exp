<script lang="ts">
  import { onMount } from 'svelte'
  import {
    DIGITS, cellContainsDigit, cloneCells, createCells, eraseCell, getConflictingIndexes, getDigitCounts,
    getToolTransition, isPeer, isSolved, parsePuzzle, placeNumber, togglePencil,
    type CellState, type Digit, type InputMode,
  } from './lib/sudoku'

  const SAVE_KEY = 'sudoku-desk-game'

  interface SavedGame {
    version: 1
    puzzleText: string
    cells: CellState[]
    history: CellState[][]
    elapsedSeconds: number
  }

  const STARTER_PUZZLE = `5 3 .  . 7 .  . . .
6 . .  1 9 5  . . .
. 9 8  . . .  . 6 .

8 . .  . 6 .  . . 3
4 . .  8 . 3  . . 1
7 . .  . 2 .  . . 6

. 6 .  . . .  2 8 .
. . .  4 1 9  . . 5
. . .  . 8 .  . 7 9`

  let puzzleText = $state(STARTER_PUZZLE)
  let cells = $state(createCells(parsePuzzle(STARTER_PUZZLE)))
  let selectedIndex = $state<number | null>(null)
  let selectedDigit = $state<Digit | null>(null)
  let inputMode = $state<InputMode>('number')
  let error = $state('')
  let notice = $state('Select a square, then choose a large number or pencil mark.')
  let paused = $state(false)
  let elapsedSeconds = $state(0)
  let loaderOpen = $state(false)
  let history = $state<CellState[][]>([])
  let storageReady = $state(false)
  let saveEnabled = $state(false)
  let startingCount = $derived(cells.filter((cell) => cell.given).length)
  let solvedCount = $derived(cells.filter((cell) => cell.value !== null).length)
  let digitCounts = $derived(getDigitCounts(cells))
  let conflictingIndexes = $derived(getConflictingIndexes(cells))
  let solved = $derived(isSolved(cells))
  let canErase = $derived(selectedIndex !== null
    && !cells[selectedIndex].given
    && (cells[selectedIndex].value !== null || cells[selectedIndex].pencils.length > 0))

  onMount(() => {
    try {
      const rawSave = localStorage.getItem(SAVE_KEY)
      const saved = rawSave ? JSON.parse(rawSave) as SavedGame : null
      if (saved?.version === 1 && saved.cells?.length === 81 && !isSolved(saved.cells)) {
        puzzleText = saved.puzzleText
        cells = cloneCells(saved.cells)
        history = Array.isArray(saved.history) ? saved.history.map(cloneCells) : []
        elapsedSeconds = Math.max(0, saved.elapsedSeconds || 0)
        selectedIndex = null
        selectedDigit = null
        paused = true
        saveEnabled = true
        notice = 'Saved game restored.'
      }
    } catch {
      localStorage.removeItem(SAVE_KEY)
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
      version: 1,
      puzzleText,
      cells: cloneCells(cells),
      history: history.map(cloneCells),
      elapsedSeconds,
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(savedGame))
  })

  $effect(() => {
    if (paused || solved) return
    const timer = setInterval(() => elapsedSeconds += 1, 1000)
    return () => clearInterval(timer)
  })

  function recordMove() {
    history = [...history.slice(-199), cloneCells(cells)]
    saveEnabled = true
  }

  function loadPuzzle() {
    try {
      cells = createCells(parsePuzzle(puzzleText))
      selectedIndex = null
      selectedDigit = null
      inputMode = 'number'
      history = []
      paused = false
      elapsedSeconds = 0
      loaderOpen = false
      saveEnabled = true
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
    notice = 'Puzzle restarted.'
  }

  function unselectCell() {
    selectedIndex = null
    notice = selectedDigit === null
      ? 'No square is selected.'
      : `${inputMode === 'number' ? 'Large' : 'Pencil'} ${selectedDigit} remains active.`
  }

  function cellLabel(index: number) {
    const cell = cells[index]
    const location = `Row ${Math.floor(index / 9) + 1}, column ${(index % 9) + 1}`
    if (cell.value !== null) {
      const status = cell.given ? ', starting number' : ''
      return `${location}: ${cell.value}${status}${conflictingIndexes.has(index) ? ', conflict' : ''}`
    }
    if (cell.pencils.length) return `${location}: pencil marks ${cell.pencils.join(', ')}`
    return `${location}: empty`
  }

  function togglePause() {
    if (solved) return
    paused = !paused
    selectedIndex = null
    loaderOpen = false
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
  <meta name="description" content="A fast, pencil-friendly Sudoku board for pasted text puzzles." />
</svelte:head>

<main class="app-shell">
  <header class="masthead">
    <div><p class="eyebrow">A quiet place to solve</p><h1>Sudoku Desk</h1></div>
    <div class="session-status">
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
        <div class="complete-banner" role="status">Solved in {formatTime(elapsedSeconds)}.</div>
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
            type="button" role="gridcell" aria-label={cellLabel(index)}
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
      </div>
      <p class="notice" aria-live="polite">{notice}</p>
    </aside>
    </section>
  {/if}

  <footer>
    <span>Fast entry, fewer taps.</span>
    <span>{saveEnabled && storageReady && !solved ? 'Progress saved locally.' : 'Your puzzle stays in this browser.'}</span>
  </footer>
</main>
